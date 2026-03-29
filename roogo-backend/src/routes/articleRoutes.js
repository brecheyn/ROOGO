const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/', articleController.getAllArticles);
router.get('/:id', articleController.getArticleById);
router.post('/', checkRole([1, 2]), articleController.createArticle);
router.put('/:id', checkRole([1, 2]), articleController.updateArticle);
router.delete('/:id', checkRole([1]), articleController.deleteArticle);

module.exports = router;
