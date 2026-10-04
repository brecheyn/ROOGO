// ─────────────────────────────────────────────────────────────────────────────
// Point d'entrée racine du dépôt (compatibilité plateformes de déploiement)
//
// L'API ROOGO vit dans `roogo-backend/server.js`. Ce fichier existe pour que
// la commande de démarrage `node server.js` (Render, Railway, etc.) fonctionne
// depuis la racine du dépôt, qui correspond au champ "main" de package.json.
//
// Ne rien ajouter ici : toute la logique doit rester dans roogo-backend/.
// ─────────────────────────────────────────────────────────────────────────────
require("./roogo-backend/server.js");
