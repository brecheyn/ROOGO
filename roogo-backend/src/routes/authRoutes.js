const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/signup', authController.signup);

router.post('/login', authController.login);
router.get('/verify', authenticateToken, authController.verify);

module.exports = router;
