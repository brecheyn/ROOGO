const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/stockIntelligenceController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

// Analyse ABC
router.get('/abc', ctrl.getABCAnalysis);

// Produits dormants
router.get('/dormant', ctrl.getDormantProducts);

// Point de commande dynamique
router.get('/reorder', ctrl.getReorderSuggestions);
router.post('/reorder', checkRole([1, 2]), ctrl.setReorderRule);

// FEFO
router.get('/fefo', ctrl.getFEFOSuggestion);

module.exports = router;
