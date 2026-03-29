const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', supplierController.getAllSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.post('/', checkRole([1, 2]), supplierController.createSupplier);
router.put('/:id', checkRole([1, 2]), supplierController.updateSupplier);
router.delete('/:id', checkRole([1]), supplierController.deleteSupplier);

module.exports = router;
