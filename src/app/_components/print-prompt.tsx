"use client";

import { printDocument } from "~/app/_components/print-frame";
import { Button, Dialog } from "~/app/_components/ui";

/**
 * After charging or receiving a payment: ask whether to print (DEC-053). Some
 * customers want the paper and some don't; the default answer is just closing.
 * The print dialog opens right here (hidden iframe), no new tab or window.
 */
export function PrintPrompt({
  open,
  title,
  message,
  printLabel,
  href,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  printLabel: string;
  href: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-base text-neutral-200">{message}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" className="h-11 px-5" onClick={onClose}>
          No imprimir
        </Button>
        <Button
          autoFocus
          className="h-11 px-5"
          onClick={() => {
            printDocument(href);
            onClose();
          }}
        >
          {printLabel}
        </Button>
      </div>
    </Dialog>
  );
}
