const pool = require('../config/database');

// Générer un rapport IA automatique
exports.generateAIReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role_id === 1;
    const storeId = req.user.store_id;
    
    // Filtrer par magasin si pas admin
    const storeCondition = isAdmin ? '' : `WHERE store_id = ${storeId}`;
    
    // 1. Analyser les bestsellers (top 5)
    const bestSellersResult = await pool.query(`
      SELECT a.name_article, 
             COUNT(s.id) as nombre_ventes,
             SUM(s.quantity) as quantite_vendue,
             SUM(s.price) as chiffre_affaires
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article
      ${storeCondition}
      GROUP BY a.id, a.name_article
      HAVING COUNT(s.id) > 0
      ORDER BY chiffre_affaires DESC
      LIMIT 5
    `);
    
    // 2. Analyser les articles qui se vendent mal (moins de 2 ventes)
    const badSellersResult = await pool.query(`
      SELECT a.name_article, 
             COALESCE(COUNT(s.id), 0) as nombre_ventes,
             a.quantity as stock_restant
      FROM article a
      LEFT JOIN sale s ON a.id = s.id_article ${storeCondition ? 'AND ' + storeCondition : ''}
      GROUP BY a.id, a.name_article, a.quantity
      HAVING COUNT(s.id) < 2
      ORDER BY nombre_ventes ASC
      LIMIT 5
    `);
    
    // 3. Articles à réapprovisionner (stock < 20)
    const lowStockResult = await pool.query(`
      SELECT name_article, quantity, unit_price
      FROM article
      WHERE quantity < 20
      ORDER BY quantity ASC
      LIMIT 10
    `);
    
    // 4. Prévisions basées sur les ventes des 7 derniers jours
    const recentSalesResult = await pool.query(`
      SELECT 
        COUNT(*) as ventes_7j,
        SUM(price) as ca_7j,
        AVG(price) as panier_moyen
      FROM sale
      WHERE date_sate >= NOW() - INTERVAL '7 days'
      ${storeCondition}
    `);
    
    // 5. Articles expirés ou bientôt expirés
    const expiringResult = await pool.query(`
      SELECT name_article, expiration_date, quantity
      FROM article
      WHERE expiration_date < NOW() + INTERVAL '30 days'
      AND quantity > 0
      ORDER BY expiration_date ASC
      LIMIT 5
    `);
    
    // Construction du rapport IA
    const bestsellers = bestSellersResult.rows
      .map(item => `${item.name_article} (${item.nombre_ventes} ventes, ${item.chiffre_affaires} FCFA)`)
      .join(', ');
    
    const badsellers = badSellersResult.rows
      .map(item => `${item.name_article} (${item.nombre_ventes} ventes, stock: ${item.stock_restant})`)
      .join(', ');
    
    const approvisionnements = lowStockResult.rows
      .map(item => `${item.name_article} (stock: ${item.quantity}, prix: ${item.unit_price} FCFA)`)
      .join(', ');
    
    const stats = recentSalesResult.rows[0];
    const previsionCA = Math.round(stats.ca_7j * 4.3); // Projection mensuelle
    
    const expiring = expiringResult.rows
      .map(item => `${item.name_article} (expire le ${new Date(item.expiration_date).toLocaleDateString()})`)
      .join(', ');
    
    // Générer les prévisions IA
    const iaPrevision = `
Basé sur l'analyse des 7 derniers jours :
- Ventes: ${stats.ventes_7j} transactions
- Chiffre d'affaires: ${Math.round(stats.ca_7j)} FCFA
- Panier moyen: ${Math.round(stats.panier_moyen)} FCFA
- Projection CA mensuel: ${previsionCA} FCFA
- Tendance: ${stats.ventes_7j > 10 ? 'Positive ✅' : 'À surveiller ⚠️'}

Recommandations:
${stats.ventes_7j > 15 ? '- Excellente performance! Maintenir la stratégie actuelle.' : '- Performance modérée. Envisager des promotions.'}
${lowStockResult.rows.length > 5 ? '- URGENT: Réapprovisionner rapidement les articles en rupture.' : '- Stock globalement correct.'}
${expiringResult.rows.length > 0 ? '- ATTENTION: Des produits arrivent à expiration. Promotions recommandées.' : '- Pas de problème d\'expiration imminent.'}
    `.trim();
    
    const titre = `Rapport IA - ${new Date().toLocaleDateString('fr-FR')} ${isAdmin ? '(Tous magasins)' : '(Magasin: ' + req.user.store_name + ')'}`;
    
    // Sauvegarder le rapport dans la base
    const rapportResult = await pool.query(
      `INSERT INTO rapport (titre, user_id, ia_prompt, bestseller_article, ia_prevision, badselle_article, approvions_article)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        titre,
        userId,
        'Analyse automatique des ventes et du stock',
        bestsellers || 'Aucune vente récente',
        iaPrevision,
        badsellers || 'Tous les articles se vendent bien',
        approvisionnements || 'Stock suffisant partout'
      ]
    );
    
    res.json({
      success: true,
      message: 'Rapport IA généré avec succès',
      data: {
        rapport: rapportResult.rows[0],
        details: {
          bestsellers: bestSellersResult.rows,
          badsellers: badSellersResult.rows,
          low_stock: lowStockResult.rows,
          expiring_soon: expiringResult.rows,
          statistics: stats
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du rapport IA',
      error: error.message
    });
  }
};

// Récupérer tous les rapports
exports.getAllReports = async (req, res) => {
  try {
    const isAdmin = req.user.role_id === 1;
    let query = `
      SELECT r.*, u.username
      FROM rapport r
      JOIN "user" u ON r.user_id = u.id
    `;
    
    // Si pas admin, voir seulement ses rapports
    if (!isAdmin) {
      query += ` WHERE r.user_id = ${req.user.id}`;
    }
    
    query += ' ORDER BY r.prompt_date DESC LIMIT 50';
    
    const result = await pool.query(query);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rapports'
    });
  }
};

// Récupérer un rapport par ID
exports.getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.*, u.username
       FROM rapport r
       JOIN "user" u ON r.user_id = u.id
       WHERE r.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du rapport'
    });
  }
};

// Supprimer un rapport
exports.deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM rapport WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rapport non trouvé'
      });
    }
    
    res.json({
      success: true,
      message: 'Rapport supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du rapport'
    });
  }
};