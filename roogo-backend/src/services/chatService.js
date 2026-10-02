const pool = require('../config/database');

// Chatbot ROOGO - moteur deterministe (langage naturel francais)
// - Toutes les donnees viennent de SQL filtre par organization_id.
// - Memoire de session : "stock de riz" -> "et le prix ?"
// - Aucune dependance reseau : fonctionne hors ligne.

// ── Normalisation ────────────────────────────────────────────────────────────
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function normalize(str) {
  return stripAccents((str || '').toLowerCase())
    .replace(/[\u2019']/g, ' ')
    .replace(/[^a-z0-9% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'au', 'aux', 'en', 'et', 'ou',
  'est', 'sont', 'ai', 'as', 'a', 'ont', 'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous',
  'ils', 'elles', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet',
  'cette', 'ces', 'qui', 'que', 'quoi', 'dont', 'pour', 'par', 'sur', 'dans', 'avec',
  'sans', 'plus', 'moins', 'tout', 'tous', 'toute', 'toutes', 'combien', 'fait', 'faire',
  'peux', 'peut', 'peuvent', 'comment', 'quel', 'quelle', 'quels', 'quelles', 'y', 'n',
  'l', 'd', 's', 'c', 'm', 't', 'chez', 'depuis', 'entre', 'avant', 'apres', 'ici',
  'donc', 'car', 'mais', 'ne', 'pas', 'se', 'oui', 'non', 'etre', 'avoir', 'veux',
  'voulez', 'voudrais', 'donne', 'donner', 'montre', 'montrez', 'the', 'and', 'or',
  'leur', 'leurs', 'autre', 'autres', 'meme',
]);

const significantTokens = (text) =>
  normalize(text).split(' ').filter((t) => t && t.length > 1 && !STOPWORDS.has(t));

// ── Correspondance d'entites (produit / client / categorie) ──────────────────
function matchItem(norm, tokens, items, tokenFn) {
  let best = null;
  let bestKey = null;
  let weak = null;
  let weakLen = -1;

  for (const item of items) {
    const nameTokens = tokenFn(item);
    if (!nameTokens.length) continue;

    const matched = nameTokens.filter(
      (t) => (t.length >= 3 ? norm.includes(t) : false) || tokens.includes(t)
    );
    if (!matched.length) continue;

    const longestMatched = matched.reduce((m, t) => Math.max(m, t.length), 0);
    if (longestMatched < 3) continue;

    // Couverture minimale : au moins 1/3 des jetons du nom
    if (matched.length * 3 < nameTokens.length) {
      // Repli : au moins un mot-clé explicite de 3+ lettres
      if (longestMatched > weakLen) {
        weak = item;
        weakLen = longestMatched;
      }
      continue;
    }

    const key = {
      ratio: matched.length / nameTokens.length,
      matched: matched.length,
      shortest: -nameTokens.length,
    };
    if (
      !bestKey ||
      key.ratio > bestKey.ratio + 1e-9 ||
      (Math.abs(key.ratio - bestKey.ratio) < 1e-9 && key.matched > bestKey.matched) ||
      (Math.abs(key.ratio - bestKey.ratio) < 1e-9 && key.matched === bestKey.matched && key.shortest > bestKey.shortest)
    ) {
      best = item;
      bestKey = key;
    }
  }
  return best || weak;
}

function matchCategory(norm, categories) {
  for (const cat of categories) {
    const c = normalize(cat);
    if (!c) continue;
    if (new RegExp('(^| )' + c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)').test(norm)) return cat;
  }
  return null;
}

// ── Periodes naturelles ──────────────────────────────────────────────────────
const NUM_WORDS = { un: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, quinze: 15, vingt: 20, trente: 30 };
const MONTHS = { janvier: 0, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5, juillet: 6, aout: 7, septembre: 8, octobre: 9, novembre: 10, decembre: 11 };

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function extractPeriod(norm) {
  const now = new Date();
  let from = null;
  let to = null;
  let label = null;

  if (/\bajourd .?hui\b|\baujourdhui\b/.test(norm)) {
    from = startOfDay(now); to = now; label = "aujourd'hui";
  } else if (/\bhier\b/.test(norm)) {
    from = startOfDay(now); from.setDate(from.getDate() - 1);
    to = new Date(from); to.setDate(to.getDate() + 1);
    label = 'hier';
  } else if (/\bcette semaine\b|\bsemaine en cours\b/.test(norm)) {
    from = startOfDay(now);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7));
    to = now; label = 'cette semaine';
  } else if (/\bsemaine derniere\b/.test(norm)) {
    const startThis = startOfDay(now);
    startThis.setDate(startThis.getDate() - ((startThis.getDay() + 6) % 7));
    to = new Date(startThis);
    from = new Date(startThis); from.setDate(from.getDate() - 7);
    label = 'la semaine derniere';
  } else if (/\bce mois\b|\bmois en cours\b/.test(norm)) {
    from = new Date(now.getFullYear(), now.getMonth(), 1); to = now; label = 'ce mois-ci';
  } else if (/\bmois dernier\b|\bmois passe\b/.test(norm)) {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth(), 1);
    label = 'le mois dernier';
  } else if (/\bcette annee\b|\bannee en cours\b/.test(norm)) {
    from = new Date(now.getFullYear(), 0, 1); to = now; label = 'cette annee';
  } else {
    const m =
      norm.match(/(\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente) (?:dernier(?:s)? )?(?:jour|jours)/) ||
      norm.match(/dernier(?:s)? (\d+|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente) (?:jour|jours)/);
    if (m) {
      const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUM_WORDS[m[1]];
      if (n && n > 0 && n <= 365) {
        from = startOfDay(now); from.setDate(from.getDate() - (n - 1));
        to = now;
        label = 'les ' + n + ' derniers jours';
      }
    }
  }

  if (!label) {
    for (const [name, idx] of Object.entries(MONTHS)) {
      if (new RegExp('(^| )' + name + '( |$)').test(norm)) {
        let y = now.getFullYear();
        if (idx > now.getMonth()) y -= 1;
        from = new Date(y, idx, 1);
        to = new Date(y, idx + 1, 1);
        label = 'en ' + name + ' ' + y;
        break;
      }
    }
  }

  if (!label && /\b(depuis le debut|depuis toujours|depuis la creation|tout compris)\b/.test(norm)) {
    label = 'depuis le debut';
  }

  return { from, to, label, explicit: !!label };
}

function periodWhere(col, period, params) {
  let sql = '';
  if (period.from) { params.push(period.from); sql += ' AND ' + col + ' >= $' + params.length; }
  if (period.to) { params.push(period.to); sql += ' AND ' + col + ' < $' + params.length; }
  return sql;
}

// ── Memoire de session (contexte conversationnel) ────────────────────────────
const sessions = new Map();
const SESSION_TTL = 15 * 60 * 1000;

function getSession(key) {
  const now = Date.now();
  let s = sessions.get(key);
  if (!s || now - s.updatedAt > SESSION_TTL) {
    s = { product: null, client: null, category: null, updatedAt: now };
    sessions.set(key, s);
  }
  return s;
}

// ── Vocabulaire de l'organisation ────────────────────────────────────────────
async function loadVocab(orgId) {
  const [arts, cats, clis] = await Promise.all([
    pool.query(
      `SELECT id, name_article, categorie, quantity, unit_price, expiration_date
       FROM article WHERE organization_id = $1 ORDER BY name_article LIMIT 500`,
      [orgId]
    ),
    pool.query(
      `SELECT DISTINCT categorie FROM article WHERE organization_id = $1 AND categorie IS NOT NULL`,
      [orgId]
    ),
    pool.query(
      `SELECT id, name, surname FROM client WHERE organization_id = $1 LIMIT 500`,
      [orgId]
    ),
  ]);
  return { articles: arts.rows, categories: cats.rows.map((r) => r.categorie), clients: clis.rows };
}

// ── Detection d'intention ────────────────────────────────────────────────────
function detectIntent(norm, { hasProduct, hasClient, hasCategory }) {
  const words = norm.split(' ').filter(Boolean);

  if (/\b(aide|help|que peux|que peut|comment .?ca marche|commandes? disponibles|tous les commandes|tes commandes)\b/.test(norm)) return 'help';
  if (/^(bonjour|salut|bonsoir|coucou|hey|hello|bonne journee|bonne soiree|cc)$/.test(norm)) return 'greeting';
  if (/^(merci|merci beaucoup|ok|okay|super|parfait|nickel|top|gentil|parfaitement|ca marche|tres bien|bien joue)$/.test(norm)) return 'thanks';

  if (/\b(meilleur|top|classement|fidele|fid.le|gros)\s+client|\bmeilleurs clients\b|\bclients? (?:qui |le plus )?achete/.test(norm)) return 'topClients';
  if (/\bplus vendu|\b(meilleur|top|classement|best)\b.*\b(vente|ventes|produit|produits|article|articles|vendu|vendus)\b/.test(norm)) return 'topArticles';
  if (/\b(ca|chiffre d ?affaires|revenus?|recettes?|b.n.fices?|gagn.|rapport.s?|total des ventes|argent (?:gagn|rentr))\b/.test(norm)) return 'ca';

  if (/\bclient\b/.test(norm) && hasClient && /\b(vente|ventes|achat|achats|achete|achet.|depense|depens)/.test(norm)) return 'salesClient';
  if (hasClient && /\b(achet|achat)/.test(norm)) return 'salesClient';
  if (/\b(vendu|vendus|vendue|vendues|vente|ventes)\b/.test(norm) && hasProduct) return 'salesProduct';

  if (/\b(prix|tarif|co.te|combien coute|valeur unitaire|unitaire)\b/.test(norm)) return 'price';

  if (/\b(valeur du stock|mon stock vaut|combien vaut mon stock|capital immobilis|valeur totale|valeur de mon stock|combien vaut tout)\b/.test(norm)) return 'stockValue';
  if (/\b(alertes?|rupture|manque|stock bas|p.nur|plus assez|presque plus|.puis.|epuis.)\b/.test(norm)) return 'lowStock';
  if (/\b(expir\w*|perem\w*|perime\w*|dlc|date limite)\b/.test(norm)) return 'expiring';
  if (/\b(dormant|dormants|immobilis|bouge plus|ne se vend|ne vend pas|vente zero|jamais vendu|sans vente|pas vendu)\b/.test(norm)) return 'dormant';

  if (/\b(stock|quantit.|en stock|restant|disponible)\b/.test(norm)) return 'stock';
  if (hasProduct && /\bcombien\b/.test(norm)) return 'stock';

  if (hasCategory && /\b(articles?|produits?|rayons?|familles?|categories?|classe)\b/.test(norm)) return 'category';
  if (/^(categories|rayons|familles)\b/.test(norm)) return 'category';

  return null;
}

// ── Formats ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(Math.round(Number(n) || 0)).toLocaleString('fr-FR');
const perLabel = (p) => (p.label ? ' (' + p.label + ')' : '');

// ── Handlers (SQL filtre par organisation) ───────────────────────────────────
async function hStock(product, orgId) {
  if (product) {
    const r = await pool.query(
      `SELECT name_article, quantity, unit_price, categorie, expiration_date
       FROM article WHERE id = $1 AND organization_id = $2`,
      [product.id, orgId]
    );
    if (!r.rows.length) return { response: 'Article introuvable.', data: null };
    const a = r.rows[0];
    const exp = a.expiration_date
      ? '\n- Peremption : ' + new Date(a.expiration_date).toLocaleDateString('fr-FR')
      : '';
    return {
      response:
        '**' + a.name_article + '**' + (a.categorie ? ' (' + a.categorie + ')' : '') + '\n' +
        '- Stock : **' + a.quantity + ' unites**\n' +
        '- Prix : **' + fmt(a.unit_price) + ' FCFA**/unite\n' +
        '- Valeur du stock : **' + fmt(a.quantity * a.unit_price) + ' FCFA**' + exp,
      data: r.rows,
    };
  }

  const r = await pool.query(
    `SELECT COUNT(*) AS nb, COALESCE(SUM(quantity), 0) AS units,
            COALESCE(SUM(quantity * unit_price), 0) AS valeur,
            COUNT(*) FILTER (WHERE quantity <= 10) AS nb_bas
     FROM article WHERE organization_id = $1`,
    [orgId]
  );
  const s = r.rows[0];
  if (Number(s.nb) === 0) return { response: 'Aucun article dans votre catalogue.', data: null };
  return {
    response:
      "**Vue d'ensemble du stock**\n" +
      '- ' + s.nb + ' reference(s), ' + s.units + ' unite(s) au total\n' +
      '- Valeur du stock : **' + fmt(s.valeur) + ' FCFA**\n' +
      '- ' + s.nb_bas + ' article(s) en stock bas\n\n' +
      '_Precisez un produit : « stock de ... »_',
    data: r.rows,
  };
}

async function hPrice(product, ctxProduct, orgId) {
  const p = product || ctxProduct;
  if (!p) {
    return {
      response: 'Le prix de quel produit ? Donnez-moi son nom (ex. « prix de ... »).',
      data: null,
    };
  }
  const r = await pool.query(
    'SELECT name_article, unit_price, quantity, categorie FROM article WHERE id = $1 AND organization_id = $2',
    [p.id, orgId]
  );
  if (!r.rows.length) return { response: 'Article introuvable.', data: null };
  const a = r.rows[0];
  return {
    response:
      '**' + a.name_article + '** : **' + fmt(a.unit_price) + ' FCFA**/unite' +
      (a.categorie ? ' (' + a.categorie + ')' : '') + '\n' +
      '- En stock : ' + a.quantity + ' unite(s)\n' +
      '- Valeur du stock : ' + fmt(a.quantity * a.unit_price) + ' FCFA',
    data: r.rows,
  };
}

async function hSalesProduct(product, period, orgId) {
  if (!product) return hCa(period, orgId);
  const params = [orgId, product.id];
  const where = periodWhere('date_sate', period, params);
  const r = await pool.query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(price), 0) AS ca
     FROM sale WHERE organization_id = $1 AND id_article = $2` + where,
    params
  );
  const s = r.rows[0];
  if (Number(s.n) === 0) {
    return { response: 'Aucune vente de **' + product.name + '** ' + (period.label || 'sur la periode') + '.', data: null };
  }
  return {
    response:
      '**Ventes de ' + product.name + '**' + perLabel(period) + '\n' +
      '- ' + s.qty + ' unite(s) vendue(s) en ' + s.n + ' transaction(s)\n' +
      '- CA genere : **' + fmt(s.ca) + ' FCFA**',
    data: r.rows,
  };
}

async function hSalesClient(client, period, orgId) {
  if (!client) {
    return { response: 'De quel client parlez-vous ? Donnez son nom (ex. « ventes de ... »).', data: null };
  }
  const params = [orgId, client.id];
  const where = periodWhere('date_sate', period, params);
  const r = await pool.query(
    `SELECT COUNT(*) AS n, COALESCE(SUM(quantity), 0) AS qty, COALESCE(SUM(price), 0) AS ca
     FROM sale WHERE organization_id = $1 AND id_client = $2` + where,
    params
  );
  const s = r.rows[0];
  const nom = client.name;
  if (Number(s.n) === 0) {
    return { response: 'Aucun achat enregistre pour **' + nom + '** ' + (period.label || 'sur la periode') + '.', data: null };
  }
  return {
    response:
      '**Achats de ' + nom + '**' + perLabel(period) + '\n' +
      '- ' + s.n + ' achat(s), ' + s.qty + ' unite(s)\n' +
      '- Total depense : **' + fmt(s.ca) + ' FCFA**',
    data: r.rows,
  };
}

async function hCa(period, orgId) {
  const params = [orgId];
  const where = periodWhere('date_sate', period, params);
  const r = await pool.query(
    `SELECT COALESCE(SUM(price), 0) AS ca, COUNT(*) AS n, COALESCE(AVG(price), 0) AS panier
     FROM sale WHERE organization_id = $1` + where,
    params
  );
  const s = r.rows[0];
  if (Number(s.n) === 0) {
    return { response: 'Aucune vente ' + (period.label || 'sur la periode') + '.', data: null };
  }
  return {
    response:
      "**Chiffre d'affaires " + (period.label || 'total') + '**\n' +
      '- CA : **' + fmt(s.ca) + ' FCFA**\n' +
      '- ' + s.n + ' vente(s)\n' +
      '- Panier moyen : **' + fmt(s.panier) + ' FCFA**',
    data: r.rows,
  };
}

async function hTopArticles(period, orgId) {
  const params = [orgId];
  const where = periodWhere('s.date_sate', period, params);
  const r = await pool.query(
    `SELECT a.name_article, COALESCE(SUM(s.quantity), 0) AS qty, COALESCE(SUM(s.price), 0) AS ca
     FROM sale s JOIN article a ON a.id = s.id_article
     WHERE s.organization_id = $1` + where + `
     GROUP BY a.id, a.name_article ORDER BY qty DESC LIMIT 5`,
    params
  );
  if (!r.rows.length) return { response: 'Aucune vente ' + (period.label || 'enregistree') + '.', data: null };
  const list = r.rows
    .map((row, i) => (i + 1) + '. **' + row.name_article + '** - ' + row.qty + ' vendus (' + fmt(row.ca) + ' FCFA)')
    .join('\n');
  return { response: '**Top ventes**' + perLabel(period) + '\n' + list, data: r.rows };
}

async function hTopClients(period, orgId) {
  const params = [orgId];
  const where = periodWhere('s.date_sate', period, params);
  const r = await pool.query(
    `SELECT c.name, c.surname, COUNT(*) AS n, COALESCE(SUM(s.price), 0) AS ca
     FROM sale s JOIN client c ON c.id = s.id_client
     WHERE s.organization_id = $1 AND s.id_client IS NOT NULL` + where + `
     GROUP BY c.id, c.name, c.surname ORDER BY ca DESC LIMIT 5`,
    params
  );
  if (!r.rows.length) return { response: 'Aucun client acheteur ' + (period.label || 'enregistre') + '.', data: null };
  const list = r.rows
    .map((row, i) => (i + 1) + '. **' + row.name + ' ' + (row.surname || '') + '** - ' + row.n + ' achat(s), ' + fmt(row.ca) + ' FCFA')
    .join('\n');
  return { response: '**Meilleurs clients**' + perLabel(period) + '\n' + list, data: r.rows };
}

async function hLowStock(orgId) {
  const r = await pool.query(
    `SELECT name_article, quantity, unit_price FROM article
     WHERE organization_id = $1 AND quantity <= 10
     ORDER BY quantity ASC LIMIT 10`,
    [orgId]
  );
  if (!r.rows.length) return { response: 'Tous les stocks sont suffisants.', data: null };
  const list = r.rows
    .map((a) => '- **' + a.name_article + '** : ' + a.quantity + ' restant(s)')
    .join('\n');
  return { response: '**Alertes stock bas** (<= 10 unites)\n' + list, data: r.rows };
}

async function hExpiring(orgId) {
  const r = await pool.query(
    `SELECT name_article, expiration_date, quantity FROM article
     WHERE organization_id = $1 AND expiration_date IS NOT NULL
       AND expiration_date < CURRENT_DATE + INTERVAL '30 days'
     ORDER BY expiration_date ASC LIMIT 10`,
    [orgId]
  );
  if (!r.rows.length) {
    return { response: "Aucun produit a risque d'expiration dans les 30 prochains jours.", data: null };
  }
  const list = r.rows
    .map((a) => '- **' + a.name_article + '** - expire le ' + new Date(a.expiration_date).toLocaleDateString('fr-FR') + ' (' + a.quantity + ' unites)')
    .join('\n');
  return { response: '**Produits proches de peremption** (30 jours)\n' + list, data: r.rows };
}

async function hDormant(orgId) {
  const r = await pool.query(
    `SELECT a.name_article, a.quantity, a.unit_price, (a.quantity * a.unit_price) AS valeur
     FROM article a
     LEFT JOIN sale s ON a.id = s.id_article AND s.date_sate >= NOW() - INTERVAL '30 days'
     WHERE a.organization_id = $1
     GROUP BY a.id, a.name_article, a.quantity, a.unit_price
     HAVING COUNT(s.id) = 0
     ORDER BY valeur DESC LIMIT 10`,
    [orgId]
  );
  if (!r.rows.length) return { response: 'Aucun produit dormant detecte (tous vendus ces 30 derniers jours).', data: null };
  const list = r.rows
    .map((a) => '- **' + a.name_article + '** - ' + a.quantity + ' unites (' + fmt(a.valeur) + ' FCFA immobilises)')
    .join('\n');
  return { response: '**Produits dormants** (>30 jours sans vente)\n' + list, data: r.rows };
}

async function hStockValue(orgId) {
  const [sum, top] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS nb, COALESCE(SUM(quantity), 0) AS units,
              COALESCE(SUM(quantity * unit_price), 0) AS valeur
       FROM article WHERE organization_id = $1`,
      [orgId]
    ),
    pool.query(
      `SELECT name_article, quantity, unit_price, (quantity * unit_price) AS val
       FROM article WHERE organization_id = $1 AND quantity > 0
       ORDER BY val DESC LIMIT 5`,
      [orgId]
    ),
  ]);
  const s = sum.rows[0];
  if (Number(s.nb) === 0) return { response: 'Aucun stock a valoriser.', data: null };
  const list = top.rows.map((a) => '- **' + a.name_article + '** : ' + fmt(a.val) + ' FCFA').join('\n');
  return {
    response:
      '**Valeur du stock** : **' + fmt(s.valeur) + ' FCFA**\n' +
      '- ' + s.nb + ' reference(s), ' + s.units + ' unite(s)\n\n' +
      'Top valeur :\n' + list,
    data: top.rows,
  };
}

async function hCategory(category, orgId) {
  if (category) {
    const r = await pool.query(
      `SELECT name_article, quantity, unit_price FROM article
       WHERE organization_id = $1 AND categorie ILIKE $2 ORDER BY name_article LIMIT 15`,
      [orgId, category]
    );
    if (!r.rows.length) return { response: 'Aucun article dans la categorie « ' + category + ' ».', data: null };
    const list = r.rows.map((a) => '- **' + a.name_article + '** - ' + a.quantity + ' u. (' + fmt(a.unit_price) + ' FCFA)').join('\n');
    return { response: '**Categorie ' + category + '** (' + r.rows.length + ' article(s))\n' + list, data: r.rows };
  }
  const r = await pool.query(
    `SELECT categorie, COUNT(*) AS nb, COALESCE(SUM(quantity * unit_price), 0) AS valeur
     FROM article WHERE organization_id = $1 AND categorie IS NOT NULL
     GROUP BY categorie ORDER BY nb DESC`,
    [orgId]
  );
  if (!r.rows.length) return { response: 'Aucune categorie definie.', data: null };
  const list = r.rows.map((c) => '- **' + c.categorie + '** - ' + c.nb + ' article(s), ' + fmt(c.valeur) + ' FCFA').join('\n');
  return { response: '**Vos categories**\n' + list, data: r.rows };
}

async function hSearch(msg, orgId) {
  const r = await pool.query(
    `SELECT name_article, categorie, quantity, unit_price FROM article
     WHERE organization_id = $1 AND (name_article ILIKE $2 OR categorie ILIKE $2)
     LIMIT 5`,
    [orgId, '%' + msg.replace(/[%_]/g, ' ') + '%']
  );
  if (r.rows.length) {
    const list = r.rows
      .map((a) => '- **' + a.name_article + '** (' + (a.categorie || 'sans categorie') + ') - ' + a.quantity + ' u., ' + fmt(a.unit_price) + ' FCFA')
      .join('\n');
    return { response: '**Resultats de recherche**\n' + list, data: r.rows };
  }
  return {
    response:
      "Je n'ai pas compris cette question. Essayez par exemple :\n" +
      '- « Stock de [produit] » / « Prix de [produit] »\n' +
      '- « Combien de [produit] ai-je vendu ce mois ? »\n' +
      "- « Chiffre d'affaires des 7 derniers jours »\n" +
      '- « Top ventes » / « Meilleur client »\n' +
      '- « Alertes stock » / « Produits expires » / « Valeur du stock »\n\n' +
      'Tapez « aide » pour la liste complete.',
    data: null,
  };
}

function hHelp() {
  return {
    response:
      "**Je suis l'assistant ROOGO.** Exemples de questions :\n\n" +
      '- « Stock de [produit] » - etat du stock\n' +
      '- « Prix de [produit] »\n' +
      '- « Combien de [produit] ai-je vendu ce mois ? »\n' +
      "- « Chiffre d'affaires des 7 derniers jours »\n" +
      '- « Top ventes » / « Meilleur client »\n' +
      '- « Alertes stock » / « Produits expires » / « Produits dormants »\n' +
      '- « Valeur du stock » / « Categories »\n\n' +
      '**Contextuel** : apres « stock de riz », demandez simplement « et le prix ? ».\n' +
      'Les dates fonctionnent : « hier », « ce mois », « semaine derniere », « en janvier »...',
    data: null,
  };
}

// ── Point d'entree ───────────────────────────────────────────────────────────
async function answer(message, { userId, orgId }) {
  const norm = normalize(message);
  const tokens = norm.split(' ').filter(Boolean);
  const ctx = getSession(userId + ':' + orgId);
  const vocab = await loadVocab(orgId);

  const ents = {
    product: matchItem(norm, tokens, vocab.articles, (a) => significantTokens(a.name_article)),
    client: matchItem(norm, tokens, vocab.clients, (c) =>
      significantTokens((c.name || '') + ' ' + (c.surname || ''))
    ),
    category: matchCategory(norm, vocab.categories),
  };

  // Pronoms / references au sujet precedent
  if (!ents.product && /\b(celui|celle|ce produit|cet article|le precedent|celui-ci|celui la|celui d avant|ce dernier)\b/.test(norm)) {
    ents.product = ctx.product;
  }
  if (!ents.client && /\bce client|le client d avant\b/.test(norm)) ents.client = ctx.client;

  const product = ents.product || ctx.product;
  const client = ents.client || ctx.client;

  const intent = detectIntent(norm, {
    hasProduct: !!product,
    hasClient: !!client,
    hasCategory: !!ents.category,
  });

  // Periode : valeur par defaut selon l'intention
  let period = extractPeriod(norm);
  if (!period.explicit) {
    if (intent === 'ca') {
      const now = new Date();
      period = { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now, label: 'ce mois-ci', explicit: false };
    } else if (['salesProduct', 'salesClient', 'topArticles', 'topClients'].includes(intent)) {
      const from = new Date();
      from.setDate(from.getDate() - 29);
      period = { from: startOfDay(from), to: new Date(), label: 'sur les 30 derniers jours', explicit: false };
    }
  }

  // Mise a jour de la memoire (nouvelles entites seulement)
  if (ents.product) ctx.product = { id: ents.product.id, name: ents.product.name_article };
  if (ents.client) ctx.client = { id: ents.client.id, name: ((ents.client.name || '') + ' ' + (ents.client.surname || '')).trim() };
  if (ents.category) ctx.category = ents.category;
  ctx.updatedAt = Date.now();

  const namedProduct = product
    ? { id: product.id, name: product.name_article || product.name }
    : null;

  let out;
  switch (intent) {
    case 'help':
      out = hHelp();
      break;
    case 'greeting':
      out = { response: 'Bonjour ! Je peux vous renseigner sur votre stock, vos ventes, vos clients... Tapez « aide » pour des exemples.', data: null };
      break;
    case 'thanks':
      out = { response: "Avec plaisir ! N'hesitez pas si vous avez d'autres questions.", data: null };
      break;
    case 'topClients':
      out = await hTopClients(period, orgId);
      break;
    case 'topArticles':
      out = await hTopArticles(period, orgId);
      break;
    case 'ca':
      out = await hCa(period, orgId);
      break;
    case 'salesProduct':
      out = await hSalesProduct(namedProduct, period, orgId);
      break;
    case 'salesClient':
      out = await hSalesClient(client, period, orgId);
      break;
    case 'price':
      out = await hPrice(namedProduct, ctx.product, orgId);
      break;
    case 'stockValue':
      out = await hStockValue(orgId);
      break;
    case 'lowStock':
      out = await hLowStock(orgId);
      break;
    case 'expiring':
      out = await hExpiring(orgId);
      break;
    case 'dormant':
      out = await hDormant(orgId);
      break;
    case 'stock':
      out = await hStock(namedProduct, orgId);
      break;
    case 'category':
      out = await hCategory(ents.category, orgId);
      break;
    default:
      if (ents.product) out = await hStock(ents.product, orgId);
      else out = await hSearch(message, orgId);
  }

  return out;
}

module.exports = { answer, normalize, extractPeriod, detectIntent };
