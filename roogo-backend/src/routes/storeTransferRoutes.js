const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/storeTransferController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

// Transferts
router.post('/transfers', checkRole([1, 2]), ctrl.createTransfer);
router.get('/transfers', ctrl.getTransfers);
router.get('/comparison', ctrl.getStoreComparison);
router.get('/out-of-stock', ctrl.getOutOfStockByStore);

// Workflow approbation
router.post('/approval', checkRole([1, 2]), ctrl.createApprovalRequest);
router.put('/approval/:audit_log_id', checkRole([1]), ctrl.approveRequest);
router.get('/approvals/pending', checkRole([1]), ctrl.getPendingApprovals);

module.exports = router;
