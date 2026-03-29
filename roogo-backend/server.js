require("dotenv").config();
const express = require("express");
const cors = require("cors");

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
const dashboardRoutes = require("./src/routes/dashboardRoutes"); // ✅ AJOUT
const { identifyTenant } = require("./src/middleware/tenant");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`📩 ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/organizations", organizationRoutes);

// Routes qui nécessitent le tenant
app.use("/api/auth", authRoutes);
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

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: " API roogo - Système de Gestion de Stock",
    version: "2.0.0",
    architecture: "MVC",
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
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route non trouvée" });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  
    API roogo - Démarré avec succès!  
    URL: http://localhost:${PORT}        
    Architecture: MVC                   
  
  `);
});