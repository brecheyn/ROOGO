const pool = require('../config/database');

// Récupérer tous les clients
exports.getAllClients = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM client ORDER BY id');
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients'
    });
  }
};

// Récupérer un client par ID
exports.getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM client WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
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
      message: 'Erreur lors de la récupération du client'
    });
  }
};

// Créer un client
exports.createClient = async (req, res) => {
  try {
    const { name, surname, phone, address } = req.body;

    if (!name || !surname) {
      return res.status(400).json({
        success: false,
        message: 'Le nom et le prénom sont obligatoires'
      });
    }

    const result = await pool.query(
      'INSERT INTO client (name, surname, phone, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, surname, phone, address]
    );

    res.status(201).json({
      success: true,
      message: 'Client créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du client'
    });
  }
};

// Mettre à jour un client
exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, surname, phone, address } = req.body;

    const result = await pool.query(
      'UPDATE client SET name = $1, surname = $2, phone = $3, address = $4 WHERE id = $5 RETURNING *',
      [name, surname, phone, address, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Client modifié avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du client'
    });
  }
};

// Supprimer un client
exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM client WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Client supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du client'
    });
  }
};