const express = require('express');
const router = express.Router();
const orderingController = require('../controllers/orderingController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', orderingController.getAllOrderings);
router.get('/:id', orderingController.getOrderingById);
router.post('/', checkRole([1, 2]), orderingController.createOrdering);
router.put('/:id/receive', checkRole([1, 2]), orderingController.receiveOrdering);

module.exports = router;
