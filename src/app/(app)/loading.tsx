/**
 * Se muestra al instante mientras carga la pantalla a la que se navega:
 * una barra fina arriba y el esqueleto del título y la tabla. Next lo usa
 * solo (convención de loading.tsx); no cambia ninguna consulta.
 */
export default function Loading() {
  return (
    <div role="status" aria-label="Cargando">
      <div className="irm-progress" />
      <div className="mb-6 h-9 w-56 animate-pulse rounded bg-neutral-800" />
      <div className="space-y-2 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="h-5 w-1/3 animate-pulse rounded bg-neutral-800" />
        <div className="h-9 animate-pulse rounded bg-neutral-800/70" />
        <div className="h-9 animate-pulse rounded bg-neutral-800/70" />
        <div className="h-9 animate-pulse rounded bg-neutral-800/70" />
        <div className="h-9 animate-pulse rounded bg-neutral-800/70" />
      </div>
    </div>
  );
}
