"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { ADMIN_OPTIONS, ADMIN_PERMISSIONS } from "~/app/(app)/admin/options";
import { ConfirmHost } from "~/app/_components/confirm";
import { ThemeToggle } from "~/app/_components/theme-toggle";
import { BrandMark, cx } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/**
 * CLI-002 — Layout con navegación por área.
 *
 * Escritorio: la barra lateral vive en el flujo (flex), así el contenido se
 * reacomoda solo cuando cambia su ancho. Sin fijar: se muestra como columna
 * de íconos y se expande al pasar el mouse. Fijada: siempre expandida
 * (cookie `irm_nav=1`). Celular: panel que entra desde la izquierda.
 */
function Icon({
  children,
  className = "h-6 w-6",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const AREAS: {
  href: string;
  label: string;
  /** One code, or several (the area shows if the user has any of them). */
  permission: string | readonly string[];
  icon: ReactNode;
  /** Extra paths that belong to this area (e.g. an invoice's detail under /ventas/…). */
  also?: RegExp;
  /** Sub-options shown under the area in the menu (Administración). */
  children?: readonly { href: string; label: string; perms: readonly string[] }[];
}[] = [
  {
    href: "/",
    label: "Resumen",
    permission: "reportes.ver",
    icon: (
      <Icon>
        <path d="m12 14 4-4" />
        <path d="M3.34 19a10 10 0 1 1 17.32 0" />
      </Icon>
    ),
  },
  {
    href: "/ventas",
    label: "Caja",
    permission: "ventas.crear",
    icon: (
      <Icon>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </Icon>
    ),
  },
  {
    href: "/facturas",
    label: "Facturas",
    permission: "ventas.ver",
    also: /^\/ventas\/\d+/,
    icon: (
      <Icon>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </Icon>
    ),
  },
  {
    href: "/taller",
    label: "Taller",
    permission: "taller.ver",
    icon: (
      <Icon>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </Icon>
    ),
  },
  {
    href: "/inventario",
    label: "Inventario",
    permission: "inventario.ver",
    icon: (
      <Icon>
        <path d="M21 8 12 3 3 8v8l9 5 9-5V8z" />
        <path d="m3 8 9 5 9-5" />
        <path d="M12 13v8" />
      </Icon>
    ),
  },
  {
    href: "/clientes",
    label: "Clientes y abonos",
    permission: "clientes.ver",
    icon: (
      <Icon>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </Icon>
    ),
  },
  {
    href: "/compras",
    label: "Compras",
    permission: "compras.ver",
    icon: (
      <Icon>
        <path d="M10 17h4V5H2v12h3" />
        <path d="M14 8h4l4 4v5h-3" />
        <circle cx="7.5" cy="17.5" r="2.5" />
        <circle cx="17.5" cy="17.5" r="2.5" />
      </Icon>
    ),
  },
  {
    href: "/retiros",
    label: "Retiros de caja",
    permission: "caja.retiros",
    icon: (
      <Icon>
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 12h.01M18 12h.01" />
      </Icon>
    ),
  },
  {
    href: "/pagos",
    label: "Pago a mecánicos",
    permission: "personal.ver",
    children: [
      { href: "/pagos/adelanto", label: "Dar adelanto", perms: ["personal.pagos"] },
      { href: "/pagos/periodo", label: "Pagar periodo trabajado", perms: ["personal.pagos"] },
    ],
    icon: (
      <Icon>
        <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
        <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
        <path d="m2 16 6 6" />
        <circle cx="16" cy="9" r="2.9" />
        <circle cx="6" cy="5" r="3" />
      </Icon>
    ),
  },
  {
    href: "/admin",
    label: "Administración",
    permission: ADMIN_PERMISSIONS,
    children: ADMIN_OPTIONS,
    icon: (
      <Icon>
        <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
        <path d="M1 14h6M9 8h6M17 16h6" />
      </Icon>
    ),
  },
];

type Me = {
  username: string;
  role: string;
  staffName: string | null;
  permissions: string[];
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Shell({
  me,
  defaultExpanded = true,
  children,
}: {
  me: Me;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pinned, setPinned] = useState(defaultExpanded); // escritorio: fijada (siempre expandida)
  const [drawer, setDrawer] = useState(false); // celular: panel abierto
  const [menu, setMenu] = useState(false); // menú de la cuenta
  const menuRef = useRef<HTMLDivElement>(null);

  const logout = api.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  const allowed = AREAS.filter((a) =>
    typeof a.permission === "string" ? me.permissions.includes(a.permission) : a.permission.some((p) => me.permissions.includes(p)),
  );
  const inArea = (a: (typeof AREAS)[number]) => (a.also?.test(pathname) ?? false) || isActive(a.href);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/ventas" ? pathname === "/ventas" : pathname.startsWith(href);
  const current = allowed.find(inArea);
  const displayName = me.staffName ?? me.username;

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    document.cookie = `irm_nav=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  };

  // Esc cierra el panel y el menú de la cuenta; un clic afuera cierra el menú.
  useEffect(() => {
    if (!drawer && !menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setMenu(false);
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (
        menu &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      )
        setMenu(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [drawer, menu]);

  // Con el panel abierto en celular, el fondo no se desplaza.
  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  // Estilos compartidos de los labels que aparecen al expandir (logo, ítems, botón).
  const labelCls = pinned
    ? "md:opacity-100"
    : "md:opacity-0 md:group-hover/nav:opacity-100";

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <a
        href="#contenido"
        className="focus:bg-brand-600 sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-70 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Saltar al contenido
      </a>

      {/* Fondo del panel en celular */}
      <div
        onClick={() => setDrawer(false)}
        aria-hidden="true"
        className={cx(
          "fixed inset-0 z-40 bg-neutral-50/40 transition-opacity duration-200 motion-reduce:transition-none md:hidden",
          drawer ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Barra lateral.
       * - Celular: fixed (drawer).
       * - Escritorio: sticky en el flujo; w-16 colapsada, w-60 en hover o fijada.
       * Como está en el flujo, el contenido se reacomoda solo al animar `width`.
       */}
      <aside
        aria-label="Menú principal"
        className={cx(
          "no-print group/nav fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden border-r border-neutral-800 bg-neutral-900",
          "transition-[translate,width,visibility] duration-200 ease-out motion-reduce:transition-none",
          drawer ? "visible translate-x-0" : "invisible -translate-x-full",
          "md:visible md:sticky md:top-0 md:bottom-auto md:z-auto md:h-screen md:shrink-0 md:translate-x-0",
          pinned ? "md:w-60" : "md:w-16 md:hover:w-60",
        )}
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-800 px-3.5">
          <Link
            href="/"
            onClick={() => setDrawer(false)}
            aria-label="Motor IRM, inicio"
            className="flex items-center gap-3 rounded-md"
          >
            <BrandMark />
            <span
              className={cx(
                "font-display text-xl font-semibold tracking-wide whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none",
                labelCls,
              )}
            >
              Motor IRM
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setDrawer(false)}
            aria-label="Cerrar menú"
            className="ml-auto grid h-9 w-9 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 md:hidden"
          >
            <Icon className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </Icon>
          </button>
        </div>

        <nav
          aria-label="Áreas"
          className="flex-1 overflow-x-hidden overflow-y-auto py-2"
        >
          {allowed.map((a) => {
            const active = inArea(a);
            const subs = a.children?.filter((c) => c.perms.some((p) => me.permissions.includes(p))) ?? [];
            return (
              <div key={a.href}>
                <Link
                  href={a.href}
                  onClick={() => setDrawer(false)}
                  title={pinned ? undefined : a.label}
                  aria-current={active && pathname === a.href ? "page" : undefined}
                  className={cx(
                    "group relative flex h-11 items-center gap-3 px-5 transition-colors duration-150",
                    active
                      ? "bg-brand-600/10 text-neutral-50"
                      : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-100",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "bg-brand-500 absolute inset-y-1.5 left-0 w-0.75 origin-center rounded-r transition-transform duration-200 motion-reduce:transition-none",
                      active ? "scale-y-100" : "scale-y-0",
                    )}
                  />
                  <span
                    className={cx(
                      "shrink-0 transition-colors duration-150",
                      active
                        ? "text-brand-600"
                        : "text-neutral-500 group-hover:text-neutral-200",
                    )}
                  >
                    {a.icon}
                  </span>
                  <span
                    className={cx(
                      "font-display text-base font-medium tracking-wide whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none",
                      labelCls,
                    )}
                  >
                    {a.label}
                  </span>
                </Link>
                {/* Sub-options (Administración): open while inside the area; hidden when the menu is only icons. */}
                {active && subs.length > 0 && (
                  <ul
                    aria-label={`Opciones de ${a.label}`}
                    className={cx("border-l border-neutral-800 py-1 pl-0 ml-8", pinned ? "" : "md:hidden md:group-hover/nav:block")}
                  >
                    {subs.map((c) => {
                      const on = pathname.startsWith(c.href);
                      return (
                        <li key={c.href}>
                          <Link
                            href={c.href}
                            onClick={() => setDrawer(false)}
                            aria-current={on ? "page" : undefined}
                            className={cx(
                              "flex min-h-9 items-center rounded-r-md py-1.5 pr-3 pl-4 text-sm whitespace-nowrap transition-colors",
                              on
                                ? "border-brand-500 -ml-px border-l-2 font-medium text-brand-600"
                                : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-100",
                            )}
                          >
                            {c.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Fijar o desfijar el ancho: solo escritorio. */}
        <button
          type="button"
          onClick={togglePinned}
          aria-pressed={pinned}
          aria-label={pinned ? "Desfijar menú" : "Fijar menú expandido"}
          title={pinned ? "Desfijar menú" : "Fijar menú expandido"}
          className="hidden h-11 shrink-0 items-center gap-3 border-t border-neutral-800 px-5 text-neutral-500 transition-colors hover:bg-neutral-800/70 hover:text-neutral-100 md:flex"
        >
          <Icon
            className={cx(
              "h-6 w-6 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              !pinned && "rotate-180",
            )}
          >
            <path d="m11 17-5-5 5-5" />
            <path d="m18 17-5-5 5-5" />
          </Icon>
          <span
            className={cx(
              "font-display text-base font-medium tracking-wide whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none",
              labelCls,
            )}
          >
            {pinned ? "Desfijar menú" : "Fijar menú"}
          </span>
        </button>
      </aside>

      {/* Contenido: flex-1 min-w-0 para que se reacomode al ancho de la barra. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-800 bg-neutral-950/90 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Abrir menú"
            aria-expanded={drawer}
            className="-ml-2 grid h-9 w-9 place-items-center rounded-md text-neutral-300 transition-colors hover:bg-neutral-800 md:hidden"
          >
            <Icon className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </Icon>
          </button>

          <p className="font-display text-lg font-semibold tracking-wide">
            {current?.label ?? "Motor IRM"}
          </p>

          {/* Toggle de tema + cuenta */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenu((m) => !m)}
                aria-haspopup="menu"
                aria-expanded={menu}
                className="flex items-center gap-2 rounded-md py-1 pr-2 pl-1 transition-colors hover:bg-neutral-800"
              >
                <span className="font-display grid h-8 w-8 place-items-center rounded-md border border-neutral-700 bg-neutral-800 text-sm font-semibold">
                  {initials(displayName)}
                </span>
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-sm font-medium">{displayName}</span>
                  <span className="block text-xs text-neutral-500">
                    {me.role}
                  </span>
                </span>
                <Icon
                  className={cx(
                    "h-4 w-4 text-neutral-500 transition-transform duration-200 motion-reduce:transition-none",
                    menu && "rotate-180",
                  )}
                >
                  <path d="m6 9 6 6 6-6" />
                </Icon>
              </button>

              <div
                role="menu"
                inert={!menu}
                className={cx(
                  "absolute top-full right-0 mt-2 w-56 origin-top-right rounded-md border border-neutral-700 bg-neutral-900 p-1 shadow-lg shadow-neutral-50/10",
                  "transition duration-150 ease-out motion-reduce:transition-none",
                  menu
                    ? "scale-100 opacity-100"
                    : "pointer-events-none scale-95 opacity-0",
                )}
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium">{displayName}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {me.role} · {me.username}
                  </p>
                </div>
                <div className="my-1 h-px bg-neutral-800" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
                >
                  <Icon className="h-4 w-4">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </Icon>
                  {logout.isPending ? "Saliendo…" : "Cerrar sesión"}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main id="contenido" className="min-w-0 px-4 py-6 md:px-8">
          {children}
        </main>
        <ConfirmHost />
      </div>
    </div>
  );
}