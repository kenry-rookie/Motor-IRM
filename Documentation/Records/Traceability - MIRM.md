---
project: "[[Motor IRM]]"
type: records
record: Traceability
updated: 2026-10-26
ai_edit: "Claude — 2026-10-26: columna conceptual llenada desde S3 - Conceptual Model (BR-001 a BR-082)"
reviewed: false
---

# 🔗 Traceability Matrix — Motor IRM

- **Estado:** ⚪ Sin empezar · 🟡 Incompleta · ✅ Completa.

| Regla / requisito | Entidad o relación (conceptual) | Tabla o restricción (relacional) | Clase o método (OO) | Estado |
| ----------------- | ------------------------------- | -------------------------------- | ------------------- | ------ |
| BR-001 | E-13 Venta · E-17 Reparación | | | 🟡 Incompleta |
| BR-002 | E-13, E-14 · R-14, R-16 (venta sin cliente) | | | 🟡 Incompleta |
| BR-003 | E-17, E-18 (tipo de línea) · R-06, R-07 | | | 🟡 Incompleta |
| BR-004 | E-05 · R-19 | | | 🟡 Incompleta |
| BR-005 | E-06 (unidad de venta) · E-14 (cantidad) | | | 🟡 Incompleta |
| BR-006 | Sin relación producto–modelo (DEC-004, §8) | | | 🟡 Incompleta |
| BR-007 | E-02 (rol) · "registrado por" en E-07, E-09, E-13, E-21 | | | 🟡 Incompleta |
| BR-008 | E-02 (rol encargado) · R-17 | | | 🟡 Incompleta |
| BR-009 | E-22 (autorizado por) · R-28 | | | 🟡 Incompleta |
| BR-010 | E-13 (rebaja autorizada por) · R-34 | | | 🟡 Incompleta |
| BR-011 | E-25 (realizado por) · R-33 | | | 🟡 Incompleta |
| BR-012 | E-08 · R-20 (sin relación fija producto–proveedor) | | | 🟡 Incompleta |
| BR-013 | E-09, E-10 · R-20, R-21 | | | 🟡 Incompleta |
| BR-014 | E-10 (costo unitario, H) · E-06 (último costo, D) | | | 🟡 Incompleta |
| BR-015 | E-06 (precio de venta) | | | 🟡 Incompleta |
| BR-016 | E-06 (precio de venta) · E-14 (precio unitario, H) · E-26 (v2) | | | 🟡 Incompleta |
| BR-017 | E-09 (condición) · E-11 · R-22 | | | 🟡 Incompleta |
| BR-018 | E-12 · R-23 | | | 🟡 Incompleta |
| BR-019 | Fuera del modelo: la grasa no es producto del negocio | | | 🟡 Incompleta |
| BR-020 | E-07 · E-06 (existencia, D) · R-24 | | | 🟡 Incompleta |
| BR-021 | E-17 (fecha de ingreso, lo que pide el cliente, recibida por) | | | 🟡 Incompleta |
| BR-022 | E-17 (lo que pide el cliente, diagnóstico) | | | 🟡 Incompleta |
| BR-023 | E-17 (responsable) · R-05 | | | 🟡 Incompleta |
| BR-024 | R-05 (cero o un responsable) · E-02 (rol) | | | 🟡 Incompleta |
| BR-025 | R-05 · E-17 (estado) | | | 🟡 Incompleta |
| BR-026 | E-19 · R-09 | | | 🟡 Incompleta |
| BR-027 | E-19 (decisión) · E-18 (falla adicional) · R-10 | | | 🟡 Incompleta |
| BR-028 | E-19 (rechazada) · E-20 (resultado) | | | 🟡 Incompleta |
| BR-029 | E-18 (monto por trabajo; no hay atributo de tiempo) | | | 🟡 Incompleta |
| BR-030 | E-16 · R-08 | | | 🟡 Incompleta |
| BR-031 | E-16 (precio de referencia) · E-18 (monto) | | | 🟡 Incompleta |
| BR-032 | E-18 (tipo: producto del cliente) | | | 🟡 Incompleta |
| BR-033 | E-17 (estado En espera, motivo de espera) | | | 🟡 Incompleta |
| BR-034 | E-17 (estado Cancelada) | | | 🟡 Incompleta |
| BR-035 | E-21 (recibido por) · E-17 (fecha de entrega) | | | 🟡 Incompleta |
| BR-036 | E-18 (producto) · E-07 (motivo ajuste, con observación) | | | 🟡 Incompleta |
| BR-037 | E-18 (tipo: trabajo externo) | | | 🟡 Incompleta |
| BR-038 | E-13 (cliente opcional) · R-16 | | | 🟡 Incompleta |
| BR-039 | E-01 (nombre, teléfono) · R-04 | | | 🟡 Incompleta |
| BR-040 | E-01 (cédula, dirección) | | | 🟡 Incompleta |
| BR-041 | E-03, E-04 · R-01, R-02 | | | 🟡 Incompleta |
| BR-042 | R-03 · historial derivado (§6) | | | 🟡 Incompleta |
| BR-043 | R-04 (cliente en cada reparación) · R-01 | | | 🟡 Incompleta |
| BR-044 | E-02 (porcentaje) · E-17 (porcentaje aplicado, H) | | | 🟡 Incompleta |
| BR-045 | E-17 (comisión, D) · E-24 (total comisiones) | | | 🟡 Incompleta |
| BR-046 | E-24 (semana, fecha de pago) · R-30 | | | 🟡 Incompleta |
| BR-047 | R-31 (se liquida en la semana del trabajo) | | | 🟡 Incompleta |
| BR-048 | E-23 · R-29 | | | 🟡 Incompleta |
| BR-049 | E-24 (monto neto, D) · R-32 | | | 🟡 Incompleta |
| BR-050 | E-17 (rebaja) | | | 🟡 Incompleta |
| BR-051 | E-17 (porcentaje aplicado vacío → comisión cero) | | | 🟡 Incompleta |
| BR-052 | Fuera del modelo (§8) | | | 🟡 Incompleta |
| BR-053 | Regla operativa: no genera datos | | | 🟡 Incompleta |
| BR-054 | Fuera del modelo: no es una Reparación (DEC-003) | | | 🟡 Incompleta |
| BR-055 | E-13 con E-01 = el mecánico | | | 🟡 Incompleta |
| BR-056 | E-21 (método) · E-13, E-17 (condición) | | | 🟡 Incompleta |
| BR-057 | E-21, E-11 (moneda) | | | 🟡 Incompleta |
| BR-058 | E-21 (tipo de cambio, H) | | | 🟡 Incompleta |
| BR-059 | Derivado (vuelto, no se guarda) | | | 🟡 Incompleta |
| BR-060 | E-13, E-17 (número de comprobante) | | | 🟡 Incompleta |
| BR-061 | E-13 (rebaja) | | | 🟡 Incompleta |
| BR-062 | E-22 · R-27 · R-16 | | | 🟡 Incompleta |
| BR-063 | E-22 (sin atributo de límite) | | | 🟡 Incompleta |
| BR-064 | E-22 (fecha de vencimiento) | | | 🟡 Incompleta |
| BR-065 | E-22 (saldo, D; estado) | | | 🟡 Incompleta |
| BR-066 | E-22 (nueva fecha de vencimiento) · R-26 (varios pagos) | | | 🟡 Incompleta |
| BR-067 | E-22 (interés mensual = 0) | | | 🟡 Incompleta |
| BR-068 | E-22 (interés mensual; monto, D) | | | 🟡 Incompleta |
| BR-069 | E-15 (resultado) · R-18 | | | 🟡 Incompleta |
| BR-070 | E-15 (condición del producto devuelto) | | | 🟡 Incompleta |
| BR-071 | E-20 · R-11 · E-07 (motivo garantía) | | | 🟡 Incompleta |
| BR-072 | E-20 (fecha, plazo) | | | 🟡 Incompleta |
| BR-073 | E-20 (resultado) · R-12 | | | 🟡 Incompleta |
| BR-074 | E-20 (atendido por) · R-13 | | | 🟡 Incompleta |
| BR-075 | E-25 | | | 🟡 Incompleta |
| BR-076 | E-25 (motivo: viaje de compras) | | | 🟡 Incompleta |
| BR-077 | Fuera del modelo: sin reparto (DEC-005, §8) | | | 🟡 Incompleta |
| BR-078 | E-25 (motivo: impuesto) | | | 🟡 Incompleta |
| BR-079 | E-07 (motivo) · R-25 | | | 🟡 Incompleta |
| BR-080 | E-17 (estado Cancelada, monto por cancelación) | | | 🟡 Incompleta |
| BR-081 | E-24 (siempre efectivo: sin atributo) | | | 🟡 Incompleta |
| BR-082 | E-18 (tipo trabajo externo, monto) | | | 🟡 Incompleta |
