const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken } = require('../middleware/auth');
const { validate, saleSchema } = require('../middleware/validate');

router.get('/', authenticateToken, saleController.getAllSales);
router.get('/:id', authenticateToken, saleController.getSaleById);
router.post('/', authenticateToken, validate(saleSchema.create), saleController.createSale);
router.put('/:id', authenticateToken, validate(saleSchema.update), saleController.updateSale);
router.delete('/:id', authenticateToken, saleController.deleteSale);

module.exports = router;
