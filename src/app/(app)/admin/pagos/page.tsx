import { redirect } from "next/navigation";

/** Pago a mecánicos moved to its own area of the menu (DEC-056). */
export default function OldPayPage() {
  redirect("/pagos");
}
