const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET manquant');
}

/**
 * Vérifier le token JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    req.user = decoded;
    next();
  });
};

/**
 * Vérifier le rôle
 */
const checkRole = (rolesAllowed = []) => {
  return (req, res, next) => {
    if (!rolesAllowed.includes(req.user.role_id)) {
      return res.status(403).json({
        success: false,
        message: 'Permissions insuffisantes'
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  checkRole
};
