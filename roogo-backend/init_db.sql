-- ============================================
-- ROOGO - Initialisation complète de la base
-- ============================================

-- Supprimer les anciennes tables si elles existent (dans l'ordre des FK)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS notification CASCADE;
DROP TABLE IF EXISTS rapport CASCADE;
DROP TABLE IF EXISTS ordering CASCADE;
DROP TABLE IF EXISTS sale CASCADE;
DROP TABLE IF EXISTS article CASCADE;
DROP TABLE IF EXISTS supplier CASCADE;
DROP TABLE IF EXISTS client CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS store CASCADE;
DROP TABLE IF EXISTS role CASCADE;
DROP TABLE IF EXISTS organization CASCADE;
DROP TABLE IF EXISTS subscription_plan CASCADE;

DROP VIEW IF EXISTS v_organization_stats CASCADE;
DROP VIEW IF EXISTS v_organization_limits CASCADE;
DROP FUNCTION IF EXISTS can_add_user(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS can_add_store(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS has_feature(INTEGER, VARCHAR) CASCADE;

-- ============================================
-- TABLES DE BASE
-- ============================================

CREATE TABLE role (
    id SERIAL PRIMARY KEY,
    name_role VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO role (name_role) VALUES ('Admin'), ('Manager'), ('Vendeur');

CREATE TABLE organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    domain VARCHAR(100) UNIQUE,
    subscription_plan VARCHAR(20) DEFAULT 'free',
    subscription_status VARCHAR(20) DEFAULT 'active',
    max_users INTEGER DEFAULT 5,
    max_stores INTEGER DEFAULT 1,
    max_storage_mb INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_expires_at TIMESTAMP,
    logo_url VARCHAR(255),
    contact_email VARCHAR(100),
    contact_phone VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE subscription_plan (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER NOT NULL,
    max_users INTEGER NOT NULL,
    max_stores INTEGER NOT NULL,
    max_storage_mb INTEGER NOT NULL,
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO subscription_plan (name, price_monthly, price_yearly, max_users, max_stores, max_storage_mb, features) VALUES
('Gratuit', 0, 0, 3, 1, 100, '{"export_excel": false, "ai_reports": false, "advanced_stats": false}'),
('Professionnel', 25000, 250000, 10, 3, 1000, '{"export_excel": true, "ai_reports": true, "advanced_stats": true}'),
('Entreprise', 100000, 1000000, 50, 10, 10000, '{"export_excel": true, "ai_reports": true, "advanced_stats": true, "api_access": true, "priority_support": true}');

CREATE TABLE store (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    adresse VARCHAR(255),
    address TEXT,
    phone VARCHAR(20),
    email_adresse VARCHAR(100),
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_store_organization ON store(organization_id);

CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    role_id INTEGER REFERENCES role(id),
    store_id INTEGER REFERENCES store(id),
    created_by INTEGER REFERENCES "user"(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_user_organization ON "user"(organization_id);

CREATE TABLE client (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_client_organization ON client(organization_id);

CREATE TABLE article (
    id SERIAL PRIMARY KEY,
    name_article VARCHAR(100) NOT NULL,
    categorie VARCHAR(100),
    quantity INTEGER DEFAULT 0,
    unit_price NUMERIC(10,2),
    date_manufacture DATE,
    expiration_date DATE,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_article_organization ON article(organization_id);

CREATE TABLE supplier (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100),
    phone VARCHAR(20),
    address TEXT,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_supplier_organization ON supplier(organization_id);

CREATE TABLE sale (
    id SERIAL PRIMARY KEY,
    id_article INTEGER REFERENCES article(id),
    id_client INTEGER REFERENCES client(id),
    store_id INTEGER REFERENCES store(id),
    quantity INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    date_sate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_sale_organization ON sale(organization_id);

CREATE TABLE ordering (
    id SERIAL PRIMARY KEY,
    id_article INTEGER REFERENCES article(id),
    id_supplier INTEGER REFERENCES supplier(id),
    quantity INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    receved_date DATE,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_ordering_organization ON ordering(organization_id);

CREATE TABLE rapport (
    id SERIAL PRIMARY KEY,
    titre VARCHAR(255),
    user_id INTEGER REFERENCES "user"(id),
    ia_prompt TEXT,
    bestseller_article TEXT,
    ia_prevision TEXT,
    badselle_article TEXT,
    approvions_article TEXT,
    prompt_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_rapport_organization ON rapport(organization_id);

CREATE TABLE notification (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id),
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_notification_organization ON notification(organization_id);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id),
    action VARCHAR(100),
    entity VARCHAR(100),
    entity_id VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE
);
CREATE INDEX idx_audit_organization ON audit_log(organization_id);

-- ============================================
-- DONNÉES DE TEST
-- ============================================

INSERT INTO organization (name, slug, domain, subscription_plan, max_users, max_stores, max_storage_mb) VALUES
('Entreprise Alpha', 'alpha', 'alpha.roogo.com', 'pro', 10, 3, 1000),
('Boutique Beta', 'beta', 'beta.roogo.com', 'free', 3, 1, 100),
('Corporation Gamma', 'gamma', 'gamma.roogo.com', 'enterprise', 50, 10, 10000);

-- ============================================
-- VUES
-- ============================================

CREATE VIEW v_organization_stats AS
SELECT
    o.id,
    o.name,
    o.subscription_plan,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT st.id) as total_stores,
    COUNT(DISTINCT s.id) as total_sales,
    SUM(s.price) as total_revenue
FROM organization o
LEFT JOIN "user" u ON o.id = u.organization_id
LEFT JOIN store st ON o.id = st.organization_id
LEFT JOIN sale s ON o.id = s.organization_id
GROUP BY o.id, o.name, o.subscription_plan;

CREATE VIEW v_organization_limits AS
SELECT
    o.id,
    o.name,
    o.subscription_plan,
    COUNT(DISTINCT u.id) as current_users,
    o.max_users,
    COUNT(DISTINCT st.id) as current_stores,
    o.max_stores,
    CASE
        WHEN COUNT(DISTINCT u.id) >= o.max_users THEN 'LIMITE ATTEINTE'
        ELSE 'OK'
    END as user_status,
    CASE
        WHEN COUNT(DISTINCT st.id) >= o.max_stores THEN 'LIMITE ATTEINTE'
        ELSE 'OK'
    END as store_status
FROM organization o
LEFT JOIN "user" u ON o.id = u.organization_id
LEFT JOIN store st ON o.id = st.organization_id
GROUP BY o.id, o.name, o.subscription_plan, o.max_users, o.max_stores;

-- ============================================
-- FONCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION can_add_user(org_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_users INTEGER;
    max_allowed INTEGER;
BEGIN
    SELECT COUNT(*), o.max_users
    INTO current_users, max_allowed
    FROM "user" u
    JOIN organization o ON o.id = org_id
    WHERE u.organization_id = org_id
    GROUP BY o.max_users;
    RETURN current_users < max_allowed;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_add_store(org_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_stores INTEGER;
    max_allowed INTEGER;
BEGIN
    SELECT COUNT(*), o.max_stores
    INTO current_stores, max_allowed
    FROM store s
    JOIN organization o ON o.id = org_id
    WHERE s.organization_id = org_id
    GROUP BY o.max_stores;
    RETURN current_stores < max_allowed;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION has_feature(org_id INTEGER, feature_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    features JSONB;
BEGIN
    SELECT sp.features INTO features
    FROM organization o
    JOIN subscription_plan sp ON o.subscription_plan = sp.name
    WHERE o.id = org_id;
    RETURN (features->>feature_name)::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MESSAGE DE CONFIRMATION
-- ============================================

SELECT 'Base de données ROOGO initialisée avec succès!' AS message;
