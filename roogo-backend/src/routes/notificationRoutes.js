const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', notificationController.getAllNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/read', notificationController.deleteReadNotifications);
router.post('/check-alerts', checkRole([1, 2]), notificationController.checkAutomaticAlerts);

module.exports = router;
