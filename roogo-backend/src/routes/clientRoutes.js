const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { validate, clientSchema, idParam } = require('../middleware/validate');

router.use(authenticateToken);

router.get('/', clientController.getAllClients);
router.get('/:id', validate(idParam), clientController.getClientById);
router.post('/', validate(clientSchema.create), clientController.createClient);
router.put('/:id', validate(clientSchema.update), clientController.updateClient);
router.delete('/:id', checkRole([1, 2]), validate(idParam), clientController.deleteClient);

module.exports = router;
