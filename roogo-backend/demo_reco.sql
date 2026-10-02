-- ═══ Données DEMO pour la page Recommandations (org 5 = Engter) ═══

-- 1. Articles démo : un par scénario
INSERT INTO article (name_article, categorie, quantity, unit_price, description, expiration_date, organization_id)
VALUES
  ('DEMO Riz Parfumé 5kg',    'Alimentation',  3,   4500,  'Démo — rupture imminente',        NULL,                 5),
  ('DEMO Huile Tournesol 1L', 'Alimentation',  18,  2000,  'Démo — stock bas à surveiller',   NULL,                 5),
  ('DEMO Casque Bluetooth',   'Électronique',  120, 15000, 'Démo — stock dormant',            NULL,                 5),
  ('DEMO Yaourt Nature x6',   'Alimentation',  25,  3500,  'Démo — expire dans 7 jours',      CURRENT_DATE + 7,     5);

-- 2. Ventes démo : semaine précédente (fort) vs semaine en cours (faible) → tendance en baisse
INSERT INTO sale (id_article, quantity, price, date_sate, organization_id)
SELECT (SELECT id FROM article WHERE name_article = 'DEMO Riz Parfumé 5kg'),    13, 58500, '2026-09-23 10:00:00', 5;
INSERT INTO sale (id_article, quantity, price, date_sate, organization_id)
SELECT (SELECT id FROM article WHERE name_article = 'DEMO Casque Bluetooth'),    2, 30000, '2026-09-24 11:00:00', 5;
INSERT INTO sale (id_article, quantity, price, date_sate, organization_id)
SELECT (SELECT id FROM article WHERE name_article = 'DEMO Riz Parfumé 5kg'),     6, 27000, '2026-09-30 10:00:00', 5;
INSERT INTO sale (id_article, quantity, price, date_sate, organization_id)
SELECT (SELECT id FROM article WHERE name_article = 'DEMO Yaourt Nature x6'),    3, 10500, '2026-09-30 15:00:00', 5;

SELECT id, name_article, quantity, expiration_date FROM article WHERE organization_id = 5 AND name_article LIKE 'DEMO%';
