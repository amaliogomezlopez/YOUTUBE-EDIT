import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "..");

const readJson = (relativePath) => {
  const absolutePath = path.join(projectRoot, relativePath);
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch (error) {
    throw new Error(
      `No se pudo leer ${relativePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const catalog = readJson("catalog/animation-patterns.json");
const effectsCatalog = readJson("catalog/animation-effects.json");
readJson("schemas/clip-animation-input.schema.json");
readJson("schemas/animation-spec.schema.json");

const allowedStatuses = new Set(["ready", "primitive", "planned"]);
const allowedFormats = new Set(["fullscreen", "overlay-alpha"]);
const allowedPromptKeys = new Set([
  "data",
  "comparison",
  "process",
  "time-concept",
  "asset",
]);
const focusIds = new Set(
  catalog.focusTreatments?.map((treatment) => treatment.id) ?? [],
);

const errors = [];
const patternIds = new Set();
const effectIds = new Set();
const effectPhases = new Set(
  effectsCatalog.phases?.map((phase) => phase.id) ?? [],
);

if (catalog.version !== 1) {
  errors.push("catalog.version debe ser 1");
}
if (!Array.isArray(catalog.patterns) || catalog.patterns.length === 0) {
  errors.push("catalog.patterns debe contener al menos un patrón");
}

for (const [index, pattern] of (catalog.patterns ?? []).entries()) {
  const location = `patterns[${index}]`;
  if (!/^[a-z]+\.[a-z0-9-]+$/.test(pattern.id ?? "")) {
    errors.push(`${location}.id no respeta <familia>.<slug>`);
  } else if (patternIds.has(pattern.id)) {
    errors.push(`${location}.id está duplicado: ${pattern.id}`);
  } else {
    patternIds.add(pattern.id);
  }

  if (!allowedStatuses.has(pattern.status)) {
    errors.push(`${location}.status no es válido: ${pattern.status}`);
  }
  if (!allowedFormats.has(pattern.defaultFormat)) {
    errors.push(`${location}.defaultFormat no es válido`);
  }
  if (!allowedPromptKeys.has(pattern.promptKey)) {
    errors.push(`${location}.promptKey no es válido`);
  }
  if (
    !Number.isFinite(pattern.durationSeconds?.min) ||
    !Number.isFinite(pattern.durationSeconds?.max) ||
    pattern.durationSeconds.min > pattern.durationSeconds.max
  ) {
    errors.push(`${location}.durationSeconds no define un rango válido`);
  }
  if (
    !Array.isArray(pattern.focusTreatments) ||
    pattern.focusTreatments.length === 0
  ) {
    errors.push(`${location}.focusTreatments está vacío`);
  } else {
    for (const treatment of pattern.focusTreatments) {
      if (!focusIds.has(treatment)) {
        errors.push(
          `${location}.focusTreatments referencia un tratamiento desconocido: ${treatment}`,
        );
      }
    }
  }
  if (pattern.status === "ready" && !pattern.implementation?.component) {
    errors.push(`${location} está ready pero no declara component`);
  }
  if (pattern.status === "planned" && pattern.implementation !== null) {
    errors.push(`${location} está planned pero implementation no es null`);
  }
}

if (effectsCatalog.version !== 1) {
  errors.push("animation-effects.version debe ser 1");
}
if (
  !Array.isArray(effectsCatalog.effects) ||
  effectsCatalog.effects.length === 0
) {
  errors.push("animation-effects.effects debe contener al menos un efecto");
}

for (const [index, effect] of (effectsCatalog.effects ?? []).entries()) {
  const location = `effects[${index}]`;
  if (!/^[a-z]+\.[a-z0-9-]+$/.test(effect.id ?? "")) {
    errors.push(`${location}.id no respeta <categoría>.<slug>`);
  } else if (effectIds.has(effect.id)) {
    errors.push(`${location}.id está duplicado: ${effect.id}`);
  } else {
    effectIds.add(effect.id);
  }
  if (!allowedStatuses.has(effect.status)) {
    errors.push(`${location}.status no es válido: ${effect.status}`);
  }
  if (!effectPhases.has(effect.phase)) {
    errors.push(`${location}.phase no es válida: ${effect.phase}`);
  }
  if (effect.status === "ready" && !effect.implementation?.component) {
    errors.push(`${location} está ready pero no declara component`);
  }
  if (effect.status === "planned" && effect.implementation !== null) {
    errors.push(`${location} está planned pero implementation no es null`);
  }
}

for (const focusId of focusIds) {
  const canonicalId = effectsCatalog.legacyFocusAliases?.[focusId];
  if (!canonicalId) {
    errors.push(`Falta alias canónico para focusTreatment: ${focusId}`);
  } else if (!effectIds.has(canonicalId)) {
    errors.push(
      `El alias ${focusId} referencia un efecto desconocido: ${canonicalId}`,
    );
  }
}

const zoomModeIds = new Set();
for (const [index, mode] of (
  effectsCatalog.zoomPolicy?.modes ?? []
).entries()) {
  const location = `zoomPolicy.modes[${index}]`;
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(mode.id ?? "")) {
    errors.push(`${location}.id no es válido`);
  } else if (zoomModeIds.has(mode.id)) {
    errors.push(`${location}.id está duplicado: ${mode.id}`);
  } else {
    zoomModeIds.add(mode.id);
  }
  if (!effectIds.has(mode.effectId)) {
    errors.push(
      `${location}.effectId referencia un efecto desconocido: ${mode.effectId}`,
    );
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const statusCounts = Object.fromEntries(
  [...allowedStatuses].map((status) => [
    status,
    catalog.patterns.filter((pattern) => pattern.status === status).length,
  ]),
);

console.log(
  `Catálogo válido: ${catalog.patterns.length} patrones ` +
    `(${Object.entries(statusCounts)
      .map(([status, count]) => `${status}=${count}`)
      .join(", ")}), ${effectsCatalog.effects.length} efectos transversales.`,
);
