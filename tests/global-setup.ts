import { execSync } from "node:child_process";

import { pointToTestDatabase } from "./test-env";

/** Once per `npm test`: empty the test database, apply every migration, seed it. */
export default function setup() {
  pointToTestDatabase();
  const env = { ...process.env, SEED_DEMO: "true", SEED_ADMIN_USERNAME: "admin", SEED_ADMIN_PASSWORD: "admin-pruebas" };
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
