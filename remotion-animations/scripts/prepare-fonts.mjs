import {copyFileSync, mkdirSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = path.join(projectRoot, "public", "fonts");
mkdirSync(targetRoot, {recursive: true});

const files = [
  {
    source: path.join(
      projectRoot,
      "node_modules",
      "@fontsource-variable",
      "schibsted-grotesk",
      "files",
      "schibsted-grotesk-latin-wght-normal.woff2",
    ),
    target: "schibsted-grotesk-latin-ext-variable.woff2",
  },
  {
    source: path.join(
      projectRoot,
      "node_modules",
      "@fontsource",
      "fragment-mono",
      "files",
      "fragment-mono-latin-400-normal.woff2",
    ),
    target: "fragment-mono-latin-ext-400.woff2",
  },
  {
    source: path.join(
      projectRoot,
      "node_modules",
      "@fontsource-variable",
      "instrument-sans",
      "files",
      "instrument-sans-latin-wght-normal.woff2",
    ),
    target: "instrument-sans-latin-ext-variable.woff2",
  },
];

for (const file of files) {
  copyFileSync(file.source, path.join(targetRoot, file.target));
}

console.log(`Fuentes locales preparadas en ${targetRoot}`);
