"use client";

import { useState } from "react";

import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { formatDateTime } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type User = RouterOutputs["admin"]["users"][number];

/**
 * Who enters the system (DEC-045: login lives in app_user). A user belongs
 * (optionally) to a person of the shop and has a profile (role). Nobody is
 * deleted: a user is deactivated, which also closes their sessions.
 */
export default function UsersPage() {
  const utils = api.useUtils();
  const me = api.auth.me.useQuery();
  const users = api.admin.users.useQuery();
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);
  const update = api.admin.updateUser.useMutation({ onSuccess: () => void utils.admin.users.invalidate() });

  return (
    <>
      <PageTitle
        title="Usuarios"
        subtitle="Quién entra al sistema y con qué perfil"
        actions={<Button onClick={() => setCreating(true)}>+ Nuevo usuario</Button>}
      />
      <Card>
        {update.error && <Alert>{errorMessage(update.error)}</Alert>}
        <Table head={["Usuario", "Persona", "Perfil", "Último ingreso", "Estado", ""]} empty={users.data?.length === 0}>
          {users.data?.map((u) => (
            <tr key={u.id}>
              <td className="font-medium">
                {u.username}
                {u.username === me.data?.username && <span className="ml-2 text-xs text-neutral-500">(usted)</span>}
              </td>
              <td>{u.staff?.name ?? "—"}</td>
              <td>{u.role.name}</td>
              <td className="text-neutral-400">{formatDateTime(u.lastLoginAt)}</td>
              <td>{u.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
              <td className="space-x-1 text-right whitespace-nowrap">
                <Button variant="ghost" onClick={() => setResetting(u)}>
                  Cambiar contraseña
                </Button>
                {u.username !== me.data?.username && (
                  <Button variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: u.id, active: !u.active })}>
                    {u.active ? "Desactivar" : "Activar"}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nuevo usuario">
        <NewUser onDone={() => setCreating(false)} />
      </Dialog>
      <Dialog open={resetting !== null} onClose={() => setResetting(null)} title={`Nueva contraseña para ${resetting?.username ?? ""}`}>
        {resetting && <ResetPassword user={resetting} onDone={() => setResetting(null)} />}
      </Dialog>
    </>
  );
}

function NewUser({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const roles = api.admin.roles.useQuery();
  const staff = api.staff.list.useQuery();
  const [f, setF] = useState({ username: "", password: "", roleId: 0, staffId: 0 });
  const create = api.admin.createUser.useMutation({
    onSuccess: () => {
      void utils.admin.users.invalidate();
      onDone();
    },
  });
  const errs = fieldErrors(create.error);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre de usuario" error={errs.username} hint="Con el que entra, por ejemplo «marta»">
        <Input autoFocus value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} />
      </Field>
      <Field label="Contraseña inicial" error={errs.password} hint="Mínimo 8 caracteres">
        <Input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <Field label="Perfil" error={errs.roleId} hint="Lo que puede hacer se ajusta en «Permisos por perfil»">
        <Select value={f.roleId} onChange={(e) => setF({ ...f, roleId: Number(e.target.value) })}>
          <option value={0}>Elegir…</option>
          {roles.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Persona del negocio (opcional)" hint="Para saber a quién pertenece el usuario">
        <Select value={f.staffId} onChange={(e) => setF({ ...f, staffId: Number(e.target.value) })}>
          <option value={0}>Ninguna</option>
          {staff.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-2">{create.error && <Alert>{errorMessage(create.error)}</Alert>}</div>
      <Button
        className="sm:col-span-2"
        disabled={!f.username || f.password.length < 8 || !f.roleId || create.isPending}
        onClick={() => create.mutate({ username: f.username, password: f.password, roleId: f.roleId, staffId: f.staffId || undefined })}
      >
        Crear usuario
      </Button>
    </div>
  );
}

function ResetPassword({ user, onDone }: { user: User; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const update = api.admin.updateUser.useMutation({ onSuccess: onDone });
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">Se cerrarán las sesiones abiertas de {user.username}.</p>
      <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
        <Input type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {update.error && <Alert>{errorMessage(update.error)}</Alert>}
      <Button className="w-full" disabled={password.length < 8 || update.isPending} onClick={() => update.mutate({ id: user.id, newPassword: password })}>
        Guardar contraseña
      </Button>
    </div>
  );
}
