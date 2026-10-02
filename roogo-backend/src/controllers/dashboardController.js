const pool = require('../config/database');
const { cacheGet, cacheSet } = require('../config/redis');

const CACHE_TTL = 60;

// Helper: filtre WHERE store_id pour les ventes
function storeFilter(storeId, params, offset) {
  if (!storeId) return { where: '', params };
  const idx = (offset || 0) + 1;
  return { where: `AND s.store_id = $${idx}`, params: [...params, storeId] };
}

// Helper: WHERE sans AND initial
function saleStoreClause(storeId, params, offset) {
  if (!storeId) return { where: '', params };
  const idx = (offset || 0) + 1;
  return { where: `WHERE s.store_id = $${idx}`, params: [...params, storeId] };
}

// ── GET /api/dashboard/stats ──────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    const orgId = req.organizationId;
    const cacheKey = `dashboard:stats:${orgId}:${storeId || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const p = [orgId];
    let sf = 'WHERE s.organization_id = $1';
    if (storeId) { sf += ' AND s.store_id = $2'; p.push(storeId); }

    // CA mois en cours
    const caMois = await pool.query(`
      SELECT COALESCE(SUM(price), 0) AS total FROM sale s
      ${sf} AND DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE)
    `, p);

    // CA mois précédent
    const caPrev = await pool.query(`
      SELECT COALESCE(SUM(price), 0) AS total FROM sale s
      ${sf} AND DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    `, p);

    // Ventes mois en cours
    const ventesMois = await pool.query(`
      SELECT COUNT(*) AS total FROM sale s
      ${sf} AND DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE)
    `, p);

    // Ventes mois précédent
    const ventesPrev = await pool.query(`
      SELECT COUNT(*) AS total FROM sale s
      ${sf} AND DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    `, p);

    // Panier moyen mois en cours
    const panierMois = await pool.query(`
      SELECT COALESCE(AVG(price), 0) AS total FROM sale s
      ${sf} AND DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE)
    `, p);

    // Panier moyen mois précédent
    const panierPrev = await pool.query(`
      SELECT COALESCE(AVG(price), 0) AS total FROM sale s
      ${sf} AND DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    `, p);

    // Total articles (organisation)
    const articles = await pool.query(`SELECT COUNT(*) AS total FROM article WHERE organization_id = $1`, [orgId]);

    // Total clients (organisation, ou par store via ventes)
    let clients;
    if (storeId) {
      clients = await pool.query(`
        SELECT COUNT(DISTINCT c.id) AS total FROM client c
        INNER JOIN sale s ON s.id_client = c.id
        WHERE s.organization_id = $1 AND s.store_id = $2
      `, [orgId, storeId]);
    } else {
      clients = await pool.query(`SELECT COUNT(*) AS total FROM client WHERE organization_id = $1`, [orgId]);
    }

    // Stock bas
    const stockBas = await pool.query(`SELECT COUNT(*) AS total FROM article WHERE organization_id = $1 AND quantity <= 5`, [orgId]);

    const ca      = parseFloat(caMois.rows[0].total);
    const caPrevV = parseFloat(caPrev.rows[0].total);
    const caTrend = caPrevV > 0 ? Math.round(((ca - caPrevV) / caPrevV) * 100) : 0;

    const ventes      = parseInt(ventesMois.rows[0].total);
    const ventesPrevV = parseInt(ventesPrev.rows[0].total);
    const ventesTrend = ventesPrevV > 0 ? Math.round(((ventes - ventesPrevV) / ventesPrevV) * 100) : 0;

    const panier      = parseFloat(panierMois.rows[0].total);
    const panierPrevV = parseFloat(panierPrev.rows[0].total);
    const panierTrend = panierPrevV > 0 ? Math.round(((panier - panierPrevV) / panierPrevV) * 100) : 0;

    const result = {
      chiffreAffairesMois:  ca,
      chiffreAffairesTrend: caTrend,
      totalArticles:        parseInt(articles.rows[0].total),
      articlesTrend:        0,
      totalClients:         parseInt(clients.rows[0].total),
      clientsTrend:         0,
      totalVentes:          ventes,
      ventesTrend:          ventesTrend,
      stockBas:             parseInt(stockBas.rows[0].total),
      panierMoyen:          panier,
      panierTrend:          panierTrend
    };

    await cacheSet(cacheKey, result, CACHE_TTL);
    res.json(result);

  } catch (error) {
    console.error('Erreur getStats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur stats' });
  }
};

// ── GET /api/dashboard/top-articles?limit=5&store_id=1 ───────────────────────
exports.getTopArticles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    const orgId = req.organizationId;
    const cacheKey = `dashboard:top-articles:${orgId}:${limit}:${storeId || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let query, params;
    if (storeId) {
      query = `
        SELECT a.name_article AS nom, COALESCE(SUM(s.quantity), 0) AS ventes
        FROM sale s
        JOIN article a ON s.id_article = a.id
        WHERE s.organization_id = $1 AND s.store_id = $2
        GROUP BY a.id, a.name_article
        ORDER BY ventes DESC
        LIMIT $3
      `;
      params = [orgId, storeId, limit];
    } else {
      query = `
        SELECT a.name_article AS nom, COALESCE(SUM(s.quantity), 0) AS ventes
        FROM sale s
        JOIN article a ON s.id_article = a.id
        WHERE s.organization_id = $1
        GROUP BY a.id, a.name_article
        ORDER BY ventes DESC
        LIMIT $2
      `;
      params = [orgId, limit];
    }

    const result = await pool.query(query, params);
    await cacheSet(cacheKey, result.rows, CACHE_TTL);
    res.json(result.rows);

  } catch (error) {
    console.error('Erreur getTopArticles:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur top-articles' });
  }
};

// ── GET /api/dashboard/stock-alerts ───────────────────────────────────────────
exports.getStockAlerts = async (req, res) => {
  try {
    const cacheKey = `dashboard:stock-alerts:${req.organizationId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    const bas = await pool.query(`
      SELECT name_article AS nom, quantity AS stock, 'bas' AS type
      FROM article WHERE organization_id = $1 AND quantity <= 5 ORDER BY quantity ASC LIMIT 10
    `, [req.organizationId]);

    const expire = await pool.query(`
      SELECT name_article AS nom, quantity AS stock, 'expire' AS type
      FROM article
      WHERE organization_id = $1
        AND expiration_date IS NOT NULL
        AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY expiration_date ASC LIMIT 10
    `, [req.organizationId]);

    const result = [...bas.rows, ...expire.rows];
    await cacheSet(cacheKey, result, CACHE_TTL);
    res.json(result);

  } catch (error) {
    console.error('Erreur getStockAlerts:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur stock-alerts' });
  }
};

// ── GET /api/dashboard/recent-sales?limit=5&store_id=1 ───────────────────────
exports.getRecentSales = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    const orgId = req.organizationId;
    const cacheKey = `dashboard:recent-sales:${orgId}:${limit}:${storeId || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let query, params;
    if (storeId) {
      query = `
        SELECT s.id,
          COALESCE(CONCAT(c.name, ' ', c.surname), 'Client inconnu') AS "clientNom",
          s.price AS montant,
          s.date_sate AS date,
          'Validée' AS statut
        FROM sale s
        LEFT JOIN client c ON s.id_client = c.id
        WHERE s.organization_id = $1 AND s.store_id = $2
        ORDER BY s.date_sate DESC
        LIMIT $3
      `;
      params = [orgId, storeId, limit];
    } else {
      query = `
        SELECT s.id,
          COALESCE(CONCAT(c.name, ' ', c.surname), 'Client inconnu') AS "clientNom",
          s.price AS montant,
          s.date_sate AS date,
          'Validée' AS statut
        FROM sale s
        LEFT JOIN client c ON s.id_client = c.id
        WHERE s.organization_id = $1
        ORDER BY s.date_sate DESC
        LIMIT $2
      `;
      params = [orgId, limit];
    }

    const result = await pool.query(query, params);
    await cacheSet(cacheKey, result.rows, CACHE_TTL);
    res.json(result.rows);

  } catch (error) {
    console.error('Erreur getRecentSales:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur recent-sales' });
  }
};

// ── GET /api/dashboard/sales-chart?days=7&store_id=1 ─────────────────────────
exports.getSalesChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const storeId = req.query.store_id ? parseInt(req.query.store_id) : null;
    const orgId = req.organizationId;
    const cacheKey = `dashboard:sales-chart:${orgId}:${days}:${storeId || 'all'}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return res.json(cached);

    let result;
    if (storeId) {
      result = await pool.query(`
        SELECT DATE(date_sate) AS jour, COALESCE(SUM(price), 0) AS total
        FROM sale
        WHERE organization_id = $1
          AND date_sate >= CURRENT_DATE - INTERVAL '${days} days'
          AND store_id = $2
        GROUP BY DATE(date_sate) ORDER BY jour ASC
      `, [orgId, storeId]);
    } else {
      result = await pool.query(`
        SELECT DATE(date_sate) AS jour, COALESCE(SUM(price), 0) AS total
        FROM sale
        WHERE organization_id = $1
          AND date_sate >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(date_sate) ORDER BY jour ASC
      `, [orgId]);
    }

    const map = {};
    result.rows.forEach(row => {
      const key = new Date(row.jour).toISOString().split('T')[0];
      map[key] = parseFloat(row.total);
    });

    const labels = [];
    const data   = [];
    const jours  = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      labels.push(jours[date.getDay()]);
      data.push(map[key] || 0);
    }

    const chartData = {
      labels,
      datasets: [{
        data,
        borderColor: '#2D5C4A',
        backgroundColor: 'rgba(45, 92, 74, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2D5C4A',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };

    await cacheSet(cacheKey, chartData, CACHE_TTL);
    res.json(chartData);

  } catch (error) {
    console.error('Erreur getSalesChart:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur sales-chart' });
  }
};
