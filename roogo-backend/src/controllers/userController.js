const pool = require('../config/database');
const bcrypt = require('bcrypt');
const { JWT_SECRET } = require('../middleware/auth');

// Récupérer tous les utilisateurs
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, r.name_role, s.name as store_name, u.store_id, u.role_id
      FROM "user" u
      JOIN role r ON u.role_id = r.id
      LEFT JOIN store s ON u.store_id = s.id
      ORDER BY u.id
    `);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des utilisateurs' });
  }
};

// Récupérer un utilisateur par ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT u.id, u.username, u.email, r.name_role, s.name as store_name, u.store_id, u.role_id
      FROM "user" u
      JOIN role r ON u.role_id = r.id
      LEFT JOIN store s ON u.store_id = s.id
      WHERE u.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération de l\'utilisateur' });
  }
};

// ── CRÉER UN EMPLOYÉ (Manager - max 3) ───────────────────────────────────────
exports.createEmployee = async (req, res) => {
  try {
    const managerId = req.user.id;
    const storeId   = req.user.store_id;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: 'Vous n\'êtes pas assigné à un magasin'
      });
    }

    // Compter les employés déjà créés par ce manager
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "user" WHERE created_by = $1 AND role_id = 3`,
      [managerId]
    );

    const count = parseInt(countResult.rows[0].count);
    if (count >= 3) {
      return res.status(403).json({
        success: false,
        message: 'Vous avez atteint la limite de 3 comptes employés'
      });
    }

    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username et mot de passe obligatoires'
      });
    }

    // Vérifier unicité du username
    const existing = await pool.query(
      'SELECT id FROM "user" WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ce nom d\'utilisateur existe déjà'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO "user" (username, email, password, role_id, store_id, created_by)
       VALUES ($1, $2, $3, 3, $4, $5)
       RETURNING id, username, email, role_id, store_id`,
      [username, email || null, hashedPassword, storeId, managerId]
    );

    res.status(201).json({
      success: true,
      message: 'Compte employé créé avec succès',
      data: result.rows[0],
      remaining: 3 - (count + 1)
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'employé' });
  }
};

// ── RÉCUPÉRER LES EMPLOYÉS DU MANAGER ────────────────────────────────────────
exports.getMyEmployees = async (req, res) => {
  try {
    const managerId = req.user.id;

    const result = await pool.query(`
      SELECT u.id, u.username, u.email, u.store_id,
             s.name as store_name, u.created_at
      FROM "user" u
      LEFT JOIN store s ON s.id = u.store_id
      WHERE u.created_by = $1 AND u.role_id = 3
      ORDER BY u.id
    `, [managerId]);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM "user" WHERE created_by = $1 AND role_id = 3`,
      [managerId]
    );

    res.json({
      success: true,
      data: result.rows,
      count: parseInt(countResult.rows[0].count),
      remaining: 3 - parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des employés' });
  }
};

// Créer un utilisateur (Admin seulement)
exports.createUser = async (req, res) => {
  try {
    const { username, password, email, role_id, store_id } = req.body;

    if (!username || !password || !role_id) {
      return res.status(400).json({
        success: false,
        message: 'Username, password et role_id sont obligatoires'
      });
    }

    const existingUser = await pool.query(
      'SELECT id FROM "user" WHERE username = $1', [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Ce nom d\'utilisateur existe déjà' });
    }

    if ((role_id === 2 || role_id === 3) && !store_id) {
      return res.status(400).json({
        success: false,
        message: 'Les Managers et Vendeurs doivent être assignés à un magasin'
      });
    }

    const finalStoreId = role_id === 1 ? null : store_id;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO "user" (username, password, email, role_id, store_id) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role_id, store_id',
      [username, hashedPassword, email, role_id, finalStoreId]
    );

    res.status(201).json({ success: true, message: 'Utilisateur créé avec succès', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'utilisateur' });
  }
};

// Mettre à jour un utilisateur
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role_id, store_id, password } = req.body;

    let query = 'UPDATE "user" SET ';
    const params = [];
    let paramCount = 1;

    if (username)          { query += `username = $${paramCount}, `;  params.push(username);  paramCount++; }
    if (email)             { query += `email = $${paramCount}, `;     params.push(email);     paramCount++; }
    if (role_id)           { query += `role_id = $${paramCount}, `;   params.push(role_id);   paramCount++;
                             if (role_id === 1) query += `store_id = NULL, `; }
    if (store_id !== undefined) { query += `store_id = $${paramCount}, `; params.push(store_id); paramCount++; }
    if (password)          { const h = await bcrypt.hash(password, 10);
                             query += `password = $${paramCount}, `;  params.push(h);         paramCount++; }

    query = query.slice(0, -2);
    query += ` WHERE id = $${paramCount} RETURNING id, username, email, role_id, store_id`;
    params.push(id);

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    res.json({ success: true, message: 'Utilisateur modifié avec succès', data: result.rows[0] });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification de l\'utilisateur' });
  }
};

// Supprimer un utilisateur
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    const result = await pool.query('DELETE FROM "user" WHERE id = $1 RETURNING username', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }
    res.json({ success: true, message: `Utilisateur ${result.rows[0].username} supprimé avec succès` });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression de l\'utilisateur' });
  }
};

// Récupérer tous les rôles
exports.getAllRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role ORDER BY id');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des rôles' });
  }
};