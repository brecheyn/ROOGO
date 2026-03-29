const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);
router.use(checkRole([1]));

router.get('/logs', auditController.getAuditLogs);
router.get('/entity/:entity/:entityId', auditController.getEntityHistory);
router.get('/stats', auditController.getAuditStats);
router.delete('/clean', auditController.cleanOldLogs);

module.exports = router;
