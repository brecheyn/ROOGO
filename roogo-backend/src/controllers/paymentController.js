const pool = require('../config/database');

// ── Taux de change (table des devises) ───────────────────────────────────────
const DEFAULT_RATES = {
  XOF: 1,     // Franc CFA (base)
  EUR: 0.0015,
  USD: 0.0016,
  GBP: 0.0013,
  GHS: 0.024,  // Cedi ghénéen
  NGN: 2.5,    // Naira
  CDF: 4.0,    // Franc congolais
  KES: 0.21,   // Shilling kényan
};

// Obtenir les taux de change
exports.getExchangeRates = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM exchange_rate ORDER BY code
    `).catch(() => null);

    const rates = result && result.rows.length > 0
      ? Object.fromEntries(result.rows.map(r => [r.code, parseFloat(r.rate)]))
      : DEFAULT_RATES;

    res.json({
      success: true,
      base_currency: 'XOF',
      rates,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    res.json({ success: true, base_currency: 'XOF', rates: DEFAULT_RATES });
  }
};

// Convertir un montant
exports.convert = async (req, res) => {
  try {
    const { amount, from, to } = req.body;

    if (!amount || !from || !to) {
      return res.status(400).json({ success: false, message: 'amount, from et to requis' });
    }

    const rates = DEFAULT_RATES;
    const fromRate = rates[from] || 1;
    const toRate = rates[to] || 1;

    // Conversion via XOF comme base
    const xofAmount = amount / fromRate;
    const converted = xofAmount * toRate;

    res.json({
      success: true,
      data: {
        original: { amount, currency: from },
        converted: { amount: Math.round(converted * 100) / 100, currency: to },
        rate: toRate / fromRate,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur conversion' });
  }
};

// ── Mobile Money ─────────────────────────────────────────────────────────────
// Initier un paiement
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, currency, provider, phone, reference_type, reference_id, description } = req.body;

    if (!amount || !provider || !phone) {
      return res.status(400).json({ success: false, message: 'amount, provider et phone requis' });
    }

    const validProviders = ['orange_money', 'mtn_mobile_money', 'wave', 'moov_money'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({
        success: false,
        message: `Provider invalide. Utilisez: ${validProviders.join(', ')}`
      });
    }

    // Générer une référence de paiement unique
    const paymentRef = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Sauvegarder (ici on simule — en prod, intégrer l'API du provider)
    const payment = {
      reference: paymentRef,
      amount,
      currency: currency || 'XOF',
      provider,
      phone,
      status: 'pending',
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      description: description || null,
      created_at: new Date().toISOString(),
    };

    // Log dans audit
    await pool.query(`
      INSERT INTO audit_log (user_id, action, entity, entity_id, details, organization_id)
      VALUES ($1, 'payment_initiated', 'payment', NULL, $2, $3)
    `, [
      req.user?.id,
      JSON.stringify(payment),
      req.organizationId
    ]);

    res.status(201).json({
      success: true,
      message: 'Paiement initié. En attente de confirmation.',
      data: payment,
      instructions: getPaymentInstructions(provider, phone, amount),
    });
  } catch (error) {
    console.error('Erreur payment:', error);
    res.status(500).json({ success: false, message: 'Erreur initiation paiement' });
  }
};

// Vérifier le statut d'un paiement
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    // En prod, interroger l'API du provider ici
    res.json({
      success: true,
      data: {
        reference,
        status: 'pending',
        message: 'En attente de confirmation du provider',
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur vérification paiement' });
  }
};

// ── Historique des paiements ─────────────────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.*, u.username
      FROM audit_log al
      LEFT JOIN "user" u ON al.user_id = u.id
      WHERE al.action LIKE 'payment_%'
      ORDER BY al.created_at DESC
      LIMIT 50
    `);

    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur historique paiements' });
  }
};

// ── Helper: instructions de paiement ─────────────────────────────────────────
function getPaymentInstructions(provider, phone, amount) {
  const instructions = {
    orange_money: {
      provider: 'Orange Money',
      steps: [
        `Sur votre téléphone, composez *#144#`,
        `Sélectionnez "Paiement"`,
        `Entrez le montant: ${amount} FCFA`,
        `Confirmez avec votre PIN`,
      ],
      ussd: `*#144#`,
    },
    mtn_mobile_money: {
      provider: 'MTN Mobile Money',
      steps: [
        `Sur votre téléphone, composez *133#`,
        `Sélectionnez "Payer un marchand"`,
        `Entrez le montant: ${amount} FCFA`,
        `Confirmez avec votre PIN`,
      ],
      ussd: `*133#`,
    },
    wave: {
      provider: 'Wave',
      steps: [
        `Ouvrez l'application Wave`,
        `Scannez le QR code du marchand`,
        `Entrez le montant: ${amount} FCFA`,
        `Confirmez avec votre PIN`,
      ],
    },
    moov_money: {
      provider: 'Moov Money',
      steps: [
        `Sur votre téléphone, composez *555#`,
        `Sélectionnez "Paiement"`,
        `Entrez le montant: ${amount} FCFA`,
        `Confirmez avec votre PIN`,
      ],
      ussd: `*555#`,
    },
  };

  return instructions[provider] || { message: 'Instructions non disponibles' };
}
