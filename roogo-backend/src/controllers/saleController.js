const pool = require('../config/database');
const { cacheDelPattern } = require('../config/redis');

// ── Helpers ──────────────────────────────────────────────────────────────────

// Normalise le payload (multi-lignes du formulaire OU format legacy) en lignes internes
function normalizeLines(body) {
  if (Array.isArray(body.articles) && body.articles.length) {
    return body.articles.map((l) => ({
      id_article: l.articleId,
      quantity: l.quantite,
      price: Math.round(Number(l.prixUnitaire) * Number(l.quantite) * 100) / 100,
    }));
  }
  return [{
    id_article: body.id_article,
    quantity: body.quantity,
    price: Math.round(Number(body.price) * 100) / 100,
  }];
}

function parseDate(v) {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Vérifie le stock puis décrémente (appelé ligne par ligne dans la transaction)
async function checkAndDecrement(client, line, orgId) {
  const art = await client.query(
    'SELECT id, name_article, quantity FROM article WHERE id = $1 AND organization_id = $2 FOR UPDATE',
    [line.id_article, orgId]
  );
  if (!art.rows.length) throw new Error('Article non trouvé');
  const available = Number(art.rows[0].quantity);
  if (available < line.quantity) {
    throw new Error(`Stock insuffisant pour "${art.rows[0].name_article}". Disponible: ${available}`);
  }
  await client.query(
    'UPDATE article SET quantity = quantity - $1 WHERE id = $2',
    [line.quantity, line.id_article]
  );
}

async function emitSale(req, event, payload) {
  const io = req.app.get('io');
  if (io) io.to(`org:${req.organization?.slug || 'default'}`).emit(event, payload);
}

// ── GET /api/sales/:id ───────────────────────────────────────────────────────
exports.getSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT s.*, c.name as client_name, c.surname as client_surname,
             a.name_article, st.name as store_name
      FROM sale s
      LEFT JOIN client c ON s.id_client = c.id
      LEFT JOIN article a ON s.id_article = a.id
      LEFT JOIN store st ON s.store_id = st.id
      WHERE s.id = $1 AND s.organization_id = $2
    `, [id, req.organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Vente non trouvée' });
    }

    const row = result.rows[0];
    const groupId = row.group_id || row.id;

    // Toutes les lignes du reçu (formulaire multi-lignes)
    const lines = await pool.query(`
      SELECT s.id, s.id_article, s.quantity, s.price, a.name_article
      FROM sale s
      LEFT JOIN article a ON a.id = s.id_article
      WHERE s.group_id = $1 AND s.organization_id = $2
      ORDER BY s.id
    `, [groupId, req.organizationId]);

    res.json({
      success: true,
      data: {
        ...row,
        group_id: groupId,
        articles: lines.rows,
        montantTotal: lines.rows.reduce((sum, l) => sum + Number(l.price), 0),
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la vente' });
  }
};

// ── GET /api/sales ───────────────────────────────────────────────────────────
exports.getAllSales = async (req, res) => {
  try {
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    let query, params;

    if (storeId) {
      query = `
        SELECT s.*, c.name as client_name, c.surname as client_surname,
               a.name_article, st.name as store_name
        FROM sale s
        LEFT JOIN client c ON s.id_client = c.id
        LEFT JOIN article a ON s.id_article = a.id
        LEFT JOIN store st ON s.store_id = st.id
        WHERE s.organization_id = $1 AND s.store_id = $2
        ORDER BY s.date_sate DESC
      `;
      params = [req.organizationId, storeId];
    } else {
      query = `
        SELECT s.*, c.name as client_name, c.surname as client_surname,
               a.name_article, st.name as store_name
        FROM sale s
        LEFT JOIN client c ON s.id_client = c.id
        LEFT JOIN article a ON s.id_article = a.id
        LEFT JOIN store st ON s.store_id = st.id
        WHERE s.organization_id = $1
        ORDER BY s.date_sate DESC
      `;
      params = [req.organizationId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des ventes' });
  }
};

// ── POST /api/sales ──────────────────────────────────────────────────────────
exports.createSale = async (req, res) => {
  const client = await pool.connect();

  try {
    const lines = normalizeLines(req.body);
    const id_client = req.body.id_client ?? req.body.clientId ?? null;
    const store_id = req.user.store_id ?? null;
    const date = parseDate(req.body.dateVente);
    const orgId = req.organizationId;

    await client.query('BEGIN');

    let groupId = null;
    const inserted = [];

    for (const line of lines) {
      await checkAndDecrement(client, line, orgId);

      const saleResult = await client.query(
        `INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate, organization_id, group_id)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, CURRENT_TIMESTAMP), $7, $8)
         RETURNING *`,
        [line.id_article, id_client, store_id, line.quantity, line.price, date, orgId, groupId]
      );

      const row = saleResult.rows[0];

      // La première ligne porte l'id du reçu (group_id = son propre id)
      if (groupId === null) {
        groupId = row.id;
        await client.query('UPDATE sale SET group_id = $1 WHERE id = $1', [groupId]);
      }

      inserted.push(row);
    }

    await client.query('COMMIT');

    await cacheDelPattern('dashboard:*');

    await emitSale(req, 'sale-created', {
      id: inserted[0].id,
      group_id: groupId,
      client: id_client,
      lines: inserted.length,
      price: inserted.reduce((s, r) => s + Number(r.price), 0),
      date: inserted[0].date_sate,
    });

    res.status(201).json({
      success: true,
      message: 'Vente enregistrée avec succès',
      data: inserted[0],
      group_id: groupId,
      lines: inserted,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Erreur lors de l'enregistrement de la vente"
    });
  } finally {
    client.release();
  }
};

// ── PUT /api/sales/:id ───────────────────────────────────────────────────────
// Remplace l'ensemble des lignes du reçu (group_id) par le nouveau contenu.
exports.updateSale = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const orgId = req.organizationId;
    const lines = normalizeLines(req.body);
    const date = parseDate(req.body.dateVente);
    const hasClient = req.body.id_client !== undefined || req.body.clientId !== undefined;
    const id_client = req.body.id_client ?? req.body.clientId ?? null;

    await client.query('BEGIN');

    const head = await client.query(
      'SELECT * FROM sale WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [id, orgId]
    );
    if (!head.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vente non trouvée' });
    }

    const groupId = head.rows[0].group_id || head.rows[0].id;

    const oldRows = await client.query(
      'SELECT * FROM sale WHERE group_id = $1 AND organization_id = $2 ORDER BY id',
      [groupId, orgId]
    );

    // 1. Restaurer le stock de l'ancien contenu
    for (const row of oldRows.rows) {
      if (row.id_article) {
        await client.query(
          'UPDATE article SET quantity = quantity + $1 WHERE id = $2',
          [row.quantity, row.id_article]
        );
      }
    }

    // 2. Appliquer le nouveau contenu (vérifie + décrémente le stock)
    for (const line of lines) {
      await checkAndDecrement(client, line, orgId);
    }

    // 3. Réconcilier les lignes: mettre à jour celles qui existent, insérer le reste
    const oldList = oldRows.rows;
    const updated = [];

    for (let i = 0; i < oldList.length; i++) {
      if (i < lines.length) {
        const line = lines[i];
        const r = await client.query(
          `UPDATE sale SET id_article = $1, quantity = $2, price = $3,
             date_sate = COALESCE($4, date_sate),
             id_client = COALESCE($5, id_client)
           WHERE id = $6 RETURNING *`,
          [line.id_article, line.quantity, line.price, date, hasClient ? id_client : null, oldList[i].id]
        );
        updated.push(r.rows[0]);
      } else {
        await client.query('DELETE FROM sale WHERE id = $1', [oldList[i].id]);
      }
    }

    for (let i = oldList.length; i < lines.length; i++) {
      const line = lines[i];
      const r = await client.query(
        `INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate, organization_id, group_id)
         VALUES ($1, COALESCE($2, $3), $4, $5, $6, COALESCE($7, CURRENT_TIMESTAMP), $8, $9)
         RETURNING *`,
        [
          line.id_article,
          hasClient ? id_client : null,
          head.rows[0].id_client,
          head.rows[0].store_id,
          line.quantity,
          line.price,
          date,
          orgId,
          groupId,
        ]
      );
      updated.push(r.rows[0]);
    }

    await client.query('COMMIT');

    await cacheDelPattern('dashboard:*');

    await emitSale(req, 'sale-updated', { id: id, group_id: groupId, lines: updated.length });

    res.json({
      success: true,
      message: 'Vente modifiée avec succès',
      data: updated[0] || null,
      group_id: groupId,
      lines: updated,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la modification de la vente'
    });
  } finally {
    client.release();
  }
};

// ── DELETE /api/sales/:id ────────────────────────────────────────────────────
// Supprime le reçu complet et restaure le stock.
exports.deleteSale = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const orgId = req.organizationId;

    await client.query('BEGIN');

    const head = await client.query(
      'SELECT * FROM sale WHERE id = $1 AND organization_id = $2 FOR UPDATE',
      [id, orgId]
    );
    if (!head.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Vente non trouvée' });
    }

    const groupId = head.rows[0].group_id || head.rows[0].id;

    const oldRows = await client.query(
      'SELECT * FROM sale WHERE group_id = $1 AND organization_id = $2',
      [groupId, orgId]
    );

    const saleIds = oldRows.rows.map((r) => r.id);

    // 1. Restaurer le stock
    for (const row of oldRows.rows) {
      if (row.id_article) {
        await client.query(
          'UPDATE article SET quantity = quantity + $1 WHERE id = $2',
          [row.quantity, row.id_article]
        );
      }
    }

    // 2. Remettre les numéros de série en stock
    if (saleIds.length) {
      await client.query(
        `UPDATE serial_number SET sale_id = NULL, status = 'in_stock', sold_at = NULL
         WHERE sale_id = ANY($1)`,
        [saleIds]
      );
    }

    // 3. Supprimer les lignes du reçu
    await client.query('DELETE FROM sale WHERE group_id = $1 AND organization_id = $2', [groupId, orgId]);

    await client.query('COMMIT');

    await cacheDelPattern('dashboard:*');

    await emitSale(req, 'sale-deleted', { id: Number(id), group_id: groupId });

    res.json({ success: true, message: 'Vente annulée et stock restauré' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la suppression de la vente'
    });
  } finally {
    client.release();
  }
};
