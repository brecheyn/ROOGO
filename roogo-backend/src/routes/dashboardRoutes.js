const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

router.get('/stats', dashboardController.getStats);
router.get('/top-articles', dashboardController.getTopArticles);
router.get('/stock-alerts', dashboardController.getStockAlerts);
router.get('/recent-sales', dashboardController.getRecentSales);
router.get('/sales-chart', dashboardController.getSalesChart);

module.exports = router;