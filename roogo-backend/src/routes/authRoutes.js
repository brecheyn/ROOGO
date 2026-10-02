const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { validate, authSchema } = require('../middleware/validate');

router.post('/signup', validate(authSchema.signup), authController.signup);
router.post('/login', validate(authSchema.login), authController.login);
router.get('/verify', authenticateToken, authController.verify);
router.put('/profile', authenticateToken, authController.updateProfile);

module.exports = router;
