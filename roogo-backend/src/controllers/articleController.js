const pool = require('../config/database');

// Récupérer tous les articles
exports.getAllArticles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM article ORDER BY id');
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des articles'
    });
  }
};

// Récupérer un article par ID
exports.getArticleById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM article WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
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
      message: 'Erreur lors de la récupération de l\'article'
    });
  }
};

// Créer un article
exports.createArticle = async (req, res) => {
  try {
    const { name_article, categorie, quantity, unit_price, date_manufacture, expiration_date } = req.body;

    if (!name_article || !categorie) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et la catégorie sont obligatoires'
      });
    }

    const result = await pool.query(
      `INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name_article, categorie, quantity || 0, unit_price, date_manufacture, expiration_date]
    );

    res.status(201).json({
      success: true,
      message: 'Article créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'article'
    });
  }
};

// Mettre à jour un article
exports.updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name_article, categorie, quantity, unit_price, date_manufacture, expiration_date } = req.body;

    const result = await pool.query(
      `UPDATE article SET name_article = $1, categorie = $2, quantity = $3, 
       unit_price = $4, date_manufacture = $5, expiration_date = $6 
       WHERE id = $7 RETURNING *`,
      [name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Article modifié avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification de l\'article'
    });
  }
};

// Supprimer un article
exports.deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM article WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Article non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Article supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'article'
    });
  }
};