-- Ventes septembre 2026 pour GAFE (store_id=1)
INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate) VALUES
  (2, 1, 1, 3, 45000, '2026-09-05 10:00:00'),
  (7, 2, 1, 1, 125000, '2026-09-08 14:30:00'),
  (4, 3, 1, 5, 22500, '2026-09-12 09:15:00'),
  (9, 4, 1, 15, 48000, '2026-09-15 11:00:00'),
  (12, 5, 1, 10, 12000, '2026-09-18 16:45:00'),
  (8, 6, 1, 3, 22500, '2026-09-20 08:30:00'),
  (14, 7, 1, 20, 30000, '2026-09-21 10:00:00');

-- Ventes septembre 2026 pour Test Org (store_id=2)
INSERT INTO sale (id_article, id_client, store_id, quantity, price, date_sate) VALUES
  (2, 1, 2, 2, 30000, '2026-09-06 10:00:00'),
  (6, 3, 2, 1, 125000, '2026-09-10 14:00:00'),
  (11, 5, 2, 30, 36000, '2026-09-14 09:00:00');
