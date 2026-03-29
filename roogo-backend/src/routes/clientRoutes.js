const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', clientController.getAllClients);
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', checkRole([1, 2]), clientController.deleteClient);

module.exports = router;
