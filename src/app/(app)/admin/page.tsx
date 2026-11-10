"use client";

import { useState } from "react";

import { Alert, Badge, Button, Card, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-015 — Catalogs, users and role permissions, without touching the database. */
const CATALOGS = [
  { kind: "productCategory", label: "Categorías de producto" },
  { kind: "productBrand", label: "Marcas de producto" },
  { kind: "motorcycleBrand", label: "Marcas de moto" },
  { kind: "paymentMethod", label: "Métodos de pago" },
  { kind: "returnReason", label: "Motivos de devolución" },
  { kind: "cashWithdrawalReason", label: "Motivos de retiro de caja" },
] as const;
type Kind = (typeof CATALOGS)[number]["kind"];
const WITH_ACTIVE = new Set<Kind>(["paymentMethod", "returnReason", "cashWithdrawalReason"]);

export default function AdminPage() {
  const me = api.auth.me.useQuery();
  const perms = me.data?.permissions ?? [];
  return (
    <>
      <PageTitle title="Administración" />
      <div className="space-y-4">
        {perms.includes("catalogos.gestionar") && <Catalogs />}
        {perms.includes("admin.usuarios") && <Users />}
        {perms.includes("admin.usuarios") && <Roles />}
      </div>
    </>
  );
}

function Catalogs() {
  const [kind, setKind] = useState<Kind>("productCategory");
  const [name, setName] = useState("");
  const utils = api.useUtils();
  const list = api.admin.catalog.useQuery({ kind });
  const refresh = () => void utils.admin.catalog.invalidate();
  const create = api.admin.createCatalogItem.useMutation({ onSuccess: () => { setName(""); refresh(); } });
  const toggle = api.admin.setCatalogItemActive.useMutation({ onSuccess: refresh });
  return (
    <Card
      title={
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {CATALOGS.map((c) => (
            <option key={c.kind} value={c.kind}>
              {c.label}
            </option>
          ))}
        </Select>
      }
    >
      <div className="mb-3 flex max-w-md gap-2">
        <Input placeholder="Nuevo nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name || create.isPending} onClick={() => create.mutate({ kind, name })}>
          Agregar
        </Button>
      </div>
      <Alert>{(create.error ?? toggle.error) && errorMessage(create.error ?? toggle.error)}</Alert>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {list.data?.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-1.5">
            <span className={r.active ? "" : "text-neutral-500 line-through"}>{r.name}</span>
            {WITH_ACTIVE.has(kind) && (
              <button
                className="text-xs text-neutral-400 hover:text-neutral-100"
                onClick={() =>
                  toggle.mutate({ kind: kind as "paymentMethod" | "returnReason" | "cashWithdrawalReason", id: r.id, active: !r.active })
                }
              >
                {r.active ? "Desactivar" : "Activar"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Users() {
  const utils = api.useUtils();
  const users = api.admin.users.useQuery();
  const roles = api.admin.roles.useQuery();
  const staff = api.staff.list.useQuery();
  const [f, setF] = useState({ username: "", password: "", roleId: 0, staffId: 0 });
  const refresh = () => void utils.admin.users.invalidate();
  const create = api.admin.createUser.useMutation({ onSuccess: () => { setF({ username: "", password: "", roleId: 0, staffId: 0 }); refresh(); } });
  const update = api.admin.updateUser.useMutation({ onSuccess: refresh });
  return (
    <Card title="Usuarios">
      <Table head={["Usuario", "Persona", "Rol", "Último ingreso", ""]}>
        {users.data?.map((u) => (
          <tr key={u.id}>
            <td>
              {u.username} {!u.active && <Badge tone="red">inactivo</Badge>}
            </td>
            <td>{u.staff?.name ?? "—"}</td>
            <td>{u.role.name}</td>
            <td>{formatDateTime(u.lastLoginAt)}</td>
            <td>
              <Button variant="ghost" onClick={() => update.mutate({ id: u.id, active: !u.active })}>
                {u.active ? "Desactivar" : "Activar"}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        <Input placeholder="Usuario" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
        <Input type="password" placeholder="Contraseña (8+)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Select value={f.roleId} onChange={(e) => setF({ ...f, roleId: Number(e.target.value) })}>
          <option value={0}>Rol…</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select value={f.staffId} onChange={(e) => setF({ ...f, staffId: Number(e.target.value) })}>
          <option value={0}>Persona (opcional)</option>
          {staff.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={!f.username || !f.password || !f.roleId || create.isPending}
          onClick={() => create.mutate({ username: f.username, password: f.password, roleId: f.roleId, staffId: f.staffId || undefined })}
        >
          Crear usuario
        </Button>
      </div>
      <div className="mt-2">
        <Alert>{(create.error ?? update.error) && errorMessage(create.error ?? update.error)}</Alert>
      </div>
    </Card>
  );
}

function Roles() {
  const utils = api.useUtils();
  const roles = api.admin.roles.useQuery();
  const permissions = api.admin.permissions.useQuery();
  const save = api.admin.saveRole.useMutation({ onSuccess: () => void utils.admin.roles.invalidate() });
  return (
    <Card title="Permisos por rol" actions={<span className="text-xs text-neutral-500">Provisional hasta responder Q-008 y Q-010</span>}>
      <Alert>{save.error && errorMessage(save.error)}</Alert>
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-neutral-400">Permiso</th>
              {roles.data?.map((r) => (
                <th key={r.id} className="px-3 py-1 text-neutral-300">
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.data?.map((p) => (
              <tr key={p.id} className="border-t border-neutral-800/60">
                <td className="px-2 py-1">
                  <code className="text-xs text-brand-700">{p.code}</code>
                  <div className="text-xs text-neutral-500">{p.description}</div>
                </td>
                {roles.data?.map((r) => {
                  const ids = r.permissions.map((rp) => rp.permissionId);
                  const has = ids.includes(p.id);
                  return (
                    <td key={r.id} className="px-3 py-1 text-center">
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={save.isPending}
                        onChange={() =>
                          save.mutate({
                            id: r.id,
                            name: r.name,
                            description: r.description ?? undefined,
                            active: r.active,
                            permissionIds: has ? ids.filter((x) => x !== p.id) : [...ids, p.id],
                          })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
