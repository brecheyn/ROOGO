const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Devises
router.get('/rates', ctrl.getExchangeRates);
router.post('/convert', ctrl.convert);

// Mobile Money
router.post('/pay', ctrl.initiatePayment);
router.get('/status/:reference', ctrl.checkPaymentStatus);
router.get('/history', ctrl.getPaymentHistory);

module.exports = router;
