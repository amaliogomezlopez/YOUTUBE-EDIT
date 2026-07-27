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

const catalog = readJson("catalog/animations/patterns.json");
const effectsCatalog = readJson("catalog/animations/effects.json");
const iconsCatalog = readJson("catalog/visuals/icons.json");
const drawingsCatalog = readJson("catalog/visuals/drawings.json");
const imagesCatalog = readJson("catalog/visuals/images.json");
readJson("schemas/clip-animation-input.schema.json");
readJson("schemas/animation-spec.schema.json");
readJson("schemas/image-asset-manifest.schema.json");
readJson("schemas/visual-selection.schema.json");

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
const soundProfileIds = new Set();
const iconIds = new Set();
const drawingIds = new Set();
const imageIds = new Set();

if (catalog.version !== 1) {
  errors.push("catalog.version debe ser 1");
}
if (catalog.catalogFamily !== "animations") {
  errors.push("catalog/animations/patterns.json debe declarar catalogFamily=animations");
}
if (!Array.isArray(catalog.patterns) || catalog.patterns.length === 0) {
  errors.push("catalog.patterns debe contener al menos un patrón");
}
if (
  effectsCatalog.soundDesignPolicy?.decision !== "required" ||
  effectsCatalog.soundDesignPolicy?.defaultDelivery !== "both"
) {
  errors.push(
    "animation-effects.soundDesignPolicy debe exigir decisión sonora y entrega both",
  );
}
if (
  !Array.isArray(effectsCatalog.soundProfiles) ||
  effectsCatalog.soundProfiles.length === 0
) {
  errors.push("animation-effects.soundProfiles debe contener perfiles");
}
for (const [index, profile] of (
  effectsCatalog.soundProfiles ?? []
).entries()) {
  const location = `soundProfiles[${index}]`;
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(profile.id ?? "")) {
    errors.push(`${location}.id no es válido`);
  } else if (soundProfileIds.has(profile.id)) {
    errors.push(`${location}.id está duplicado: ${profile.id}`);
  } else {
    soundProfileIds.add(profile.id);
  }
  if (!Number.isInteger(profile.maxCues) || profile.maxCues < 1) {
    errors.push(`${location}.maxCues debe ser un entero positivo`);
  }
  if (
    !Array.isArray(profile.defaultFiles) ||
    profile.defaultFiles.length === 0 ||
    profile.defaultFiles.some(
      (file) => !/^sfx\/amaliometria-[a-z-]+\.wav$/.test(file),
    )
  ) {
    errors.push(
      `${location}.defaultFiles debe usar WAV propios sfx/amaliometria-*`,
    );
  }
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
  if (!soundProfileIds.has(pattern.soundProfile)) {
    errors.push(
      `${location}.soundProfile referencia un perfil desconocido: ${pattern.soundProfile}`,
    );
  }
}

if (
  !Array.isArray(catalog.selectionPolicy?.readyRouting) ||
  catalog.selectionPolicy.readyRouting.length === 0
) {
  errors.push("catalog.selectionPolicy.readyRouting debe contener rutas");
}
for (const [index, route] of (
  catalog.selectionPolicy?.readyRouting ?? []
).entries()) {
  const location = `selectionPolicy.readyRouting[${index}]`;
  const pattern = (catalog.patterns ?? []).find(
    (candidate) => candidate.id === route.patternId,
  );
  if (!pattern) {
    errors.push(`${location}.patternId no existe: ${route.patternId}`);
  } else if (pattern.status !== "ready") {
    errors.push(`${location}.patternId no está ready: ${route.patternId}`);
  }
}

if (effectsCatalog.version !== 1) {
  errors.push("animation-effects.version debe ser 1");
}
if (effectsCatalog.catalogFamily !== "animations") {
  errors.push("catalog/animations/effects.json debe declarar catalogFamily=animations");
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

if (
  iconsCatalog.version !== 1 ||
  iconsCatalog.catalogFamily !== "visuals" ||
  iconsCatalog.kind !== "icon"
) {
  errors.push("catalog/visuals/icons.json no declara el contrato visual v1");
}
if (!Array.isArray(iconsCatalog.icons) || iconsCatalog.icons.length === 0) {
  errors.push("catalog/visuals/icons.json debe contener iconos");
}
for (const [index, icon] of (iconsCatalog.icons ?? []).entries()) {
  const location = `icons[${index}]`;
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(icon.id ?? "")) {
    errors.push(`${location}.id no es un slug válido`);
  } else if (iconIds.has(icon.id)) {
    errors.push(`${location}.id está duplicado: ${icon.id}`);
  } else {
    iconIds.add(icon.id);
  }
  if (
    typeof icon.label !== "string" ||
    !icon.label.trim() ||
    typeof icon.category !== "string" ||
    !icon.category.trim()
  ) {
    errors.push(`${location} necesita label y category`);
  }
  if (!Array.isArray(icon.tags) || icon.tags.length < 2) {
    errors.push(`${location}.tags necesita al menos dos términos semánticos`);
  }
  if (!Array.isArray(icon.parts) || icon.parts.length === 0) {
    errors.push(`${location}.parts debe describir sus piezas visuales`);
  }
}

if (
  drawingsCatalog.version !== 1 ||
  drawingsCatalog.catalogFamily !== "visuals" ||
  drawingsCatalog.kind !== "drawing"
) {
  errors.push("catalog/visuals/drawings.json no declara el contrato visual v1");
}
if (
  !Array.isArray(drawingsCatalog.drawings) ||
  drawingsCatalog.drawings.length === 0
) {
  errors.push("catalog/visuals/drawings.json debe contener dibujos");
}
for (const [index, drawing] of (drawingsCatalog.drawings ?? []).entries()) {
  const location = `drawings[${index}]`;
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(drawing.id ?? "")) {
    errors.push(`${location}.id no es un slug válido`);
  } else if (drawingIds.has(drawing.id)) {
    errors.push(`${location}.id está duplicado: ${drawing.id}`);
  } else {
    drawingIds.add(drawing.id);
  }
  if (!Array.isArray(drawing.iconRefs) || drawing.iconRefs.length === 0) {
    errors.push(`${location}.iconRefs debe contener referencias`);
  } else {
    for (const iconId of drawing.iconRefs) {
      if (!iconIds.has(iconId)) {
        errors.push(`${location}.iconRefs referencia un icono desconocido: ${iconId}`);
      }
    }
  }
  if (!Array.isArray(drawing.tags) || drawing.tags.length < 2) {
    errors.push(`${location}.tags necesita al menos dos términos semánticos`);
  }
  if (typeof drawing.motionVerb !== "string" || !drawing.motionVerb.trim()) {
    errors.push(`${location}.motionVerb es obligatorio`);
  }
}

if (
  imagesCatalog.version !== 1 ||
  imagesCatalog.catalogFamily !== "visuals" ||
  imagesCatalog.kind !== "managed-image"
) {
  errors.push("catalog/visuals/images.json no declara el contrato visual v1");
}
if (!Array.isArray(imagesCatalog.images)) {
  errors.push("catalog/visuals/images.json debe declarar images como array");
}
for (const [index, image] of (imagesCatalog.images ?? []).entries()) {
  const location = `images[${index}]`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(image.id ?? "")) {
    errors.push(`${location}.id no es un slug válido`);
  } else if (imageIds.has(image.id)) {
    errors.push(`${location}.id está duplicado: ${image.id}`);
  } else {
    imageIds.add(image.id);
  }
  if (!/^assets\/library\//.test(image.publicPath ?? "")) {
    errors.push(`${location}.publicPath debe vivir en assets/library/`);
  }
  if (!/^[a-fA-F0-9]{64}$/.test(image.sha256 ?? "")) {
    errors.push(`${location}.sha256 no es válido`);
  }
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height)) {
    errors.push(`${location} necesita width y height enteros`);
  }
  if (!Array.isArray(image.tags) || image.tags.length < 2) {
    errors.push(`${location}.tags necesita al menos dos términos semánticos`);
  }
  if (
    typeof image.source !== "string" ||
    !image.source.trim() ||
    typeof image.license !== "string" ||
    !image.license.trim()
  ) {
    errors.push(`${location} necesita source y license verificables`);
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
      .join(", ")}), ${effectsCatalog.effects.length} efectos transversales, ` +
    `${soundProfileIds.size} perfiles sonoros, ${iconIds.size} iconos y ` +
    `${drawingIds.size} dibujos; ${imageIds.size} imágenes gestionadas.`,
);
