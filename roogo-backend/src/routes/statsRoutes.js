const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/advanced', statsController.getAdvancedStats);
router.get('/period', statsController.getStatsByPeriod);
router.get('/top-products', statsController.getTopProducts);

module.exports = router;
