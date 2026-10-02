const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    const result = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.validated = result;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

// ── Schémas de validation ──────────────────────────────────────────────────────

const articleSchema = {
  create: z.object({
    body: z.object({
      name_article: z.string().min(2, 'Le nom doit avoir au moins 2 caractères').max(150),
      categorie: z.string().min(1, 'La catégorie est requise').max(100),
      description: z.string().max(1000).optional().nullable(),
      quantity: z.number().int().min(0).optional().default(0),
      unit_price: z.number().min(0).optional(),
      date_manufacture: z.string().optional().nullable(),
      expiration_date: z.string().optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
  update: z.object({
    body: z.object({
      name_article: z.string().min(2).max(150).optional(),
      categorie: z.string().min(1).max(100).optional(),
      description: z.string().max(1000).optional().nullable(),
      quantity: z.number().int().min(0).optional(),
      unit_price: z.number().min(0).optional(),
      date_manufacture: z.string().optional().nullable(),
      expiration_date: z.string().optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({ id: z.string().regex(/^\d+$/, 'ID invalide') }),
  }),
};

const clientSchema = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, 'Le nom est requis').max(100),
      surname: z.string().min(1, 'Le prénom est requis').max(100),
      phone: z.string().max(20).optional().nullable(),
      address: z.string().max(255).optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
  update: z.object({
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      surname: z.string().min(1).max(100).optional(),
      phone: z.string().max(20).optional().nullable(),
      address: z.string().max(255).optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({ id: z.string().regex(/^\d+$/, 'ID invalide') }),
  }),
};

const supplierSchema = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, 'Le nom est requis').max(100),
      surname: z.string().max(100).optional().nullable(),
      phone: z.string().max(20).optional().nullable(),
      address: z.string().max(255).optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
  update: z.object({
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      surname: z.string().max(100).optional().nullable(),
      phone: z.string().max(20).optional().nullable(),
      address: z.string().max(255).optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({ id: z.string().regex(/^\d+$/, 'ID invalide') }),
  }),
};

const saleLineSchema = z.object({
  articleId: z.coerce.number().int().positive('ID article invalide'),
  quantite: z.coerce.number().int().positive('La quantité doit être positive'),
  prixUnitaire: z.coerce.number().positive('Le prix doit être positif'),
});

const saleSchema = {
  create: z.object({
    body: z
      .object({
        // Format legacy (une ligne)
        id_article: z.coerce.number().int().positive('ID article invalide').optional(),
        quantity: z.coerce.number().int().positive('La quantité doit être positive').optional(),
        price: z.coerce.number().positive('Le prix doit être positif').optional(),
        // Format multi-lignes (formulaire Angular)
        articles: z.array(saleLineSchema).min(1, 'Au moins un article requis').optional(),
        // Client (les deux formes acceptées)
        id_client: z.coerce.number().int().positive('ID client invalide').optional(),
        clientId: z.coerce.number().int().positive('ID client invalide').optional(),
        // Facultatifs
        dateVente: z.union([z.string(), z.number(), z.null()]).optional(),
        montantTotal: z.number().optional(),
      })
      .superRefine((body, ctx) => {
        const legacy = body.id_article != null && body.quantity != null && body.price != null;
        const multi = Array.isArray(body.articles);
        if (!legacy && !multi) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['articles'],
            message: 'Format invalide: articles[] ou id_article/quantity/price requis',
          });
        }
      }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
  update: z.object({
      body: z
        .object({
          id_article: z.coerce.number().int().positive('ID article invalide').optional(),
          quantity: z.coerce.number().int().positive('La quantité doit être positive').optional(),
          price: z.coerce.number().positive('Le prix doit être positif').optional(),
          articles: z.array(saleLineSchema).min(1, 'Au moins un article requis').optional(),
          id_client: z.coerce.number().int().positive('ID client invalide').optional().nullable(),
          clientId: z.coerce.number().int().positive('ID client invalide').optional().nullable(),
          dateVente: z.union([z.string(), z.number(), z.null()]).optional(),
          montantTotal: z.coerce.number().optional(),
        })
      .superRefine((body, ctx) => {
        const legacy = body.id_article != null && body.quantity != null && body.price != null;
        const multi = Array.isArray(body.articles);
        if (!legacy && !multi) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['articles'],
            message: 'Format invalide: articles[] ou id_article/quantity/price requis',
          });
        }
      }),
    query: z.object({}).passthrough(),
    params: z.object({ id: z.string().regex(/^\d+$/, 'ID invalide') }),
  }),
};

const orderingSchema = {
  create: z.object({
    body: z.object({
      id_article: z.number().int().positive('ID article invalide'),
      id_supplier: z.number().int().positive('ID fournisseur invalide'),
      quantity: z.number().int().positive('La quantité doit être positive'),
      price: z.number().positive('Le prix doit être positif'),
    }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
};

const authSchema = {
  login: z.object({
    body: z.object({
      username: z.string().min(3, 'Le nom d\'utilisateur doit avoir au moins 3 caractères'),
      password: z.string().min(1, 'Le mot de passe est requis'),
    }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
  signup: z.object({
    body: z.object({
      username: z.string().min(3).max(100),
      email: z.string().email('Email invalide'),
      password: z.string().min(8, 'Le mot de passe doit avoir au moins 8 caractères'),
      organizationName: z.string().min(1, 'Le nom de l\'organisation est requis').max(100),
      industry: z.string().max(100).optional().nullable(),
      phone: z.string().max(20).optional().nullable(),
      plan: z.string().max(50).optional().nullable(),
    }),
    query: z.object({}).passthrough(),
    params: z.object({}).passthrough(),
  }),
};

const idParam = z.object({
  body: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  params: z.object({ id: z.string().regex(/^\d+$/, 'ID invalide') }),
});

module.exports = {
  validate,
  articleSchema,
  clientSchema,
  supplierSchema,
  saleSchema,
  orderingSchema,
  authSchema,
  idParam,
};
