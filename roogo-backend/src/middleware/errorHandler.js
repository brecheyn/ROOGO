const logger = require('../config/logger');

const errorHandler = (err, req, res, _next) => {
  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userId: req.user?.id,
    },
  }, 'Unhandled error');

  // Erreur de validation PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Conflit : cet enregistrement existe déjà',
    });
  }

  // Erreur de validation PostgreSQL (foreign key)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Référence invalide : l\'élément lié n\'existe pas',
    });
  }

  // Erreur de connexion DB
  if (err.code === 'ECONNREFUSED' || err.code === '57P01' || err.code === '57P03') {
    return res.status(503).json({
      success: false,
      message: 'Service temporairement indisponible. Réessayez dans quelques instants.',
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Session expirée. Veuillez vous reconnecter.',
    });
  }

  // Erreur par défaut
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err.message || 'Erreur interne du serveur',
  });
};

module.exports = errorHandler;
