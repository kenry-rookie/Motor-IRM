"use client";

import { type ReactNode } from "react";

import { printDocument } from "~/app/_components/print-frame";

/**
 * "Imprimir" link: a normal click prints right here (hidden iframe, no new
 * window). Cmd/Ctrl/Shift-click still opens the document to look at it.
 */
export function PrintLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        printDocument(href);
      }}
    >
      {children}
    </a>
  );
}
