import {writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildCapabilitiesManifest} from "./lib/capabilities-manifest.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "..");
const manifest = buildCapabilitiesManifest(projectRoot);
const target = path.join(
  projectRoot,
  "catalog",
  "capabilities.manifest.json",
);
writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Manifest de capacidades actualizado: ${target}`);
