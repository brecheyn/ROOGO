const pool = require('../config/database');
const QRCode = require('qrcode');

// ── Générer QR code pour un article ──────────────────────────────────────────
exports.generateArticleQR = async (req, res) => {
  try {
    const { id } = req.params;
    const { size } = req.query; // small, medium, large

    const result = await pool.query(
      'SELECT id, name_article, categorie, quantity, unit_price FROM article WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Article non trouvé' });
    }

    const article = result.rows[0];

    // Payload du QR code
    const payload = JSON.stringify({
      type: 'ROOGO_ARTICLE',
      id: article.id,
      name: article.name_article,
      category: article.categorie,
      price: article.unit_price,
      stock: article.quantity,
      generated: new Date().toISOString(),
    });

    const qrSize = size === 'large' ? 512 : size === 'small' ? 128 : 256;

    const qrDataUrl = await QRCode.toDataURL(payload, {
      width: qrSize,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
    });

    res.json({
      success: true,
      data: {
        article,
        qr: qrDataUrl,
        payload,
        size: qrSize,
      }
    });
  } catch (error) {
    console.error('Erreur QR:', error);
    res.status(500).json({ success: false, message: 'Erreur génération QR code' });
  }
};

// ── Générer QR codes en lot (tous les articles) ─────────────────────────────
exports.generateAllQRCodes = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name_article, categorie, quantity, unit_price FROM article ORDER BY id'
    );

    const qrs = await Promise.all(
      result.rows.map(async (article) => {
        const payload = JSON.stringify({
          type: 'ROOGO_ARTICLE',
          id: article.id,
          name: article.name_article,
          price: article.unit_price,
        });

        const qr = await QRCode.toDataURL(payload, {
          width: 256,
          margin: 1,
          errorCorrectionLevel: 'M',
        });

        return { article, qr, payload };
      })
    );

    res.json({
      success: true,
      count: qrs.length,
      data: qrs
    });
  } catch (error) {
    console.error('Erreur QR batch:', error);
    res.status(500).json({ success: false, message: 'Erreur génération QR codes' });
  }
};

// ── Lookup article par barcode/QR scanné ─────────────────────────────────────
exports.lookupByBarcode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Code requis' });
    }

    // Essayer de parser le QR code ROOGO
    let parsed;
    try {
      parsed = JSON.parse(code);
    } catch {
      // Ce n'est pas du JSON — chercher par nom ou référence
      const searchResult = await pool.query(`
        SELECT id, name_article, categorie, quantity, unit_price, expiration_date
        FROM article
        WHERE name_article ILIKE $1
           OR CAST(id AS TEXT) = $1
        LIMIT 5
      `, [`%${code}%`]);

      return res.json({
        success: true,
        type: 'text_search',
        count: searchResult.rows.length,
        data: searchResult.rows
      });
    }

    // QR code ROOGO
    if (parsed.type === 'ROOGO_ARTICLE' && parsed.id) {
      const result = await pool.query(`
        SELECT a.id, a.name_article, a.categorie, a.quantity, a.unit_price,
               a.date_manufacture, a.expiration_date,
               (SELECT COUNT(*) FROM product_lot pl WHERE pl.article_id = a.id AND pl.status = 'active') AS active_lots,
               (SELECT SUM(pl.quantity) FROM product_lot pl WHERE pl.article_id = a.id AND pl.status = 'active') AS lot_stock
        FROM article a
        WHERE a.id = $1
      `, [parsed.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Article non trouvé' });
      }

      // Récupérer les lots FEFO
      const lots = await pool.query(`
        SELECT id, lot_number, quantity, expiration_date, received_date
        FROM product_lot
        WHERE article_id = $1 AND status = 'active' AND quantity > 0
        ORDER BY
          CASE WHEN expiration_date IS NULL THEN 1 ELSE 0 END,
          expiration_date ASC
      `, [parsed.id]);

      // Récupérer les numéros de série disponibles
      const serials = await pool.query(`
        SELECT id, serial_number, status
        FROM serial_number
        WHERE article_id = $1 AND status = 'in_stock'
        LIMIT 10
      `, [parsed.id]);

      return res.json({
        success: true,
        type: 'roogo_qr',
        data: {
          ...result.rows[0],
          lots: lots.rows,
          available_serials: serials.rows,
        }
      });
    }

    // Autre format de QR
    res.json({
      success: true,
      type: 'unknown_format',
      raw: parsed
    });
  } catch (error) {
    console.error('Erreur lookup:', error);
    res.status(500).json({ success: false, message: 'Erreur lookup barcode' });
  }
};

// ── Inventaire physique par scan ─────────────────────────────────────────────
exports.physicalInventory = async (req, res) => {
  try {
    const { items } = req.body; // [{ article_id, counted_quantity, lot_id?, serial_number? }]

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Liste d\'articles requise' });
    }

    const results = [];

    for (const item of items) {
      const { article_id, counted_quantity, lot_id, serial_number, notes } = item;

      // Récupérer le stock actuel
      const current = await pool.query('SELECT quantity, name_article FROM article WHERE id = $1', [article_id]);
      if (current.rows.length === 0) continue;

      const currentStock = current.rows[0].quantity;
      const difference = counted_quantity - currentStock;

      // Mettre à jour le stock
      await pool.query('UPDATE article SET quantity = $1 WHERE id = $2', [counted_quantity, article_id]);

      // Log le mouvement d'ajustement
      await pool.query(`
        INSERT INTO stock_movement (article_id, lot_id, movement_type, quantity, reference_type, notes, user_id, organization_id)
        VALUES ($1, $2, 'adjustment', $3, 'inventory', $4, $5, $6)
      `, [
        article_id,
        lot_id || null,
        difference,
        notes || `Inventaire physique: ${currentStock} → ${counted_quantity}`,
        req.user?.id,
        req.organizationId
      ]);

      results.push({
        article_id,
        article_name: current.rows[0].name_article,
        previous_stock: currentStock,
        counted_stock: counted_quantity,
        difference,
        status: difference === 0 ? 'correct' : difference > 0 ? 'surplus' : 'shortage'
      });
    }

    // Résumé
    const summary = {
      total_items: results.length,
      correct: results.filter(r => r.status === 'correct').length,
      surplus: results.filter(r => r.status === 'surplus').length,
      shortage: results.filter(r => r.status === 'shortage').length,
      total_difference: results.reduce((sum, r) => sum + r.difference, 0),
    };

    res.json({
      success: true,
      message: 'Inventaire physique enregistré',
      summary,
      details: results
    });
  } catch (error) {
    console.error('Erreur inventory:', error);
    res.status(500).json({ success: false, message: 'Erreur inventaire physique' });
  }
};

// ── Scan rapide (enregistrement d'une vente par scan) ────────────────────────
exports.quickSale = async (req, res) => {
  const client = await pool.connect();

  try {
    const { article_id, client_id, quantity, lot_id, serial_number } = req.body;
    const store_id = req.user.store_id;

    await client.query('BEGIN');

    // Vérifier le stock
    const articleResult = await client.query(
      'SELECT quantity, unit_price, name_article FROM article WHERE id = $1',
      [article_id]
    );

    if (articleResult.rows.length === 0) {
      throw new Error('Article non trouvé');
    }

    const article = articleResult.rows[0];

    if (article.quantity < quantity) {
      throw new Error(`Stock insuffisant. Disponible: ${article.quantity}`);
    }

    // Si lot spécifié, vérifier le lot
    if (lot_id) {
      const lotResult = await client.query(
        'SELECT quantity FROM product_lot WHERE id = $1 AND article_id = $2 AND status = $2',
        [lot_id, article_id]
      );

      if (lotResult.rows.length === 0) {
        throw new Error('Lot non trouvé ou inactif');
      }

      if (lotResult.rows[0].quantity < quantity) {
        throw new Error(`Stock du lot insuffisant. Disponible: ${lotResult.rows[0].quantity}`);
      }

      // Mettre à jour le lot
      await client.query(
        'UPDATE product_lot SET quantity = quantity - $1 WHERE id = $2',
        [quantity, lot_id]
      );

      // Si lot épuisé, marquer
      if (lotResult.rows[0].quantity - quantity <= 0) {
        await client.query("UPDATE product_lot SET status = 'depleted' WHERE id = $1", [lot_id]);
      }
    }

    // Créer la vente
    const price = article.unit_price * quantity;
    const saleResult = await client.query(
      `INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate, organization_id)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6) RETURNING *`,
      [article_id, client_id || null, store_id, quantity, price, req.organizationId]
    );

    // Mettre à jour le stock
    await client.query(
      'UPDATE article SET quantity = quantity - $1 WHERE id = $2',
      [quantity, article_id]
    );

    // Log mouvement
    await client.query(`
      INSERT INTO stock_movement (article_id, lot_id, movement_type, quantity, reference_id, reference_type, user_id, organization_id)
      VALUES ($1, $2, 'sale', $3, $4, 'sale', $5, $6)
    `, [article_id, lot_id || null, quantity, saleResult.rows[0].id, req.user?.id, req.organizationId]);

    // Si numéro de série, marquer comme vendu
    if (serial_number) {
      await client.query(
        "UPDATE serial_number SET status = 'sold', sale_id = $1, sold_at = CURRENT_TIMESTAMP WHERE serial_number = $2",
        [saleResult.rows[0].id, serial_number]
      );
    }

    await client.query('COMMIT');

    // Invalider cache
    const { cacheDelPattern } = require('../config/redis');
    await cacheDelPattern('dashboard:*');

    // Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organization?.slug || 'default'}`).emit('sale-created', {
        id: saleResult.rows[0].id,
        article: article.name_article,
        quantity,
        price,
        via: 'scan',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Vente enregistrée par scan',
      data: {
        sale: saleResult.rows[0],
        article_name: article.name_article,
        unit_price: article.unit_price,
        total: price,
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur quickSale:', error);
    res.status(500).json({ success: false, message: error.message || 'Erreur vente par scan' });
  } finally {
    client.release();
  }
};
