"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, BrandMark, Button, Field, Input } from "~/app/_components/ui";
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
    <main className="bg-pit flex min-h-screen items-center justify-center px-4 text-neutral-100">
      <form
        className="border-t-brand-600 w-full max-w-sm space-y-5 rounded-lg border border-t-2 border-neutral-800 bg-neutral-900 p-6 shadow-xl shadow-neutral-50/8"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate({ username, password });
        }}
      >
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 text-lg" />
          <div>
            <h1 className="font-display text-3xl leading-none font-semibold tracking-wide">
              Motor IRM
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              Inicie sesión para continuar
            </p>
          </div>
        </div>
        <Field label="Usuario">
          <Input
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>
        <Field label="Contraseña">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Alert>{login.error && errorMessage(login.error)}</Alert>
        <Button
          type="submit"
          className="w-full"
          disabled={login.isPending || !username || !password}
        >
          {login.isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
