import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(scriptDir);
const serverDir = join(projectRoot, "dist", "server");
const target = join(serverDir, "server.js");
const candidates = [
  join(serverDir, "server.js"),
  join(serverDir, "index.js"),
  join(serverDir, "index.mjs"),
];

const source = candidates.find((filePath) => existsSync(filePath));

if (!source) {
  console.warn(
    `[ensure-server-entry] Skipped: no server entry found in ${serverDir}`
  );
  process.exit(0);
}

if (source === target) {
  console.log(`[ensure-server-entry] Using existing ${target}`);
  process.exit(0);
}

copyFileSync(source, target);
console.log(`[ensure-server-entry] Copied ${source} -> ${target}`);
