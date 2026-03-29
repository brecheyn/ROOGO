const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', storeController.getAllStores);
router.post('/', checkRole([1]), storeController.createStore);
router.get('/stats/dashboard', storeController.getDashboardStats);

module.exports = router;
