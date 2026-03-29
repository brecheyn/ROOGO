const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET manquant dans les variables d\'environnement');
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // enlève les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

async function uniqueSlug(baseSlug, client) {
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const exists = await client.query(
      'SELECT id FROM organization WHERE slug = $1', [slug]
    );
    if (exists.rows.length === 0) return slug;
    slug = `${baseSlug}-${i++}`;
  }
}

// ── SIGNUP ────────────────────────────────────────────────────────────────────
exports.signup = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      username,
      email,
      password,
      organizationName,
      industry,
      phone,
      plan
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants (username, email, password)'
      });
    }

    if (!organizationName) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de l\'organisation est obligatoire'
      });
    }

    // ── Vérifier unicité email + username ─────────────────────────────────────
    const existingEmail = await client.query(
      'SELECT id FROM "user" WHERE email = $1', [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email déjà utilisé' });
    }

    const existingUsername = await client.query(
      'SELECT id FROM "user" WHERE username = $1', [username]
    );
    if (existingUsername.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Nom d\'utilisateur déjà pris' });
    }

    await client.query('BEGIN');

    // ── 1. Créer l'organisation ───────────────────────────────────────────────
    const baseSlug = generateSlug(organizationName);
    const slug     = await uniqueSlug(baseSlug, client);

    // On stocke industry et plan dans le nom étendu (colonne name)
    // car la table n'a pas ces colonnes — on les stocke proprement
    const orgResult = await client.query(
      `INSERT INTO organization (name, slug, is_active)
       VALUES ($1, $2, true)
       RETURNING id, name, slug`,
      [organizationName, slug]
    );
    const org = orgResult.rows[0];

    // ── 2. Créer le store principal ───────────────────────────────────────────
    const storeName    = `${organizationName} - Principal`;
    const storeAddress = phone || null; // on stocke le téléphone dans address provisoirement

    const storeResult = await client.query(
      `INSERT INTO store (name, address, organization_id)
       VALUES ($1, $2, $3)
       RETURNING id, name`,
      [storeName, storeAddress, org.id]
    );
    const store = storeResult.rows[0];

    // ── 3. Créer l'utilisateur (role_id=2 = manager) ──────────────────────────
    const hashedPassword = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      `INSERT INTO "user" (username, email, password, role_id, store_id)
       VALUES ($1, $2, $3, 2, $4)
       RETURNING id, username, email, role_id, store_id`,
      [username, email, hashedPassword, store.id]
    );
    const user = userResult.rows[0];

    await client.query('COMMIT');

    // ── 4. Générer le JWT ─────────────────────────────────────────────────────
    const token = jwt.sign(
      {
        id:               user.id,
        role_id:          user.role_id,
        store_id:         store.id,
        organizationId:   org.id,
        organizationSlug: org.slug
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      token,
      user: {
        id:               user.id,
        username:         user.username,
        email:            user.email,
        role_id:          user.role_id,
        role:             'manager',
        store_id:         store.id,
        store:            store.name,
        organizationId:   org.id,
        organizationSlug: org.slug,
        organizationName: org.name,
        industry:         industry   || null,
        plan:             plan       || 'starter',
        phone:            phone      || null
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur signup:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte',
      error: error.message
    });
  } finally {
    client.release();
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      `SELECT
         u.id, u.username, u.email, u.password,
         u.role_id, r.name_role,
         u.store_id, s.name AS store_name,
         o.id   AS organization_id,
         o.slug AS organization_slug,
         o.name AS organization_name
       FROM "user" u
       JOIN role r ON r.id = u.role_id
       LEFT JOIN store s ON s.id = u.store_id
       LEFT JOIN organization o ON o.id = s.organization_id
       WHERE u.username = $1
       LIMIT 1`,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }

    const user = result.rows[0];

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      {
        id:               user.id,
        role_id:          user.role_id,
        store_id:         user.store_id,
        organizationId:   user.organization_id,
        organizationSlug: user.organization_slug
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id:               user.id,
        username:         user.username,
        email:            user.email,
        role:             user.name_role,
        role_id:          user.role_id,
        store:            user.store_name,
        store_id:         user.store_id,
        organizationSlug: user.organization_slug,
        organizationName: user.organization_name
      }
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la connexion' });
  }
};

// ── VERIFY TOKEN ──────────────────────────────────────────────────────────────
exports.verify = (req, res) => {
  res.json({ success: true, user: req.user });
};