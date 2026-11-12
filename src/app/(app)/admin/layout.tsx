import { type ReactNode } from "react";

/**
 * Administración: its options live in the side menu, under «Administración»
 * (DEC-054); /admin itself shows them as cards.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
