const pool = require('../config/database');

// ── Transfert inter-magasins ─────────────────────────────────────────────────
exports.createTransfer = async (req, res) => {
  const client = await pool.connect();

  try {
    const { from_store_id, to_store_id, article_id, quantity, lot_id, notes } = req.body;

    if (!from_store_id || !to_store_id || !article_id || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'from_store_id, to_store_id, article_id et quantity requis'
      });
    }

    if (from_store_id === to_store_id) {
      return res.status(400).json({ success: false, message: 'Les magasins source et destination doivent être différents' });
    }

    await client.query('BEGIN');

    // Vérifier le stock source
    const stockCheck = await client.query(
      'SELECT quantity FROM article WHERE id = $1',
      [article_id]
    );

    if (stockCheck.rows.length === 0) {
      throw new Error('Article non trouvé');
    }

    if (stockCheck.rows[0].quantity < quantity) {
      throw new Error(`Stock insuffisant. Disponible: ${stockCheck.rows[0].quantity}`);
    }

    // Décrémenter le stock source
    await client.query(
      'UPDATE article SET quantity = quantity - $1 WHERE id = $2',
      [quantity, article_id]
    );

    // Créer le mouvement sortant
    await client.query(`
      INSERT INTO stock_movement (article_id, lot_id, movement_type, quantity, from_store_id, to_store_id, reference_type, notes, user_id, organization_id)
      VALUES ($1, $2, 'transfer_out', $3, $4, $5, 'transfer', $6, $7, $8)
    `, [article_id, lot_id || null, quantity, from_store_id, to_store_id, notes || null, req.user?.id, req.organizationId]);

    // Créer le mouvement entrant
    await client.query(`
      INSERT INTO stock_movement (article_id, lot_id, movement_type, quantity, from_store_id, to_store_id, reference_type, notes, user_id, organization_id)
      VALUES ($1, $2, 'transfer_in', $3, $4, $5, 'transfer', $6, $7, $8)
    `, [article_id, lot_id || null, quantity, from_store_id, to_store_id, notes || null, req.user?.id, req.organizationId]);

    await client.query('COMMIT');

    // Socket.io notification
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organization?.slug || 'default'}`).emit('transfer-created', {
        from_store_id,
        to_store_id,
        article_id,
        quantity,
        by: req.user?.username,
      });
    }

    res.status(201).json({
      success: true,
      message: `Transfert de ${quantity} unités effectué`,
      data: { from_store_id, to_store_id, article_id, quantity }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur transfer:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur transfert' });
  } finally {
    client.release();
  }
};

// ── Historique des transferts ────────────────────────────────────────────────
exports.getTransfers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sm.*,
        a.name_article,
        fs.name AS from_store_name,
        ts.name AS to_store_name,
        u.username
      FROM stock_movement sm
      JOIN article a ON sm.article_id = a.id
      LEFT JOIN store fs ON sm.from_store_id = fs.id
      LEFT JOIN store ts ON sm.to_store_id = ts.id
      LEFT JOIN "user" u ON sm.user_id = u.id
      WHERE sm.movement_type IN ('transfer_in', 'transfer_out')
      ORDER BY sm.created_at DESC
      LIMIT 50
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur transfers:', error);
    res.status(500).json({ success: false, message: 'Erreur historique transferts' });
  }
};

// ── Comparaison des stocks entre magasins ────────────────────────────────────
exports.getStoreComparison = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        st.id AS store_id,
        st.name AS store_name,
        st.adresse,
        (SELECT COUNT(*) FROM sale s WHERE s.store_id = st.id) AS total_sales,
        (SELECT COALESCE(SUM(s.price * s.quantity), 0) FROM sale s WHERE s.store_id = st.id) AS total_revenue,
        (SELECT COUNT(*) FROM sale s WHERE s.store_id = st.id AND s.date_sate >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_sales,
        (SELECT COALESCE(SUM(s.price * s.quantity), 0) FROM sale s WHERE s.store_id = st.id AND s.date_sate >= DATE_TRUNC('month', CURRENT_DATE)) AS monthly_revenue,
        (SELECT COUNT(DISTINCT s.id_client) FROM sale s WHERE s.store_id = st.id) AS unique_clients,
        (SELECT COUNT(*) FROM ordering o WHERE o.organization_id = st.organization_id) AS total_orders
      FROM store st
      WHERE st.organization_id = $1 OR st.organization_id IS NULL
      ORDER BY total_revenue DESC
    `, [req.organizationId]);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur comparison:', error);
    res.status(500).json({ success: false, message: 'Erreur comparaison magasins' });
  }
};

// ── Articles en rupture par magasin ──────────────────────────────────────────
exports.getOutOfStockByStore = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT st.id AS store_id, st.name AS store_name,
        COUNT(CASE WHEN a.quantity = 0 THEN 1 END) AS out_of_stock,
        COUNT(CASE WHEN a.quantity <= 5 AND a.quantity > 0 THEN 1 END) AS low_stock,
        COUNT(CASE WHEN a.quantity > 5 THEN 1 END) AS ok_stock
      FROM store st
      LEFT JOIN article a ON a.organization_id = st.organization_id
      WHERE st.organization_id = $1
      GROUP BY st.id, st.name
    `, [req.organizationId]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur oos:', error);
    res.status(500).json({ success: false, message: 'Erreur rupture par magasin' });
  }
};

// ── Workflow d'approbation commandes ─────────────────────────────────────────
exports.createApprovalRequest = async (req, res) => {
  try {
    const { ordering_id, notes } = req.body;

    const ordering = await pool.query(
      'SELECT * FROM ordering WHERE id = $1',
      [ordering_id]
    );

    if (ordering.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    const order = ordering.rows[0];

    // Seuil d'approbation : > 500 000 FCFA nécessite 2 approbations
    const needsDirectorApproval = parseFloat(order.price) > 500000;

    // Créer la demande dans audit_log
    await pool.query(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, details, organization_id)
      VALUES ($1, 'approval_request', 'ordering', $2, $3, $4)
    `, [
      req.user?.id,
      ordering_id,
      JSON.stringify({
        requested_by: req.user?.username,
        amount: order.price,
        needs_director: needsDirectorApproval,
        notes: notes || null,
      }),
      req.organizationId
    ]);

    res.status(201).json({
      success: true,
      message: 'Demande d\'approbation créée',
      data: {
        ordering_id,
        amount: order.price,
        needs_director_approval: needsDirectorApproval,
        status: 'pending',
      }
    });
  } catch (error) {
    console.error('Erreur approval:', error);
    res.status(500).json({ success: false, message: 'Erreur demande approbation' });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { audit_log_id } = req.params;
    const { approved, notes } = req.body;

    const logEntry = await pool.query(
      "SELECT * FROM audit_log WHERE id = $1 AND action = 'approval_request'",
      [audit_log_id]
    );

    if (logEntry.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Demande non trouvée' });
    }

    const details = JSON.parse(logEntry.rows[0].details);

    // Mettre à jour les détails
    details.approved_by = req.user?.username;
    details.approved = approved;
    details.approved_at = new Date().toISOString();
    details.approval_notes = notes || null;

    await pool.query(
      'UPDATE audit_log SET details = $1 WHERE id = $2',
      [JSON.stringify(details), audit_log_id]
    );

    // Si approuvé et pas besoin de directeur, valider la commande
    if (approved && !details.needs_director) {
      await pool.query(
        "UPDATE ordering SET receved_date = CURRENT_DATE WHERE id = $1",
        [details.ordering_id]
      );
    }

    res.json({
      success: true,
      message: approved ? 'Commande approuvée' : 'Commande rejetée',
      data: details
    });
  } catch (error) {
    console.error('Erreur approve:', error);
    res.status(500).json({ success: false, message: 'Erreur approbation' });
  }
};

exports.getPendingApprovals = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.*, u.username
      FROM audit_log al
      LEFT JOIN "user" u ON al.user_id = u.id
      WHERE al.action = 'approval_request'
        AND (al.details->>'approved') IS NULL
      ORDER BY al.created_at DESC
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur pending:', error);
    res.status(500).json({ success: false, message: 'Erreur demandes en attente' });
  }
};
