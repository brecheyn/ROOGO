const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', storeController.getAllStores);
router.post('/', checkRole([1, 2]), storeController.createStore);
router.put('/:id', checkRole([1, 2]), storeController.updateStore);
router.delete('/:id', checkRole([1, 2]), storeController.deleteStore);
router.get('/stats/dashboard', storeController.getDashboardStats);

module.exports = router;
