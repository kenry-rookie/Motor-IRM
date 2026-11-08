"use client";

/**
 * CLI-003 — Small component base (Tailwind only, no extra library) so every screen
 * looks the same: buttons, inputs, selects, cards, tables, alerts, dialogs.
 */
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-amber-500 text-neutral-950 hover:bg-amber-400",
        variant === "secondary" && "border border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
        variant === "ghost" && "text-neutral-300 hover:bg-neutral-800",
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-neutral-500">{hint}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 focus:border-amber-500 focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputCls, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputCls, "min-h-20", className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputCls, className)} {...props} />;
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-xl border border-neutral-800 bg-neutral-900/60 p-4", className)}>
      {(title ?? actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok" | "info"; children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={cx(
        "rounded-lg border px-3 py-2 text-sm",
        kind === "error" && "border-red-800 bg-red-950/60 text-red-200",
        kind === "ok" && "border-emerald-800 bg-emerald-950/60 text-emerald-200",
        kind === "info" && "border-neutral-700 bg-neutral-900 text-neutral-300",
      )}
    >
      {children}
    </div>
  );
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-neutral-400">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="border-b border-neutral-800 px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-neutral-800/60 [&_td]:px-2 [&_td]:py-2">{children}</tbody>
      </table>
      {empty && <p className="py-6 text-center text-sm text-neutral-500">No hay registros.</p>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "amber" | "green" | "red" | "blue" }) {
  return (
    <span
      className={cx(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-neutral-800 text-neutral-300",
        tone === "amber" && "bg-amber-500/15 text-amber-300",
        tone === "green" && "bg-emerald-500/15 text-emerald-300",
        tone === "red" && "bg-red-500/15 text-red-300",
        tone === "blue" && "bg-sky-500/15 text-sky-300",
      )}
    >
      {children}
    </span>
  );
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
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
      className="m-auto w-[min(640px,calc(100vw-2rem))] rounded-xl border border-neutral-700 bg-neutral-950 p-0 text-neutral-100 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100" aria-label="Cerrar">
          ✕
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">{open && children}</div>
    </dialog>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-400">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
