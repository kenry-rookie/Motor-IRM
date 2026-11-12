// Regenerates db/01_schema.sql from the running database (DEC-040).
// The schema is defined ONLY by prisma/migrations; this file is a readable
// copy for the Databases class. Run after `npm run db:migrate`:
//   npm run db:dump-schema
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const dump = execFileSync(
  "docker",
  ["compose", "exec", "-T", "db", "pg_dump", "-U", "motor_irm", "--schema-only", "--no-owner", "--no-privileges", "motor_irm"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);

const body = dump
  .split("\n")
  .filter((l) => !/^(SET |SELECT pg_catalog\.set_config|\\restrict |\\unrestrict |-- Dumped )/.test(l))
  .join("\n");

// Keep the header comment of the current file (everything before the first blank line after it).
const current = readFileSync("db/01_schema.sql", "utf8");
const header = current.slice(0, current.indexOf("\n\n") + 2);

writeFileSync("db/01_schema.sql", header + body);
console.log("db/01_schema.sql actualizado desde la base (pg_dump --schema-only).");
