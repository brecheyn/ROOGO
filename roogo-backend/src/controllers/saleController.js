const pool = require('../config/database');

// Récupérer toutes les ventes
exports.getAllSales = async (req, res) => {
  try {
    const { storeFilter, storeParams } = req;
    
    let query = `
      SELECT s.*, c.name as client_name, c.surname as client_surname, 
             a.name_article, st.name as store_name
      FROM sale s
      LEFT JOIN client c ON s.id_client = c.id
      LEFT JOIN article a ON s.id_article = a.id
      LEFT JOIN store st ON s.store_id = st.id
      ${storeFilter}
      ORDER BY s.date_sate DESC
    `;

    const result = await pool.query(query, storeParams);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ventes'
    });
  }
};

// Créer une vente
exports.createSale = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id_article, id_client, quantity, price } = req.body;
    const store_id = req.user.store_id;

    await client.query('BEGIN');

    // Vérifier le stock
    const articleResult = await client.query(
      'SELECT quantity FROM article WHERE id = $1',
      [id_article]
    );

    if (articleResult.rows.length === 0) {
      throw new Error('Article non trouvé');
    }

    const stockDisponible = articleResult.rows[0].quantity;

    if (stockDisponible < quantity) {
      throw new Error(`Stock insuffisant. Disponible: ${stockDisponible}`);
    }

    // Créer la vente
    const saleResult = await client.query(
      `INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate) 
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *`,
      [id_article, id_client, store_id, quantity, price]
    );

    // Mettre à jour le stock
    await client.query(
      'UPDATE article SET quantity = quantity - $1 WHERE id = $2',
      [quantity, id_article]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Vente enregistrée avec succès',
      data: saleResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'enregistrement de la vente'
    });
  } finally {
    client.release();
  }
};