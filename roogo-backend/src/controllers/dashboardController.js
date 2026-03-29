const pool = require('../config/database');

// ── GET /api/dashboard/stats ──────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const { storeFilter, storeParams } = req;
    const p = storeParams || [];

    // CA mois en cours
    const caMois = await pool.query(`
      SELECT COALESCE(SUM(price * quantity), 0) AS total
      FROM sale
      WHERE DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE)
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
    `, p);

    // CA mois précédent
    const caPrev = await pool.query(`
      SELECT COALESCE(SUM(price * quantity), 0) AS total
      FROM sale
      WHERE DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
    `, p);

    // Ventes mois en cours
    const ventesMois = await pool.query(`
      SELECT COUNT(*) AS total
      FROM sale
      WHERE DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE)
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
    `, p);

    // Ventes mois précédent
    const ventesPrev = await pool.query(`
      SELECT COUNT(*) AS total
      FROM sale
      WHERE DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
    `, p);

    // Panier moyen mois en cours
    const panierMois = await pool.query(`
      SELECT COALESCE(AVG(price * quantity), 0) AS total
      FROM sale
      WHERE DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE)
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
    `, p);

    // Panier moyen mois précédent
    const panierPrev = await pool.query(`
      SELECT COALESCE(AVG(price * quantity), 0) AS total
      FROM sale
      WHERE DATE_TRUNC('month', date_sate) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
    `, p);

    // Total articles
    const articles = await pool.query(`
      SELECT COUNT(*) AS total FROM article
    `);

    // Total clients
    const clients = await pool.query(`
      SELECT COUNT(*) AS total FROM client
    `);

    // Stock bas (quantity <= 5)
    const stockBas = await pool.query(`
      SELECT COUNT(*) AS total FROM article WHERE quantity <= 5
    `);

    // Calcul trends
    const ca      = parseFloat(caMois.rows[0].total);
    const caPrevV = parseFloat(caPrev.rows[0].total);
    const caTrend = caPrevV > 0 ? Math.round(((ca - caPrevV) / caPrevV) * 100) : 0;

    const ventes      = parseInt(ventesMois.rows[0].total);
    const ventesPrevV = parseInt(ventesPrev.rows[0].total);
    const ventesTrend = ventesPrevV > 0 ? Math.round(((ventes - ventesPrevV) / ventesPrevV) * 100) : 0;

    const panier      = parseFloat(panierMois.rows[0].total);
    const panierPrevV = parseFloat(panierPrev.rows[0].total);
    const panierTrend = panierPrevV > 0 ? Math.round(((panier - panierPrevV) / panierPrevV) * 100) : 0;

    res.json({
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
    });

  } catch (error) {
    console.error('Erreur getStats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur stats' });
  }
};

// ── GET /api/dashboard/top-articles?limit=5 ───────────────────────────────────
exports.getTopArticles = async (req, res) => {
  try {
    const { storeFilter, storeParams } = req;
    const limit = parseInt(req.query.limit) || 5;
    const p = [...(storeParams || []), limit];

    const result = await pool.query(`
      SELECT
        a.name_article                    AS nom,
        COALESCE(SUM(s.quantity), 0)      AS ventes
      FROM sale s
      JOIN article a ON s.id_article = a.id
      ${storeFilter || ''}
      GROUP BY a.id, a.name_article
      ORDER BY ventes DESC
      LIMIT $${p.length}
    `, p);

    res.json(result.rows);

  } catch (error) {
    console.error('Erreur getTopArticles:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur top-articles' });
  }
};

// ── GET /api/dashboard/stock-alerts ───────────────────────────────────────────
exports.getStockAlerts = async (req, res) => {
  try {
    // Articles stock bas (quantity <= 5)
    const bas = await pool.query(`
      SELECT
        name_article  AS nom,
        quantity      AS stock,
        'bas'         AS type
      FROM article
      WHERE quantity <= 5
      ORDER BY quantity ASC
      LIMIT 10
    `);

    // Articles proches péremption (dans les 30 prochains jours)
    const expire = await pool.query(`
      SELECT
        name_article      AS nom,
        quantity          AS stock,
        'expire'          AS type
      FROM article
      WHERE expiration_date IS NOT NULL
        AND expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ORDER BY expiration_date ASC
      LIMIT 10
    `);

    res.json([...bas.rows, ...expire.rows]);

  } catch (error) {
    console.error('Erreur getStockAlerts:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur stock-alerts' });
  }
};

// ── GET /api/dashboard/recent-sales?limit=5 ───────────────────────────────────
exports.getRecentSales = async (req, res) => {
  try {
    const { storeFilter, storeParams } = req;
    const limit = parseInt(req.query.limit) || 5;
    const p = [...(storeParams || []), limit];

    const result = await pool.query(`
      SELECT
        s.id,
        COALESCE(CONCAT(c.name, ' ', c.surname), 'Client inconnu') AS "clientNom",
        (s.price * s.quantity)                                       AS montant,
        s.date_sate                                                  AS date,
        'Validée'                                                    AS statut
      FROM sale s
      LEFT JOIN client c ON s.id_client = c.id
      ${storeFilter || ''}
      ORDER BY s.date_sate DESC
      LIMIT $${p.length}
    `, p);

    res.json(result.rows);

  } catch (error) {
    console.error('Erreur getRecentSales:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur recent-sales' });
  }
};

// ── GET /api/dashboard/sales-chart?days=7 ─────────────────────────────────────
exports.getSalesChart = async (req, res) => {
  try {
    const { storeFilter, storeParams } = req;
    const days = parseInt(req.query.days) || 7;
    const p = storeParams || [];

    const result = await pool.query(`
      SELECT
        DATE(date_sate)                    AS jour,
        COALESCE(SUM(price * quantity), 0) AS total
      FROM sale
      WHERE date_sate >= CURRENT_DATE - INTERVAL '${days} days'
      ${storeFilter ? 'AND ' + storeFilter.replace(/^WHERE\s*/i, '') : ''}
      GROUP BY DATE(date_sate)
      ORDER BY jour ASC
    `, p);

    // Indexer par date pour remplir les jours sans ventes à 0
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

    res.json({
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
    });

  } catch (error) {
    console.error('Erreur getSalesChart:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur sales-chart' });
  }
};