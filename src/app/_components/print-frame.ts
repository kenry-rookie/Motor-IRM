"use client";

/**
 * Prints a document (factura, recibo de abono) WITHOUT opening a new window.
 *
 * Before: every "Imprimir" did `window.open(..., "_blank")`, so 5 prints left
 * 5 extra windows open. Now the printable page is loaded inside an invisible
 * <iframe> on the current screen. The page itself (useAutoPrint in print-kit)
 * opens the print dialog of the iframe and tells us when it is done with a
 * postMessage; then the iframe is removed. The user only sees the dialog.
 *
 * Same origin (localhost), so the session cookie works inside the iframe.
 */

import { alertDialog } from "~/app/_components/confirm";

export const PRINT_MESSAGE = "irm-print";

export type PrintMessage =
  | { source: typeof PRINT_MESSAGE; kind: "done" }
  | { source: typeof PRINT_MESSAGE; kind: "error"; message: string };

const FRAME_ID = "irm-print-frame";
/** Safety net: if the page never answers, remove the iframe anyway. */
const MAX_WAIT_MS = 120_000;

let cleanup: (() => void) | null = null;

export function printDocument(href: string) {
  if (!href) return;
  // Only one print at a time: a new click replaces the previous iframe.
  cleanup?.();

  const url = new URL(href, window.location.origin);
  url.searchParams.set("imprimir", "1");

  const frame = document.createElement("iframe");
  frame.id = FRAME_ID;
  frame.title = "Impresión";
  frame.setAttribute("aria-hidden", "true");
  // Not display:none — some browsers don't lay out (and so don't print) a hidden frame.
  Object.assign(frame.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    visibility: "hidden",
  });

  const onMessage = (e: MessageEvent<PrintMessage>) => {
    if (e.origin !== window.location.origin || e.source !== frame.contentWindow) return;
    if (e.data?.source !== PRINT_MESSAGE) return;
    if (e.data.kind === "error") {
      void alertDialog(`No se pudo imprimir.\n\n${e.data.message}`, { title: "Imprimir" });
    }
    // Let the browser finish handing the page to the printer before removing it.
    setTimeout(() => cleanup?.(), 500);
  };
  const timer = setTimeout(() => cleanup?.(), MAX_WAIT_MS);

  cleanup = () => {
    window.removeEventListener("message", onMessage);
    clearTimeout(timer);
    frame.remove();
    cleanup = null;
  };

  window.addEventListener("message", onMessage);
  frame.src = url.pathname + url.search;
  document.body.appendChild(frame);
}
