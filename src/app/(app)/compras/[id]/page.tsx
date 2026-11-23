"use client";

import { useParams } from "next/navigation";

import { PurchaseDetail } from "~/app/(app)/compras/purchase-detail";
import { BackBar, PageTitle } from "~/app/_components/ui";
import { docNo } from "~/lib/business";

/** Detail of a purchase, full screen: what was bought, what was paid and what was returned. */
export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const purchaseId = Number(id);
  return (
    <>
      <BackBar crumbs={[{ label: "Compras", href: "/compras" }, { label: docNo("compra", purchaseId) }]} back={{ href: "/compras", label: "Volver a compras" }} />
      <PageTitle title={`Factura de compra ${docNo("compra", purchaseId)}`} />
      <PurchaseDetail id={purchaseId} />
    </>
  );
}
