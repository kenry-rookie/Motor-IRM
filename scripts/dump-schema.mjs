// Regenerates db/01_schema.sql from the running database (DEC-040).
// The schema is defined ONLY by prisma/migrations; this file is a readable
// copy for the Databases class. Run after `npm run db:migrate`:
//   npm run db:dump-schema
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

// With Docker (DATABASE_URL on localhost:5433) pg_dump runs inside the container;
// without Docker (Postgres.app, Windows) the pg_dump of this computer is used.
const url = process.env.DATABASE_URL ?? /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(".env", "utf8"))?.[1] ?? "";
const flags = ["--schema-only", "--no-owner", "--no-privileges"];
const dump = /localhost:5433\//.test(url)
  ? execFileSync("docker", ["compose", "exec", "-T", "db", "pg_dump", "-U", "motor_irm", ...flags, "motor_irm"], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    })
  : execFileSync("pg_dump", [...flags, url.replace(/\?.*$/, "")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const body = dump
  .split("\n")
  .filter((l) => !/^(SET |SELECT pg_catalog\.set_config|\\restrict |\\unrestrict |-- Dumped )/.test(l))
  .join("\n");

// Keep the header comment of the current file (everything before the first blank line after it).
const current = readFileSync("db/01_schema.sql", "utf8");
const header = current.slice(0, current.indexOf("\n\n") + 2);

writeFileSync("db/01_schema.sql", header + body);
console.log("db/01_schema.sql actualizado desde la base (pg_dump --schema-only).");
