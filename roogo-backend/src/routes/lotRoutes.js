const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/lotController');
const { authenticateToken, checkRole } = require('../middleware/auth');

router.use(authenticateToken);

// ── Lots ──────────────────────────────────────────────────────────────────────
router.post('/lots', checkRole([1, 2]), ctrl.createLot);
router.get('/lots/:article_id', ctrl.getLotsByArticle);

// ── Numéros de série ──────────────────────────────────────────────────────────
router.post('/serials', checkRole([1, 2]), ctrl.createSerialNumber);
router.get('/serials/:article_id', ctrl.getSerialNumbers);

// ── Contrôle qualité ──────────────────────────────────────────────────────────
router.post('/quality', checkRole([1, 2]), ctrl.createQualityCheck);
router.get('/quality', ctrl.getQualityChecks);

// ── Traçabilité ───────────────────────────────────────────────────────────────
router.get('/movements/:article_id', ctrl.getStockMovements);
router.get('/traceability/:article_id', ctrl.getFullTraceability);

// ── Catalogue fournisseur ─────────────────────────────────────────────────────
router.get('/catalog/:supplier_id', ctrl.getSupplierCatalog);

module.exports = router;
