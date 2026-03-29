const pool = require('../config/database');

// Recherche globale
exports.globalSearch = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'La recherche doit contenir au moins 2 caractères'
      });
    }
    
    const searchPattern = `%${query}%`;
    
    // Rechercher dans les clients
    const clientsResult = await pool.query(`
      SELECT 'client' as type, id, name, surname, phone, address
      FROM client
      WHERE name ILIKE $1 OR surname ILIKE $1 OR phone ILIKE $1
      LIMIT 10
    `, [searchPattern]);
    
    // Rechercher dans les articles
    const articlesResult = await pool.query(`
      SELECT 'article' as type, id, name_article, categorie, quantity, unit_price
      FROM article
      WHERE name_article ILIKE $1 OR categorie ILIKE $1
      LIMIT 10
    `, [searchPattern]);
    
    // Rechercher dans les fournisseurs
    const suppliersResult = await pool.query(`
      SELECT 'supplier' as type, id, name, surname, phone
      FROM supplier
      WHERE name ILIKE $1 OR surname ILIKE $1
      LIMIT 10
    `, [searchPattern]);
    
    // Rechercher dans les magasins
    const storesResult = await pool.query(`
      SELECT 'store' as type, id, name, adresse, phone
      FROM store
      WHERE name ILIKE $1 OR adresse ILIKE $1
      LIMIT 10
    `, [searchPattern]);
    
    res.json({
      success: true,
      query: query,
      results: {
        clients: clientsResult.rows,
        articles: articlesResult.rows,
        suppliers: suppliersResult.rows,
        stores: storesResult.rows
      },
      total: clientsResult.rows.length + articlesResult.rows.length + 
             suppliersResult.rows.length + storesResult.rows.length
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche',
      error: error.message
    });
  }
};

// Recherche avancée de ventes avec filtres
exports.searchSales = async (req, res) => {
  try {
    const {
      clientId,
      articleId,
      storeId,
      startDate,
      endDate,
      minPrice,
      maxPrice,
      sortBy = 'date_sate',
      sortOrder = 'DESC',
      page = 1,
      limit = 20
    } = req.query;
    
    const isAdmin = req.user.role_id === 1;
    const userStoreId = req.user.store_id;
    
    let query = `
      SELECT s.*, 
             c.name as client_name, c.surname as client_surname,
             a.name_article,
             st.name as store_name
      FROM sale s
      JOIN client c ON s.id_client = c.id
      JOIN article a ON s.id_article = a.id
      LEFT JOIN store st ON s.store_id = st.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    // Filtrer par magasin si pas admin
    if (!isAdmin) {
      params.push(userStoreId);
      query += ` AND s.store_id = $${paramCount}`;
      paramCount++;
    }
    
    if (clientId) {
      params.push(clientId);
      query += ` AND s.id_client = $${paramCount}`;
      paramCount++;
    }
    
    if (articleId) {
      params.push(articleId);
      query += ` AND s.id_article = $${paramCount}`;
      paramCount++;
    }
    
    if (storeId && isAdmin) {
      params.push(storeId);
      query += ` AND s.store_id = $${paramCount}`;
      paramCount++;
    }
    
    if (startDate) {
      params.push(startDate);
      query += ` AND s.date_sate >= $${paramCount}`;
      paramCount++;
    }
    
    if (endDate) {
      params.push(endDate);
      query += ` AND s.date_sate <= $${paramCount}`;
      paramCount++;
    }
    
    if (minPrice) {
      params.push(minPrice);
      query += ` AND s.price >= $${paramCount}`;
      paramCount++;
    }
    
    if (maxPrice) {
      params.push(maxPrice);
      query += ` AND s.price <= $${paramCount}`;
      paramCount++;
    }
    
    // Tri
    const allowedSortFields = ['date_sate', 'price', 'quantity'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'date_sate';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY s.${sortField} ${order}`;
    
    // Pagination
    const offset = (page - 1) * limit;
    params.push(limit, offset);
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    
    const result = await pool.query(query, params);
    
    // Compter le total
    let countQuery = query.split('ORDER BY')[0];
    countQuery = countQuery.replace(/SELECT s\.\*.*FROM/s, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(countResult.rows[0].count / limit)
      }
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche des ventes',
      error: error.message
    });
  }
};

// Recherche d'articles avec filtres
exports.searchArticles = async (req, res) => {
  try {
    const {
      categorie,
      minPrice,
      maxPrice,
      minQuantity,
      maxQuantity,
      inStock,
      lowStock,
      expired,
      sortBy = 'name_article',
      sortOrder = 'ASC'
    } = req.query;
    
    let query = `
      SELECT * FROM article WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (categorie) {
      params.push(categorie);
      query += ` AND categorie ILIKE $${paramCount}`;
      paramCount++;
    }
    
    if (minPrice) {
      params.push(minPrice);
      query += ` AND unit_price >= $${paramCount}`;
      paramCount++;
    }
    
    if (maxPrice) {
      params.push(maxPrice);
      query += ` AND unit_price <= $${paramCount}`;
      paramCount++;
    }
    
    if (minQuantity) {
      params.push(minQuantity);
      query += ` AND quantity >= $${paramCount}`;
      paramCount++;
    }
    
    if (maxQuantity) {
      params.push(maxQuantity);
      query += ` AND quantity <= $${paramCount}`;
      paramCount++;
    }
    
    if (inStock === 'true') {
      query += ` AND quantity > 0`;
    }
    
    if (lowStock === 'true') {
      query += ` AND quantity < 10 AND quantity > 0`;
    }
    
    if (expired === 'true') {
      query += ` AND expiration_date < NOW()`;
    }
    
    const allowedSortFields = ['name_article', 'categorie', 'quantity', 'unit_price', 'expiration_date'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'name_article';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY ${sortField} ${order}`;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche d\'articles',
      error: error.message
    });
  }
};