const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/chat', ctrl.chat);
router.get('/recommendations', ctrl.getRecommendations);
router.get('/anomalies', ctrl.getAnomalies);
router.get('/forecasts', ctrl.getForecasts);

// Éléments marqués comme résolus
router.get('/resolved', ctrl.getResolved);
router.post('/resolve', ctrl.resolveItem);
router.delete('/resolve', ctrl.unresolveItem);

module.exports = router;
