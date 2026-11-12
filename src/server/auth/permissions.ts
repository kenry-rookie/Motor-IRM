/**
 * Permission codes (table `permission`, CHECK ^[a-z_]+(\.[a-z_]+)*$).
 * The seed inserts exactly this list; the API checks them with
 * `permissionProcedure("...")`. Add new codes here and re-run the seed.
 *
 * Which role has which permission is still an open question for the owners
 * (Q-008, Q-010): the seed gives "Dueño" everything and "Encargado" the
 * day-to-day operation. The owners can change it from Administración.
 */
export const PERMISSIONS = {
  "clientes.ver": "Ver clientes, motos y estados de cuenta",
  "clientes.gestionar": "Crear y editar clientes y motos; saldos iniciales",
  "inventario.ver": "Ver productos, existencias y kardex",
  "inventario.gestionar": "Crear y editar productos; inventario inicial",
  "inventario.ajustar": "Registrar ajustes de inventario (entrada/salida)",
  "inventario.precios": "Cambiar precios de venta",
  "ventas.ver": "Ver facturas de venta",
  "ventas.crear": "Vender en mostrador",
  "ventas.autorizar_descuento": "Autorizar descuentos",
  "ventas.autorizar_credito": "Autorizar ventas al crédito y prórrogas",
  "ventas.devoluciones": "Registrar devoluciones de clientes",
  "ventas.anular": "Anular facturas (solo dueños, hasta 3 días)",
  "cobros.registrar": "Registrar abonos y pagos de clientes",
  "taller.ver": "Ver órdenes de servicio",
  "taller.gestionar": "Recibir motos, asignar mecánico, cambiar estados, fallas adicionales",
  "taller.facturar": "Cerrar y cobrar órdenes de servicio",
  "taller.precio_especial": "Cobrar un trabajo fuera de su rango de precio",
  "garantias.gestionar": "Registrar reclamos de garantía",
  "compras.ver": "Ver proveedores y compras",
  "compras.gestionar": "Registrar compras, devoluciones y pagos a proveedores",
  "personal.ver": "Ver personal, comisiones y adelantos",
  "personal.pagos": "Dar adelantos y pagar la semana a los mecánicos",
  "caja.retiros": "Registrar retiros de caja",
  "caja.arqueo": "Abrir y cerrar la caja del día (arqueo)",
  "caja.corregir": "Reabrir, corregir y eliminar cajas (solo administradores)",
  "reportes.ver": "Ver reportes y cierre de caja",
  "catalogos.gestionar": "Mantener catálogos (marcas, categorías, motivos, métodos de pago…)",
  "admin.usuarios": "Administrar usuarios, roles y permisos",
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionCode[];

/** Default roles created by the seed. */
export const DEFAULT_ROLES: Record<string, { description: string; permissions: PermissionCode[] }> = {
  Dueño: { description: "Dueño del negocio: acceso completo", permissions: ALL_PERMISSIONS },
  Encargado: {
    description: "Atiende mostrador y taller",
    permissions: [
      "clientes.ver",
      "clientes.gestionar",
      "inventario.ver",
      "ventas.ver",
      "ventas.crear",
      "ventas.devoluciones",
      "cobros.registrar",
      "caja.arqueo",
      "taller.ver",
      "taller.gestionar",
      "taller.facturar",
      "garantias.gestionar",
      "compras.ver",
      "compras.gestionar",
      "personal.ver",
    ],
  },
};
