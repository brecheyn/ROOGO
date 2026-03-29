const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { identifyTenant } = require('../middleware/tenant');

// Route publique - Inscription (Sign Up)
router.post('/signup', organizationController.signUp);

// Routes protégées - Nécessitent authentification ET identification du tenant
router.use(authenticateToken);
router.use(identifyTenant);

// GET /api/organizations - Infos de l'organisation
router.get('/', organizationController.getOrganization);

// PUT /api/organizations - Mettre à jour l'organisation (Admin seulement)
router.put('/', checkRole([1]), organizationController.updateOrganization);

// POST /api/organizations/upgrade - Upgrader le plan (Admin seulement)
router.post('/upgrade', checkRole([1]), organizationController.upgradePlan);

// GET /api/organizations/plans - Liste des plans disponibles
router.get('/plans', organizationController.getAvailablePlans);

module.exports = router;