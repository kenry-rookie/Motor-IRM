/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // The desktop app (scripts/desktop) builds into its own folder, so `npm run dev`
  // and the installed app never overwrite each other's files.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default config;
