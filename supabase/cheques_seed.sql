-- ============================================================
-- SEED: Datos planilla de cheques (importación inicial)
-- Ejecutar en Supabase → SQL Editor
-- NOTA: Los ECHEQ marcados como (*) tienen número ilegible
--       en la imagen — podés editarlos después desde la app.
-- ============================================================

INSERT INTO cheques
  (dueno, numero, tipo, fecha, banco, quien_entrego,
   monto_egresado, monto_ingresado, entregada_a, pagado, rechazado, notas)
VALUES

-- ── Bloque 1 ─────────────────────────────────────────────────────────────
(NULL, '02542167',        'CH',     '2025-12-31', 'HIPOTECARIO',   'LA TRANQUERA',                         563607.00,  563607.00,  'SIVET',    TRUE,  FALSE, NULL),
(NULL, '63091358',        'CH',     '2026-02-27', 'MACRO',         'EL RODEO GA',                         2500000.00, 2500000.00, 'SIVET',    TRUE,  FALSE, 'PETSPLAST SRL'),

-- ECHEQ FENDY DAIANA (4 cuotas mensuales) (*número no legible en imagen)
(NULL, 'ECHEQ-FENDY-0217','ECHEQ',  '2026-02-17', 'NACION ARG',   'FENDY DAIANA',                        3762262.00, 3762262.00, 'CR',       TRUE,  FALSE, 'VILLA NUEVA'),
(NULL, 'ECHEQ-FENDY-0317','ECHEQ',  '2026-03-17', 'NACION ARG',   'FENDY DAIANA',                        3762262.00, 3762262.00, 'CR',       TRUE,  FALSE, 'LECHE Y MIEL'),
(NULL, 'ECHEQ-FENDY-0417','ECHEQ',  '2026-04-17', 'NACION ARG',   'FENDY DAIANA',                        3762262.00, 3762262.00, 'CR',       TRUE,  FALSE, 'GANAFORT'),
(NULL, 'ECHEQ-FENDY-0517','ECHEQ',  '2026-05-17', 'NACION ARG',   'FENDY DAIANA',                        3762262.00, 3762262.00, 'CR',       TRUE,  FALSE, 'SIVET'),

-- ── Bloque 2 ─────────────────────────────────────────────────────────────
(NULL, '318',             'ECHEQ',  '2026-01-20', NULL,            'KURMAY SA (Fernando)',                  687372.74,  687372.74, 'GANAFORT', TRUE,  FALSE, 'MERVAX SRL - 20ene'),
(NULL, '12300383',        'CH',     '2025-12-28', 'ICBC',          'KETOBAC SRL',                          512000.00,  512000.00, 'GANAFORT', TRUE,  FALSE, 'HEANUT SA - 35ene'),
(NULL, '90000502',        'ECHEQ',  '2026-01-21', 'BNA',           'LA TRANQUERA',                        1444600.00, 1444600.00, 'GANAFORT', TRUE,  FALSE, 'VIA - 23ene'),
(NULL, '10464399',        'CH',     '2026-04-11', 'ICBC',          'RENATO YUSTACORI',                     414000.00,  414000.00, 'GANAFORT', TRUE,  FALSE, 'PELLCAT - 25ene'),
(NULL, '00003114',        'F_CHEQ', '2026-02-04', 'NACION ARG',   'LA TRANQUERA',                         446600.00,  446600.00, 'GANAFORT', TRUE,  FALSE, 'SENIOR JACK - CR'),

-- ── Bloque 3 ─────────────────────────────────────────────────────────────
(NULL, '85594837',        'CH',     '2026-03-10', 'SUPERVIELLE',   'MARIANO CHACON',                       108535.00,  108535.00, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, '00231129',        'CH',     '2026-02-21', 'NACION ARG',    'EL PUMA',                               68000.00,   68000.00, 'SIVET',    TRUE,  FALSE, NULL),

-- ECHEQ sin fecha legible
(NULL, '72628995',        'ECHEQ',  NULL,         'NACION ARG',    'LA TRANQUERA',                         178792.40,  178792.40, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '00008637',        'F_CHEQ', NULL,         'NACION ARG',    'LA TRANQUERA',                         486812.50,  486812.50, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '63958170',        'ECHEQ',  NULL,         'NACION ARG',    'LA TRANQUERA',                        1000000.00, 1000000.00, 'VIA',      TRUE,  FALSE, NULL),

-- ── Bloque 4 ─────────────────────────────────────────────────────────────
(NULL, '807.12403606',    'CH',     '2026-03-16', 'ICBC',          'ALBERTO MARTINEZ',                     500000.00,  500000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, 'ECHEQ-0203-LTRANQ','ECHEQ', '2026-03-02', 'NACION ARG',   'LA TRANQUERA',                        1000000.00, 1000000.00, 'SIVET',    TRUE,  FALSE, NULL),

-- ── EL RODEO GA - serie SANTANDER ────────────────────────────────────────
(NULL, '33163552',        'CH',     '2026-05-10', 'GALICIA',       'EL RODEO GA',                          400000.00,  400000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '55303133',        'CH',     '2026-03-01', 'SANTANDER',     'EL RODEO GA',                          400000.00,  400000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '00010868',        'CH',     '2026-03-29', 'SANTANDER',     'EL RODEO GA',                          200000.00,  200000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '00010869',        'CH',     '2026-03-30', 'SANTANDER',     'EL RODEO GA',                          200000.00,  200000.00, 'GANAFORT', TRUE,  FALSE, NULL),

-- ── RECHAZADOS ────────────────────────────────────────────────────────────
(NULL, '00007027',        'CH',     '2026-04-05', 'NACION ARG',    'DAIANA FENDY',                        1000000.00, 1000000.00, 'GANAFORT', FALSE, TRUE,  'Rechazado'),
(NULL, '00007028',        'CH',     '2026-04-05', 'NACION ARG',    'DAIANA FENDY',                        1000000.00, 1000000.00, 'GANAFORT', FALSE, TRUE,  'Rechazado'),

-- ── DAIANA FENDY - restantes ─────────────────────────────────────────────
(NULL, '31826859',        'CH',     '2026-04-07', 'BCO ENTRE RIOS','DAIANA FENDY',                         551240.00,  551240.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '33524177',        'CH',     '2026-03-25', 'GALICIA',       'DAIANA FENDY',                         800000.00,  800000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '63384357',        'CH',     '2026-02-20', 'CREDICOOP',     'DAIANA FENDY',                         791828.40,  791828.40, 'GANAFORT', TRUE,  FALSE, NULL),

-- ── SEBASTIAN ────────────────────────────────────────────────────────────
(NULL, '00000043',        'ECHEQ',  '2026-03-04', NULL,            'SEBASTIAN',                            300000.00,  300000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '00000047',        'F_CHEQ', '2026-03-20', NULL,            'SEBASTIAN',                            339715.80,  339715.80, 'GANAFORT', TRUE,  FALSE, NULL),

-- ── Bloque 5 ─────────────────────────────────────────────────────────────
(NULL, '12096932',        'CH',     '2026-03-13', 'BCO PROVINCIA', 'LA TRANQUERA',                        1000000.00, 1000000.00, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, '00475150',        'CH',     '2026-04-09', 'NACION ARG',    'JUAN ESTEBAN PERDIGÜEZ',               500000.00,  500000.00, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, '85594844',        'CH',     '2026-04-18', 'SUPERVIELLE',   'MARIANO CHACON',                       108535.00,  108535.00, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, 'F-CHEQ-0519-1',  'F_CHEQ', '2026-05-19', 'NACION ARG',    'LA TRANQUERA',                        1000000.00, 1000000.00, 'CR',       TRUE,  FALSE, NULL),
(NULL, '00000089',        'CH',     '2026-04-28', 'NACION ARG',    'RENATO YUSTACORI',                     600000.00,  600000.00, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, '00003206',        'CH',     '2026-05-13', 'NACION ARG',    'YELLOWSTONE SA (Luis Garce)',           402087.84,  402087.84, 'GANAFORT', TRUE,  FALSE, NULL),

-- ── Bloque 6 ─────────────────────────────────────────────────────────────
(NULL, '1789',            'ECHEQ',  '2026-04-10', 'GALICIA',       'BRACORP SA',                            82280.00,   82280.00, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '16766670',        'F_CHEQ', '2026-04-24', 'SANTANDER',     'EDUARDO LUCAS',                        483600.00,  483600.00, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '16769285',        'ECHEQ',  '2026-04-24', 'SANTANDER',     'EDUARDO LUCAS',                        482614.62,  482614.62, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '00000570',        'CH',     '2026-05-20', 'NACION ARG',    'LA TRANQUERA',                        1200000.00, 1200000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '00231217',        'CH',     '2026-04-16', 'NACION ARG',    'EL PUMA',                               90000.00,   90000.00, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, '91761941',        'CH',     '2026-04-20', 'CREDICOOP',     'ALBERTO MARTINEZ',                     674820.05,  674820.05, 'SIVET',    TRUE,  FALSE, NULL),
(NULL, '00548265',        'CH',     '2026-05-26', 'NACION ARG',    'EL RODEO GA',                          546000.00,  546000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '00148324',        'CH',     '2026-05-30', 'NACION ARG',    'EL RODEO GA',                         1000000.00, 1000000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '86121337',        'CH',     '2026-04-30', 'SUPERVIELLE',   'OSVALDO MARTINEZ',                     295000.00,  295000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, 'F-CHEQ-0409-MINFRA','F_CHEQ','2026-04-09',NULL,            'ALBERTO MARTINEZ (MINFRA CAÑADA ANCHA)',714716.97, 714716.97, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '85547687',        'CH',     '2026-04-24', 'SUPERVIELLE',   'LA TRANQUERA',                         535000.00,  535000.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, 'F-CHEQ-0619-SUPE','F_CHEQ', '2026-06-19', 'SUPERVIELLE',  'LA TRANQUERA',                        1000000.00, 1000000.00, 'VIA',      TRUE,  FALSE, NULL),

-- ── SAMA ─────────────────────────────────────────────────────────────────
(NULL, '26201365',        'CH',     '2026-05-30', 'SANTANDER',     'SAMA',                                 302900.00,  302900.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '26201366',        'CH',     '2026-06-15', 'SANTANDER',     'SAMA',                                 302900.00,  302900.00, 'GANAFORT', TRUE,  FALSE, NULL),
(NULL, '26201363',        'CH',     '2026-06-15', 'SANTANDER',     'SAMA',                                 304293.00,  304293.00, 'GANAFORT', TRUE,  FALSE, NULL),

-- ── FERNANDO ─────────────────────────────────────────────────────────────
(NULL, '86156488',        'CH',     '2026-06-04', 'SUPERVIELLE',   'EL RODEO GA',                          400000.00,  400000.00, 'FERNANDO', TRUE,  FALSE, NULL),
(NULL, '86156489',        'CH',     '2026-06-06', 'SUPERVIELLE',   'EL RODEO GA',                          400000.00,  400000.00, 'FERNANDO', TRUE,  FALSE, NULL),

-- ── Sección pendientes / parciales ───────────────────────────────────────
-- (sin V en PAGADO o INGRESADO vacío = pendiente)
(NULL, '00426844',        'CH',     '2026-05-08', 'NACION ARG',    'JUAN ESTEBAN PERDIGÜEZ',                84000.00,       0.00,  NULL,      FALSE, FALSE, NULL),
(NULL, '61772727',        'CH',     '2026-06-28', 'MACRO',         'JUAN ESTEBAN PERDIGÜEZ',               275000.00,  275000.00, 'CR',       TRUE,  FALSE, NULL),
(NULL, '1847',            'F_CHEQ', '2026-06-10', 'GALICIA',       'BRACORP SA',                           740270.00,  740270.00, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '01793828',        'ECHEQ',  '2026-06-10', NULL,            'JUAN ESTEBAN PERDIGÜEZ',               928000.00,  928000.00, 'VIA',      TRUE,  FALSE, NULL),
(NULL, '00000408',        'CH',     '2026-06-09', 'NACION ARG',    'EL RODEO GA',                          500000.00,       0.00,  NULL,      FALSE, FALSE, NULL),
(NULL, '00231572',        'CH',     '2026-06-18', 'NACION ARG',    'EL PUMA',                              105000.00,  689000.00,  NULL,      FALSE, FALSE, NULL),
(NULL, '00000277',        'CH',     '2026-06-20', 'NACION ARG',    'EL RODEO GA',                               0.00, 1018903.72,  NULL,      FALSE, FALSE, NULL),
(NULL, '91260311',        'CH',     '2026-06-20', 'CREDICOOP',     'ARTURO MANZANO',                       192000.00,  192000.00,  NULL,      TRUE,  FALSE, NULL),
(NULL, 'ECHEQ-MINFRA-0530','ECHEQ', '2026-05-30', NULL,           'ALBERTO MARTINEZ (M CAÑADA ANCHA)',     145574.01,  145574.01,  NULL,      TRUE,  FALSE, NULL),
(NULL, 'CH-BNA-LTRANQ-1', 'CH',     NULL,         'BNA',           'LA TRANQUERA',                         537000.00,       0.00,  NULL,      FALSE, FALSE, NULL);
