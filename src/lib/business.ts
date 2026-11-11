/**
 * Datos del negocio que salen en la factura y en los comprobantes (DEC-053).
 *
 * Provisional: son genéricos hasta que la Fase 6 los pase a `app_setting`
 * (pantalla de Ajustes), donde los dueños los podrán cambiar sin tocar código.
 */
export const BUSINESS = {
  name: "Motoservicios y Repuestos Rivera",
  tagline: "Repuestos, accesorios, lubricantes y taller de motos",
  address: "Managua, Nicaragua",
  phone: "2250-0000 · 8888-0000",
  thanks: "¡Gracias por su preferencia!",
} as const;

/** Internal consecutive number shown on printed documents, e.g. 31 → "000031". */
export const docNumber = (id: number) => String(id).padStart(6, "0");
