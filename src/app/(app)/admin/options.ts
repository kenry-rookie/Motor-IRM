/** The options of Administración (Kenry, 10-nov): one screen per subject. */
export const ADMIN_OPTIONS = [
  { href: "/admin/personas", label: "Personas del negocio", hint: "Dueños, mecánicos y encargado; quién repara y quién cobra comisión", perms: ["personal.ver", "admin.usuarios"] },
  { href: "/admin/pagos", label: "Pago a mecánicos", hint: "Comisiones, adelantos y pago del periodo trabajado", perms: ["personal.ver"] },
  { href: "/admin/usuarios", label: "Usuarios", hint: "Quién entra al sistema, con qué perfil; activar o desactivar", perms: ["admin.usuarios"] },
  { href: "/admin/permisos", label: "Permisos por perfil", hint: "Qué puede hacer cada perfil (pide su contraseña para guardar)", perms: ["admin.usuarios"] },
  { href: "/admin/trabajos", label: "Trabajos del taller", hint: "Catálogo de trabajos por categoría, precio de referencia y rango", perms: ["catalogos.gestionar"] },
  { href: "/admin/motos", label: "Marcas y modelos de moto", hint: "Lo que se elige al recibir una moto", perms: ["catalogos.gestionar"] },
  { href: "/admin/catalogos", label: "Otros catálogos", hint: "Categorías y marcas de producto, métodos de pago, motivos", perms: ["catalogos.gestionar"] },
] as const;

export const ADMIN_PERMISSIONS = [...new Set(ADMIN_OPTIONS.flatMap((o) => o.perms))];
