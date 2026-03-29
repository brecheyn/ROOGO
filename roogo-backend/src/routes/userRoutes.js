const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

// ── ADMIN ─────────────────────────────────────────────────────────────────────
router.get('/',        checkRole([1]),    userController.getAllUsers);
router.get('/roles',                      userController.getAllRoles);
router.get('/:id',     checkRole([1]),    userController.getUserById);
router.post('/',       checkRole([1]),    userController.createUser);
router.put('/:id',     checkRole([1]),    userController.updateUser);
router.delete('/:id',  checkRole([1]),    userController.deleteUser);

// ── MANAGER (créer max 3 employés) ────────────────────────────────────────────
router.get('/employees/mine',   checkRole([2]), userController.getMyEmployees);
router.post('/employees/create', checkRole([2]), userController.createEmployee);

module.exports = router;