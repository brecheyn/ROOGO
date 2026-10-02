// Point d'entrée Vercel Serverless Functions.
// Exporte l'app Express sans appeler listen() (voir server.js).
module.exports = require("../roogo-backend/server").app;
