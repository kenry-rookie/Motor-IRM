"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Button, Field, Input } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { api } from "~/trpc/react";

/** CLI-001 — Login. The session cookie is HttpOnly: JavaScript never sees the token. */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = api.auth.login.useMutation({
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
      <form
        className="w-full max-w-sm space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ username, password });
        }}
      >
        <div>
          <h1 className="text-2xl font-bold">
            Motor <span className="text-amber-400">IRM</span>
          </h1>
          <p className="text-sm text-neutral-400">Inicie sesión para continuar</p>
        </div>
        <Field label="Usuario">
          <Input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Alert>{login.error && errorMessage(login.error)}</Alert>
        <Button type="submit" className="w-full" disabled={login.isPending || !username || !password}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
