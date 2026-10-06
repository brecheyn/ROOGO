const pool = require('../config/database');

// Récupérer tous les articles
exports.getAllArticles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM article WHERE organization_id = $1 ORDER BY id', [req.organizationId]);
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
    const result = await pool.query('SELECT * FROM article WHERE id = $1 AND organization_id = $2', [id, req.organizationId]);

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
    const { name_article, categorie, description, quantity, unit_price, date_manufacture, expiration_date } = req.body;

    if (!name_article || !categorie) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et la catégorie sont obligatoires'
      });
    }

    const result = await pool.query(
      `INSERT INTO article (name_article, categorie, description, quantity, unit_price, date_manufacture, expiration_date, organization_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name_article, categorie, description || null, quantity || 0, unit_price, date_manufacture, expiration_date, req.organizationId || null]
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
    const { name_article, categorie, description, quantity, unit_price, date_manufacture, expiration_date } = req.body;

    const result = await pool.query(
      `UPDATE article SET name_article = $1, categorie = $2, description = $3, quantity = $4, 
       unit_price = $5, date_manufacture = $6, expiration_date = $7 
       WHERE id = $8 AND organization_id = $9 RETURNING *`,
      [name_article, categorie, description || null, quantity, unit_price, date_manufacture, expiration_date, id, req.organizationId]
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

    const result = await pool.query('DELETE FROM article WHERE id = $1 AND organization_id = $2 RETURNING *', [id, req.organizationId]);

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
    if (error && error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: "Suppression impossible : cet article est utilisé par des ventes ou des commandes. Archivez-le plutôt que de le supprimer."
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'article'
    });
  }
};