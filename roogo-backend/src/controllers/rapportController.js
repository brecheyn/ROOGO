const pool = require('../config/database');

// Générer un rapport IA automatique
exports.generateAIReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role_id === 1;
    const storeId = req.user.store_id;

    // 1. Analyser les bestsellers (top 5) — paramétré
    const bestSellersResult = isAdmin
      ? await pool.query(`
          SELECT a.name_article,
                 COUNT(s.id) as nombre_ventes,
                 SUM(s.quantity) as quantite_vendue,
                 SUM(s.price) as chiffre_affaires
          FROM article a
          LEFT JOIN sale s ON a.id = s.id_article
          GROUP BY a.id, a.name_article
          HAVING COUNT(s.id) > 0
          ORDER BY chiffre_affaires DESC
          LIMIT 5`)
      : await pool.query(`
          SELECT a.name_article,
                 COUNT(s.id) as nombre_ventes,
                 SUM(s.quantity) as quantite_vendue,
                 SUM(s.price) as chiffre_affaires
          FROM article a
          LEFT JOIN sale s ON a.id = s.id_article
          WHERE s.store_id = $1
          GROUP BY a.id, a.name_article
          HAVING COUNT(s.id) > 0
          ORDER BY chiffre_affaires DESC
          LIMIT 5`, [storeId]);

    // 2. Analyser les articles qui se vendent mal — paramétré
    const badSellersResult = isAdmin
      ? await pool.query(`
          SELECT a.name_article,
                 COALESCE(COUNT(s.id), 0) as nombre_ventes,
                 a.quantity as stock_restant
          FROM article a
          LEFT JOIN sale s ON a.id = s.id_article
          GROUP BY a.id, a.name_article, a.quantity
          HAVING COUNT(s.id) < 2
          ORDER BY nombre_ventes ASC
          LIMIT 5`)
      : await pool.query(`
          SELECT a.name_article,
                 COALESCE(COUNT(s.id), 0) as nombre_ventes,
                 a.quantity as stock_restant
          FROM article a
          LEFT JOIN sale s ON a.id = s.id_article AND s.store_id = $1
          GROUP BY a.id, a.name_article, a.quantity
          HAVING COUNT(s.id) < 2
          ORDER BY nombre_ventes ASC
          LIMIT 5`, [storeId]);

    // 3. Articles à réapprovisionner (stock < 20)
    const lowStockResult = await pool.query(`
      SELECT name_article, quantity, unit_price
      FROM article
      WHERE quantity < 20
      ORDER BY quantity ASC
      LIMIT 10`);

    // 4. Prévisions basées sur les ventes des 7 derniers jours — paramétré
    const recentSalesResult = isAdmin
      ? await pool.query(`
          SELECT
            COUNT(*) as ventes_7j,
            SUM(price) as ca_7j,
            AVG(price) as panier_moyen
          FROM sale
          WHERE date_sate >= NOW() - INTERVAL '7 days'`)
      : await pool.query(`
          SELECT
            COUNT(*) as ventes_7j,
            SUM(price) as ca_7j,
            AVG(price) as panier_moyen
          FROM sale
          WHERE date_sate >= NOW() - INTERVAL '7 days'
            AND store_id = $1`, [storeId]);

    // 5. Articles expirés ou bientôt expirés
    const expiringResult = await pool.query(`
      SELECT name_article, expiration_date, quantity
      FROM article
      WHERE expiration_date < NOW() + INTERVAL '30 days'
        AND quantity > 0
      ORDER BY expiration_date ASC
      LIMIT 5`);

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
    const ventes7j = parseInt(stats.ventes_7j, 10) || 0;
    const ca7j = Math.round(Number(stats.ca_7j) || 0);
    const panierMoyen = Math.round(Number(stats.panier_moyen) || 0);
    const previsionCA = Math.round(ca7j * 4.3);

    // Générer les prévisions IA
    // Sans données, la prévision doit LE DIRE : auparavant elle affichait
    // toujours « Performance modérée / À surveiller » même à zéro chiffre.
    const iaPrevision = ventes7j === 0 ? `
Aucune vente sur les 7 derniers jours — prévision IA indisponible.
Aucune donnée à analyser : les indicateurs resteront à zéro tant qu'aucune vente n'est enregistrée.

- Ventes: 0 transaction
- Chiffre d'affaires: 0 FCFA
- Projection CA mensuel: non calculable (base de calcul vide)
- Tendance: indéterminée (données insuffisantes)

Recommandations:
- Aucune donnée disponible : enregistrez au moins une vente pour activer les prévisions.
${lowStockResult.rows.length > 5 ? '- URGENT: Réapprovisionner rapidement les articles en rupture.' : (lowStockResult.rows.length > 0 ? '- Des articles ont un stock bas : à surveiller.' : '- Aucun article en stock : commencez par créer vos articles.')}
${expiringResult.rows.length > 0 ? '- ATTENTION: Des produits arrivent à expiration. Promotions recommandées.' : '- Pas de problème d\'expiration imminent.'}
    `.trim() : `
Basé sur l'analyse des 7 derniers jours :
- Ventes: ${ventes7j} transactions
- Chiffre d'affaires: ${ca7j} FCFA
- Panier moyen: ${panierMoyen} FCFA
- Projection CA mensuel: ${previsionCA} FCFA
- Tendance: ${ventes7j > 10 ? 'Positive' : 'À surveiller'}

Recommandations:
${ventes7j > 15 ? '- Excellente performance! Maintenir la stratégie actuelle.' : '- Performance modérée. Envisager des promotions.'}
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

    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`org:${req.organization?.slug}`).emit('report-generated', {
        reportId: rapportResult.rows[0].id,
        titre,
      });
    }

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

// Récupérer tous les rapports — paramétré
exports.getAllReports = async (req, res) => {
  try {
    const isAdmin = req.user.role_id === 1;

    const result = isAdmin
      ? await pool.query(`
          SELECT r.*, u.username
          FROM rapport r
          JOIN "user" u ON r.user_id = u.id
          ORDER BY r.prompt_date DESC LIMIT 50`)
      : await pool.query(`
          SELECT r.*, u.username
          FROM rapport r
          JOIN "user" u ON r.user_id = u.id
          WHERE r.user_id = $1
          ORDER BY r.prompt_date DESC LIMIT 50`, [req.user.id]);

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
    if (error && error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'Suppression impossible : ce rapport est référencé ailleurs.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du rapport'
    });
  }
};
