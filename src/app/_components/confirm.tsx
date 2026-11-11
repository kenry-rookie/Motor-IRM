"use client";

import { useEffect, useState } from "react";

import { Button, Dialog } from "~/app/_components/ui";

/**
 * The app's own "Are you sure?" and notice windows, instead of the browser's
 * `window.confirm` / `window.alert` (which say "localhost:3100 says" and look
 * like they come from the browser, not from Motor IRM).
 *
 *   if (!(await confirmDialog("¿Registrar el pago?"))) return;
 *   await alertDialog("No se pudo imprimir.", { title: "Imprimir" });
 *
 * <ConfirmHost /> is mounted once in the Shell; these functions talk to it.
 */
type Request = {
  message: string;
  title: string;
  confirmLabel: string;
  cancelLabel: string | null; // null = only "Entendido" (an alert)
  danger: boolean;
  resolve: (ok: boolean) => void;
};

type Options = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };

let show: ((r: Request) => void) | null = null;

export function confirmDialog(message: string, o: Options = {}): Promise<boolean> {
  return new Promise((resolve) => {
    // Outside the app shell (e.g. the login) there is no host: fall back to the browser.
    if (!show) return resolve(window.confirm(message));
    show({
      message,
      title: o.title ?? "Confirmar",
      confirmLabel: o.confirmLabel ?? "Sí, continuar",
      cancelLabel: o.cancelLabel ?? "Cancelar",
      danger: o.danger ?? false,
      resolve,
    });
  });
}

export function alertDialog(message: string, o: Omit<Options, "cancelLabel"> = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!show) {
      window.alert(message);
      return resolve();
    }
    show({
      message,
      title: o.title ?? "Motor IRM",
      confirmLabel: o.confirmLabel ?? "Entendido",
      cancelLabel: null,
      danger: o.danger ?? false,
      resolve: () => resolve(),
    });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => {
    show = setReq;
    return () => {
      show = null;
    };
  }, []);
  const answer = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };
  return (
    <Dialog open={!!req} onClose={() => answer(false)} title={req?.title ?? ""}>
      <p className="text-base whitespace-pre-line text-neutral-200">{req?.message}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {req?.cancelLabel && (
          <Button variant="secondary" className="h-11 px-5" onClick={() => answer(false)}>
            {req.cancelLabel}
          </Button>
        )}
        <Button autoFocus variant={req?.danger ? "danger" : "primary"} className="h-11 px-5" onClick={() => answer(true)}>
          {req?.confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
