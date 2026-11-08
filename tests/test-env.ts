/** Points DATABASE_URL at the TEST database. Never runs against development data. */
export function pointToTestDatabase() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env: rely on the real environment (CI)
  }
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Falta TEST_DATABASE_URL en .env (ver .env.example).");
  if (!new URL(url).pathname.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test.");
  }
  process.env.DATABASE_URL = url;
  process.env.SKIP_ENV_VALIDATION = "true";
  return url;
}
