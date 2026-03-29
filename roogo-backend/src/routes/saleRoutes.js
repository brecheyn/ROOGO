const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, saleController.getAllSales);
router.post('/', authenticateToken, saleController.createSale);

module.exports = router;
