/**
 * Puente catálogo → render.
 *
 * ANM-E01/E03 — Hasta ahora `patternId` se declaraba en el plan y el render lo
 * ignoraba: quien decidía qué se pintaba era `switch (scene.kind)`. Eso hacía
 * que FC-R-020 aprobara el eje de patrón por una promesa que los píxeles no
 * cumplían. Aquí la resolución pasa a ser patternId → composición → componente.
 *
 * La tabla patternId → compositionId **no se escribe a mano**: sale de
 * `implementation.compositionId` de `patterns.json`. `pattern-routes.json`
 * declara qué composiciones tienen adaptador, y este módulo comprueba al
 * cargarse que catálogo, lista de rutas y registro de componentes dicen
 * exactamente lo mismo. Si se pudieran desincronizar, el puente no existiría.
 */
import catalog from "../../catalog/animations/patterns.json";
import routes from "../../catalog/animations/pattern-routes.json";

type CatalogPattern = {
  id: string;
  status: string;
  implementation: {compositionId?: string} | null;
};

const patterns = catalog.patterns as CatalogPattern[];

/** patternId → compositionId, derivado del catálogo. */
export const COMPOSITION_BY_PATTERN = new Map<string, string>(
  patterns
    .filter(
      (pattern) =>
        pattern.status === "ready" && pattern.implementation?.compositionId,
    )
    .map((pattern) => [
      pattern.id,
      pattern.implementation?.compositionId as string,
    ]),
);

const ROUTED = routes.routed as string[];
const UNROUTED = routes.unrouted as {
  compositionId: string;
  patternId: string;
  reason: string;
}[];

/**
 * Comprueba las tres fuentes contra sí mismas. Se llama al cargar el registro
 * de componentes, así que `remotion compositions` (y por tanto
 * `npm run remotion:check`) falla si alguien añade un adaptador sin declararlo,
 * declara una ruta que nadie implementa o cambia el `compositionId` de un
 * patrón en el catálogo.
 */
const KIND_FALLBACK_DECLARED = routes.kindFallback as {
  kind: string;
  reason: string;
}[];

export const assertRoutesInSync = (
  implemented: string[],
  fallbackKinds: string[] = [],
) => {
  const problems: string[] = [];
  const declaredFallback = new Set(
    KIND_FALLBACK_DECLARED.map((entry) => entry.kind),
  );
  for (const kind of fallbackKinds) {
    if (!declaredFallback.has(kind)) {
      problems.push(
        `«${kind}» está en la tabla heredada de SceneRegistry y no en ` +
          "`kindFallback` de pattern-routes.json: la deuda dejaría de contarse.",
      );
    }
  }
  for (const kind of declaredFallback) {
    if (!fallbackKinds.includes(kind)) {
      problems.push(
        `pattern-routes.json declara «${kind}» como camino heredado y ` +
          "SceneRegistry ya no lo tiene: retíralo del catálogo de rutas.",
      );
    }
  }
  const readyCompositions = new Set(COMPOSITION_BY_PATTERN.values());
  const routed = new Set(ROUTED);
  const built = new Set(implemented);

  for (const compositionId of ROUTED) {
    if (!readyCompositions.has(compositionId)) {
      problems.push(
        `pattern-routes.json enruta «${compositionId}», que ningún patrón ` +
          "`ready` de patterns.json implementa.",
      );
    }
    if (!built.has(compositionId)) {
      problems.push(
        `pattern-routes.json enruta «${compositionId}» pero PatternScenes no ` +
          "registra ningún componente para esa composición.",
      );
    }
  }
  for (const compositionId of built) {
    if (!routed.has(compositionId)) {
      problems.push(
        `PatternScenes registra «${compositionId}» sin declararlo en ` +
          "pattern-routes.json.",
      );
    }
  }
  for (const compositionId of readyCompositions) {
    if (routed.has(compositionId)) continue;
    const excuse = UNROUTED.find(
      (entry) => entry.compositionId === compositionId,
    );
    if (!excuse?.reason) {
      problems.push(
        `«${compositionId}» es la implementación de un patrón \`ready\` y no ` +
          "está ni en `routed` ni en `unrouted` con motivo.",
      );
    }
  }
  if (problems.length) {
    throw new Error(
      `El router de patrones y el catálogo están desincronizados:\n - ${problems.join(
        "\n - ",
      )}`,
    );
  }
};

export type PatternResolution =
  | {mode: "pattern"; patternId: string; compositionId: string}
  | {mode: "unroutable"; patternId: string | null; reason: string};

/** Resuelve el patrón de una escena a la composición que lo pinta. */
export const resolvePattern = (patternId?: string): PatternResolution => {
  if (!patternId) {
    return {
      mode: "unroutable",
      patternId: null,
      reason: "la escena no declara `patternId`",
    };
  }
  const compositionId = COMPOSITION_BY_PATTERN.get(patternId);
  if (!compositionId) {
    const pattern = patterns.find((entry) => entry.id === patternId);
    return {
      mode: "unroutable",
      patternId,
      reason: pattern
        ? `el patrón está \`${pattern.status}\` en el catálogo y no declara composición`
        : "el patrón no existe en patterns.json",
    };
  }
  if (!ROUTED.includes(compositionId)) {
    const excuse = UNROUTED.find(
      (entry) => entry.compositionId === compositionId,
    );
    return {
      mode: "unroutable",
      patternId,
      reason: `«${compositionId}» sin adaptador: ${excuse?.reason ?? "sin motivo declarado"}`,
    };
  }
  return {mode: "pattern", patternId, compositionId};
};

/**
 * Traza del camino heredado. El fallback por `kind` no puede ser un `default`
 * silencioso: mientras quede uno, tiene que verse en la consola del render y
 * poder contarse. Es la medida de la deuda que queda de ANM-E03.
 */
const fallbackTrace = new Map<string, {kind: string; patternId: string | null; reason: string; scenes: string[]}>();

export const recordKindFallback = (
  kind: string,
  sceneId: string,
  patternId: string | null,
  reason: string,
) => {
  const entry = fallbackTrace.get(kind) ?? {
    kind,
    patternId,
    reason,
    scenes: [],
  };
  if (!entry.scenes.includes(sceneId)) entry.scenes.push(sceneId);
  if (entry.scenes.length === 1) {
    // Una línea por `kind`, no una por escena: el objetivo es contar deuda,
    // no inundar el log del render.
    console.warn(
      `[router] «${kind}» sigue resolviéndose por kind (patrón del plan: ` +
        `${patternId ?? "ninguno"}) — ${reason}`,
    );
  }
  fallbackTrace.set(kind, entry);
};

export const getKindFallbackTrace = () => [...fallbackTrace.values()];
