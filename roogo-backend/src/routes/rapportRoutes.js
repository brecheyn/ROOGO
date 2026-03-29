const express = require('express');
const router = express.Router();
const rapportController = require('../controllers/rapportController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/generate', checkRole([1, 2]), rapportController.generateAIReport);
router.get('/', rapportController.getAllReports);
router.get('/:id', rapportController.getReportById);
router.delete('/:id', checkRole([1]), rapportController.deleteReport);

module.exports = router;
