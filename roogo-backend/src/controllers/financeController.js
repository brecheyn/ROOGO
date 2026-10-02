const pool = require('../config/database');

// ── Valorisation FIFO ────────────────────────────────────────────────────────
exports.getFIFOValuation = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id AS article_id,
        a.name_article,
        a.quantity AS current_stock,
        a.unit_price,
        SUM(pl.quantity) AS lot_total_qty,
        a.quantity * a.unit_price AS total_value
      FROM article a
      LEFT JOIN product_lot pl ON a.id = pl.article_id AND pl.status = 'active' AND pl.quantity > 0
      WHERE a.organization_id = $1 AND a.quantity > 0
      GROUP BY a.id, a.name_article, a.quantity, a.unit_price
      ORDER BY total_value DESC
    `, [req.organizationId]);

    // Calculer la valorisation totale
    let totalValue = 0;
    const byArticle = {};

    result.rows.forEach(row => {
      if (!byArticle[row.article_id]) {
        byArticle[row.article_id] = {
          name: row.name_article,
          stock: row.current_stock,
          price_per_unit: parseFloat(row.unit_price),
          total_value: parseFloat(row.total_value),
        };
      }
      totalValue += parseFloat(row.total_value);
    });

    res.json({
      success: true,
      method: 'FIFO',
      total_value: Math.round(totalValue * 100) / 100,
      articles: Object.values(byArticle),
    });
  } catch (error) {
    console.error('Erreur FIFO:', error);
    res.status(500).json({ success: false, message: 'Erreur valorisation FIFO' });
  }
};

// ── Valorisation Coût Moyen Pondéré ──────────────────────────────────────────
exports.getWeightedAvgValuation = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id AS article_id,
        a.name_article,
        a.quantity AS current_stock,
        a.unit_price AS weighted_avg_price,
        ROUND(a.quantity * a.unit_price, 2) AS total_value
      FROM article a
      WHERE a.organization_id = $1 AND a.quantity > 0
      ORDER BY total_value DESC
    `, [req.organizationId]);

    const totalValue = result.rows.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0);

    res.json({
      success: true,
      method: 'Coût Moyen Pondéré',
      total_value: Math.round(totalValue * 100) / 100,
      articles: result.rows,
    });
  } catch (error) {
    console.error('Erreur CMP:', error);
    res.status(500).json({ success: false, message: 'Erreur valorisation CMP' });
  }
};

// ── Coût de possession du stock ──────────────────────────────────────────────
exports.getHoldingCost = async (req, res) => {
  try {
    const storageCostPerUnit = parseFloat(req.query.storage_cost) || 50; // FCFA/unité/mois
    const insuranceRate = parseFloat(req.query.insurance_rate) || 0.02; // 2% de la valeur
    const obsolescenceRate = parseFloat(req.query.obsolescence_rate) || 0.05; // 5%

    const result = await pool.query(`
      SELECT
        a.id,
        a.name_article,
        a.quantity,
        a.unit_price,
        ROUND(a.quantity * a.unit_price, 2) AS stock_value,
        ROUND(a.quantity * $2, 2) AS storage_cost_monthly,
        ROUND(a.quantity * a.unit_price * $3, 2) AS insurance_cost_monthly,
        ROUND(a.quantity * a.unit_price * $4, 2) AS obsolescence_risk
      FROM article a
      WHERE a.organization_id = $1 AND a.quantity > 0
      ORDER BY stock_value DESC
    `, [req.organizationId, storageCostPerUnit, insuranceRate, obsolescenceRate]);

    const summary = {
      total_stock_value: 0,
      total_monthly_holding_cost: 0,
      total_annual_holding_cost: 0,
    };

    result.rows.forEach(r => {
      summary.total_stock_value += parseFloat(r.stock_value);
      summary.total_monthly_holding_cost += parseFloat(r.storage_cost_monthly) + parseFloat(r.insurance_cost_monthly);
    });

    summary.total_annual_holding_cost = summary.total_monthly_holding_cost * 12;

    res.json({
      success: true,
      parameters: { storageCostPerUnit, insuranceRate, obsolescenceRate },
      summary,
      articles: result.rows,
    });
  } catch (error) {
    console.error('Erreur holding:', error);
    res.status(500).json({ success: false, message: 'Erreur coût de possession' });
  }
};

// ── Simulation de scénarios ──────────────────────────────────────────────────
exports.simulateScenario = async (req, res) => {
  try {
    const { scenario, params } = req.body;

    // Récupérer l'état actuel
    const currentState = await pool.query(`
      SELECT
        a.id, a.name_article, a.quantity, a.unit_price,
        (a.quantity * a.unit_price) AS stock_value,
        COALESCE(
          (SELECT SUM(s.quantity) FROM sale s
           WHERE s.id_article = a.id AND s.organization_id = $1
             AND s.date_sate >= NOW() - INTERVAL '30 days'),
          0
        ) AS monthly_sales
      FROM article a
      WHERE a.organization_id = $1 AND a.quantity > 0
    `, [req.organizationId]);

    let simulations = [];

    switch (scenario) {
      case 'reduce_safety_stock': {
        // Réduire le stock de sécurité de X%
        const reductionPct = (params?.reduction_pct || 10) / 100;

        simulations = currentState.rows.map(r => {
          const freedCash = r.stock_value * reductionPct;
          const riskOfStockout = r.monthly_sales > 0
            ? Math.min(100, Math.round((reductionPct * 100) / (r.monthly_sales / 30) * 10))
            : 0;

          return {
            article: r.name_article,
            current_stock: r.quantity,
            reduction: Math.ceil(r.quantity * reductionPct),
            new_stock: r.quantity - Math.ceil(r.quantity * reductionPct),
            freed_cash: Math.round(freedCash),
            risk_of_stockout_pct: riskOfStockout,
          };
        });

        const totalFreed = simulations.reduce((s, r) => s + r.freed_cash, 0);
        const avgRisk = simulations.length > 0
          ? Math.round(simulations.reduce((s, r) => s + r.risk_of_stockout_pct, 0) / simulations.length)
          : 0;

        return res.json({
          success: true,
          scenario: 'Réduction du stock de sécurité',
          parameters: { reduction_pct: `${reductionPct * 100}%` },
          summary: {
            total_freed_cash: totalFreed,
            average_risk_pct: avgRisk,
            recommendation: avgRisk > 50 ? 'Risque trop élevé — réduire moins' : 'Réduction acceptable',
          },
          details: simulations,
        });
      }

      case 'promotion_impact': {
        // Impact d'une promotion de X%
        const discountPct = (params?.discount_pct || 20) / 100;
        const expectedSalesIncrease = params?.expected_increase || 2; // x2

        simulations = currentState.rows.map(r => {
          const discountedPrice = r.unit_price * (1 - discountPct);
          const currentRevenue = r.monthly_sales * r.unit_price;
          const promoRevenue = (r.monthly_sales * expectedSalesIncrease) * discountedPrice;
          const marginChange = promoRevenue - currentRevenue;

          return {
            article: r.name_article,
            current_price: r.unit_price,
            discounted_price: Math.round(discountedPrice),
            current_monthly_revenue: Math.round(currentRevenue),
            projected_monthly_revenue: Math.round(promoRevenue),
            margin_change: Math.round(marginChange),
            margin_change_pct: currentRevenue > 0 ? Math.round((marginChange / currentRevenue) * 100) : 0,
          };
        });

        const totalMarginChange = simulations.reduce((s, r) => s + r.margin_change, 0);

        return res.json({
          success: true,
          scenario: 'Impact d\'une promotion',
          parameters: { discount_pct: `${discountPct * 100}%`, expected_increase: `${expectedSalesIncrease}x` },
          summary: {
            total_margin_change: totalMarginChange,
            recommendation: totalMarginChange > 0 ? 'Promotion rentable' : 'Promotion déficitaire — augmenter le volume',
          },
          details: simulations,
        });
      }

      case 'discontinue_product': {
        // Impact d'arrêter un produit
        const articleId = params?.article_id;

        simulations = currentState.rows
          .filter(r => !articleId || r.id === articleId)
          .map(r => ({
            article: r.name_article,
            freed_cash: r.stock_value,
            monthly_lost_revenue: r.monthly_sales * r.unit_price,
            months_to_sell_out: r.monthly_sales > 0 ? Math.ceil(r.quantity / r.monthly_sales) : Infinity,
          }));

        const totalFreed = simulations.reduce((s, r) => s + r.freed_cash, 0);

        return res.json({
          success: true,
          scenario: 'Arrêt de produit',
          summary: {
            total_freed_cash: totalFreed,
            recommendation: totalFreed > 500000 ? 'Fort capital à libérer — considérer l\'arrêt' : 'Capital modéré — maintenir le produit',
          },
          details: simulations,
        });
      }

      default:
        return res.status(400).json({
          success: false,
          message: 'Scénario inconnu. Utilisez: reduce_safety_stock, promotion_impact, discontinue_product'
        });
    }
  } catch (error) {
    console.error('Erreur simulation:', error);
    res.status(500).json({ success: false, message: 'Erreur simulation' });
  }
};

// ── Rapport financier synthétique ────────────────────────────────────────────
exports.getFinancialSummary = async (req, res) => {
  try {
    // CA et marges
    const sales = await pool.query(`
      SELECT
        COALESCE(SUM(price), 0) AS total_revenue,
        COALESCE(SUM(quantity), 0) AS total_units_sold,
        COALESCE(AVG(price), 0) AS avg_basket,
        COUNT(*) AS total_transactions
      FROM sale
      WHERE organization_id = $1
        AND date_sate >= DATE_TRUNC('month', CURRENT_DATE)
    `, [req.organizationId]);

    // Valeur du stock
    const stock = await pool.query(`
      SELECT
        COALESCE(SUM(quantity * unit_price), 0) AS total_stock_value,
        COALESCE(SUM(quantity), 0) AS total_units,
        COUNT(*) AS total_articles
      FROM article WHERE organization_id = $1 AND quantity > 0
    `, [req.organizationId]);

    // Coût de possession mensuel estimé
    const holdingCost = parseFloat(stock.rows[0].total_stock_value) * 0.04; // 4%/mois

    // Stock turnover ratio
    const monthlyRevenue = parseFloat(sales.rows[0].total_revenue);
    const stockValue = parseFloat(stock.rows[0].total_stock_value);
    const turnoverRatio = stockValue > 0 ? (monthlyRevenue / stockValue).toFixed(2) : 0;

    // Days of supply
    const dailyDemand = parseInt(sales.rows[0].total_units_sold) / 30;
    const daysOfSupply = dailyDemand > 0 ? Math.round(parseInt(stock.rows[0].total_units) / dailyDemand) : 999;

    res.json({
      success: true,
      data: {
        sales: {
          monthly_revenue: Math.round(monthlyRevenue),
          units_sold: parseInt(sales.rows[0].total_units_sold),
          avg_basket: Math.round(parseFloat(sales.rows[0].avg_basket)),
          transactions: parseInt(sales.rows[0].total_transactions),
        },
        inventory: {
          total_value: Math.round(stockValue),
          total_units: parseInt(stock.rows[0].total_units),
          total_articles: parseInt(stock.rows[0].total_articles),
        },
        financial_metrics: {
          holding_cost_monthly: Math.round(holdingCost),
          turnover_ratio: parseFloat(turnoverRatio),
          days_of_supply: daysOfSupply,
          stock_to_sales_ratio: monthlyRevenue > 0 ? (stockValue / monthlyRevenue).toFixed(2) : 0,
        },
      }
    });
  } catch (error) {
    console.error('Erreur financial:', error);
    res.status(500).json({ success: false, message: 'Erreur rapport financier' });
  }
};
