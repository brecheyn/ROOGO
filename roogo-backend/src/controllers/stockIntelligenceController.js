const pool = require('../config/database');

// ── Analyse ABC automatique ───────────────────────────────────────────────────
// Classe les articles en A (20% = 80% CA), B (30% = 15% CA), C (50% = 5% CA)
exports.getABCAnalysis = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH article_revenue AS (
        SELECT
          a.id,
          a.name_article,
          a.categorie,
          a.quantity AS current_stock,
          a.unit_price,
          COALESCE(SUM(s.quantity), 0) AS total_sold,
          COALESCE(SUM(s.price * s.quantity), 0) AS total_revenue,
          COUNT(s.id) AS total_sales
        FROM article a
        LEFT JOIN sale s ON a.id = s.id_article
        GROUP BY a.id, a.name_article, a.categorie, a.quantity, a.unit_price
      ),
      ranked AS (
        SELECT *,
          SUM(total_revenue) OVER () AS grand_total,
          SUM(total_revenue) OVER (ORDER BY total_revenue DESC ROWS UNBOUNDED PRECEDING) AS cumulative_revenue
        FROM article_revenue
        WHERE total_revenue > 0
      )
      SELECT
        id,
        name_article,
        categorie,
        current_stock,
        unit_price,
        total_sold,
        total_revenue,
        total_sales,
        CASE
          WHEN cumulative_revenue <= grand_total * 0.8 THEN 'A'
          WHEN cumulative_revenue <= grand_total * 0.95 THEN 'B'
          ELSE 'C'
        END AS abc_class,
        ROUND(cumulative_revenue / NULLIF(grand_total, 0) * 100, 1) AS cumulative_pct
      FROM ranked
      ORDER BY total_revenue DESC
    `);

    // Stats résumées
    const classes = { A: [], B: [], C: [] };
    result.rows.forEach(row => {
      classes[row.abc_class].push(row);
    });

    res.json({
      success: true,
      data: {
        articles: result.rows,
        summary: {
          A: { count: classes.A.length, revenue: classes.A.reduce((s, r) => s + parseFloat(r.total_revenue), 0) },
          B: { count: classes.B.length, revenue: classes.B.reduce((s, r) => s + parseFloat(r.total_revenue), 0) },
          C: { count: classes.C.length, revenue: classes.C.reduce((s, r) => s + parseFloat(r.total_revenue), 0) },
        }
      }
    });
  } catch (error) {
    console.error('Erreur ABC:', error);
    res.status(500).json({ success: false, message: 'Erreur analyse ABC' });
  }
};

// ── Produits dormants (stock qui ne bouge pas depuis X jours) ────────────────
exports.getDormantProducts = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    const result = await pool.query(`
      SELECT
        a.id,
        a.name_article,
        a.categorie,
        a.quantity AS current_stock,
        a.unit_price,
        (a.quantity * a.unit_price) AS stock_value,
        MAX(s.date_sate) AS last_sale_date,
        EXTRACT(DAY FROM NOW() - MAX(s.date_sate)) AS days_since_last_sale,
        COUNT(s.id) AS total_sales
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article
      GROUP BY a.id, a.name_article, a.categorie, a.quantity, a.unit_price
      HAVING MAX(s.date_sate) IS NULL
         OR MAX(s.date_sate) < NOW() - INTERVAL '1 day' * ${days}
      ORDER BY stock_value DESC
    `);

    // Suggestions d'action
    const suggestions = result.rows.map(article => {
      let action = 'Surveiller';
      let priority = 'low';

      if (article.total_sales === 0) {
        action = 'Article jamais vendu — envisager suppression ou promotion';
        priority = 'high';
      } else if (article.stock_value > 100000) {
        action = 'Fort capital immobilisé — promotion ou déstockage recommandé';
        priority = 'high';
      } else if (article.stock_value > 50000) {
        action = 'Capital significatif — réduire le stock via promotion';
        priority = 'medium';
      } else {
        action = 'Stock faible — attendre ou retour fournisseur';
        priority = 'low';
      }

      return { ...article, suggested_action: action, priority };
    });

    res.json({
      success: true,
      count: suggestions.length,
      days_threshold: days,
      total_dormant_value: suggestions.reduce((s, r) => s + parseFloat(r.stock_value), 0),
      data: suggestions
    });
  } catch (error) {
    console.error('Erreur dormants:', error);
    res.status(500).json({ success: false, message: 'Erreur produits dormants' });
  }
};

// ── Point de commande dynamique ───────────────────────────────────────────────
exports.getReorderSuggestions = async (req, res) => {
  try {
    const result = await pool.query(`
      WITH demand_stats AS (
        SELECT
          a.id AS article_id,
          a.name_article,
          a.quantity AS current_stock,
          a.unit_price,
          COALESCE(AVG(daily.qty), 0) AS avg_daily_demand,
          COALESCE(MAX(daily.qty), 0) AS max_daily_demand
        FROM article a
        LEFT JOIN (
          SELECT id_article, DATE(date_sate) AS sale_date, SUM(quantity) AS qty
          FROM sale
          WHERE date_sate >= NOW() - INTERVAL '90 days'
          GROUP BY id_article, DATE(date_sate)
        ) daily ON a.id = daily.id_article
        GROUP BY a.id, a.name_article, a.quantity, a.unit_price
      )
      SELECT
        ds.*,
        7 AS lead_time_days,
        5 AS safety_stock,
        10 AS min_stock,
        100 AS max_stock,
        CEIL(ds.avg_daily_demand * 7 + 5) AS reorder_point,
        CASE
          WHEN ds.current_stock <= CEIL(ds.avg_daily_demand * 7 + 5)
          THEN 100 - ds.current_stock
          ELSE 0
        END AS suggested_order_qty,
        CASE
          WHEN ds.avg_daily_demand > 0
          THEN FLOOR(ds.current_stock / ds.avg_daily_demand)
          ELSE 999
        END AS days_of_stock_remaining
      FROM demand_stats ds
      WHERE ds.current_stock <= CEIL(ds.avg_daily_demand * 7 + 5)
         OR (ds.avg_daily_demand = 0 AND ds.current_stock < 10)
      ORDER BY
        CASE WHEN ds.avg_daily_demand > 0 THEN ds.current_stock / ds.avg_daily_demand ELSE 999 END ASC
    `);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur reorder:', error);
    res.status(500).json({ success: false, message: 'Erreur point de commande' });
  }
};

// ── Configurer une règle de réapprovisionnement ──────────────────────────────
exports.setReorderRule = async (req, res) => {
  try {
    const { article_id, min_stock, max_stock, lead_time_days, safety_stock, auto_reorder } = req.body;

    if (!article_id) {
      return res.status(400).json({ success: false, message: 'article_id requis' });
    }

    const result = await pool.query(`
      INSERT INTO reorder_rule (article_id, min_stock, max_stock, reorder_point, lead_time_days, safety_stock, auto_reorder, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (article_id) DO UPDATE SET
        min_stock = EXCLUDED.min_stock,
        max_stock = EXCLUDED.max_stock,
        reorder_point = EXCLUDED.reorder_point,
        lead_time_days = EXCLUDED.lead_time_days,
        safety_stock = EXCLUDED.safety_stock,
        auto_reorder = EXCLUDED.auto_reorder,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      article_id,
      min_stock || 10,
      max_stock || 100,
      CEIL((req.body.avg_daily_demand || 5) * (lead_time_days || 7) + (safety_stock || 5)),
      lead_time_days || 7,
      safety_stock || 5,
      auto_reorder || false,
      req.organizationId
    ]);

    res.json({
      success: true,
      message: 'Règle de réapprovisionnement configurée',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur reorder rule:', error);
    res.status(500).json({ success: false, message: 'Erreur configuration réapprovisionnement' });
  }
};

// ── FEFO: Sortie First Expired First Out ─────────────────────────────────────
exports.getFEFOSuggestion = async (req, res) => {
  try {
    const { article_id, quantity_needed } = req.query;

    if (!article_id || !quantity_needed) {
      return res.status(400).json({ success: false, message: 'article_id et quantity_needed requis' });
    }

    // Trouver les lots par ordre de péremption (FEFO)
    const lots = await pool.query(`
      SELECT
        id, lot_number, quantity, expiration_date, received_date
      FROM product_lot
      WHERE article_id = $1
        AND status = 'active'
        AND quantity > 0
        AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE)
      ORDER BY
        CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,
        expiration_date ASC,
        received_date ASC
    `, [article_id]);

    let remaining = parseInt(quantity_needed);
    const allocation = [];

    for (const lot of lots.rows) {
      if (remaining <= 0) break;
      const take = Math.min(lot.quantity, remaining);
      allocation.push({
        lot_id: lot.id,
        lot_number: lot.lot_number,
        quantity_to_take: take,
        expiration_date: lot.expiration_date,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      return res.status(400).json({
        success: false,
        message: `Stock insuffisant. Manque ${remaining} unités.`,
        allocation,
        shortfall: remaining
      });
    }

    res.json({
      success: true,
      message: 'Allocation FEFO calculée',
      allocation,
      total_allocated: parseInt(quantity_needed)
    });
  } catch (error) {
    console.error('Erreur FEFO:', error);
    res.status(500).json({ success: false, message: 'Erreur FEFO' });
  }
};
