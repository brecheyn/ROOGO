const pool = require("../config/database");
const nodemailer = require("nodemailer");

// Configuration du transporteur email (à configurer avec vos identifiants)
const transporter = nodemailer.createTransport({
  service: "gmail", // ou autre service
  auth: {
    user: process.env.EMAIL_USER || "votre_email@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "votre_mot_de_passe_app",
  },
});

// Récupérer toutes les notifications
exports.getAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role_id === 1;

    let query = `
      SELECT * FROM notification
      WHERE 1=1
    `;

    // Admin voit tout, les autres voient seulement leurs notifications
    if (!isAdmin) {
      query += ` AND user_id = ${userId}`;
    }

    query += " ORDER BY created_at DESC LIMIT 50";

    const result = await pool.query(query);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des notifications",
    });
  }
};

// Marquer une notification comme lue
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE notification SET is_read = true WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Notification non trouvée",
      });
    }

    res.json({
      success: true,
      message: "Notification marquée comme lue",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour de la notification",
    });
  }
};

// Créer une notification
exports.createNotification = async (userId, type, title, message) => {
  try {
    await pool.query(
      "INSERT INTO notification (user_id, type, title, message) VALUES ($1, $2, $3, $4)",
      [userId, type, title, message],
    );
  } catch (error) {
    console.error("Erreur création notification:", error);
  }
};

// Vérifier les alertes automatiques (stock bas, produits expirés)
exports.checkAutomaticAlerts = async (req, res) => {
  try {
    // 1. Vérifier le stock bas (< 10)
    const lowStockResult = await pool.query(`
      SELECT id, name_article, quantity FROM article WHERE quantity < 10
    `);

    if (lowStockResult.rows.length > 0) {
      // Notifier les admins et managers
      const adminsManagers = await pool.query(`
        SELECT id, email FROM "user" WHERE role_id IN (1, 2)
      `);

      for (const user of adminsManagers.rows) {
        const articles = lowStockResult.rows
          .map((a) => `${a.name_article} (${a.quantity})`)
          .join(", ");
        await exports.createNotification(
          user.id,
          "warning",
          "⚠️ Alerte Stock Bas",
          `${lowStockResult.rows.length} article(s) en stock bas: ${articles}`,
        );

        // Envoyer email si configuré
        if (user.email && process.env.EMAIL_USER) {
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "⚠️ Alerte Stock Bas - roogo",
            html: `
              <h2>Alerte Stock Bas</h2>
              <p>${lowStockResult.rows.length} article(s) ont un stock inférieur à 10:</p>
              <ul>
                ${lowStockResult.rows.map((a) => `<li>${a.name_article}: ${a.quantity} unités</li>`).join("")}
              </ul>
              <p>Veuillez réapprovisionner rapidement.</p>
            `,
          });
        }
      }
    }

    // 2. Vérifier les produits expirés
    const expiredResult = await pool.query(`
      SELECT id, name_article, expiration_date, quantity 
      FROM article 
      WHERE expiration_date < NOW() AND quantity > 0
    `);

    if (expiredResult.rows.length > 0) {
      const adminsManagers = await pool.query(`
        SELECT id, email FROM "user" WHERE role_id IN (1, 2)
      `);

      for (const user of adminsManagers.rows) {
        const articles = expiredResult.rows
          .map((a) => a.name_article)
          .join(", ");
        await exports.createNotification(
          user.id,
          "danger",
          "🚨 Produits Expirés",
          `${expiredResult.rows.length} produit(s) expiré(s): ${articles}`,
        );
      }
    }

    // 3. Vérifier les produits qui expirent dans 7 jours
    const expiringSoonResult = await pool.query(`
      SELECT id, name_article, expiration_date, quantity 
      FROM article 
      WHERE expiration_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' 
      AND quantity > 0
    `);

    if (expiringSoonResult.rows.length > 0) {
      const adminsManagers = await pool.query(`
        SELECT id FROM "user" WHERE role_id IN (1, 2)
      `);

      for (const user of adminsManagers.rows) {
        const articles = expiringSoonResult.rows
          .map(
            (a) =>
              `${a.name_article} (expire le ${new Date(a.expiration_date).toLocaleDateString()})`,
          )
          .join(", ");

        await exports.createNotification(
          user.id,
          "info",
          "📅 Produits Bientôt Expirés",
          `${expiringSoonResult.rows.length} produit(s) expirent dans 7 jours: ${articles}`,
        );
      }
    }

    res.json({
      success: true,
      message: "Vérification des alertes terminée",
      data: {
        low_stock: lowStockResult.rows.length,
        expired: expiredResult.rows.length,
        expiring_soon: expiringSoonResult.rows.length,
      },
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la vérification des alertes",
      error: error.message,
    });
  }
};

// Notification lors d'une nouvelle commande reçue
exports.notifyOrderReceived = async (orderId) => {
  try {
    const orderResult = await pool.query(
      `
      SELECT o.*, a.name_article, s.name as supplier_name
      FROM ordering o
      JOIN article a ON o.id_article = a.id
      JOIN supplier s ON o.id_supplier = s.id
      WHERE o.id = $1
    `,
      [orderId],
    );

    if (orderResult.rows.length > 0) {
      const order = orderResult.rows[0];

      // Notifier tous les managers et admins
      const managers = await pool.query(`
        SELECT id FROM "user" WHERE role_id IN (1, 2)
      `);

      for (const user of managers.rows) {
        await exports.createNotification(
          user.id,
          "success",
          "📦 Commande Reçue",
          `Commande #${order.id} reçue: ${order.quantity}x ${order.name_article} de ${order.supplier_name}`,
        );
      }
    }
  } catch (error) {
    console.error("Erreur notification commande:", error);
  }
};

// Supprimer toutes les notifications lues de l'utilisateur
exports.deleteReadNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      "DELETE FROM notification WHERE user_id = $1 AND is_read = true RETURNING *",
      [userId],
    );

    res.json({
      success: true,
      message: `${result.rows.length} notification(s) supprimée(s)`,
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression des notifications",
    });
  }
};
