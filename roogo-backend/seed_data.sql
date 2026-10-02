-- ============================================================
-- SCRIPT DE DONNÉES EXEMPLES - ROOGO
-- Données réalistes pour la Côte d'Ivoire
-- ============================================================

-- Récupérer l'organisation_id du test org
DO $$
DECLARE
  org_id INTEGER;
  client1_id INTEGER; client2_id INTEGER; client3_id INTEGER; client4_id INTEGER; client5_id INTEGER;
  client6_id INTEGER; client7_id INTEGER; client8_id INTEGER;
  sup1_id INTEGER; sup2_id INTEGER; sup3_id INTEGER;
  art1_id INTEGER; art2_id INTEGER; art3_id INTEGER; art4_id INTEGER; art5_id INTEGER;
  art6_id INTEGER; art7_id INTEGER; art8_id INTEGER; art9_id INTEGER; art10_id INTEGER;
  art11_id INTEGER; art12_id INTEGER; art13_id INTEGER; art14_id INTEGER; art15_id INTEGER;
  store1_id INTEGER; store2_id INTEGER;
BEGIN
  SELECT id INTO org_id FROM organization WHERE slug = 'alpha' LIMIT 1;
  IF org_id IS NULL THEN org_id := 1; END IF;

  -- ============================================================
  -- CLIENTS (8 clients variés)
  -- ============================================================
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Koné', 'Aminata', '+225 07 08 12 34', 'Abidjan, Cocody, Rue des Jardins', org_id)
    RETURNING id INTO client1_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Traoré', 'Ibrahim', '+225 05 62 45 78', 'Bouaké, Centre-Ville', org_id)
    RETURNING id INTO client2_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Diallo', 'Fatoumata', '+225 01 03 56 89', 'Yamoussoukro, Quartier Résidentiel', org_id)
    RETURNING id INTO client3_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Bamba', 'Moussa', '+225 07 78 23 45', 'San-Pédro, Port', org_id)
    RETURNING id INTO client4_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Ouattara', 'Mariam', '+225 05 44 67 12', 'Korhogo, Nord', org_id)
    RETURNING id INTO client5_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Gnakpa', 'Jean-Baptiste', '+225 01 89 34 56', 'Abidjan, Plateau', org_id)
    RETURNING id INTO client6_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Soro', 'Awa', '+225 07 12 98 76', 'Man, Ouest', org_id)
    RETURNING id INTO client7_id;
  INSERT INTO client (name, surname, phone, address, organization_id) VALUES
    ('Coulibaly', 'Ségbé', '+225 05 67 43 21', 'Abobo, Abidjan', org_id)
    RETURNING id INTO client8_id;

  RAISE NOTICE 'Clients insérés: %', client1_id;

  -- ============================================================
  -- FOURNISSEURS (4 fournisseurs)
  -- ============================================================
  INSERT INTO supplier (name, surname, phone, address, organization_id) VALUES
    ('Distribois CI', 'Commercial', '+225 27 20 21 22', 'Abidjan, Zone Industrielle, Yopougon', org_id)
    RETURNING id INTO sup1_id;
  INSERT INTO supplier (name, surname, phone, address, organization_id) VALUES
    ('Fournitures Plus', 'Service Clients', '+225 27 31 45 67', 'Abidjan, Marcory', org_id)
    RETURNING id INTO sup2_id;
  INSERT INTO supplier (name, surname, phone, address, organization_id) VALUES
    ('Agro-Supply CI', 'Direction', '+225 27 56 78 90', 'Bouaké, Zone Commerciale', org_id)
    RETURNING id INTO sup3_id;
  INSERT INTO supplier (name, surname, phone, address, organization_id) VALUES
    ('TechImport Afrique', 'Ventes', '+225 07 09 87 65', 'Abidjan, Treichville', org_id)
    RETURNING id INTO sup3_id;

  RAISE NOTICE 'Fournisseurs insérés';

  -- ============================================================
  -- ARTICLES (15 articles couvrant diverses catégories)
  -- ============================================================

  -- Alimentation
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Riz Premium 25kg', 'Alimentation', 150, 15000.00, '2026-01-15', '2027-01-15', org_id)
    RETURNING id INTO art1_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Huile d''arachide 5L', 'Alimentation', 80, 8500.00, '2026-03-01', '2026-09-01', org_id)
    RETURNING id INTO art2_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Sucre en Poudre 10kg', 'Alimentation', 200, 6500.00, '2026-02-10', '2027-02-10', org_id)
    RETURNING id INTO art3_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Café Torréfié 1kg', 'Alimentation', 120, 4500.00, '2026-04-20', '2026-12-20', org_id)
    RETURNING id INTO art4_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Poisson Fumé 500g', 'Alimentation', 45, 3500.00, '2026-06-01', '2026-07-15', org_id)
    RETURNING id INTO art5_id;

  -- Électronique
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Téléphone Smart G5', 'Électronique', 35, 125000.00, '2026-01-01', NULL, org_id)
    RETURNING id INTO art6_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Chargeur Solaire 20W', 'Électronique', 60, 18000.00, '2026-02-15', NULL, org_id)
    RETURNING id INTO art7_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Écouteurs Bluetooth', 'Électronique', 90, 7500.00, '2026-03-10', NULL, org_id)
    RETURNING id INTO art8_id;

  -- Fournitures
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Papier A4 500 feuilles', 'Fournitures', 300, 3200.00, '2026-01-20', NULL, org_id)
    RETURNING id INTO art9_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Stylos Bille (lot 50)', 'Fournitures', 180, 2500.00, '2026-02-05', NULL, org_id)
    RETURNING id INTO art10_id;

  -- Hygiène
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Savon Noir 200g', 'Hygiène', 250, 1200.00, '2026-04-01', '2027-04-01', org_id)
    RETURNING id INTO art11_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Shampooing 400ml', 'Hygiène', 100, 3800.00, '2026-03-15', '2027-03-15', org_id)
    RETURNING id INTO art12_id;

  -- Boissons
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Jus de Bissap 1L', 'Boissons', 160, 1500.00, '2026-06-10', '2026-09-10', org_id)
    RETURNING id INTO art13_id;
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Bière FLAG 33cl (x24)', 'Boissons', 40, 12000.00, '2026-05-01', '2026-11-01', org_id)
    RETURNING id INTO art14_id;

  -- Textile
  INSERT INTO article (name_article, categorie, quantity, unit_price, date_manufacture, expiration_date, organization_id) VALUES
    ('Pagne Wax Hollandais', 'Textile', 75, 5500.00, NULL, NULL, org_id)
    RETURNING id INTO art15_id;

  RAISE NOTICE 'Articles insérés';

  -- ============================================================
  -- SALES (15 ventes sur les 6 derniers mois)
  -- ============================================================
  INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate, organization_id) VALUES
    (art1_id, client1_id, 1, 5, 75000.00, '2026-03-15 10:30:00', org_id),
    (art6_id, client2_id, 1, 1, 125000.00, '2026-04-02 14:15:00', org_id),
    (art4_id, client3_id, 1, 3, 13500.00, '2026-04-18 09:00:00', org_id),
    (art9_id, client6_id, 1, 10, 32000.00, '2026-05-01 11:45:00', org_id),
    (art2_id, client4_id, 1, 2, 17000.00, '2026-05-14 16:30:00', org_id),
    (art11_id, client5_id, 1, 20, 24000.00, '2026-05-28 08:20:00', org_id),
    (art7_id, client1_id, 1, 2, 36000.00, '2026-06-05 13:00:00', org_id),
    (art8_id, client8_id, 1, 5, 37500.00, '2026-06-10 15:30:00', org_id),
    (art13_id, client7_id, 1, 30, 45000.00, '2026-06-18 10:00:00', org_id),
    (art14_id, client2_id, 1, 3, 36000.00, '2026-07-01 17:45:00', org_id),
    (art3_id, client3_id, 1, 8, 52000.00, '2026-07-12 09:15:00', org_id),
    (art15_id, client5_id, 1, 6, 33000.00, '2026-07-20 14:00:00', org_id),
    (art12_id, client4_id, 1, 4, 15200.00, '2026-08-02 11:30:00', org_id),
    (art5_id, client6_id, 1, 10, 35000.00, '2026-08-15 16:00:00', org_id),
    (art1_id, client1_id, 1, 10, 150000.00, '2026-08-28 08:45:00', org_id);

  RAISE NOTICE 'Ventes insérées';

  -- ============================================================
  -- COMMANDES (8 commandes fournisseurs)
  -- ============================================================
  INSERT INTO ordering (id_article, id_supplier, quantity, price, order_date, receved_date, organization_id) VALUES
    (art1_id, sup3_id, 50, 650000.00, '2026-01-10 09:00:00', '2026-01-20', org_id),
    (art2_id, sup1_id, 30, 180000.00, '2026-02-05 10:30:00', '2026-02-15', org_id),
    (art6_id, sup2_id, 10, 1000000.00, '2026-03-01 14:00:00', '2026-03-10', org_id),
    (art9_id, sup1_id, 100, 160000.00, '2026-04-15 08:00:00', '2026-04-25', org_id),
    (art11_id, sup3_id, 200, 120000.00, '2026-05-20 11:00:00', '2026-05-30', org_id),
    (art4_id, sup3_id, 40, 120000.00, '2026-06-10 09:30:00', '2026-06-20', org_id),
    (art7_id, sup2_id, 25, 300000.00, '2026-07-05 15:00:00', '2026-07-15', org_id),
    (art13_id, sup1_id, 100, 75000.00, '2026-08-01 10:00:00', '2026-08-10', org_id);

  RAISE NOTICE 'Commandes insérées';

  -- ============================================================
  -- PRODUCT_LOTS (lots de stock)
  -- ============================================================
  INSERT INTO product_lot (article_id, lot_number, quantity, manufacturing_date, expiration_date, supplier_id, organization_id, status) VALUES
    (art1_id, 'LOT-RIZ-2026-001', 100, '2026-01-15', '2027-01-15', sup3_id, org_id, 'active'),
    (art1_id, 'LOT-RIZ-2026-002', 50, '2026-06-01', '2027-06-01', sup3_id, org_id, 'active'),
    (art2_id, 'LOT-HUILE-2026-001', 50, '2026-03-01', '2026-09-01', sup1_id, org_id, 'active'),
    (art2_id, 'LOT-HUILE-2026-002', 30, '2026-05-15', '2026-11-15', sup1_id, org_id, 'active'),
    (art4_id, 'LOT-CAFE-2026-001', 80, '2026-04-20', '2026-12-20', sup3_id, org_id, 'active'),
    (art5_id, 'LOT-POISSON-2026-001', 30, '2026-06-01', '2026-07-15', sup1_id, org_id, 'expired'),
    (art5_id, 'LOT-POISSON-2026-002', 15, '2026-06-20', '2026-08-05', sup1_id, org_id, 'active'),
    (art6_id, 'LOT-TELECH-2026-001', 20, '2026-01-01', NULL, sup2_id, org_id, 'active'),
    (art6_id, 'LOT-TELECH-2026-002', 15, '2026-03-01', NULL, sup2_id, org_id, 'active'),
    (art13_id, 'LOT-BISSAP-2026-001', 100, '2026-06-10', '2026-09-10', sup1_id, org_id, 'active'),
    (art13_id, 'LOT-BISSAP-2026-002', 60, '2026-08-01', '2026-11-01', sup1_id, org_id, 'active'),
    (art14_id, 'LOT-BIERE-2026-001', 40, '2026-05-01', '2026-11-01', sup1_id, org_id, 'active');

  RAISE NOTICE 'Lots insérés';

  -- ============================================================
  -- STOCK_MOVEMENTS (mouvements de stock variés)
  -- ============================================================
  INSERT INTO stock_movement (article_id, movement_type, quantity, reference_id, reference_type, notes, user_id, organization_id, created_at) VALUES
    (art1_id, 'purchase', 50, 1, 'ordering', 'Réception lot riz premium', 1, org_id, '2026-01-20 10:00:00'),
    (art1_id, 'sale', -5, 1, 'sale', 'Vente client Koné', 1, org_id, '2026-03-15 10:30:00'),
    (art6_id, 'purchase', 10, 3, 'ordering', 'Réception smartphones', 1, org_id, '2026-03-10 14:00:00'),
    (art6_id, 'sale', -1, 2, 'sale', 'Vente client Traoré', 1, org_id, '2026-04-02 14:15:00'),
    (art4_id, 'sale', -3, 3, 'sale', 'Vente café', 1, org_id, '2026-04-18 09:00:00'),
    (art9_id, 'purchase', 100, 4, 'ordering', 'Réception papier A4', 1, org_id, '2026-04-25 08:00:00'),
    (art9_id, 'sale', -10, 4, 'sale', 'Vente fournitures Gnakpa', 1, org_id, '2026-05-01 11:45:00'),
    (art11_id, 'purchase', 200, 5, 'ordering', 'Réception savon noir', 1, org_id, '2026-05-30 10:00:00'),
    (art11_id, 'sale', -20, 6, 'sale', 'Vente savon Ouattara', 1, org_id, '2026-05-28 08:20:00'),
    (art7_id, 'purchase', 25, 7, 'ordering', 'Réception chargeurs solaires', 1, org_id, '2026-07-15 10:00:00'),
    (art7_id, 'sale', -2, 7, 'sale', 'Vente chargeur Koné', 1, org_id, '2026-06-05 13:00:00'),
    (art13_id, 'purchase', 100, 8, 'ordering', 'Réception bissap', 1, org_id, '2026-08-10 10:00:00'),
    (art13_id, 'sale', -30, 9, 'sale', 'Vente bissap Soro', 1, org_id, '2026-06-18 10:00:00'),
    (art5_id, 'adjustment', -5, NULL, NULL, 'Ajustement - produits avariés', 1, org_id, '2026-07-01 09:00:00'),
    (art1_id, 'transfer_out', -20, NULL, 'transfer', 'Transfert vers magasin secondaire', 1, org_id, '2026-08-01 11:00:00');

  RAISE NOTICE 'Mouvements de stock insérés';

  -- ============================================================
  -- SUPPLIER_CATALOG (catalogue fournisseurs)
  -- ============================================================
  INSERT INTO supplier_catalog (supplier_id, article_id, product_name, supplier_price, min_order_quantity, lead_time_days, organization_id) VALUES
    (sup1_id, art1_id, 'Riz Basmati 25kg - Marque Premium', 13000.00, 10, 7, org_id),
    (sup1_id, art2_id, 'Huile d''arachide pure 5L', 6800.00, 20, 5, org_id),
    (sup1_id, art3_id, 'Sucre cristallisé 10kg', 5200.00, 50, 5, org_id),
    (sup1_id, art11_id, 'Savon noir artisanal 200g', 500.00, 100, 3, org_id),
    (sup1_id, art13_id, 'Jus de bissap concentré 1L', 1000.00, 50, 3, org_id),
    (sup1_id, art14_id, 'Bière FLAG pack x24', 10000.00, 10, 5, org_id),
    (sup2_id, art6_id, 'Smartphone G5 - 64Go Noir', 95000.00, 5, 10, org_id),
    (sup2_id, art7_id, 'Panneau solaire chargeur 20W', 14000.00, 10, 14, org_id),
    (sup2_id, art8_id, 'Écouteurs BT sans fil', 5500.00, 20, 7, org_id),
    (sup2_id, art9_id, 'Ramette papier A4 80g', 2200.00, 50, 3, org_id),
    (sup2_id, art10_id, 'Lot 50 stylos bille bleus', 1800.00, 30, 3, org_id),
    (sup3_id, art4_id, 'Café Robusta torréfié 1kg', 3200.00, 30, 10, org_id),
    (sup3_id, art5_id, 'Poisson fumé séché 500g', 2500.00, 20, 2, org_id),
    (sup3_id, art12_id, 'Shampooing karité 400ml', 2800.00, 20, 7, org_id),
    (sup3_id, art15_id, 'Pagne Wax Hollandais 6 yards', 4000.00, 10, 14, org_id);

  RAISE NOTICE 'Catalogue fournisseurs inséré';

  RAISE NOTICE '=== DONNÉES EXEMPLES INSÉRÉES AVEC SUCCÈS ===';

END $$;
