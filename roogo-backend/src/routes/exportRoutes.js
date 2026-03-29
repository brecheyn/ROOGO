const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/sales/excel', checkRole([1, 2]), exportController.exportSalesToExcel);
router.get('/stock/excel', checkRole([1, 2]), exportController.exportStockToExcel);
router.get('/invoice/:id/pdf', exportController.generateInvoicePDF);

module.exports = router;
