const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.get('/global', searchController.globalSearch);
router.get('/sales', searchController.searchSales);
router.get('/articles', searchController.searchArticles);

module.exports = router;
