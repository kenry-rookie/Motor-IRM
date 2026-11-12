"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { PRINT_MESSAGE, type PrintMessage } from "~/app/_components/print-frame";
import { BUSINESS } from "~/lib/business";

/**
 * Pieces shared by the printable documents (DEC-053). Fixed colors (hex), never
 * the theme's `neutral-*`, so the paper looks the same in light and dark mode.
 */

/** Toolbar over the sheet; it does not print. */
export function PrintToolbar({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="no-print mx-auto mb-4 flex max-w-[816px] items-center justify-between gap-2 px-4">
      <a href={backHref} className="rounded-md border border-[#c9ced5] bg-white px-3 py-2 text-sm font-medium hover:bg-[#f3f4f6]">
        ← {backLabel}
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-md bg-[#c8202a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a31822]"
      >
        Imprimir
      </button>
    </div>
  );
}

/**
 * Opens the print dialog once, when the page was opened with ?imprimir=1.
 * Inside the hidden print iframe (printDocument), it also tells the screen that
 * opened it when printing is over, or that the document could not load.
 */
export function useAutoPrint(ready: boolean, error?: string | null) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    if (new URLSearchParams(window.location.search).get("imprimir") !== "1") return;
    const inFrame = window.parent !== window;
    const tell = (msg: PrintMessage) => {
      if (inFrame) window.parent.postMessage(msg, window.location.origin);
    };
    if (error) {
      done.current = true;
      tell({ source: PRINT_MESSAGE, kind: "error", message: error });
      return;
    }
    if (!ready) return;
    const onAfterPrint = () => tell({ source: PRINT_MESSAGE, kind: "done" });
    window.addEventListener("afterprint", onAfterPrint, { once: true });
    const t = setTimeout(() => {
      done.current = true;
      window.print();
    }, 300);
    return () => {
      clearTimeout(t);
      if (!done.current) window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [ready, error]);
}

/** A letter-size sheet. */
export function Sheet({ children }: { children: ReactNode }) {
  return (
    <article className="print-sheet mx-auto flex min-h-[1000px] max-w-[816px] flex-col bg-white px-12 py-10 text-[13px] leading-snug shadow-md print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
      {children}
    </article>
  );
}

/** Business header with the document box on the right. */
export function SheetHeader({ title, number, rows }: { title: string; number: string; rows: [string, ReactNode][] }) {
  return (
    <header className="flex items-start justify-between gap-6 border-b-2 border-[#111] pb-4">
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-[#c8202a] font-display text-xl font-bold text-white">
          MR
        </div>
        <div>
          <p className="font-display text-2xl leading-tight font-bold tracking-tight uppercase">{BUSINESS.name}</p>
          <p className="text-[#444]">{BUSINESS.tagline}</p>
          <p className="text-[#444]">{BUSINESS.address}</p>
          <p className="font-medium">Tel. {BUSINESS.phone}</p>
        </div>
      </div>
      <div className="min-w-52 rounded-md border-2 border-[#111] text-center">
        <p className="bg-[#111] px-3 py-1 font-display text-lg font-bold tracking-widest text-white uppercase">{title}</p>
        <p className="px-3 pt-1 text-xl font-bold tabular-nums">N.º {number}</p>
        <dl className="px-3 pb-2 text-left text-xs">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-[#555]">{k}</dt>
              <dd className="text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}

/** Label/value block (customer, motorcycle…). */
export function InfoGrid({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border border-[#c9ced5] px-4 py-3">
      {items.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-24 shrink-0 text-[#555]">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Signatures({ left, right }: { left: string; right: string }) {
  return (
    <div className="mt-16 grid grid-cols-2 gap-16 text-center text-xs text-[#444]">
      <p className="border-t border-[#111] pt-1">{left}</p>
      <p className="border-t border-[#111] pt-1">{right}</p>
    </div>
  );
}

export function SheetFooter({ children }: { children?: ReactNode }) {
  return (
    <footer className="mt-auto border-t border-[#c9ced5] pt-3 text-center text-xs text-[#555]">
      {children}
      <p className="font-medium text-[#111]">{BUSINESS.thanks}</p>
    </footer>
  );
}
