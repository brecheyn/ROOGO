const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/financeController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/fifo', ctrl.getFIFOValuation);
router.get('/weighted-avg', ctrl.getWeightedAvgValuation);
router.get('/holding-cost', ctrl.getHoldingCost);
router.post('/simulate', ctrl.simulateScenario);
router.get('/summary', ctrl.getFinancialSummary);

module.exports = router;
