const pool = require('../config/database');

// Récupérer tous les fournisseurs
exports.getAllSuppliers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM supplier ORDER BY id');
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des fournisseurs'
    });
  }
};

// Récupérer un fournisseur par ID
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM supplier WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
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
      message: 'Erreur lors de la récupération du fournisseur'
    });
  }
};

// Créer un fournisseur
exports.createSupplier = async (req, res) => {
  try {
    const { name, surname, phone, address } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Le nom est obligatoire'
      });
    }

    const result = await pool.query(
      'INSERT INTO supplier (name, surname, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, surname, phone, address]
    );

    res.status(201).json({
      success: true,
      message: 'Fournisseur créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du fournisseur'
    });
  }
};

// Mettre à jour un fournisseur
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, surname, phone, address } = req.body;

    const result = await pool.query(
      'UPDATE supplier SET name = $1, surname = $2, phone = $3, address = $4 WHERE id = $5 RETURNING *',
      [name, surname, phone, address, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Fournisseur modifié avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du fournisseur'
    });
  }
};

// Supprimer un fournisseur
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM supplier WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fournisseur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Fournisseur supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du fournisseur'
    });
  }
};
