"use client";

import { useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import { Alert, Badge, Button, Dialog, Field, Input, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";

export type CatalogRow = { id: number; name: string; active: boolean; uses: number; extra?: string };

/**
 * One catalog as a table (DEC-061): rename, deactivate/activate, delete what was
 * never used, and merge a wrong item into the right one. Deactivated items are
 * hidden until «Ver desactivados» is on. Every action goes through callbacks so
 * the same table serves all the catalogs.
 */
export function CatalogTable({
  rows,
  loading,
  usesLabel = "Usos",
  onRename,
  onToggle,
  onDelete,
  onMerge,
  error,
  pending,
}: {
  rows: CatalogRow[];
  loading?: boolean;
  usesLabel?: string;
  onRename: (id: number, name: string) => void;
  onToggle: (id: number, active: boolean) => void;
  onDelete: (id: number) => void;
  onMerge?: (fromId: number, intoId: number) => void;
  error?: unknown;
  pending?: boolean;
}) {
  const [showInactive, setShowInactive] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [merging, setMerging] = useState<CatalogRow | null>(null);
  const q = text.trim().toLowerCase();
  const inactive = rows.filter((r) => !r.active).length;
  const shown = rows.filter((r) => (showInactive ? !r.active : r.active) && (!q || r.name.toLowerCase().includes(q)));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="h-11 max-w-sm" placeholder="Buscar…" value={text} onChange={(e) => setText(e.target.value)} />
        <Button variant={showInactive ? "primary" : "secondary"} className="h-11" onClick={() => setShowInactive((v) => !v)}>
          {showInactive ? "← Volver a los activos" : `Ver desactivados (${inactive})`}
        </Button>
      </div>
      {showInactive && <Alert kind="info">Estos no aparecen en las listas de las demás pantallas. Actívelos para volver a usarlos.</Alert>}
      <Alert>{error ? errorMessage(error) : null}</Alert>
      <Table head={["Nombre", usesLabel, "", ""]} empty={!loading && shown.length === 0}>
        {shown.map((r) => (
          <tr key={r.id}>
            <td>
              {editing?.id === r.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editing.name.trim()) onRename(r.id, editing.name.trim());
                    setEditing(null);
                  }}
                >
                  <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: r.id, name: e.target.value })} />
                  <Button type="submit" disabled={!editing.name.trim()}>
                    Guardar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                    Cancelar
                  </Button>
                </form>
              ) : (
                <>
                  <span className={r.active ? "" : "text-neutral-500"}>{r.name}</span>
                  {r.extra && <div className="text-xs text-neutral-500">{r.extra}</div>}
                </>
              )}
            </td>
            <td className="tabular-nums text-neutral-400">{r.uses > 0 ? r.uses : <Badge>sin usar</Badge>}</td>
            <td>{!r.active && <Badge tone="amber">Desactivado</Badge>}</td>
            <td className="text-right">
              {editing?.id !== r.id && (
                <div className="flex flex-wrap justify-end gap-1">
                  <Button variant="ghost" disabled={pending} onClick={() => setEditing({ id: r.id, name: r.name })}>
                    Editar
                  </Button>
                  <Button variant="ghost" disabled={pending} onClick={() => onToggle(r.id, !r.active)}>
                    {r.active ? "Desactivar" : "Activar"}
                  </Button>
                  {onMerge && r.uses > 0 && (
                    <Button variant="ghost" disabled={pending} onClick={() => setMerging(r)}>
                      Unir con…
                    </Button>
                  )}
                  {r.uses === 0 && (
                    <Button
                      variant="ghost"
                      className="text-bad-fg"
                      disabled={pending}
                      onClick={async () => {
                        if (await confirmDialog(`¿Eliminar «${r.name}»? Nadie lo usa todavía.`, { title: "Eliminar", confirmLabel: "Sí, eliminar", danger: true }))
                          onDelete(r.id);
                      }}
                    >
                      Eliminar
                    </Button>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-xs text-neutral-500">
        Lo que nunca se usó se puede eliminar. Si algo se escribió mal y ya se usó, use «Unir con…»: sus registros pasan al correcto y el
        mal escrito desaparece. Lo que ya no se usa, desactívelo.
      </p>
      {onMerge && (
        <MergeDialog
          row={merging}
          options={rows.filter((x) => x.id !== merging?.id)}
          onClose={() => setMerging(null)}
          onMerge={(into) => {
            if (merging) onMerge(merging.id, into);
            setMerging(null);
          }}
        />
      )}
    </div>
  );
}

/** «Unir con…»: choose the RIGHT item; the wrong one's records move there. */
export function MergeDialog({
  row,
  options,
  onClose,
  onMerge,
}: {
  row: { id: number; name: string; uses: number } | null;
  options: { id: number; name: string; active?: boolean }[];
  onClose: () => void;
  onMerge: (intoId: number) => void;
}) {
  const [into, setInto] = useState(0);
  const target = options.find((o) => o.id === into);
  return (
    <Dialog open={!!row} onClose={onClose} title={row ? `Unir «${row.name}» con otro` : "Unir"}>
      {row && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-400">
            Los {row.uses} registro(s) de «{row.name}» pasan al que elija, y «{row.name}» se elimina. Úselo cuando el mismo elemento se registró dos veces
            o se escribió mal. No se puede deshacer.
          </p>
          <Field label="¿Cuál es el correcto?">
            <Select value={into} onChange={(e) => setInto(Number(e.target.value))}>
              <option value={0}>Elegir…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.active === false ? " (desactivado)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            className="w-full"
            disabled={!into}
            onClick={async () => {
              if (
                target &&
                (await confirmDialog(`¿Pasar todo lo de «${row.name}» a «${target.name}» y eliminar «${row.name}»?`, {
                  title: "Unir",
                  confirmLabel: "Sí, unir",
                  danger: true,
                }))
              )
                onMerge(into);
            }}
          >
            Unir
          </Button>
        </div>
      )}
    </Dialog>
  );
}
