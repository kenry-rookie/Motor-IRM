"use client";

/**
 * CLI-003 — Small component base (Tailwind only, no extra library) so every screen
 * looks the same: buttons, inputs, selects, cards, tables, alerts, dialogs.
 *
 * Tema taller (grafito + rojo). Las props de los componentes existentes no cambian;
 * lo nuevo es aditivo: BrandMark, Collapsible, Toolbar y Card con `collapsible`.
 */
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

/* ───────────── Marca ───────────── */

/** Ficha roja con las siglas; es lo único con rojo sólido grande en el menú. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "bg-brand-600 font-display grid h-9 w-9 shrink-0 place-items-center rounded-md text-base font-bold tracking-wider text-white",
        className,
      )}
    >
      IRM
    </span>
  );
}

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx(
        "h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
        open ? "rotate-0" : "-rotate-90",
        className,
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/* ───────────── Botones y campos ───────────── */

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors duration-150 enabled:active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand-600 hover:bg-brand-500 text-white",
        variant === "secondary" &&
          "border border-neutral-700 bg-neutral-800 text-neutral-100 hover:border-neutral-600 hover:bg-neutral-700",
        variant === "danger" &&
          "border border-red-800 bg-red-950 text-red-200 hover:bg-red-900",
        variant === "ghost" &&
          "text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  children,
  hint,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-neutral-300">{label}</span>
      {children}
      {hint && !error && (
        <span className="text-xs text-neutral-500">{hint}</span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 transition-colors duration-150 hover:border-neutral-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cx(inputCls, "min-h-20", className)} {...props} />
  );
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputCls, className)} {...props} />;
}

/* ───────────── Desplegables ───────────── */

/**
 * Abre y cierra con altura suave. Usa `grid-template-rows` (0fr ↔ 1fr), sin medir
 * nada con JavaScript. Cerrado queda `inert`: no se enfoca ni se lee.
 */
export function Collapsible({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  );
}

/**
 * Barra de filtros o acciones que se pliega. Úsela arriba de una tabla:
 *   <Toolbar title="Filtros" actions={<Button>Nuevo</Button>}> …campos… </Toolbar>
 */
export function Toolbar({
  title = "Filtros",
  actions,
  defaultOpen = true,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 rounded-lg border border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded text-sm font-medium text-neutral-300 transition-colors hover:text-neutral-50"
        >
          <Chevron open={open} />
          {title}
        </button>
        {actions}
      </div>
      <Collapsible open={open}>
        <div className="border-t border-neutral-800 p-3">{children}</div>
      </Collapsible>
    </div>
  );
}

/* ───────────── Contenedores ───────────── */

export function Card({
  title,
  actions,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** El título pasa a ser un botón que pliega el contenido. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasHeader = Boolean(title ?? actions);
  const body = <div className="p-4">{children}</div>;
  const titleCls = "font-display text-lg font-semibold tracking-wide";

  return (
    <section
      className={cx(
        "rounded-lg border border-neutral-800 bg-neutral-900",
        className,
      )}
    >
      {hasHeader && (
        <header
          className={cx(
            "flex items-center justify-between gap-2 px-4 py-3",
            (!collapsible || open) && "border-b border-neutral-800",
          )}
        >
          {collapsible ? (
            <h2 className={titleCls}>
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex items-center gap-2 text-left transition-colors hover:text-white"
              >
                <Chevron open={open} />
                {title}
              </button>
            </h2>
          ) : (
            <h2 className={titleCls}>{title}</h2>
          )}
          {actions}
        </header>
      )}
      {collapsible ? <Collapsible open={open}>{body}</Collapsible> : body}
    </section>
  );
}

export function Alert({
  kind = "error",
  children,
}: {
  kind?: "error" | "ok" | "info";
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cx(
        "rounded-md border px-3 py-2 text-sm",
        kind === "error" && "border-red-800 bg-red-950/60 text-red-200",
        kind === "ok" &&
          "border-emerald-800 bg-emerald-950/60 text-emerald-200",
        kind === "info" &&
          "border-neutral-700 bg-neutral-800/60 text-neutral-300",
      )}
    >
      {children}
    </div>
  );
}

export function Table({
  head,
  children,
  empty,
}: {
  head: ReactNode[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-neutral-400">
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="border-b border-neutral-700 px-2 py-2 font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-neutral-800 [&_td]:px-2 [&_td]:py-2 [&_tr]:transition-colors [&_tr:hover]:bg-neutral-800/40">
          {children}
        </tbody>
      </table>
      {empty && (
        <p className="py-6 text-center text-sm text-neutral-500">
          No hay registros.
        </p>
      )}
    </div>
  );
}

/**
 * "amber" (en uso en las pantallas) = estado que pide atención: contorno rojo.
 * "red" = problema o cancelado: relleno rojo. Así no se confunden entre sí.
 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "amber" | "green" | "red" | "blue";
}) {
  return (
    <span
      className={cx(
        "inline-block rounded px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-neutral-800 text-neutral-300",
        tone === "amber" && "border-brand-500/50 text-brand-300 border",
        tone === "green" && "bg-emerald-500/15 text-emerald-300",
        tone === "red" && "bg-red-600/25 text-red-200",
        tone === "blue" && "bg-sky-500/15 text-sky-300",
      )}
    >
      {children}
    </span>
  );
}

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-lg border border-neutral-700 bg-neutral-950 p-0 text-neutral-100 shadow-2xl shadow-black/50 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="font-display text-lg font-semibold tracking-wide">
          {title}
        </h2>
        <button
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          aria-label="Cerrar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">{open && children}</div>
    </dialog>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
