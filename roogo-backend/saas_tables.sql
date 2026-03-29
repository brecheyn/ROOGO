-- ============================================
-- ARCHITECTURE SAAS MULTI-TENANT
-- ============================================

-- TABLE: organization (Tenant)
CREATE TABLE organization (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL, -- client1, client2, etc.
    domain VARCHAR(100) UNIQUE, -- client1.roogo.com
    subscription_plan VARCHAR(20) DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    subscription_status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'cancelled'
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

-- TABLE: subscription_plan (Plans disponibles)
CREATE TABLE subscription_plan (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    price_monthly INTEGER NOT NULL, -- En FCFA
    price_yearly INTEGER NOT NULL,
    max_users INTEGER NOT NULL,
    max_stores INTEGER NOT NULL,
    max_storage_mb INTEGER NOT NULL,
    features JSONB, -- {"export_excel": true, "ai_reports": true, ...}
    is_active BOOLEAN DEFAULT TRUE
);

-- Données des plans
INSERT INTO subscription_plan (name, price_monthly, price_yearly, max_users, max_stores, max_storage_mb, features) VALUES
('Gratuit', 0, 0, 3, 1, 100, '{"export_excel": false, "ai_reports": false, "advanced_stats": false}'),
('Professionnel', 25000, 250000, 10, 3, 1000, '{"export_excel": true, "ai_reports": true, "advanced_stats": true}'),
('Entreprise', 100000, 1000000, 50, 10, 10000, '{"export_excel": true, "ai_reports": true, "advanced_stats": true, "api_access": true, "priority_support": true}');

-- ============================================
-- MODIFIER LES TABLES EXISTANTES
-- ============================================

-- Ajouter organization_id à TOUTES les tables

ALTER TABLE "user" ADD COLUMN organization_id INTEGER;
ALTER TABLE "user" ADD CONSTRAINT fk_user_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_user_organization ON "user"(organization_id);

ALTER TABLE store ADD COLUMN organization_id INTEGER;
ALTER TABLE store ADD CONSTRAINT fk_store_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_store_organization ON store(organization_id);

ALTER TABLE client ADD COLUMN organization_id INTEGER;
ALTER TABLE client ADD CONSTRAINT fk_client_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_client_organization ON client(organization_id);

ALTER TABLE article ADD COLUMN organization_id INTEGER;
ALTER TABLE article ADD CONSTRAINT fk_article_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_article_organization ON article(organization_id);

ALTER TABLE supplier ADD COLUMN organization_id INTEGER;
ALTER TABLE supplier ADD CONSTRAINT fk_supplier_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_supplier_organization ON supplier(organization_id);

ALTER TABLE sale ADD COLUMN organization_id INTEGER;
ALTER TABLE sale ADD CONSTRAINT fk_sale_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_sale_organization ON sale(organization_id);

ALTER TABLE ordering ADD COLUMN organization_id INTEGER;
ALTER TABLE ordering ADD CONSTRAINT fk_ordering_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_ordering_organization ON ordering(organization_id);

ALTER TABLE rapport ADD COLUMN organization_id INTEGER;
ALTER TABLE rapport ADD CONSTRAINT fk_rapport_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_rapport_organization ON rapport(organization_id);

ALTER TABLE notification ADD COLUMN organization_id INTEGER;
ALTER TABLE notification ADD CONSTRAINT fk_notification_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_notification_organization ON notification(organization_id);

ALTER TABLE audit_log ADD COLUMN organization_id INTEGER;
ALTER TABLE audit_log ADD CONSTRAINT fk_audit_organization FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_audit_organization ON audit_log(organization_id);

-- ============================================
-- DONNÉES DE TEST
-- ============================================

-- Créer 3 organisations de test
INSERT INTO organization (name, slug, domain, subscription_plan, max_users, max_stores, max_storage_mb) VALUES
('Entreprise Alpha', 'alpha', 'alpha.roogo.com', 'pro', 10, 3, 1000),
('Boutique Beta', 'beta', 'beta.roogo.com', 'free', 3, 1, 100),
('Corporation Gamma', 'gamma', 'gamma.roogo.com', 'enterprise', 50, 10, 10000);

-- Assigner les données existantes à l'organisation Alpha (ID=1)
UPDATE "user" SET organization_id = 1;
UPDATE store SET organization_id = 1;
UPDATE client SET organization_id = 1;
UPDATE article SET organization_id = 1;
UPDATE supplier SET organization_id = 1;
UPDATE sale SET organization_id = 1;
UPDATE ordering SET organization_id = 1;
UPDATE rapport SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE notification SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE audit_log SET organization_id = 1 WHERE organization_id IS NULL;

-- ============================================
-- VUES UTILES
-- ============================================

-- Vue : Statistiques par organisation
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

-- Vue : Organisations avec limites
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
-- FONCTIONS UTILES
-- ============================================

-- Vérifier si l'organisation peut ajouter un utilisateur
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

-- Vérifier si l'organisation peut ajouter un magasin
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

-- Vérifier si l'organisation a accès à une fonctionnalité
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
-- AFFICHAGE
-- ============================================

SELECT 'Architecture SaaS créée avec succès!' AS message;
SELECT '' AS "";
SELECT 'ORGANISATIONS:' AS info;
SELECT * FROM organization;

SELECT '' AS "";
SELECT 'STATISTIQUES PAR ORGANISATION:' AS info;
SELECT * FROM v_organization_stats;

SELECT '' AS "";
SELECT 'LIMITES PAR ORGANISATION:' AS info;
SELECT * FROM v_organization_limits;
