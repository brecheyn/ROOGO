const pool = require('../config/database');

// ── LOTS ──────────────────────────────────────────────────────────────────────

// Créer un lot
exports.createLot = async (req, res) => {
  try {
    const { article_id, lot_number, quantity, manufacturing_date, expiration_date, supplier_id } = req.body;

    if (!article_id || !lot_number || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'article_id, lot_number et quantity requis' });
    }

    const result = await pool.query(`
      INSERT INTO product_lot (article_id, lot_number, quantity, manufacturing_date, expiration_date, supplier_id, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [article_id, lot_number, quantity, manufacturing_date || null, expiration_date || null, supplier_id || null, req.organizationId]);

    // Mettre à jour le stock de l'article
    await pool.query('UPDATE article SET quantity = quantity + $1 WHERE id = $2', [quantity, article_id]);

    // Log mouvement de stock
    await pool.query(`
      INSERT INTO stock_movement (article_id, lot_id, movement_type, quantity, reference_type, user_id, organization_id)
      VALUES ($1, $2, 'purchase', $3, 'lot', $4, $5)
    `, [article_id, result.rows[0].id, quantity, req.user?.id, req.organizationId]);

    res.status(201).json({
      success: true,
      message: 'Lot créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ce numéro de lot existe déjà pour cet article' });
    }
    console.error('Erreur createLot:', error);
    res.status(500).json({ success: false, message: 'Erreur création lot' });
  }
};

// Lister les lots d'un article
exports.getLotsByArticle = async (req, res) => {
  try {
    const { article_id } = req.params;

    const result = await pool.query(`
      SELECT pl.*,
        s.name AS supplier_name,
        CASE
          WHEN pl.expiration_date IS NULL THEN 'N/A'
          WHEN pl.expiration_date < CURRENT_DATE THEN 'EXPIRÉ'
          WHEN pl.expiration_date < CURRENT_DATE + INTERVAL '30 days' THEN 'BIENTÔT EXPIRÉ'
          ELSE 'ACTIF'
        END AS expiration_status
      FROM product_lot pl
      LEFT JOIN supplier s ON pl.supplier_id = s.id
      WHERE pl.article_id = $1
      ORDER BY
        CASE WHEN pl.expiration_date IS NULL THEN 1 ELSE 0 END,
        pl.expiration_date ASC
    `, [article_id]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur getLots:', error);
    res.status(500).json({ success: false, message: 'Erreur récupération lots' });
  }
};

// ── NUMÉROS DE SÉRIE ─────────────────────────────────────────────────────────

// Créer un numéro de série
exports.createSerialNumber = async (req, res) => {
  try {
    const { article_id, serial_number, lot_id } = req.body;

    if (!article_id || !serial_number) {
      return res.status(400).json({ success: false, message: 'article_id et serial_number requis' });
    }

    const result = await pool.query(`
      INSERT INTO serial_number (article_id, serial_number, lot_id, organization_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [article_id, serial_number, lot_id || null, req.organizationId]);

    res.status(201).json({
      success: true,
      message: 'Numéro de série créé',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ce numéro de série existe déjà' });
    }
    console.error('Erreur createSerial:', error);
    res.status(500).json({ success: false, message: 'Erreur création série' });
  }
};

// Lister les numéros de série d'un article
exports.getSerialNumbers = async (req, res) => {
  try {
    const { article_id } = req.params;
    const { status } = req.query;

    let query = `
      SELECT sn.*, pl.lot_number, a.name_article
      FROM serial_number sn
      JOIN article a ON sn.article_id = a.id
      LEFT JOIN product_lot pl ON sn.lot_id = pl.id
      WHERE sn.article_id = $1
    `;
    const params = [article_id];

    if (status) {
      query += ` AND sn.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY sn.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur getSerial:', error);
    res.status(500).json({ success: false, message: 'Erreur récupération séries' });
  }
};

// ── CONTRÔLE QUALITÉ ─────────────────────────────────────────────────────────

// Créer un contrôle qualité
exports.createQualityCheck = async (req, res) => {
  try {
    const { lot_id, quantity_received, quantity_accepted, quantity_rejected, notes } = req.body;

    if (!lot_id || quantity_received === undefined) {
      return res.status(400).json({ success: false, message: 'lot_id et quantity_received requis' });
    }

    const accepted = quantity_accepted || 0;
    const rejected = quantity_rejected || 0;
    let status = 'pending';

    if (accepted + rejected === quantity_received) {
      status = rejected === 0 ? 'approved' : accepted > 0 ? 'partial' : 'rejected';
    }

    const result = await pool.query(`
      INSERT INTO quality_check (lot_id, checked_by, quantity_received, quantity_accepted, quantity_rejected, notes, status, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [lot_id, req.user?.id, quantity_received, accepted, rejected, notes || null, status, req.organizationId]);

    // Si rejeté, mettre à jour le statut du lot
    if (status === 'rejected') {
      await pool.query('UPDATE product_lot SET status = $1 WHERE id = $2', ['recalled', lot_id]);
    }

    res.status(201).json({
      success: true,
      message: 'Contrôle qualité enregistré',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur qualityCheck:', error);
    res.status(500).json({ success: false, message: 'Erreur contrôle qualité' });
  }
};

// Lister les contrôles qualité
exports.getQualityChecks = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT qc.*, pl.lot_number, a.name_article, u.username AS checked_by_name
      FROM quality_check qc
      JOIN product_lot pl ON qc.lot_id = pl.id
      JOIN article a ON pl.article_id = a.id
      LEFT JOIN "user" u ON qc.checked_by = u.id
      ORDER BY qc.check_date DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur getQC:', error);
    res.status(500).json({ success: false, message: 'Erreur récupération contrôles' });
  }
};

// ── MOUVEMENTS DE STOCK (Traçabilité) ────────────────────────────────────────

// Historique des mouvements d'un article
exports.getStockMovements = async (req, res) => {
  try {
    const { article_id } = req.params;
    const { limit } = req.query;

    const result = await pool.query(`
      SELECT sm.*,
        a.name_article,
        pl.lot_number,
        u.username,
        fs.name AS from_store_name,
        ts.name AS to_store_name
      FROM stock_movement sm
      JOIN article a ON sm.article_id = a.id
      LEFT JOIN product_lot pl ON sm.lot_id = pl.id
      LEFT JOIN "user" u ON sm.user_id = u.id
      LEFT JOIN store fs ON sm.from_store_id = fs.id
      LEFT JOIN store ts ON sm.to_store_id = ts.id
      WHERE sm.article_id = $1
      ORDER BY sm.created_at DESC
      LIMIT $2
    `, [article_id, parseInt(limit) || 50]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur movements:', error);
    res.status(500).json({ success: false, message: 'Erreur mouvements stock' });
  }
};

// Traçabilité complète d'un produit (de la réception à la vente)
exports.getFullTraceability = async (req, res) => {
  try {
    const { article_id } = req.params;

    // Trouver les lots et leur historique
    const lots = await pool.query(`
      SELECT
        pl.*,
        s.name AS supplier_name,
        s.surname AS supplier_surname,
        qc.quantity_received,
        qc.quantity_accepted,
        qc.quantity_rejected,
        qc.status AS qc_status,
        qc.check_date
      FROM product_lot pl
      LEFT JOIN supplier s ON pl.supplier_id = s.id
      LEFT JOIN quality_check qc ON pl.id = qc.lot_id
      WHERE pl.article_id = $1
      ORDER BY pl.received_date DESC
    `, [article_id]);

    // Trouver les ventes liées à ces lots
    const sales = await pool.query(`
      SELECT
        sm.*,
        pl.lot_number,
        c.name AS client_name,
        c.surname AS client_surname,
        sl.date_sate
      FROM stock_movement sm
      LEFT JOIN product_lot pl ON sm.lot_id = pl.id
      LEFT JOIN sale sl ON sm.reference_id = sl.id AND sm.reference_type = 'sale'
      LEFT JOIN client c ON sl.id_client = c.id
      WHERE sm.article_id = $1 AND sm.movement_type = 'sale'
      ORDER BY sm.created_at DESC
    `, [article_id]);

    res.json({
      success: true,
      article_id: parseInt(article_id),
      lots: lots.rows,
      sales: sales.rows,
      summary: {
        total_lots: lots.rows.length,
        total_sold_movements: sales.rows.length,
        suppliers_involved: [...new Set(lots.rows.map(l => l.supplier_name).filter(Boolean))],
      }
    });
  } catch (error) {
    console.error('Erreur traceability:', error);
    res.status(500).json({ success: false, message: 'Erreur traçabilité' });
  }
};

// ── CATALOGUE FOURNISSEUR ────────────────────────────────────────────────────
exports.getSupplierCatalog = async (req, res) => {
  try {
    const { supplier_id } = req.params;

    const result = await pool.query(`
      SELECT sc.*, a.name_article, a.categorie
      FROM supplier_catalog sc
      LEFT JOIN article a ON sc.article_id = a.id
      WHERE sc.supplier_id = $1
      ORDER BY sc.product_name
    `, [supplier_id]);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur catalog:', error);
    res.status(500).json({ success: false, message: 'Erreur catalogue fournisseur' });
  }
};
