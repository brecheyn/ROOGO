const pool = require('../config/database');

// Créer un log d'audit
exports.createAuditLog = async (userId, action, entity, entityId, details = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entity, entityId, details, null, null]
    );
  } catch (error) {
    console.error('Erreur création audit log:', error);
  }
};

// Récupérer l'historique des audits
exports.getAuditLogs = async (req, res) => {
  try {
    const {
      userId,
      action,
      entity,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;
    
    const isAdmin = req.user.role_id === 1;
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    let query = `
      SELECT a.*, u.username
      FROM audit_log a
      JOIN "user" u ON a.user_id = u.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (userId) {
      params.push(userId);
      query += ` AND a.user_id = $${paramCount}`;
      paramCount++;
    }
    
    if (action) {
      params.push(action);
      query += ` AND a.action = $${paramCount}`;
      paramCount++;
    }
    
    if (entity) {
      params.push(entity);
      query += ` AND a.entity = $${paramCount}`;
      paramCount++;
    }
    
    if (startDate) {
      params.push(startDate);
      query += ` AND a.created_at >= $${paramCount}`;
      paramCount++;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND a.created_at <= $${paramCount}`;
      paramCount++;
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    
    const result = await pool.query(query, params);
    
    // Compter le total
    let countQuery = query.split('ORDER BY')[0];
    countQuery = countQuery.replace(/SELECT a\.\*, u\.username FROM/s, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des logs',
      error: error.message
    });
  }
};

// Récupérer l'historique d'une entité spécifique
exports.getEntityHistory = async (req, res) => {
  try {
    const { entity, entityId } = req.params;
    
    const result = await pool.query(`
      SELECT a.*, u.username
      FROM audit_log a
      JOIN "user" u ON a.user_id = u.id
      WHERE a.entity = $1 AND a.entity_id = $2
      ORDER BY a.created_at DESC
      LIMIT 100
    `, [entity, entityId]);
    
    res.json({
      success: true,
      entity: entity,
      entity_id: entityId,
      history: result.rows
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message
    });
  }
};

// Statistiques d'audit
exports.getAuditStats = async (req, res) => {
  try {
    const isAdmin = req.user.role_id === 1;
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    // Actions par type
    const actionsByTypeResult = await pool.query(`
      SELECT action, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY action
      ORDER BY count DESC
    `);
    
    // Actions par utilisateur
    const actionsByUserResult = await pool.query(`
      SELECT u.username, COUNT(a.id) as count
      FROM audit_log a
      JOIN "user" u ON a.user_id = u.id
      WHERE a.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY u.id, u.username
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Actions par entité
    const actionsByEntityResult = await pool.query(`
      SELECT entity, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY entity
      ORDER BY count DESC
    `);
    
    // Actions par jour (7 derniers jours)
    const actionsByDayResult = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      period: '30 derniers jours',
      stats: {
        by_action: actionsByTypeResult.rows,
        by_user: actionsByUserResult.rows,
        by_entity: actionsByEntityResult.rows,
        by_day: actionsByDayResult.rows
      }
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques d\'audit',
      error: error.message
    });
  }
};

// Nettoyer les anciens logs (plus de 90 jours)
exports.cleanOldLogs = async (req, res) => {
  try {
    const isAdmin = req.user.role_id === 1;
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux administrateurs'
      });
    }
    
    const result = await pool.query(`
      DELETE FROM audit_log
      WHERE created_at < NOW() - INTERVAL '90 days'
      RETURNING id
    `);
    
    res.json({
      success: true,
      message: `${result.rows.length} log(s) supprimé(s)`,
      deleted_count: result.rows.length
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du nettoyage des logs',
      error: error.message
    });
  }
};