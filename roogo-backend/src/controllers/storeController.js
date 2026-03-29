const pool = require('../config/database');

// Récupérer tous les magasins
exports.getAllStores = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM store ORDER BY id');
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des magasins'
    });
  }
};

// Créer un magasin
exports.createStore = async (req, res) => {
  try {
    const { name, adresse, phone, email_adresse } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Le nom du magasin est obligatoire'
      });
    }

    const result = await pool.query(
      'INSERT INTO store (name, adresse, phone, email_adresse) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, adresse, phone, email_adresse]
    );

    res.status(201).json({
      success: true,
      message: 'Magasin créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du magasin'
    });
  }
};

// Statistiques du tableau de bord
exports.getDashboardStats = async (req, res) => {
  try {
    const isAdmin = req.user.role_id === 1;
    const storeCondition = isAdmin ? '' : `WHERE store_id = ${req.user.store_id}`;

    const salesResult = await pool.query(`
      SELECT COUNT(*) as total, SUM(price) as chiffre_affaires
      FROM sale
      ${storeCondition}
    `);

    const stockResult = await pool.query(
      'SELECT SUM(quantity * unit_price) as valeur_stock FROM article'
    );

    const ruptureResult = await pool.query(
      'SELECT COUNT(*) as articles_rupture FROM article WHERE quantity = 0'
    );

    const topArticlesResult = await pool.query(`
      SELECT a.name_article, COUNT(s.id) as ventes, SUM(s.price) as ca
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article
      ${isAdmin ? '' : `WHERE s.store_id = ${req.user.store_id}`}
      GROUP BY a.id, a.name_article
      ORDER BY ca DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        total_ventes: salesResult.rows[0].total,
        chiffre_affaires: salesResult.rows[0].chiffre_affaires || 0,
        valeur_stock: stockResult.rows[0].valeur_stock || 0,
        articles_rupture: ruptureResult.rows[0].articles_rupture,
        top_articles: topArticlesResult.rows
      }
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};