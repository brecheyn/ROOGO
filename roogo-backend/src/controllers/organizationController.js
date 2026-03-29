const pool = require("../config/database");
const bcrypt = require("bcrypt");

// Inscription d'une nouvelle organisation (Sign Up)
exports.signUp = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      organization_name,
      slug,
      admin_username,
      admin_password,
      admin_email,
      contact_phone,
      subscription_plan = "free",
    } = req.body;

    // Validation
    if (
      !organization_name ||
      !slug ||
      !admin_username ||
      !admin_password ||
      !admin_email
    ) {
      return res.status(400).json({
        success: false,
        message: "Tous les champs obligatoires doivent être remplis",
      });
    }

    await client.query("BEGIN");

    // Vérifier si le slug existe déjà
    const slugCheck = await client.query(
      "SELECT id FROM organization WHERE slug = $1",
      [slug],
    );

    if (slugCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Ce nom d'organisation est déjà utilisé",
      });
    }

    // Récupérer les limites du plan
    const planResult = await client.query(
      "SELECT * FROM subscription_plan WHERE name = $1",
      [subscription_plan],
    );

    if (planResult.rows.length === 0) {
      throw new Error("Plan d'abonnement invalide");
    }

    const plan = planResult.rows[0];

    // Créer l'organisation
    const orgResult = await client.query(
      `INSERT INTO organization (name, slug, subscription_plan, max_users, max_stores, max_storage_mb, contact_email, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        organization_name,
        slug,
        subscription_plan,
        plan.max_users,
        plan.max_stores,
        plan.max_storage_mb,
        admin_email,
        contact_phone,
      ],
    );

    const organization = orgResult.rows[0];

    // Créer le rôle Admin s'il n'existe pas
    let adminRoleId;
    const roleCheck = await client.query(
      "SELECT id FROM role WHERE name_role = $1",
      ["Admin"],
    );
    if (roleCheck.rows.length > 0) {
      adminRoleId = roleCheck.rows[0].id;
    } else {
      const roleResult = await client.query(
        "INSERT INTO role (name_role) VALUES ($1) RETURNING id",
        ["Admin"],
      );
      adminRoleId = roleResult.rows[0].id;
    }

    // Hasher le mot de passe (en production)
    // const hashedPassword = await bcrypt.hash(admin_password, 10);

    // Créer l'utilisateur admin
    const userResult = await client.query(
      `INSERT INTO "user" (username, password, email, role_id, organization_id, store_id)
       VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id, username, email`,
      [
        admin_username,
        admin_password,
        admin_email,
        adminRoleId,
        organization.id,
      ],
    );

    const admin = userResult.rows[0];

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Organisation créée avec succès!",
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          domain: `${organization.slug}.roogo.com`,
          subscription_plan: organization.subscription_plan,
        },
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
        },
        next_steps: [
          "Connectez-vous avec vos identifiants",
          `Accédez à votre tableau de bord: https://${organization.slug}.roogo.com`,
          "Configurez votre premier magasin",
        ],
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de l'organisation",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// Obtenir les informations de l'organisation
exports.getOrganization = async (req, res) => {
  try {
    const orgId = req.organizationId;

    const result = await pool.query(
      `SELECT o.*, sp.features
       FROM organization o
       JOIN subscription_plan sp ON o.subscription_plan = sp.name
       WHERE o.id = $1`,
      [orgId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Organisation non trouvée",
      });
    }

    // Obtenir les statistiques
    const stats = await pool.query(
      "SELECT * FROM v_organization_stats WHERE id = $1",
      [orgId],
    );

    const limits = await pool.query(
      "SELECT * FROM v_organization_limits WHERE id = $1",
      [orgId],
    );

    res.json({
      success: true,
      data: {
        organization: result.rows[0],
        statistics: stats.rows[0],
        limits: limits.rows[0],
      },
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des informations",
    });
  }
};

// Mettre à jour l'organisation
exports.updateOrganization = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { name, contact_email, contact_phone, address, logo_url } = req.body;

    const result = await pool.query(
      `UPDATE organization 
       SET name = $1, contact_email = $2, contact_phone = $3, address = $4, logo_url = $5
       WHERE id = $6 RETURNING *`,
      [name, contact_email, contact_phone, address, logo_url, orgId],
    );

    res.json({
      success: true,
      message: "Organisation mise à jour",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour",
    });
  }
};

// Upgrader le plan
exports.upgradePlan = async (req, res) => {
  try {
    const orgId = req.organizationId;
    const { new_plan } = req.body; // 'pro' ou 'enterprise'

    // Vérifier que le nouveau plan existe
    const planResult = await pool.query(
      "SELECT * FROM subscription_plan WHERE name = $1",
      [new_plan],
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Plan invalide",
      });
    }

    const plan = planResult.rows[0];

    // Mettre à jour l'organisation
    const result = await pool.query(
      `UPDATE organization 
       SET subscription_plan = $1, max_users = $2, max_stores = $3, max_storage_mb = $4,
           subscription_expires_at = NOW() + INTERVAL '30 days'
       WHERE id = $5 RETURNING *`,
      [new_plan, plan.max_users, plan.max_stores, plan.max_storage_mb, orgId],
    );

    res.json({
      success: true,
      message: "Plan mis à niveau avec succès!",
      data: {
        organization: result.rows[0],
        new_features: plan.features,
        billing: {
          amount_monthly: plan.price_monthly,
          amount_yearly: plan.price_yearly,
          currency: "FCFA",
        },
      },
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à niveau",
    });
  }
};

// Liste des plans disponibles
exports.getAvailablePlans = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subscription_plan WHERE is_active = true ORDER BY price_monthly",
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur",
    });
  }
};
