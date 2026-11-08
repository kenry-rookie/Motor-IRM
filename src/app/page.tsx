const areas = [
  { name: "Ventas", detail: "Facturas, devoluciones y pagos de clientes" },
  {
    name: "Taller",
    detail: "Órdenes de servicio, fallas adicionales y garantías",
  },
  { name: "Inventario", detail: "Productos, precios y movimientos de stock" },
  { name: "Compras", detail: "Proveedores, facturas de compra y devoluciones" },
  { name: "Clientes", detail: "Clientes, motocicletas y saldos iniciales" },
  { name: "Personal", detail: "Pagos, adelantos y retiros de caja" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-16 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold tracking-tight">Motor IRM</h1>
        <p className="mt-2 text-neutral-400">
          Administración de taller y venta de repuestos de motocicletas.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((area) => (
            <li
              key={area.name}
              className="rounded-xl border border-neutral-800 p-4"
            >
              <h2 className="text-lg font-semibold">{area.name}</h2>
              <p className="mt-1 text-sm text-neutral-400">{area.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
