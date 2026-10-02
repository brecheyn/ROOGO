const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/marketplaceController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

// Marketplace
router.get('/listings', ctrl.getSupplierListings);
router.post('/order', checkRole([1, 2]), ctrl.placeMarketplaceOrder);

// E-commerce sync
router.get('/ecommerce/sync', ctrl.getEcommerceSync);

// Alertes
router.post('/alerts/send', checkRole([1, 2]), ctrl.sendStockAlert);
router.post('/alerts/run', checkRole([1]), ctrl.runAutoAlerts);

module.exports = router;
