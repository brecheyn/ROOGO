const express = require('express');
const router = express.Router();
const articleController = require('../controllers/articleController');
const { authenticateToken, checkRole } = require('../middleware/auth');
const { validate, articleSchema, idParam } = require('../middleware/validate');

router.use(authenticateToken);

router.get('/', articleController.getAllArticles);
router.get('/:id', validate(idParam), articleController.getArticleById);
router.post('/', checkRole([1, 2]), validate(articleSchema.create), articleController.createArticle);
router.put('/:id', checkRole([1, 2]), validate(articleSchema.update), articleController.updateArticle);
router.delete('/:id', checkRole([1]), validate(idParam), articleController.deleteArticle);

module.exports = router;
