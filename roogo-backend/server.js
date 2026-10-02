require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pinoHttp = require("pino-http");
const http = require("http");
const { Server } = require("socket.io");

const logger = require("./src/config/logger");
const errorHandler = require("./src/middleware/errorHandler");

const authRoutes = require("./src/routes/authRoutes");
const clientRoutes = require("./src/routes/clientRoutes");
const articleRoutes = require("./src/routes/articleRoutes");
const saleRoutes = require("./src/routes/saleRoutes");
const supplierRoutes = require("./src/routes/supplierRoutes");
const orderingRoutes = require("./src/routes/orderingRoutes");
const storeRoutes = require("./src/routes/storeRoutes");
const userRoutes = require("./src/routes/userRoutes");
const rapportRoutes = require("./src/routes/rapportRoutes");
const exportRoutes = require("./src/routes/exportRoutes");
const statsRoutes = require("./src/routes/statsRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");
const searchRoutes = require("./src/routes/searchRoutes");
const auditRoutes = require("./src/routes/auditRoutes");
const organizationRoutes = require("./src/routes/organizationRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const intelligenceRoutes = require("./src/routes/intelligenceRoutes");
const lotRoutes = require("./src/routes/lotRoutes");
const scanRoutes = require("./src/routes/scanRoutes");
const aiRoutes = require("./src/routes/aiRoutes");
const storeTransferRoutes = require("./src/routes/storeTransferRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const marketplaceRoutes = require("./src/routes/marketplaceRoutes");
const financeRoutes = require("./src/routes/financeRoutes");
const { identifyTenant } = require("./src/middleware/tenant");

const app = express();
const server = http.createServer(app);

// Origines CORS (séparées par virgule) — ex: "http://localhost:4200,http://192.168.1.10:4300"
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:4200")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: corsOrigins,
    methods: ["GET", "POST"],
  },
});
const PORT = process.env.PORT || 3000;

// ── Exposer io pour les controllers ────────────────────────────────────────────
app.set("io", io);

// ── Sécurité ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // désactivé pour le dev, à configurer en prod
  crossOriginEmbedderPolicy: false,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Trop de requêtes. Réessayez dans 15 minutes." },
});
// Rate limit sur l'API uniquement (les assets statiques ne consomment pas le quota)
app.use("/api", limiter);

// Rate limit strict sur l'auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 tentatives de login par IP en 15 min
  message: { success: false, message: "Trop de tentatives. Réessayez dans 15 minutes." },
});

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── CORS configuré ────────────────────────────────────────────────────────────
app.use(cors({
  origin: corsOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Organization-Slug"],
  credentials: true,
}));

// ── Logging structuré ─────────────────────────────────────────────────────────
app.use(pinoHttp({ logger, autoLogging: process.env.NODE_ENV === "development" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/organizations", organizationRoutes);

app.use("/api/dashboard", identifyTenant, dashboardRoutes);
app.use("/api/clients", identifyTenant, clientRoutes);
app.use("/api/articles", identifyTenant, articleRoutes);
app.use("/api/sales", identifyTenant, saleRoutes);
app.use("/api/suppliers", identifyTenant, supplierRoutes);
app.use("/api/orderings", identifyTenant, orderingRoutes);
app.use("/api/stores", identifyTenant, storeRoutes);
app.use("/api/users", identifyTenant, userRoutes);
app.use("/api/rapports", identifyTenant, rapportRoutes);
app.use("/api/export", identifyTenant, exportRoutes);
app.use("/api/stats", identifyTenant, statsRoutes);
app.use("/api/notifications", identifyTenant, notificationRoutes);
app.use("/api/search", identifyTenant, searchRoutes);
app.use("/api/audit", identifyTenant, auditRoutes);
app.use("/api/intelligence", identifyTenant, intelligenceRoutes);
app.use("/api/stock", identifyTenant, lotRoutes);
app.use("/api/scan", identifyTenant, scanRoutes);
app.use("/api/ai", identifyTenant, aiRoutes);
app.use("/api/stores-management", identifyTenant, storeTransferRoutes);
app.use("/api/payments", identifyTenant, paymentRoutes);
app.use("/api/marketplace", identifyTenant, marketplaceRoutes);
app.use("/api/finance", identifyTenant, financeRoutes);

// ── Root endpoint API ────────────────────────────────────────────────────────
app.get("/api", (req, res) => {
  res.json({
    message: "API ROOGO - Système de Gestion de Stock",
    version: "4.0.0",
    architecture: "MVC + Real-time",
    endpoints: {
      auth: "/api/auth",
      dashboard: "/api/dashboard",
      organizations: "/api/organizations",
      clients: "/api/clients",
      articles: "/api/articles",
      sales: "/api/sales",
      suppliers: "/api/suppliers",
      orderings: "/api/orderings",
      stores: "/api/stores",
      users: "/api/users",
      rapports: "/api/rapports",
      export: "/api/export",
      stats: "/api/stats",
      notifications: "/api/notifications",
      search: "/api/search",
      audit: "/api/audit",
      intelligence: "/api/intelligence",
      stock: "/api/stock",
      scan: "/api/scan",
      ai: "/api/ai",
      stores_management: "/api/stores-management",
      payments: "/api/payments",
      marketplace: "/api/marketplace",
      finance: "/api/finance",
    },
  });
});

// ── Frontend PWA (build Angular : dist/roogo-frontend/browser) ────────────────
const FRONTEND_DIST = path.join(__dirname, "..", "roogo-frontend", "dist", "roogo-frontend", "browser");
const hasFrontend = fs.existsSync(path.join(FRONTEND_DIST, "index.html"));
if (hasFrontend) {
  app.use(express.static(FRONTEND_DIST));
}

// ── Fallback SPA (routes Angular) + 404 API ───────────────────────────────────
app.use((req, res) => {
  if (hasFrontend && req.method === "GET" && !req.path.startsWith("/api")) {
    return res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  }
  res.status(404).json({ success: false, message: "Route non trouvée" });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  logger.info({ socketId: socket.id }, "Client connecté");

  // Rejoindre une room par organisation
  socket.on("join-organization", (orgSlug) => {
    socket.join(`org:${orgSlug}`);
    logger.info({ socketId: socket.id, orgSlug }, "Rejoint la room organisation");
  });

  socket.on("disconnect", () => {
    logger.info({ socketId: socket.id }, "Client déconnecté");
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
const pool = require("./src/config/database");

const shutdown = async (signal) => {
  logger.info({ signal }, "Arrêt du serveur...");
  server.close(() => {
    logger.info("Serveur HTTP fermé");
  });
  await pool.end();
  logger.info("Pool PostgreSQL fermé");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── Start (exécution locale uniquement) ──────────────────────────────────────
// Sur Vercel, api/index.js importe cette app sans la démarrer (serverless).
if (require.main === module) {
  server.listen(PORT, () => {
    logger.info({
      port: PORT,
      env: process.env.NODE_ENV || "development",
      version: "4.0.0",
    }, "API ROOGO démarrée avec succès");
  });
}

module.exports = { app, server, io };
