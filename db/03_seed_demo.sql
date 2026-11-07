BEGIN;

-- 1. Catálogos
INSERT INTO product_category (name) VALUES
    ('Repuestos'), ('Accesorios'), ('Iluminación'), ('Protectores'), ('Rodamientos');

INSERT INTO product_brand (name) VALUES
    ('Genérico'), ('KOYO'), ('NGK'), ('BINDA'), ('Protaper'), ('FOX'), ('Monster'), ('Tomasol');

INSERT INTO motorcycle_brand (name) VALUES ('Bajaj'), ('Yamaha'), ('Suzuki');

INSERT INTO service_type (name, reference_price) VALUES
    ('Engrase', 400),
    ('Cambio de aceite', 150),
    ('Instalación de accesorio', 200),
    ('Trabajo de motor', NULL),
    ('Diagnóstico', NULL);

-- 2. Personal
INSERT INTO staff (name, phone, role) VALUES
    ('Dueño Uno',     '8840-3201', 'DUENO'),
    ('Dueño Dos',     '8620-0452', 'DUENO'),
    ('Freddy Orozco', '8190-6003', 'MECANICO'),
    ('Carlos Padel',  '5790-2104', 'MECANICO'),
    ('Encargado',     '8310-5505', 'ENCARGADO');

INSERT INTO owner (id_owner)
SELECT id_staff FROM staff WHERE role = 'DUENO';

INSERT INTO mechanic (id_mechanic, commission_rate)
SELECT id_staff, CASE name WHEN 'Freddy Orozco' THEN 0.60 ELSE 1.00 END
FROM staff WHERE role = 'MECANICO';

-- 3. Proveedor
INSERT INTO supplier (name, phone, gives_warranty)
VALUES ('Distribuidora MotoNica', '2221-0303', FALSE);

-- 4. Productos de la factura real 
INSERT INTO product (id_product_category, id_product_brand, name, tier, sale_price)
SELECT c.id_product_category, b.id_product_brand, v.name, v.tier, v.sale_price
FROM (VALUES
    ('Pide Vias NS200', 'Iluminación', 'Genérico', 'BAJA', 240.00),
    ('Porta Placa Acero Protaper Con Vias Para Universal-5cm', 'Accesorios', 'Protaper', 'MEDIA', 650.00),
    ('Pide Vias Led X-799 Running', 'Iluminación', 'Genérico', 'BAJA', 220.00),
    ('Pesas de Manubrio con Protector Metal Lujo-280g', 'Protectores', 'Genérico', 'MEDIA', 380.00),
    ('Defensa Protector de Motor Lujo Pulsar 200NS #1', 'Protectores', 'Genérico', 'MEDIA', 1980.00),
    ('Manubrio XL125 Negro', 'Repuestos', 'Genérico', 'BAJA', 300.00),
    ('Maya de Foco Pulsar NS200 With Stainless Steel', 'Accesorios', 'Genérico', 'BAJA', 1400.00),
    ('Perno Completo Delantero CG125 con Bushing', 'Repuestos', 'Genérico', 'BAJA', 100.00),
    ('Tapon de Aceite PS135', 'Repuestos', 'Genérico', 'BAJA', 60.00),
    ('Bujia de Foco HID Abanico (M4) (MH4)', 'Iluminación', 'Genérico', 'BAJA', 600.00),
    ('Calcomania para Tanque "Pulsar" 180UG', 'Accesorios', 'Genérico', 'BAJA', 120.00),
    ('Bujia de Foco Flasher 2B/SF-B142 5 Lados', 'Iluminación', 'Genérico', 'BAJA', 380.00),
    ('Porta Placa con Aluminio Rectangular Color', 'Accesorios', 'Genérico', 'BAJA', 120.00),
    ('Palanca de Cambios Pulsar NS160 Completa', 'Repuestos', 'Genérico', 'BAJA', 280.00),
    ('Bujia de Foco Led 8 Lados 6B With Flasher #202', 'Iluminación', 'Genérico', 'BAJA', 300.00),
    ('Porta Celular para Moto Lujo Especial Con USB #2', 'Accesorios', 'Genérico', 'MEDIA', 650.00),
    ('Mangos UFO-#4014 Lujo 7 Color', 'Accesorios', 'Genérico', 'MEDIA', 180.00),
    ('Cinta de Luces para Asientos (Flexible) 19Cm Amarillo/Rojo', 'Iluminación', 'Genérico', 'BAJA', 80.00),
    ('Balineras 6203 KOYO', 'Rodamientos', 'KOYO', 'ALTA', 120.00),
    ('Balineras 6201 KOYO', 'Rodamientos', 'KOYO', 'ALTA', 120.00),
    ('Balineras 6202 KOYO', 'Rodamientos', 'KOYO', 'ALTA', 120.00),
    ('Banda de Frenos Trasera HJ125/YBR125 BINDA', 'Repuestos', 'BINDA', 'MEDIA', 180.00),
    ('Lodera de Polvo Protaper 193x155', 'Protectores', 'Protaper', 'MEDIA', 120.00),
    ('Tuerca de Perno No.22 (50 Pcs/Bolsa)', 'Repuestos', 'Genérico', 'BAJA', 10.00),
    ('Bujia de Pide Via Glassy Led 128 Flasher-1Fila (unidad)', 'Iluminación', 'Genérico', 'BAJA', 65.00),
    ('Bujia de Foco (H4) Ultra', 'Iluminación', 'Genérico', 'BAJA', 80.00),
    ('Switch de Encendido Universal para Manubrio Color "A"', 'Repuestos', 'Genérico', 'BAJA', 220.00),
    ('Switch de Encendido Universal para Manubrio Tomasol', 'Repuestos', 'Tomasol', 'BAJA', 320.00),
    ('Bujia de Foco Led 3L-H4 Ceramic', 'Iluminación', 'Genérico', 'BAJA', 180.00),
    ('Bujia de Lateral Led 6B Con Strober (2Pcs/Jgo)', 'Iluminación', 'Genérico', 'BAJA', 60.00),
    ('Mangos UFO-#3012', 'Accesorios', 'Genérico', 'BAJA', 160.00),
    ('Mangos UFO-#3013', 'Accesorios', 'Genérico', 'BAJA', 200.00),
    ('Protector de Motor (Pechera) Lujo GN125', 'Protectores', 'Genérico', 'MEDIA', 1980.00),
    ('Coleta Trasera Universal con Stop Lujo', 'Accesorios', 'Genérico', 'MEDIA', 250.00),
    ('Tapa de Cadena Universal Aluminio Honda #FH-1454', 'Protectores', 'Genérico', 'BAJA', 200.00),
    ('Patada H y Dayun', 'Repuestos', 'Genérico', 'BAJA', 200.00),
    ('Banda de Frenos Delantera UM200/C110 y Serpento Sin Uña', 'Repuestos', 'Genérico', 'BAJA', 80.00),
    ('Bushing de Tijera XR150L/DY150GY-6', 'Repuestos', 'Genérico', 'BAJA', 260.00),
    ('Cuarto de Gas Whit Aluminium con Cable Color', 'Repuestos', 'Genérico', 'BAJA', 930.00),
    ('Guantes Cortos MONSTER-XXL', 'Accesorios', 'Monster', 'BAJA', 220.00),
    ('Balineras 6301 KOYO', 'Rodamientos', 'KOYO', 'ALTA', 120.00),
    ('Bujia Led para PideVias Yellow (Aluminium 5.5/Par)', 'Iluminación', 'Genérico', 'BAJA', 240.00),
    ('Capucha de Chispero Con Cable NGK', 'Repuestos', 'NGK', 'ALTA', 380.00),
    ('Alerones Frontales para Moto Pulsar 200NS', 'Accesorios', 'Genérico', 'BAJA', 800.00),
    ('Protector de Deposito Trasero Lujo Pulsar 200NS', 'Protectores', 'Genérico', 'MEDIA', 250.00),
    ('Protector de Filtro de Aceite Lujo Pulsar NS200', 'Protectores', 'Genérico', 'MEDIA', 250.00),
    ('Protector de Bomba Delantera Lujo Pulsar NS200', 'Protectores', 'Genérico', 'MEDIA', 260.00),
    ('Protector de Mordaza Lujo Pulsar200NS "A"', 'Protectores', 'Genérico', 'MEDIA', 380.00),
    ('Lodera de Guardafango Trasera AKT NKD150/Xpress150', 'Protectores', 'Genérico', 'BAJA', 150.00),
    ('Protector de Radiador Lujo Pulsar 200NS', 'Protectores', 'Genérico', 'MEDIA', 1250.00),
    ('Protector de Lateral de Radiador Lujo Pulsar NS200-2 Pcs', 'Protectores', 'Genérico', 'MEDIA', 550.00),
    ('Protector de Manubrio Central Lujo Pulsar NS200', 'Protectores', 'Genérico', 'MEDIA', 260.00),
    ('Protector de Tapa de Cadena Lujo Pulsar NS200-Moderno', 'Protectores', 'Genérico', 'MEDIA', 1250.00),
    ('Protector de Tapa de Cadena Lujo FOX', 'Protectores', 'FOX', 'MEDIA', 820.00),
    ('Carburador EN125/GN125 Con Diafragma 1 Handle', 'Repuestos', 'Genérico', 'BAJA', 960.00),
    ('Tapon de Eje Mediano (XD-022) Dima Deang/2 Pcs', 'Repuestos', 'Genérico', 'BAJA', 150.00),
    ('Lodera de Polvo Fox 220x195 Talla Grande', 'Protectores', 'FOX', 'MEDIA', 140.00),
    ('Kit de Helicoil 8mm (20Pcs Resortes)', 'Repuestos', 'Genérico', 'BAJA', 550.00),
    ('Tacometro Digital GN125/DY125', 'Repuestos', 'Genérico', 'BAJA', 1900.00),
    ('Motor de Arranque Crux REV 110', 'Repuestos', 'Genérico', 'BAJA', 1200.00),
    ('Protector de Motor (Pechera) Lujo AKT NKD125', 'Protectores', 'Genérico', 'MEDIA', 1650.00),
    ('Embancador Universal Del y Tra Black,Red', 'Accesorios', 'Genérico', 'BAJA', 1089.00),
    ('Protector de Tapa de Bobina y Clutch Plastico 3Pcs FOX', 'Protectores', 'FOX', 'MEDIA', 550.00)
) AS v(name, category, brand, tier, sale_price)
JOIN product_category c ON c.name = v.category
JOIN product_brand    b ON b.name = v.brand;

-- 5. La factura de compra
INSERT INTO purchase (id_supplier, invoice_number, purchase_date, terms, due_date, discount, id_received_by)
SELECT s.id_supplier, 'FAC-000123', CURRENT_DATE - 3, 'CREDITO', CURRENT_DATE + 27, 6525.00, o.id_owner
FROM supplier s, owner o
JOIN staff st ON st.id_staff = o.id_owner
WHERE s.name = 'Distribuidora MotoNica' AND st.name = 'Dueño Uno';


INSERT INTO purchase_detail (id_purchase, line_no, id_product, quantity, unit_cost)
SELECT pu.id_purchase, v.line_no, p.id_product, v.quantity, v.unit_cost
FROM (VALUES
    (1, 'Pide Vias NS200', 6, 106.00),
    (2, 'Porta Placa Acero Protaper Con Vias Para Universal-5cm', 4, 370.00),
    (3, 'Pide Vias Led X-799 Running', 6, 101.00),
    (4, 'Pesas de Manubrio con Protector Metal Lujo-280g', 3, 236.00),
    (5, 'Defensa Protector de Motor Lujo Pulsar 200NS #1', 2, 1474.00),
    (6, 'Manubrio XL125 Negro', 4, 154.00),
    (7, 'Maya de Foco Pulsar NS200 With Stainless Steel', 2, 952.00),
    (8, 'Perno Completo Delantero CG125 con Bushing', 10, 37.00),
    (9, 'Tapon de Aceite PS135', 10, 23.00),
    (10, 'Bujia de Foco HID Abanico (M4) (MH4)', 3, 278.00),
    (11, 'Calcomania para Tanque "Pulsar" 180UG', 12, 73.00),
    (12, 'Bujia de Foco Flasher 2B/SF-B142 5 Lados', 8, 280.00),
    (13, 'Porta Placa con Aluminio Rectangular Color', 18, 56.00),
    (14, 'Palanca de Cambios Pulsar NS160 Completa', 5, 167.00),
    (15, 'Bujia de Foco Led 8 Lados 6B With Flasher #202', 6, 191.00),
    (16, 'Porta Celular para Moto Lujo Especial Con USB #2', 4, 392.00),
    (17, 'Mangos UFO-#4014 Lujo 7 Color', 6, 112.00),
    (18, 'Cinta de Luces para Asientos (Flexible) 19Cm Amarillo/Rojo', 11, 45.00),
    (19, 'Balineras 6203 KOYO', 20, 37.00),
    (20, 'Balineras 6201 KOYO', 20, 30.00),
    (21, 'Balineras 6202 KOYO', 20, 27.00),
    (22, 'Banda de Frenos Trasera HJ125/YBR125 BINDA', 5, 90.00),
    (23, 'Lodera de Polvo Protaper 193x155', 11, 34.00),
    (24, 'Tuerca de Perno No.22 (50 Pcs/Bolsa)', 50, 7.00),
    (25, 'Bujia de Pide Via Glassy Led 128 Flasher-1Fila (unidad)', 160, 12.35),
    (26, 'Bujia de Foco (H4) Ultra', 7, 35.00),
    (27, 'Switch de Encendido Universal para Manubrio Color "A"', 9, 164.00),
    (28, 'Switch de Encendido Universal para Manubrio Tomasol', 3, 220.00),
    (29, 'Bujia de Foco Led 3L-H4 Ceramic', 6, 112.00),
    (30, 'Bujia de Lateral Led 6B Con Strober (2Pcs/Jgo)', 6, 34.00),
    (31, 'Mangos UFO-#3012', 7, 81.00),
    (32, 'Mangos UFO-#3013', 2, 79.00),
    (33, 'Protector de Motor (Pechera) Lujo GN125', 9, 1442.00),
    (34, 'Coleta Trasera Universal con Stop Lujo', 6, 124.00),
    (35, 'Mangos UFO-#3012', 36, 81.00),
    (36, 'Tapa de Cadena Universal Aluminio Honda #FH-1454', 18, 93.00),
    (37, 'Patada H y Dayun', 10, 107.00),
    (38, 'Banda de Frenos Delantera UM200/C110 y Serpento Sin Uña', 10, 34.00),
    (39, 'Bushing de Tijera XR150L/DY150GY-6', 12, 129.00),
    (40, 'Cuarto de Gas Whit Aluminium con Cable Color', 6, 605.00),
    (41, 'Guantes Cortos MONSTER-XXL', 12, 157.00),
    (42, 'Balineras 6301 KOYO', 10, 32.00),
    (43, 'Bujia Led para PideVias Yellow (Aluminium 5.5/Par)', 12, 124.00),
    (44, 'Capucha de Chispero Con Cable NGK', 4, 241.00),
    (45, 'Alerones Frontales para Moto Pulsar 200NS', 2, 408.00),
    (46, 'Protector de Deposito Trasero Lujo Pulsar 200NS', 6, 90.00),
    (47, 'Protector de Filtro de Aceite Lujo Pulsar NS200', 15, 101.00),
    (48, 'Protector de Bomba Delantera Lujo Pulsar NS200', 6, 98.00),
    (49, 'Protector de Mordaza Lujo Pulsar200NS "A"', 6, 198.00),
    (50, 'Lodera de Guardafango Trasera AKT NKD150/Xpress150', 6, 25.00),
    (51, 'Protector de Radiador Lujo Pulsar 200NS', 2, 650.00),
    (52, 'Protector de Lateral de Radiador Lujo Pulsar NS200-2 Pcs', 2, 218.00),
    (53, 'Protector de Manubrio Central Lujo Pulsar NS200', 6, 76.00),
    (54, 'Protector de Tapa de Cadena Lujo Pulsar NS200-Moderno', 4, 684.00),
    (55, 'Protector de Tapa de Cadena Lujo FOX', 12, 672.00),
    (56, 'Carburador EN125/GN125 Con Diafragma 1 Handle', 1, 672.00),
    (57, 'Tapon de Eje Mediano (XD-022) Dima Deang/2 Pcs', 12, 90.00),
    (58, 'Lodera de Polvo Fox 220x195 Talla Grande', 12, 40.00),
    (59, 'Kit de Helicoil 8mm (20Pcs Resortes)', 4, 364.00),
    (60, 'Tacometro Digital GN125/DY125', 1, 1529.00),
    (61, 'Motor de Arranque Crux REV 110', 2, 530.00),
    (62, 'Protector de Motor (Pechera) Lujo AKT NKD125', 7, 1029.00),
    (63, 'Embancador Universal Del y Tra Black,Red', 1, 1089.00),
    (64, 'Protector de Tapa de Bobina y Clutch Plastico 3Pcs FOX', 18, 173.00)
) AS v(line_no, name, quantity, unit_cost)
JOIN product p   ON p.name = v.name
JOIN purchase pu ON pu.invoice_number = 'FAC-000123';

-- 7. Cada línea de compra mete el producto al inventario
INSERT INTO inventory_movement (id_product, moved_at, reason, quantity, unit_cost, id_registered_by, id_purchase_detail)
SELECT pd.id_product, CURRENT_DATE - 3 + TIME '10:00', 'COMPRA', pd.quantity, pd.unit_cost, pu.id_received_by, pd.id_purchase_detail
FROM purchase_detail pd
JOIN purchase pu ON pu.id_purchase = pd.id_purchase
WHERE pu.invoice_number = 'FAC-000123';

-- 8. Primer precio de cada producto en el historial
INSERT INTO price_history (id_product, changed_at, new_price, id_changed_by)
SELECT p.id_product, CURRENT_DATE - 3 + TIME '11:00', p.sale_price, o.id_owner
FROM product p, owner o JOIN staff st ON st.id_staff = o.id_owner
WHERE st.name = 'Dueño Uno';

-- 9. Clientes y motos
INSERT INTO customer (name, phone, national_id, address) VALUES
    ('Juan Pérez',   '8591-2524', '001-010190-0001A', 'Barrio El Sacramento'),
    ('María López',  '8113-3457', NULL, NULL),
    ('Carlos Ruiz',  '5700-3459', '001-150585-0002B', 'Barrio Luis Alfonzo');

INSERT INTO motorcycle_model (id_motorcycle_brand, name)
SELECT id_motorcycle_brand, v.name
FROM motorcycle_brand b
JOIN (VALUES ('Bajaj', 'Pulsar NS200'), ('Yamaha', 'XTZ 125'), ('Suzuki', 'GN125')) AS v(brand, name)
  ON v.brand = b.name;

INSERT INTO motorcycle (id_customer, id_motorcycle_model, color, plate)
SELECT c.id_customer, m.id_motorcycle_model, v.color, v.plate
FROM (VALUES ('Juan Pérez', 'Pulsar NS200', 'Negro', 'M 123-456'),
             ('María López', 'GN125', 'Rojo', NULL)) AS v(customer, model, color, plate)
JOIN customer c         ON c.name = v.customer
JOIN motorcycle_model m ON m.name = v.model;

-- 10. VENTA de contado sin cliente
INSERT INTO billable_document (kind, id_registered_by, terms, receipt_number)
SELECT 'VENTA', id_staff, 'CONTADO', 'C-0001' FROM staff WHERE name = 'Encargado';

INSERT INTO sale (id_sale)
SELECT id_billable_document FROM billable_document WHERE receipt_number = 'C-0001';

INSERT INTO sale_detail (id_sale, line_no, id_product, quantity, unit_price)
SELECT d.id_billable_document, v.line_no, p.id_product, v.quantity, p.sale_price
FROM billable_document d
JOIN (VALUES (1, 'Mangos UFO-#3012', 2),
             (2, 'Porta Celular para Moto Lujo Especial Con USB #2', 1)) AS v(line_no, name, quantity) ON TRUE
JOIN product p ON p.name = v.name
WHERE d.receipt_number = 'C-0001';

INSERT INTO inventory_movement (id_product, reason, quantity, unit_cost, id_registered_by, id_sale_detail)
SELECT sd.id_product, 'VENTA', sd.quantity,
       (SELECT pd.unit_cost FROM purchase_detail pd WHERE pd.id_product = sd.id_product
        ORDER BY pd.id_purchase_detail DESC LIMIT 1),
       d.id_registered_by, sd.id_sale_detail
FROM sale_detail sd
JOIN billable_document d ON d.id_billable_document = sd.id_sale
WHERE d.receipt_number = 'C-0001';

-- El monto se calcula de las líneas: así no puede cobrarse distinto de lo vendido
INSERT INTO customer_payment (amount, method, id_received_by)
SELECT (SELECT SUM(sd.quantity * sd.unit_price) FROM sale_detail sd
        JOIN billable_document d ON d.id_billable_document = sd.id_sale WHERE d.receipt_number = 'C-0001'),
       'EFECTIVO', id_staff
FROM staff WHERE name = 'Encargado';

INSERT INTO payment_application (id_customer_payment, id_billable_document, applied_amount)
SELECT (SELECT max(id_customer_payment) FROM customer_payment), d.id_billable_document,
       (SELECT SUM(quantity * unit_price) FROM sale_detail WHERE id_sale = d.id_billable_document)
FROM billable_document d WHERE d.receipt_number = 'C-0001';

-- 11. SERVICIO
INSERT INTO billable_document (kind, id_customer, id_registered_by, terms)
SELECT 'SERVICIO', c.id_customer, s.id_staff, 'CONTADO'
FROM customer c, staff s WHERE c.name = 'Juan Pérez' AND s.name = 'Dueño Uno';

INSERT INTO mechanical_service (id_mechanical_service, id_motorcycle, id_responsible, requested_work, applied_rate)
SELECT d.id_billable_document, mo.id_motorcycle, me.id_mechanic, 'Instalar protector de radiador', me.commission_rate
FROM billable_document d
JOIN motorcycle mo ON mo.plate = 'M 123-456'
JOIN mechanic me   ON me.id_mechanic = (SELECT id_staff FROM staff WHERE name = 'Freddy Orozco')
WHERE d.id_billable_document = (SELECT max(id_billable_document) FROM billable_document WHERE kind = 'SERVICIO');

INSERT INTO status_change (id_mechanical_service, changed_at, status, id_registered_by)
SELECT ms.id_mechanical_service, LOCALTIMESTAMP - v.hace, v.status, (SELECT id_staff FROM staff WHERE name = 'Dueño Uno')
FROM mechanical_service ms
JOIN (VALUES ('RECIBIDA', interval '3 hours'), ('EN_PROCESO', interval '2 hours'),
             ('TERMINADA', interval '1 hour'), ('EN_PRUEBA', interval '50 minutes'),
             ('ENTREGADA', interval '40 minutes')) AS v(status, hace) ON TRUE
WHERE ms.requested_work = 'Instalar protector de radiador';

INSERT INTO service_labor (id_mechanical_service, line_no, description, amount, id_service_type)
SELECT ms.id_mechanical_service, 1, 'Instalación de protector de radiador', 200, st.id_service_type
FROM mechanical_service ms, service_type st
WHERE ms.requested_work = 'Instalar protector de radiador' AND st.name = 'Instalación de accesorio';

INSERT INTO service_part (id_mechanical_service, line_no, id_product, quantity, unit_price)
SELECT ms.id_mechanical_service, 1, p.id_product, 1, p.sale_price
FROM mechanical_service ms, product p
WHERE ms.requested_work = 'Instalar protector de radiador' AND p.name = 'Protector de Radiador Lujo Pulsar 200NS';

INSERT INTO inventory_movement (id_product, reason, quantity, unit_cost, id_registered_by, id_service_part)
SELECT sp.id_product, 'USO_SERVICIO', sp.quantity,
       (SELECT pd.unit_cost FROM purchase_detail pd WHERE pd.id_product = sp.id_product
        ORDER BY pd.id_purchase_detail DESC LIMIT 1),
       (SELECT id_staff FROM staff WHERE name = 'Dueño Uno'), sp.id_service_part
FROM service_part sp
JOIN mechanical_service ms ON ms.id_mechanical_service = sp.id_mechanical_service
WHERE ms.requested_work = 'Instalar protector de radiador';

UPDATE billable_document SET receipt_number = 'C-0002'
WHERE id_billable_document = (SELECT id_mechanical_service FROM mechanical_service
                              WHERE requested_work = 'Instalar protector de radiador');

INSERT INTO customer_payment (amount, method, id_received_by)
SELECT 200 + 1250, 'TRANSFERENCIA', id_staff FROM staff WHERE name = 'Dueño Uno';  -- mano de obra + protector

INSERT INTO payment_application (id_customer_payment, id_billable_document, applied_amount)
SELECT (SELECT max(id_customer_payment) FROM customer_payment), id_billable_document, 200 + 1250
FROM billable_document WHERE receipt_number = 'C-0002';

-- 12. Un servicio que sigue en el taller 
INSERT INTO billable_document (kind, id_customer, id_registered_by, terms)
SELECT 'SERVICIO', c.id_customer, s.id_staff, 'CONTADO'
FROM customer c, staff s WHERE c.name = 'María López' AND s.name = 'Dueño Dos';

INSERT INTO mechanical_service (id_mechanical_service, id_motorcycle, id_responsible, requested_work, applied_rate)
SELECT (SELECT max(id_billable_document) FROM billable_document WHERE kind = 'SERVICIO'),
       mo.id_motorcycle, me.id_mechanic, 'Engrase y revisar frenos', me.commission_rate
FROM motorcycle mo
JOIN customer c  ON c.id_customer = mo.id_customer AND c.name = 'María López'
JOIN mechanic me ON me.id_mechanic = (SELECT id_staff FROM staff WHERE name = 'Carlos Padel');

INSERT INTO status_change (id_mechanical_service, changed_at, status, id_registered_by)
SELECT ms.id_mechanical_service, LOCALTIMESTAMP - v.hace, v.status, (SELECT id_staff FROM staff WHERE name = 'Dueño Dos')
FROM mechanical_service ms
JOIN (VALUES ('RECIBIDA', interval '1 hour'), ('EN_PROCESO', interval '30 minutes')) AS v(status, hace) ON TRUE
WHERE ms.requested_work = 'Engrase y revisar frenos';

INSERT INTO service_labor (id_mechanical_service, line_no, description, amount, id_service_type)
SELECT ms.id_mechanical_service, 1, 'Engrase', 400, st.id_service_type
FROM mechanical_service ms, service_type st
WHERE ms.requested_work = 'Engrase y revisar frenos' AND st.name = 'Engrase';

INSERT INTO additional_fault (id_mechanical_service, fault_no, description, proposed_price, decision)
SELECT id_mechanical_service, 1, 'Banda de freno trasera gastada', 180, 'PENDIENTE'
FROM mechanical_service WHERE requested_work = 'Engrase y revisar frenos';

-- Juan rechazó cambiar la llanta: queda como prueba de que se le advirtió (BR-028)
INSERT INTO additional_fault (id_mechanical_service, fault_no, description, proposed_price, decision)
SELECT id_mechanical_service, 1, 'Llanta trasera gastada', 1500, 'RECHAZADA'
FROM mechanical_service WHERE requested_work = 'Instalar protector de radiador';

-- 13. VENTA A CRÉDITO: Carlos lleva una pechera GN125; la autoriza un dueño y abona una parte
INSERT INTO billable_document (kind, id_customer, id_registered_by, terms, receipt_number)
SELECT 'VENTA', c.id_customer, s.id_staff, 'CREDITO', 'C-0003'
FROM customer c, staff s WHERE c.name = 'Carlos Ruiz' AND s.name = 'Dueño Dos';

INSERT INTO sale (id_sale)
SELECT id_billable_document FROM billable_document WHERE receipt_number = 'C-0003';

INSERT INTO sale_detail (id_sale, line_no, id_product, quantity, unit_price)
SELECT d.id_billable_document, 1, p.id_product, 1, p.sale_price
FROM billable_document d, product p
WHERE d.receipt_number = 'C-0003' AND p.name = 'Protector de Motor (Pechera) Lujo GN125';

INSERT INTO inventory_movement (id_product, reason, quantity, unit_cost, id_registered_by, id_sale_detail)
SELECT sd.id_product, 'VENTA', sd.quantity,
       (SELECT pd.unit_cost FROM purchase_detail pd WHERE pd.id_product = sd.id_product
        ORDER BY pd.id_purchase_detail DESC LIMIT 1),
       d.id_registered_by, sd.id_sale_detail
FROM sale_detail sd JOIN billable_document d ON d.id_billable_document = sd.id_sale
WHERE d.receipt_number = 'C-0003';

INSERT INTO credit (id_credit, id_authorized_by, due_date)
SELECT d.id_billable_document, o.id_owner, CURRENT_DATE + 30
FROM billable_document d, owner o JOIN staff st ON st.id_staff = o.id_owner
WHERE d.receipt_number = 'C-0003' AND st.name = 'Dueño Dos';

INSERT INTO customer_payment (amount, method, id_received_by)
SELECT 1000, 'EFECTIVO', id_staff FROM staff WHERE name = 'Dueño Dos';

INSERT INTO payment_application (id_customer_payment, id_billable_document, applied_amount)
SELECT (SELECT max(id_customer_payment) FROM customer_payment), id_billable_document, 1000
FROM billable_document WHERE receipt_number = 'C-0003';

-- 14. Un adelanto y el pago semanal 
INSERT INTO weekly_payout (id_mechanic, period_start, period_end)
SELECT id_staff, date_trunc('week', CURRENT_DATE)::date, date_trunc('week', CURRENT_DATE)::date + 5
FROM staff WHERE name = 'Freddy Orozco';

INSERT INTO advance (id_mechanic, amount, id_given_by, id_weekly_payout)
SELECT wp.id_mechanic, 50, (SELECT id_staff FROM staff WHERE name = 'Dueño Uno'), wp.id_weekly_payout
FROM weekly_payout wp JOIN staff s ON s.id_staff = wp.id_mechanic WHERE s.name = 'Freddy Orozco';

UPDATE mechanical_service SET id_weekly_payout = (SELECT max(id_weekly_payout) FROM weekly_payout)
WHERE requested_work = 'Instalar protector de radiador';

-- 15. Retiro de caja: el impuesto del mes
INSERT INTO cash_withdrawal (id_owner, amount, reason)
SELECT o.id_owner, 800, 'IMPUESTO' FROM owner o JOIN staff st ON st.id_staff = o.id_owner WHERE st.name = 'Dueño Uno';



SELECT (SELECT count(*) FROM product)                          AS productos,
       (SELECT count(*) FROM purchase_detail)                  AS lineas_factura,
       (SELECT sum(quantity * unit_cost) FROM purchase_detail) AS total_factura,
       (SELECT count(*) FROM mechanical_service)               AS servicios;

COMMIT;