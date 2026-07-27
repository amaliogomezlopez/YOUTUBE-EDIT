import {build} from "esbuild";
import {copyFile, mkdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "..");
const outputDirectory = path.resolve(
  projectRoot,
  "..",
  "public",
  "remotion-review",
);

await mkdir(outputDirectory, {recursive: true});
await copyFile(
  path.join(
    projectRoot,
    "public",
    "fonts",
    "schibsted-grotesk-latin-ext-variable.woff2",
  ),
  path.join(outputDirectory, "schibsted-grotesk.woff2"),
);

await build({
  entryPoints: [path.join(projectRoot, "review", "main.tsx")],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  platform: "browser",
  target: ["chrome120", "edge120"],
  outfile: path.join(outputDirectory, "app.js"),
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  loader: {
    ".woff2": "dataurl",
  },
  logLevel: "info",
});

console.log(`Review Studio compilado en ${outputDirectory}`);
