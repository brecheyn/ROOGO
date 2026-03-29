const pool = require("../config/database");

// Middleware pour identifier le tenant (organisation)
const identifyTenant = async (req, res, next) => {
  try {
    let organizationId = null;

    // Méthode 1 : Via sous-domaine (client1.roogo.com)
    const hostname = req.hostname;
    const subdomain = hostname.split(".")[0];

    if (subdomain && subdomain !== "www" && subdomain !== "localhost") {
      const result = await pool.query(
        "SELECT * FROM organization WHERE slug = $1 AND is_active = true",
        [subdomain],
      );

      if (result.rows.length > 0) {
        organizationId = result.rows[0].id;
        req.organization = result.rows[0];
      }
    }

    // Méthode 2 : Via header personnalisé
    if (!organizationId && req.headers["x-organization-slug"]) {
      const result = await pool.query(
        "SELECT * FROM organization WHERE slug = $1 AND is_active = true",
        [req.headers["x-organization-slug"]],
      );

      if (result.rows.length > 0) {
        organizationId = result.rows[0].id;
        req.organization = result.rows[0];
      }
    }

    // Méthode 3 : Via le user connecté (si déjà authentifié)
    if (!organizationId && req.user && req.user.organization_id) {
      const result = await pool.query(
        "SELECT * FROM organization WHERE id = $1 AND is_active = true",
        [req.user.organization_id],
      );

      if (result.rows.length > 0) {
        organizationId = result.rows[0].id;
        req.organization = result.rows[0];
      }
    }

    // Pas d'organisation trouvée
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message:
          "Organisation non identifiée. Utilisez un sous-domaine valide ou le header X-Organization-Slug",
      });
    }

    // Vérifier si l'abonnement est actif
    if (req.organization.subscription_status !== "active") {
      return res.status(403).json({
        success: false,
        message:
          "Abonnement suspendu ou expiré. Veuillez contacter le support.",
        subscription_status: req.organization.subscription_status,
      });
    }

    req.organizationId = organizationId;
    next();
  } catch (error) {
    console.error("Erreur identification tenant:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'identification de l'organisation",
    });
  }
};

// Middleware pour vérifier les limites du plan
const checkPlanLimits = (resource) => {
  return async (req, res, next) => {
    try {
      const orgId = req.organizationId;

      switch (resource) {
        case "user":
          const canAddUser = await pool.query(
            "SELECT can_add_user($1) as can_add",
            [orgId],
          );

          if (!canAddUser.rows[0].can_add) {
            return res.status(403).json({
              success: false,
              message:
                "Limite d'utilisateurs atteinte pour votre plan. Veuillez upgrader.",
              current_plan: req.organization.subscription_plan,
            });
          }
          break;

        case "store":
          const canAddStore = await pool.query(
            "SELECT can_add_store($1) as can_add",
            [orgId],
          );

          if (!canAddStore.rows[0].can_add) {
            return res.status(403).json({
              success: false,
              message:
                "Limite de magasins atteinte pour votre plan. Veuillez upgrader.",
              current_plan: req.organization.subscription_plan,
            });
          }
          break;
      }

      next();
    } catch (error) {
      console.error("Erreur vérification limites:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la vérification des limites",
      });
    }
  };
};

// Middleware pour vérifier l'accès à une fonctionnalité
const checkFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    try {
      const orgId = req.organizationId;

      const hasAccess = await pool.query(
        "SELECT has_feature($1, $2) as has_access",
        [orgId, featureName],
      );

      if (!hasAccess.rows[0].has_access) {
        return res.status(403).json({
          success: false,
          message: `La fonctionnalité "${featureName}" n'est pas disponible dans votre plan actuel.`,
          feature: featureName,
          current_plan: req.organization.subscription_plan,
          upgrade_url: "/api/organizations/upgrade",
        });
      }

      next();
    } catch (error) {
      console.error("Erreur vérification fonctionnalité:", error);
      res.status(500).json({
        success: false,
        message: "Erreur lors de la vérification des permissions",
      });
    }
  };
};

// Middleware pour filtrer les données par organisation
const filterByOrganization = (req, res, next) => {
  req.orgFilter = "WHERE organization_id = $1";
  req.orgParams = [req.organizationId];
  next();
};

module.exports = {
  identifyTenant,
  checkPlanLimits,
  checkFeatureAccess,
  filterByOrganization,
};
