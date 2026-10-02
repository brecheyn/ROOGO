const pool = require('../config/database');
const chatService = require('../services/chatService');

// ── Chatbot : répondre en langage naturel ────────────────────────────────────
exports.chat = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Message requis (min 2 caractères)' });
    }

    const result = await chatService.answer(message, {
      userId: req.user?.id,
      orgId: req.organizationId,
    });

    // Sauvegarder la conversation (audit)
    await pool.query(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, details, organization_id)
      VALUES ($1, 'chatbot_query', 'chatbot', NULL, $2, $3)
    `, [req.user?.id, JSON.stringify({ query: message, response: result.response.substring(0, 500) }), req.organizationId]);

    res.json({
      success: true,
      data: {
        response: result.response,
        structured_data: result.data,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('Erreur chatbot:', error);
    res.status(500).json({ success: false, message: 'Erreur assistant IA' });
  }
};

// ── Éléments résolus (recommandations & anomalies) ──────────────────────────
const getResolvedKeys = async (orgId, category) => {
  const r = await pool.query(
    'SELECT item_key FROM resolved_item WHERE organization_id = $1 AND category = $2',
    [orgId, category]
  );
  return new Set(r.rows.map(x => x.item_key));
};

exports.getResolved = async (req, res) => {
  try {
    const category = req.query.category === 'anomaly' ? 'anomaly' : 'recommendation';
    const r = await pool.query(
      `SELECT item_key, title, entity_type, entity_id, created_at
       FROM resolved_item
       WHERE organization_id = $1 AND category = $2
       ORDER BY created_at DESC LIMIT 100`,
      [req.organizationId, category]
    );
    res.json({ success: true, count: r.rows.length, data: r.rows });
  } catch (error) {
    console.error('Erreur resolved list:', error);
    res.status(500).json({ success: false, message: 'Erreur historique résolus' });
  }
};

exports.resolveItem = async (req, res) => {
  try {
    const { category, item_key, title, entity_type, entity_id } = req.body;
    if (!item_key) {
      return res.status(400).json({ success: false, message: 'item_key requis' });
    }
    const cat = category === 'anomaly' ? 'anomaly' : 'recommendation';
    await pool.query(
      `INSERT INTO resolved_item (organization_id, category, item_key, title, entity_type, entity_id, resolved_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (organization_id, category, item_key) DO NOTHING`,
      [req.organizationId, cat, item_key, title || null, entity_type || null,
       entity_id || null, (req.user && req.user.id) || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur resolve:', error);
    res.status(500).json({ success: false, message: 'Erreur marquage résolu' });
  }
};

exports.unresolveItem = async (req, res) => {
  try {
    const { category, item_key } = req.body;
    if (!item_key) {
      return res.status(400).json({ success: false, message: 'item_key requis' });
    }
    const cat = category === 'anomaly' ? 'anomaly' : 'recommendation';
    await pool.query(
      'DELETE FROM resolved_item WHERE organization_id = $1 AND category = $2 AND item_key = $3',
      [req.organizationId, cat, item_key]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur unresolve:', error);
    res.status(500).json({ success: false, message: 'Erreur réactivation' });
  }
};

// ── Recommandations automatiques ─────────────────────────────────────────────
exports.getRecommendations = async (req, res) => {
  try {
    const recommendations = [];
    const orgId = req.organizationId;

    // 1. Articles à réapprovisionner en priorité
    const reorder = await pool.query(`
      SELECT a.id, a.name_article, a.quantity,
        COALESCE(s.total_30d, 0) / 30.0 AS avg_daily_demand
      FROM article a
      LEFT JOIN (
        SELECT id_article, SUM(quantity) AS total_30d
        FROM sale WHERE date_sate >= NOW() - INTERVAL '30 days' AND organization_id = $1
        GROUP BY id_article
      ) s ON a.id = s.id_article
      WHERE a.quantity <= 20 AND a.organization_id = $1
      ORDER BY a.quantity ASC LIMIT 5
    `, [orgId]);

    reorder.rows.forEach(r => {
      const avg = parseFloat(r.avg_daily_demand) || 0;
      recommendations.push({
        type: 'reorder',
        priority: r.quantity <= 5 ? 'critical' : 'high',
        title: `Réapprovisionner "${r.name_article}"`,
        description: `Stock actuel: ${r.quantity} unités. Demande moyenne: ${avg.toFixed(1)}/jour. Rupture prévue dans ${avg > 0 ? Math.ceil(r.quantity / avg) : '—'} jours.`,
        action: avg > 0 ? `Commander au minimum ${Math.ceil(avg * 14 + 5)} unités` : 'Aucune vente récente — vérifier la visibilité',
        article_name: r.name_article,
        article_id: r.id,
        item_key: `reorder|${r.name_article}`,
      });
    });

    // 2. Produits à promouvoir (stock élevé, ventes faibles)
    const promote = await pool.query(`
      SELECT a.id, a.name_article, a.quantity, a.unit_price,
        COALESCE(SUM(s.quantity), 0) AS total_sold
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article AND s.date_sate >= NOW() - INTERVAL '30 days'
      WHERE a.organization_id = $1
      GROUP BY a.id, a.name_article, a.quantity, a.unit_price
      HAVING a.quantity > 50 AND COALESCE(SUM(s.quantity), 0) < 5
      ORDER BY a.quantity DESC LIMIT 5
    `, [orgId]);

    promote.rows.forEach(r => {
      recommendations.push({
        type: 'promotion',
        priority: 'medium',
        title: `Promouvoir "${r.name_article}"`,
        description: `Stock élevé (${r.quantity} unités) mais seulement ${r.total_sold} vendus ce mois. Capital immobilisé: ${Math.round(r.quantity * r.unit_price)} FCFA.`,
        action: `Envisager une réduction de ${(r.unit_price * 0.15).toFixed(0)} FCFA (promo -15%)`,
        article_name: r.name_article,
        article_id: r.id,
        item_key: `promotion|${r.name_article}`,
      });
    });

    // 3. Produits proches de péremption
    const expiring = await pool.query(`
      SELECT id, name_article, expiration_date, quantity, unit_price
      FROM article
      WHERE expiration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
        AND quantity > 0 AND organization_id = $1
      ORDER BY expiration_date ASC LIMIT 5
    `, [orgId]);

    expiring.rows.forEach(r => {
      const daysLeft = Math.ceil((new Date(r.expiration_date) - new Date()) / (1000 * 60 * 60 * 24));
      recommendations.push({
        type: 'urgent_expiry',
        priority: 'critical',
        title: `Solder "${r.name_article}" avant expiration`,
        description: `Expire dans ${daysLeft} jours (${new Date(r.expiration_date).toLocaleDateString('fr-FR')}). ${r.quantity} unités en stock.`,
        action: `Vente Flash -30% minimum. Valeur à risque: ${Math.round(r.quantity * r.unit_price)} FCFA`,
        article_name: r.name_article,
        article_id: r.id,
        item_key: `urgent_expiry|${r.name_article}`,
      });
    });

    // 4. Tendance ventes
    const trend = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN date_sate >= DATE_TRUNC('week', CURRENT_DATE) THEN price END), 0) AS ca_semaine,
        COALESCE(SUM(CASE WHEN date_sate >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days' AND date_sate < DATE_TRUNC('week', CURRENT_DATE) THEN price END), 0) AS ca_semaine_prev
      FROM sale WHERE organization_id = $1
    `, [orgId]);

    const t = trend.rows[0];
    if (parseFloat(t.ca_semaine_prev) > 0) {
      const variation = ((parseFloat(t.ca_semaine) - parseFloat(t.ca_semaine_prev)) / parseFloat(t.ca_semaine_prev) * 100).toFixed(1);
      recommendations.push({
        type: 'trend',
        priority: parseFloat(variation) < -20 ? 'high' : 'low',
        title: `Tendance ventes: ${parseFloat(variation) > 0 ? '+' : ''}${variation}%`,
        description: `CA cette semaine: ${Math.round(t.ca_semaine)} FCFA vs ${Math.round(t.ca_semaine_prev)} FCFA la semaine précédente.`,
        action: parseFloat(variation) < -20 ? 'Analyser les causes de la baisse' : 'Maintenir la dynamique',
        item_key: 'trend|weekly',
      });
    }

    // Trier par priorité
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Exclure les éléments marqués comme résolus
    const resolvedKeys = await getResolvedKeys(orgId, 'recommendation');
    const visible = recommendations.filter(r => !resolvedKeys.has(r.item_key));

    res.json({
      success: true,
      count: visible.length,
      data: visible
    });
  } catch (error) {
    console.error('Erreur recommendations:', error);
    res.status(500).json({ success: false, message: 'Erreur recommandations' });
  }
};

// ── Détection d'anomalies ────────────────────────────────────────────────────
exports.getAnomalies = async (req, res) => {
  try {
    const anomalies = [];
    const orgId = req.organizationId;

    // 1. Vente anormalement élevée (> 3x la moyenne)
    const bigSales = await pool.query(`
      SELECT s.id, s.quantity, s.price, s.date_sate,
             a.name_article, a.unit_price,
             (SELECT AVG(s2.quantity) FROM sale s2 WHERE s2.id_article = s.id_article) AS avg_qty
      FROM sale s
      JOIN article a ON s.id_article = a.id
      WHERE s.date_sate >= NOW() - INTERVAL '30 days'
        AND s.organization_id = $1
        AND s.quantity > (
          SELECT COALESCE(AVG(s2.quantity) * 3, 999999)
          FROM sale s2 WHERE s2.id_article = s.id_article
        )
      ORDER BY s.date_sate DESC LIMIT 10
    `, [orgId]);

    bigSales.rows.forEach(r => {
      anomalies.push({
        type: 'unusual_sale',
        severity: 'warning',
        title: `Vente anormale: ${r.name_article}`,
        description: `${r.quantity} unités vendues le ${new Date(r.date_sate).toLocaleDateString('fr-FR')} (moyenne: ${Math.round(r.avg_qty)} unités). Possible erreur ou fraude.`,
        entity_type: 'sale',
        entity_id: r.id,
        item_key: `unusual_sale|sale|${r.id}`,
      });
    });

    // 2. Ajustements de stock suspects (ajustements négatifs fréquents)
    const suspiciousAdjustments = await pool.query(`
      SELECT article_id, a.name_article,
             COUNT(*) AS nb_adjustments,
             SUM(CASE WHEN sm.quantity < 0 THEN ABS(sm.quantity) ELSE 0 END) AS total_lost
      FROM stock_movement sm
      JOIN article a ON sm.article_id = a.id
      WHERE sm.movement_type = 'adjustment'
        AND sm.created_at >= NOW() - INTERVAL '30 days'
        AND sm.quantity < 0
        AND sm.organization_id = $1
      GROUP BY article_id, a.name_article
      HAVING COUNT(*) > 2 OR SUM(ABS(sm.quantity)) > 10
      ORDER BY total_lost DESC LIMIT 10
    `, [orgId]);

    suspiciousAdjustments.rows.forEach(r => {
      anomalies.push({
        type: 'suspicious_adjustment',
        severity: 'warning',
        title: `Ajustements suspects: ${r.name_article}`,
        description: `${r.nb_adjustments} ajustements négatifs ce mois. Total perdu: ${r.total_lost} unités.`,
        entity_type: 'article',
        entity_id: r.article_id,
        item_key: `suspicious_adjustment|article|${r.article_id}`,
      });
    });

    // 3. Stock négatif (ne devrait jamais arriver)
    const negativeStock = await pool.query(
      'SELECT id, name_article, quantity FROM article WHERE quantity < 0 AND organization_id = $1',
      [orgId]
    );

    negativeStock.rows.forEach(r => {
      anomalies.push({
        type: 'negative_stock',
        severity: 'critical',
        title: `Stock négatif: ${r.name_article}`,
        description: `Le stock est de ${r.quantity} unités. Ceci est impossible et indique une erreur de saisie.`,
        entity_type: 'article',
        entity_id: r.id,
        item_key: `negative_stock|article|${r.id}`,
      });
    });

    // 4. Gros mouvements de stock sans vente correspondante
    const bigMovements = await pool.query(`
      SELECT sm.id, sm.article_id, sm.quantity, sm.movement_type, sm.created_at, sm.notes,
             a.name_article
      FROM stock_movement sm
      JOIN article a ON sm.article_id = a.id
      WHERE sm.movement_type = 'adjustment'
        AND sm.quantity < -20
        AND sm.created_at >= NOW() - INTERVAL '7 days'
        AND sm.organization_id = $1
      ORDER BY sm.created_at DESC LIMIT 10
    `, [orgId]);

    bigMovements.rows.forEach(r => {
      anomalies.push({
        type: 'big_adjustment',
        severity: 'info',
        title: `Gros ajustement: ${r.name_article}`,
        description: `${Math.abs(r.quantity)} unités retirées le ${new Date(r.created_at).toLocaleDateString('fr-FR')}. Notes: ${r.notes || 'Aucune'}`,
        entity_type: 'movement',
        entity_id: r.id,
        article_id: r.article_id,
        item_key: `big_adjustment|movement|${r.id}`,
      });
    });

    // Trier par sévérité
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Exclure les anomalies marquées comme résolues
    const resolvedKeys = await getResolvedKeys(orgId, 'anomaly');
    const visible = anomalies.filter(a => !resolvedKeys.has(a.item_key));

    res.json({
      success: true,
      count: visible.length,
      critical: visible.filter(a => a.severity === 'critical').length,
      warnings: visible.filter(a => a.severity === 'warning').length,
      data: visible
    });
  } catch (error) {
    console.error('Erreur anomalies:', error);
    res.status(500).json({ success: false, message: 'Erreur détection anomalies' });
  }
};

// ── Prévisions IA (projection simple) ────────────────────────────────────────
exports.getForecasts = async (req, res) => {
  try {
    const { article_id } = req.query;
    const orgId = req.organizationId;

    let whereS = 'WHERE s.organization_id = $1';
    let whereP = 'WHERE organization_id = $1';
    const paramsS = [orgId];
    const paramsP = [orgId];

    if (article_id) {
      whereS += ' AND s.id_article = $2';
      paramsS.push(article_id);
      whereP += ' AND id_article = $2';
      paramsP.push(article_id);
    }

    // Ventes moyennes par jour de la semaine
    const weeklyPattern = await pool.query(`
      SELECT
        EXTRACT(DOW FROM s.date_sate) AS day_of_week,
        AVG(s.quantity) AS avg_qty,
        AVG(s.price) AS avg_revenue,
        COUNT(*) AS sample_size
      FROM sale s
      ${whereS}
      GROUP BY EXTRACT(DOW FROM s.date_sate)
      ORDER BY day_of_week
    `, paramsS);

    // Tendance mensuelle (3 derniers mois)
    const monthlyTrend = await pool.query(`
      SELECT
        DATE_TRUNC('month', s.date_sate) AS month,
        SUM(s.quantity) AS total_qty,
        SUM(s.price) AS total_revenue,
        COUNT(*) AS nb_sales
      FROM sale s
      ${whereS}
        AND s.date_sate >= NOW() - INTERVAL '3 months'
      GROUP BY DATE_TRUNC('month', s.date_sate)
      ORDER BY month
    `, paramsS);

    // Projection 30 jours (basée sur la moyenne mobile)
    const projection = await pool.query(`
      SELECT
        AVG(daily_revenue) AS avg_daily_revenue,
        AVG(daily_qty) AS avg_daily_qty,
        STDDEV(daily_revenue) AS stddev_revenue
      FROM (
        SELECT
          DATE(date_sate) AS day,
          SUM(price) AS daily_revenue,
          SUM(quantity) AS daily_qty
        FROM sale
        ${whereP}
          AND date_sate >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(date_sate)
      ) daily
    `, paramsP);

    const p = projection.rows[0];
    const daysInMonth = 30;

    const forecast = {
      next_30_days: {
        projected_revenue: Math.round((parseFloat(p.avg_daily_revenue) || 0) * daysInMonth),
        projected_quantity: Math.round((parseFloat(p.avg_daily_qty) || 0) * daysInMonth),
        confidence_low: Math.round(((parseFloat(p.avg_daily_revenue) || 0) - (parseFloat(p.stddev_revenue) || 0)) * daysInMonth),
        confidence_high: Math.round(((parseFloat(p.avg_daily_revenue) || 0) + (parseFloat(p.stddev_revenue) || 0)) * daysInMonth),
      },
      weekly_pattern: weeklyPattern.rows,
      monthly_trend: monthlyTrend.rows,
    };

    res.json({
      success: true,
      data: forecast
    });
  } catch (error) {
    console.error('Erreur forecasts:', error);
    res.status(500).json({ success: false, message: 'Erreur prévisions' });
  }
};
