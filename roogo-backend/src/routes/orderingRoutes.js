const express = require('express');
const router = express.Router();
const orderingController = require('../controllers/orderingController');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { validate, orderingSchema, idParam } = require('../middleware/validate');

router.use(authenticateToken);

router.get('/', orderingController.getAllOrderings);
router.get('/:id', validate(idParam), orderingController.getOrderingById);
router.post('/', checkRole([1, 2]), validate(orderingSchema.create), orderingController.createOrdering);
router.put('/:id', checkRole([1, 2]), validate(orderingSchema.create), orderingController.updateOrdering);
router.delete('/:id', checkRole([1, 2]), validate(idParam), orderingController.deleteOrdering);
router.put('/:id/receive', checkRole([1, 2]), validate(idParam), orderingController.receiveOrdering);

module.exports = router;
