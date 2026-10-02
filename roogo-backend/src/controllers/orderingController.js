const pool = require('../config/database');

// Récupérer toutes les commandes
exports.getAllOrderings = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT o.*, s.name as supplier_name, a.name_article
      FROM ordering o
      LEFT JOIN supplier s ON o.id_supplier = s.id
      LEFT JOIN article a ON o.id_article = a.id
      ORDER BY o.order_date DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes'
    });
  }
};

// Récupérer une commande par ID
exports.getOrderingById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT o.*, s.name as supplier_name, a.name_article
      FROM ordering o
      LEFT JOIN supplier s ON o.id_supplier = s.id
      LEFT JOIN article a ON o.id_article = a.id
      WHERE o.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande'
    });
  }
};

// Créer une commande
exports.createOrdering = async (req, res) => {
  try {
    const { id_article, id_supplier, quantity, price } = req.body;

    const result = await pool.query(
      `INSERT INTO ordering (id_article, id_supplier, quantity, price, order_date) 
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING *`,
      [id_article, id_supplier, quantity, price]
    );

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande'
    });
  }
};

// Modifier une commande
exports.updateOrdering = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_article, id_supplier, quantity, price } = req.body;

    const existing = await pool.query('SELECT * FROM ordering WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    const result = await pool.query(
      `UPDATE ordering SET id_article = $1, id_supplier = $2, quantity = $3, price = $4 WHERE id = $5 RETURNING *`,
      [id_article, id_supplier, quantity, price, id]
    );
    res.json({ success: true, message: 'Commande modifiée', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// Supprimer une commande
exports.deleteOrdering = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT * FROM ordering WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    await pool.query('DELETE FROM ordering WHERE id = $1', [id]);
    res.json({ success: true, message: 'Commande supprimée' });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
exports.receiveOrdering = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT * FROM ordering WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Commande non trouvée');
    }

    const order = orderResult.rows[0];

    await client.query(
      'UPDATE ordering SET receved_date = CURRENT_DATE WHERE id = $1',
      [id]
    );

    await client.query(
      'UPDATE article SET quantity = quantity + $1 WHERE id = $2',
      [order.quantity, order.id_article]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Commande marquée comme reçue et stock mis à jour'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de la réception de la commande'
    });
  } finally {
    client.release();
  }
};