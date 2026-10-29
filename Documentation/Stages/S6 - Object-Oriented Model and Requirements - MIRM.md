---
project: "[[Motor IRM]]"
stage: S6
status: ⚪ Pendiente
started:
finished:
source:
ai_edit: "Claude — 2026-10-27: nota creada con Requirements como pendiente (decisión del equipo); 2026-10-28: insumos y navegación desde S5"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|← S5]]**

# S6 - Object-Oriented Model and Requirements - MIRM

## Objetivo de la etapa

Pasar el modelo de datos a **clases del dominio** (las que usarán los modelos de Django) y escribir los **requisitos** del sistema, que el equipo decidió trabajar aquí (27-oct).

## Insumos

- [[S5 - Relational Schema - MIRM|Modelo relacional (S5)]] y [[S3 - Conceptual Model - MIRM|modelo conceptual]]
- Restricciones que van en la aplicación: §6 del [[S5 - Relational Schema - MIRM|esquema relacional]]
- [[Business Rules - MIRM|Business Rules]]
- [[Knowledge - Requisitos de software (FR, NFR y casos de uso)]]
- [[Technology Recommendations - MIRM|Recomendación de tecnologías]] y DEC-006

## Requirements (pendiente desde S3)

Llenar [[Requirements - MIRM|Requirements]] siguiendo la nota de Knowledge:

- [ ] **FR** de la versión de clase (venta rápida, inventario, servicios mecánicos, créditos, pago semanal).
- [ ] **NFR** que ya tienen fuente: vender rápido (Q-004), PC con internet (SRC-01), comprobante impreso con formato ajustable y escáner de barras (SRC-06), solo los dueños administran y ven datos de clientes (SRC-06), respaldo diario.
- [ ] **Casos de uso:** Registrar venta, Recibir moto, Cobrar servicio, Registrar compra, Pagar a mecánicos, Cobrar crédito, Puesta en marcha.
- [ ] Columna **Versión 1** (clase) vs. versión del negocio.

## Criterio de cierre

- [ ] Diagrama de clases del dominio.
- [ ] Requirements con FR, NFR y casos de uso, cada uno con su fuente.

➡️ Siguiente etapa: S7 - Verification - MIRM
