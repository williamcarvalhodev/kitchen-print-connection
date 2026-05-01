import { build } from "esbuild";
import { execSync } from "child_process";

console.log("Building server...");
await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/server.mjs",
  sourcemap: true,
  external: ["pg-native"],
});
console.log("Server built.");

console.log("Building frontend...");
execSync("npx vite build --config vite.config.mjs", { stdio: "inherit" });
console.log("All done!");
