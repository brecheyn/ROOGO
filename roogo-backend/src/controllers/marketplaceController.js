const pool = require('../config/database');

// ── Marketplace: annonces fournisseurs ───────────────────────────────────────
exports.getSupplierListings = async (req, res) => {
  try {
    const { category, min_price, max_price, search, sort } = req.query;

    let query = `
      SELECT
        sc.id,
        sc.supplier_id,
        s.name AS supplier_name,
        sc.product_name AS article_name,
        sc.supplier_price AS unit_price,
        sc.min_order_quantity AS min_quantity,
        sc.lead_time_days,
        sc.article_id
      FROM supplier_catalog sc
      LEFT JOIN supplier s ON sc.supplier_id = s.id
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (category) {
      query += ` AND sc.product_name ILIKE $${paramIdx}`;
      params.push(`%${category}%`);
      paramIdx++;
    }
    if (min_price) {
      query += ` AND sc.supplier_price >= $${paramIdx}`;
      params.push(parseFloat(min_price));
      paramIdx++;
    }
    if (max_price) {
      query += ` AND sc.supplier_price <= $${paramIdx}`;
      params.push(parseFloat(max_price));
      paramIdx++;
    }
    if (search) {
      query += ` AND (sc.product_name ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const sortMap = {
      price_asc: 'sc.supplier_price ASC',
      price_desc: 'sc.supplier_price DESC',
      newest: 'sc.last_updated DESC',
      name: 'sc.product_name ASC',
    };
    query += ` ORDER BY ${sortMap[sort] || 'sc.last_updated DESC'}`;
    query += ' LIMIT 50';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Erreur listings:', error);
    res.status(500).json({ success: false, message: 'Erreur marketplace' });
  }
};

// ── Commander depuis le marketplace ──────────────────────────────────────────
exports.placeMarketplaceOrder = async (req, res) => {
  try {
    const { supplier_catalog_id, quantity, delivery_address, notes } = req.body;

    if (!supplier_catalog_id || !quantity) {
      return res.status(400).json({ success: false, message: 'supplier_catalog_id et quantity requis' });
    }

    const listing = await pool.query(
      'SELECT sc.*, s.name AS supplier_name FROM supplier_catalog sc LEFT JOIN supplier s ON sc.supplier_id = s.id WHERE sc.id = $1',
      [supplier_catalog_id]
    );

    if (listing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Annonce introuvable ou indisponible' });
    }

    const item = listing.rows[0];

    if (quantity < item.min_order_quantity) {
      return res.status(400).json({
        success: false,
        message: `Quantité minimum: ${item.min_order_quantity} unités`
      });
    }

    const totalCost = parseFloat(item.supplier_price) * quantity;

    // Créer la commande
    const orderResult = await pool.query(`
      INSERT INTO ordering (supplier_id, reference, price, date_ordering, notes, organization_id)
      VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)
      RETURNING id
    `, [
      item.supplier_id,
      `MKT-${Date.now()}`,
      totalCost,
      `Commande marketplace: ${item.article_name} x${quantity}. ${notes || ''}`,
      req.organizationId,
    ]);

    // Log
    await pool.query(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, details, organization_id)
      VALUES ($1, 'marketplace_order', 'ordering', $2, $3, $4)
    `, [
      req.user?.id,
      orderResult.rows[0].id,
      JSON.stringify({
        listing_id: supplier_catalog_id,
        article: item.article_name,
        supplier: item.supplier_id,
        quantity,
        total: totalCost,
        delivery_address,
      }),
      req.organizationId,
    ]);

    res.status(201).json({
      success: true,
      message: 'Commande marketplace passée',
      data: {
        order_id: orderResult.rows[0].id,
        supplier: item.supplier_name,
        article: item.article_name,
        quantity,
        unit_price: item.unit_price,
        total: totalCost,
        estimated_delivery: `${item.lead_time_days} jours`,
      }
    });
  } catch (error) {
    console.error('Erreur marketplace order:', error);
    res.status(500).json({ success: false, message: 'Erreur commande marketplace' });
  }
};

// ── E-commerce: sync produits vers boutique en ligne ─────────────────────────
exports.getEcommerceSync = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.name_article,
        a.unit_price,
        a.quantity,
        a.categorie,
        a.expiration_date,
        CASE
          WHEN a.quantity > 10 THEN 'in_stock'
          WHEN a.quantity > 0 THEN 'low_stock'
          ELSE 'out_of_stock'
        END AS availability
      FROM article a
      WHERE a.quantity > 0
      ORDER BY a.name_article ASC
    `);

    const syncData = result.rows.map(r => ({
      id: `PROD-${r.id}`,
      title: r.name_article,
      description: r.name_article,
      price: parseFloat(r.unit_price),
      currency: 'XOF',
      category: r.categorie || 'Général',
      stock_quantity: r.quantity,
      availability: r.availability,
      images: [],
      metadata: {
        internal_id: r.id,
        expiration_date: r.expiration_date,
      }
    }));

    res.json({
      success: true,
      format: 'JSON-LD / Shopify Compatible',
      count: syncData.length,
      products: syncData,
    });
  } catch (error) {
    console.error('Erreur ecommerce:', error);
    res.status(500).json({ success: false, message: 'Erreur sync e-commerce' });
  }
};

// ── Alertes WhatsApp / SMS ──────────────────────────────────────────────────
exports.sendStockAlert = async (req, res) => {
  try {
    const { article_id, alert_type, recipients } = req.body;

    const article = await pool.query(
      'SELECT * FROM article WHERE id = $1',
      [article_id]
    );

    if (article.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Article introuvable' });
    }

    const a = article.rows[0];

    const messages = {
      low_stock: `⚠️ STOCK BAS: "${a.name_article}" — ${a.quantity} unités restantes. Réapprovisionnement recommandé.`,
      out_of_stock: `🔴 RUPTURE: "${a.name_article}" est en rupture de stock !`,
      expiry_warning: `⏰ PÉREMPTION: "${a.name_article}" expire bientôt (${a.expiration_date ? new Date(a.expiration_date).toLocaleDateString('fr-FR') : 'N/A'}).`,
    };

    const message = messages[alert_type] || messages.low_stock;

    // En prod: intégrer Twilio, Africa's Talking, ou WhatsApp Business API
    // Ici on simule l'envoi
    const alertRecord = {
      article_id,
      article_name: a.name_article,
      alert_type,
      message,
      recipients: recipients || [],
      status: 'sent_simulation',
      sent_at: new Date().toISOString(),
    };

    await pool.query(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, details, organization_id)
      VALUES ($1, 'stock_alert', 'article', $2, $3, $4)
    `, [
      req.user?.id,
      article_id,
      JSON.stringify(alertRecord),
      req.organizationId,
    ]);

    // Socket.io notification
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organization?.slug || 'default'}`).emit('stock-alert', alertRecord);
    }

    res.json({
      success: true,
      message: 'Alerte envoyée (simulation)',
      data: alertRecord,
      note: 'En production, intégrer Twilio/Africa\'s Talking pour l\'envoi réel.',
    });
  } catch (error) {
    console.error('Erreur alert:', error);
    res.status(500).json({ success: false, message: 'Erreur envoi alerte' });
  }
};

// ── Alertes automatiques (batch) ────────────────────────────────────────────
exports.runAutoAlerts = async (req, res) => {
  try {
    const alerts = [];

    // Produits en stock bas
    const lowStock = await pool.query(`
      SELECT id, name_article, quantity FROM article WHERE quantity <= 10 AND quantity > 0
    `);
    lowStock.rows.forEach(r => {
      alerts.push({
        type: 'low_stock',
        article_id: r.id,
        article_name: r.name_article,
        message: `Stock bas: ${r.quantity} unités`,
      });
    });

    // Produits expirés
    const expired = await pool.query(`
      SELECT id, name_article, expiration_date FROM article
      WHERE expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE + INTERVAL '7 days'
    `);
    expired.rows.forEach(r => {
      alerts.push({
        type: 'expiry_warning',
        article_id: r.id,
        article_name: r.name_article,
        message: `Expire le ${new Date(r.expiration_date).toLocaleDateString('fr-FR')}`,
      });
    });

    // Log
    await pool.query(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, details, organization_id)
      VALUES ($1, 'auto_alerts_batch', 'system', NULL, $2, $3)
    `, [
      req.user?.id,
      JSON.stringify({ alerts_count: alerts.length, alerts: alerts.slice(0, 20) }),
      req.organizationId,
    ]);

    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Erreur auto alerts:', error);
    res.status(500).json({ success: false, message: 'Erreur alertes automatiques' });
  }
};
