const pool = require('../config/database');

// Statistiques avancées du dashboard
exports.getAdvancedStats = async (req, res) => {
  try {
    const isAdmin = req.user.role_id === 1;
    const storeId = req.user.store_id;
    const storeCondition = isAdmin ? '' : `WHERE s.store_id = ${storeId}`;
    
    // 1. Ventes par jour (7 derniers jours)
    const salesByDayResult = await pool.query(`
      SELECT 
        DATE(date_sate) as date,
        COUNT(*) as nombre_ventes,
        SUM(price) as chiffre_affaires
      FROM sale s
      ${storeCondition}
      ${storeCondition ? 'AND' : 'WHERE'} date_sate >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(date_sate)
      ORDER BY date DESC
    `);
    
    // 2. Ventes par catégorie
    const salesByCategoryResult = await pool.query(`
      SELECT 
        a.categorie,
        COUNT(s.id) as nombre_ventes,
        SUM(s.price) as chiffre_affaires
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article ${storeCondition ? 'AND s.store_id = ' + storeId : ''}
      GROUP BY a.categorie
      ORDER BY chiffre_affaires DESC
    `);
    
    // 3. Performance des vendeurs (si admin ou manager)
    let vendorPerformance = [];
    if (req.user.role_id === 1 || req.user.role_id === 2) {
      const vendorQuery = isAdmin
        ? `SELECT u.username, st.name as magasin, COUNT(s.id) as ventes, SUM(s.price) as ca
           FROM "user" u
           LEFT JOIN store st ON u.store_id = st.id
           LEFT JOIN sale s ON s.store_id = u.store_id
           WHERE u.role_id = 3
           GROUP BY u.id, u.username, st.name
           ORDER BY ca DESC`
        : `SELECT u.username, COUNT(s.id) as ventes, SUM(s.price) as ca
           FROM "user" u
           LEFT JOIN sale s ON s.store_id = u.store_id
           WHERE u.role_id = 3 AND u.store_id = ${storeId}
           GROUP BY u.id, u.username
           ORDER BY ca DESC`;
      
      const vendorResult = await pool.query(vendorQuery);
      vendorPerformance = vendorResult.rows;
    }
    
    // 4. Comparaison entre magasins (admin seulement)
    let storeComparison = [];
    if (isAdmin) {
      const storeCompResult = await pool.query(`
        SELECT 
          st.name as magasin,
          COUNT(s.id) as nombre_ventes,
          SUM(s.price) as chiffre_affaires,
          AVG(s.price) as panier_moyen
        FROM store st
        LEFT JOIN sale s ON st.id = s.store_id
        GROUP BY st.id, st.name
        ORDER BY chiffre_affaires DESC
      `);
      storeComparison = storeCompResult.rows;
    }
    
    // 5. Alertes (stock bas, produits expirés, etc.)
    const lowStockResult = await pool.query(`
      SELECT name_article, quantity, unit_price
      FROM article
      WHERE quantity < 10
      ORDER BY quantity ASC
    `);
    
    const expiredResult = await pool.query(`
      SELECT name_article, expiration_date, quantity
      FROM article
      WHERE expiration_date < NOW()
      AND quantity > 0
    `);
    
    const expiringSoonResult = await pool.query(`
      SELECT name_article, expiration_date, quantity
      FROM article
      WHERE expiration_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
      AND quantity > 0
      ORDER BY expiration_date ASC
    `);
    
    res.json({
      success: true,
      data: {
        sales_by_day: salesByDayResult.rows,
        sales_by_category: salesByCategoryResult.rows,
        vendor_performance: vendorPerformance,
        store_comparison: storeComparison,
        alerts: {
          low_stock: lowStockResult.rows,
          expired_products: expiredResult.rows,
          expiring_soon: expiringSoonResult.rows
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
};

// Statistiques par période
exports.getStatsByPeriod = async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query; // period: 'day', 'week', 'month'
    const isAdmin = req.user.role_id === 1;
    const storeId = req.user.store_id;
    
    let dateGroup = '';
    switch (period) {
      case 'day':
        dateGroup = "DATE(date_sate)";
        break;
      case 'week':
        dateGroup = "DATE_TRUNC('week', date_sate)";
        break;
      case 'month':
        dateGroup = "DATE_TRUNC('month', date_sate)";
        break;
      default:
        dateGroup = "DATE(date_sate)";
    }
    
    let query = `
      SELECT 
        ${dateGroup} as periode,
        COUNT(*) as nombre_ventes,
        SUM(price) as chiffre_affaires,
        AVG(price) as panier_moyen,
        SUM(quantity) as articles_vendus
      FROM sale
      WHERE 1=1
    `;
    
    const params = [];
    
    if (!isAdmin) {
      params.push(storeId);
      query += ` AND store_id = $${params.length}`;
    }
    
    if (startDate) {
      params.push(startDate);
      query += ` AND date_sate >= $${params.length}`;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND date_sate <= $${params.length}`;
    }
    
    query += ` GROUP BY ${dateGroup} ORDER BY periode DESC`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      period: period || 'day',
      data: result.rows
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques par période',
      error: error.message
    });
  }
};

// Top produits
exports.getTopProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const isAdmin = req.user.role_id === 1;
    const storeId = req.user.store_id;
    
    const storeCondition = isAdmin ? '' : `WHERE s.store_id = ${storeId}`;
    
    const result = await pool.query(`
      SELECT 
        a.name_article,
        a.categorie,
        COUNT(s.id) as nombre_ventes,
        SUM(s.quantity) as quantite_vendue,
        SUM(s.price) as chiffre_affaires,
        AVG(s.price) as prix_moyen
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article
      ${storeCondition}
      GROUP BY a.id, a.name_article, a.categorie
      HAVING COUNT(s.id) > 0
      ORDER BY chiffre_affaires DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du top produits',
      error: error.message
    });
  }
};