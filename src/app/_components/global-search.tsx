"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Badge, cx } from "~/app/_components/ui";
import { useDebounced } from "~/lib/use-debounced";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Buscador general (Kenry, 23-nov), always at the top of the screen. Type a
 * document number (R-000045, F-12), a customer, a plate, a product or a supplier;
 * the first results show while typing. Enter or «Ver todo» opens /buscar, where
 * the results can be filtered with big buttons. Ctrl+K or «/» puts the cursor here.
 */
type Hit = RouterOutputs["search"]["global"]["hits"][number];

export const GROUP_LABELS = {
  documentos: "Facturas, recibos y órdenes",
  clientes: "Clientes",
  motos: "Motos",
  productos: "Productos",
  proveedores: "Proveedores",
} as const;

export function GlobalSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const q = useDebounced(text.trim(), 200);
  const found = api.search.global.useQuery({ q, limit: 4 }, { enabled: q.length > 0, placeholderData: (p) => p });
  const hits = q ? (found.data?.hits ?? []) : [];

  // Ctrl+K / Cmd+K or «/» (when not typing somewhere else) jumps here.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") ?? null);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  // Leaving the page closes the list.
  useEffect(() => setOpen(false), [pathname]);

  const go = (href: string) => {
    setOpen(false);
    setText("");
    router.push(href);
  };
  const all = () => text.trim() && go(`/buscar?q=${encodeURIComponent(text.trim())}`);

  return (
    <div ref={box} className="relative hidden w-full max-w-md md:block">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const h = hits[active];
          if (h && open) go(h.href);
          else all();
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={ref}
          type="search"
          role="combobox"
          aria-expanded={open && q.length > 0}
          aria-controls={listId}
          aria-label="Buscar en todo el sistema"
          autoComplete="off"
          placeholder="Buscar: R-000045, cliente, placa, producto…"
          className="h-10 w-full rounded-md border border-neutral-700 bg-neutral-900 pr-16 pl-9 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/50 focus:outline-none"
          value={text}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-neutral-700 px-1.5 text-[10px] text-neutral-500 lg:block">Ctrl K</kbd>
      </form>
      {open && q.length > 0 && (
        <div id={listId} role="listbox" className="absolute top-full right-0 left-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-lg border border-neutral-700 bg-neutral-900 p-1 shadow-xl shadow-neutral-50/10">
          {found.isLoading && <p className="px-3 py-2 text-sm text-neutral-500">Buscando…</p>}
          {!found.isLoading && hits.length === 0 && <p className="px-3 py-2 text-sm text-neutral-500">No se encontró nada con «{q}».</p>}
          {hits.map((h, i) => (
            <HitRow key={h.key} hit={h} active={i === active} onPick={() => go(h.href)} />
          ))}
          <button type="button" onClick={all} className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-brand-600 hover:bg-neutral-800">
            Ver todos los resultados y filtrar →
          </button>
        </div>
      )}
    </div>
  );
}

function HitRow({ hit, active, onPick }: { hit: Hit; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onPick}
      className={cx("flex w-full items-start justify-between gap-3 rounded-md px-3 py-2 text-left", active ? "bg-neutral-800" : "hover:bg-neutral-800/60")}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-neutral-100">{hit.title}</span>
        <span className="block truncate text-xs text-neutral-500">{hit.subtitle}</span>
      </span>
      {hit.badge && <Badge tone={hit.badge === "En el taller" ? "amber" : "neutral"}>{hit.badge}</Badge>}
    </button>
  );
}

/** For phones: the header only has room for a button that opens /buscar. */
export function GlobalSearchButton() {
  return (
    <Link href="/buscar" aria-label="Buscar" className="grid h-9 w-9 place-items-center rounded-md text-neutral-300 hover:bg-neutral-800 md:hidden">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-5 w-5">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    </Link>
  );
}
