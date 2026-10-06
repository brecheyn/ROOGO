const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { validate, supplierSchema, idParam } = require('../middleware/validate');

router.use(authenticateToken);

router.get('/', supplierController.getAllSuppliers);
router.get('/:id', validate(idParam), supplierController.getSupplierById);
router.post('/', checkRole([1, 2]), validate(supplierSchema.create), supplierController.createSupplier);
router.put('/:id', checkRole([1, 2]), validate(supplierSchema.update), supplierController.updateSupplier);
router.delete('/:id', checkRole([1, 2]), validate(idParam), supplierController.deleteSupplier);

module.exports = router;
