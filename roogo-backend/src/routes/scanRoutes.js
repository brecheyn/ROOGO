const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/scanController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

// QR Code
router.get('/qr/:id', ctrl.generateArticleQR);
router.get('/qr-batch/all', ctrl.generateAllQRCodes);

// Barcode lookup
router.post('/lookup', ctrl.lookupByBarcode);

// Vente par scan
router.post('/quick-sale', ctrl.quickSale);

// Inventaire physique
router.post('/inventory', checkRole([1, 2]), ctrl.physicalInventory);

module.exports = router;
