-- ============================================
-- SPRINT 3-5 : Nouvelles fonctionnalités
-- ============================================

-- TABLE: product_lot (Gestion des lots)
CREATE TABLE IF NOT EXISTS product_lot (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    lot_number VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    manufacturing_date DATE,
    expiration_date DATE,
    supplier_id INTEGER REFERENCES supplier(id),
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active', -- active, depleted, expired, recalled
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, lot_number)
);
CREATE INDEX IF NOT EXISTS idx_lot_article ON product_lot(article_id);
CREATE INDEX IF NOT EXISTS idx_lot_expiration ON product_lot(expiration_date);
CREATE INDEX IF NOT EXISTS idx_lot_org ON product_lot(organization_id);

-- TABLE: serial_number (Numéros de série)
CREATE TABLE IF NOT EXISTS serial_number (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    lot_id INTEGER REFERENCES product_lot(id),
    serial_number VARCHAR(200) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'in_stock', -- in_stock, sold, returned, defective
    sale_id INTEGER REFERENCES sale(id),
    sold_at TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_serial_article ON serial_number(article_id);
CREATE INDEX IF NOT EXISTS idx_serial_status ON serial_number(status);

-- TABLE: quality_check (Contrôle qualité à réception)
CREATE TABLE IF NOT EXISTS quality_check (
    id SERIAL PRIMARY KEY,
    lot_id INTEGER REFERENCES product_lot(id) ON DELETE CASCADE,
    checked_by INTEGER REFERENCES "user"(id),
    check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    quantity_received INTEGER NOT NULL,
    quantity_accepted INTEGER NOT NULL DEFAULT 0,
    quantity_rejected INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, partial
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_qc_lot ON quality_check(lot_id);

-- TABLE: stock_movement (Traçabilité des mouvements)
CREATE TABLE IF NOT EXISTS stock_movement (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    lot_id INTEGER REFERENCES product_lot(id),
    movement_type VARCHAR(50) NOT NULL, -- sale, purchase, transfer_in, transfer_out, adjustment, return_supplier, return_client
    quantity INTEGER NOT NULL,
    reference_id INTEGER, -- ID de la vente, commande, etc.
    reference_type VARCHAR(50), -- sale, ordering, transfer
    from_store_id INTEGER REFERENCES store(id),
    to_store_id INTEGER REFERENCES store(id),
    notes TEXT,
    user_id INTEGER REFERENCES "user"(id),
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_movement_article ON stock_movement(article_id);
CREATE INDEX IF NOT EXISTS idx_movement_type ON stock_movement(movement_type);
CREATE INDEX IF NOT EXISTS idx_movement_date ON stock_movement(created_at);

-- TABLE: reorder_rule (Règles de réapprovisionnement dynamique)
CREATE TABLE IF NOT EXISTS reorder_rule (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES article(id) ON DELETE CASCADE,
    min_stock INTEGER NOT NULL DEFAULT 10,
    max_stock INTEGER NOT NULL DEFAULT 100,
    reorder_point INTEGER NOT NULL DEFAULT 20,
    lead_time_days INTEGER DEFAULT 7, -- délai fournisseur en jours
    safety_stock INTEGER DEFAULT 5, -- stock de sécurité
    auto_reorder BOOLEAN DEFAULT FALSE,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id)
);
CREATE INDEX IF NOT EXISTS idx_reorder_article ON reorder_rule(article_id);

-- TABLE: supplier_catalog (Catalogue fournisseurs)
CREATE TABLE IF NOT EXISTS supplier_catalog (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES supplier(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES article(id) ON DELETE SET NULL,
    product_name VARCHAR(200) NOT NULL,
    supplier_price NUMERIC(10,2) NOT NULL,
    min_order_quantity INTEGER DEFAULT 1,
    lead_time_days INTEGER DEFAULT 7,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
