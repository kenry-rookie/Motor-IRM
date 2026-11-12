"use client";

import { useEffect, useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import { Alert, Button, Card, cx, Dialog, Field, Input, PageTitle } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { api } from "~/trpc/react";

/** Areas of the permission codes, in the order the shop thinks about them. */
const AREAS: [string, string][] = [
  ["ventas", "Caja y ventas"],
  ["cobros", "Cobros"],
  ["clientes", "Clientes"],
  ["taller", "Taller"],
  ["garantias", "Garantías"],
  ["inventario", "Inventario"],
  ["compras", "Compras"],
  ["caja", "Caja"],
  ["personal", "Personal"],
  ["reportes", "Reportes"],
  ["catalogos", "Catálogos"],
  ["admin", "Administración"],
];

/**
 * What each profile can do. Changes are made on screen and saved together;
 * saving asks for the password of whoever saves, even an owner already logged
 * in (DEC-050): an open computer must not be enough to hand out permissions.
 */
export default function PermissionsPage() {
  const roles = api.admin.roles.useQuery();
  const permissions = api.admin.permissions.useQuery();
  const [roleId, setRoleId] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);

  const role = roles.data?.find((r) => r.id === roleId) ?? roles.data?.[0];
  const original = new Set(role?.permissions.map((p) => p.permissionId) ?? []);
  useEffect(() => {
    if (role) setChecked(new Set(role.permissions.map((p) => p.permissionId)));
  }, [role]);
  const dirty = original.size !== checked.size || [...checked].some((id) => !original.has(id));

  const byArea = AREAS.map(([prefix, label]) => ({
    label,
    perms: (permissions.data ?? []).filter((p) => p.code.split(".")[0] === prefix),
  })).filter((a) => a.perms.length > 0);

  return (
    <>
      <PageTitle
        title="Permisos por perfil"
        subtitle="Marque lo que puede hacer cada perfil y guarde con su contraseña"
        actions={
          <Button variant="secondary" onClick={() => setCreating(true)}>
            + Nuevo perfil
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Perfiles">
        {roles.data?.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={role?.id === r.id}
            onClick={async () => {
              if (dirty && !(await confirmDialog("Hay cambios sin guardar en este perfil. ¿Descartarlos?", { title: "Cambios sin guardar", confirmLabel: "Sí, descartar", danger: true }))) return;
              setRoleId(r.id);
              setSaved(false);
            }}
            className={cx(
              "min-h-10 rounded-lg border px-4 text-sm font-medium",
              role?.id === r.id ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-700 text-neutral-200 hover:bg-neutral-800",
            )}
          >
            {r.name} <span className="font-normal opacity-75">· {r._count.users} usuario{r._count.users === 1 ? "" : "s"}</span>
          </button>
        ))}
      </div>
      {saved && !dirty && <Alert kind="ok">Permisos guardados.</Alert>}
      {role && (
        <div className="grid gap-4 xl:grid-cols-2">
          {byArea.map((a) => (
            <Card key={a.label} title={a.label}>
              <ul className="space-y-1">
                {a.perms.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-neutral-800/50">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={checked.has(p.id)}
                        onChange={() => {
                          const next = new Set(checked);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          setChecked(next);
                          setSaved(false);
                        }}
                      />
                      <span className="text-sm">{p.description ?? p.code}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      {dirty && role && (
        <div className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-lg">
          <span className="text-sm text-neutral-300">Cambios sin guardar en «{role.name}».</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setChecked(new Set(original))}>
              Descartar
            </Button>
            <Button onClick={() => setConfirming(true)}>Guardar cambios</Button>
          </div>
        </div>
      )}
      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Confirme con su contraseña">
        {role && (
          <ConfirmSave
            payload={{ id: role.id, name: role.name, description: role.description ?? undefined, active: role.active, permissionIds: [...checked] }}
            onDone={() => {
              setConfirming(false);
              setSaved(true);
            }}
          />
        )}
      </Dialog>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nuevo perfil">
        <NewRole
          onDone={(id) => {
            setCreating(false);
            setRoleId(id);
          }}
        />
      </Dialog>
    </>
  );
}

type Payload = { id?: number; name: string; description?: string; active: boolean; permissionIds: number[] };

function ConfirmSave({ payload, onDone }: { payload: Payload; onDone: (id: number) => void }) {
  const utils = api.useUtils();
  const [password, setPassword] = useState("");
  const save = api.admin.saveRole.useMutation({
    onSuccess: async (r) => {
      await utils.admin.roles.invalidate();
      void utils.auth.me.invalidate();
      onDone(r.id);
    },
  });
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ ...payload, confirmPassword: password });
      }}
    >
      <p className="text-sm text-neutral-400">
        Para cambiar permisos se pide la contraseña de quien guarda, aunque ya haya iniciado sesión.
      </p>
      <Field label="Su contraseña">
        <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {save.error && <Alert>{errorMessage(save.error)}</Alert>}
      <Button type="submit" className="w-full" disabled={!password || save.isPending}>
        {save.isPending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function NewRole({ onDone }: { onDone: (id: number) => void }) {
  const roles = api.admin.roles.useQuery();
  const [name, setName] = useState("");
  const [copyFrom, setCopyFrom] = useState(0);
  const [step, setStep] = useState<"name" | "password">("name");
  const base = roles.data?.find((r) => r.id === copyFrom);
  if (step === "password") {
    return (
      <ConfirmSave
        payload={{ name, active: true, permissionIds: base?.permissions.map((p) => p.permissionId) ?? [] }}
        onDone={onDone}
      />
    );
  }
  return (
    <div className="space-y-3">
      <Field label="Nombre del perfil" hint="Por ejemplo «Cajero» o «Encargado de taller»">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Empezar con los permisos de">
        <select
          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
          value={copyFrom}
          onChange={(e) => setCopyFrom(Number(e.target.value))}
        >
          <option value={0}>Ninguno (vacío)</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>
      <Button className="w-full" disabled={!name.trim()} onClick={() => setStep("password")}>
        Continuar
      </Button>
    </div>
  );
}
