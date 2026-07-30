import {readFileSync} from "node:fs";
import path from "node:path";

const readJson = (projectRoot, relativePath) =>
  JSON.parse(readFileSync(path.join(projectRoot, relativePath), "utf8"));

/**
 * Fuentes donde se declaran composiciones. `Root.tsx` ya no lista los shorts uno a
 * uno: los importa de `src/shorts/registry.generated.ts`, que genera
 * `npm run shorts:build`. Sin leer los dos, los ids de los shorts desaparecerian
 * del manifiesto de capacidades.
 */
export const readCompositionSources = (projectRoot) =>
  // Cada superficie de montaje registra sus composiciones en un fichero generado
  // que el Root importa; el manifiesto tiene que leerlos todos o una intro nueva no
  // aparece publicada como capacidad.
  ["src/Root.tsx", "src/shorts/registry.generated.ts", "src/intro/registry.generated.ts"]
    .map((relativePath) => {
      try {
        return readFileSync(path.join(projectRoot, relativePath), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");

export const extractCompositionIds = (rootSource) => {
  const ids = new Set();
  for (const match of rootSource.matchAll(/\bid=["']([A-Za-z0-9-]+)["']/g)) {
    ids.add(match[1]);
  }
  for (const match of rootSource.matchAll(/\bid:\s*["']([A-Za-z0-9-]+)["']/g)) {
    ids.add(match[1]);
  }
  for (const match of rootSource.matchAll(
    /\bid:\s*composition\.id\.replace\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)/g,
  )) {
    const [, from, to] = match;
    for (const id of [...ids]) {
      if (id.includes(from)) ids.add(id.replace(from, to));
    }
  }
  return [...ids].sort();
};

export const buildCapabilitiesManifest = (projectRoot) => {
  const patterns = readJson(projectRoot, "catalog/animations/patterns.json");
  const effects = readJson(projectRoot, "catalog/animations/effects.json");
  const icons = readJson(projectRoot, "catalog/visuals/icons.json");
  const drawings = readJson(projectRoot, "catalog/visuals/drawings.json");
  const images = readJson(projectRoot, "catalog/visuals/images.json");
  const brandProfiles = readJson(
    projectRoot,
    "catalog/design/brand-profiles.json",
  );
  const preferences = readJson(
    projectRoot,
    "catalog/preferences/channel-profile.json",
  );
  const compositionIds = extractCompositionIds(readCompositionSources(projectRoot));
  return {
    version: 2,
    product: "Shortsmith Remotion",
    sourceOfTruth: [
      "catalog/animations/patterns.json",
      "catalog/animations/effects.json",
      "catalog/animations/pattern-bindings.json",
      "catalog/sound/recipes.json",
      "catalog/sound/sfx.json",
      "catalog/visuals/icons.json",
      "catalog/visuals/drawings.json",
      "catalog/visuals/images.json",
      "catalog/design/brand-profiles.json",
      "catalog/preferences/channel-profile.json",
      "src/Root.tsx",
      "src/shorts/registry.generated.ts",
      "src/intro/registry.generated.ts",
    ],
    commands: {
      ingestAnnotatedChart:
        "npm run remotion:ingest:chart -- --input <chart-ingestion-input.json>",
      selectVisual:
        'npm run remotion:select:visual -- --query "<concepto>" --allow-fallback',
      validate: "npm run remotion:check",
      renderChartStills: "npm run remotion:stills:annotated-chart",
      importAsset:
        "npm run remotion:asset:import -- --file <imagen> --id <slug> --type <tipo> --alt <texto> --source <origen> --license <licencia> --tags <lista>",
      buildReviewStudio: "npm run remotion:review:build",
      createReviewPackage:
        "npm run remotion:review:package -- --session <review-id>",
      validateEpisodePlan:
        "npm run episode:plan:validate -- --plan <visual-plan.json> --words <words.json>",
      synthesizeSfx: "npm run sfx:synthesize",
      renderChannelPlaybook: "npm run channel:playbook",
      recordChannelFeedback:
        'npm run channel:feedback -- --note "<corrección>" --section <id> --severity <error|warning|review>',
      verifyChannelEntities:
        "npm run channel:entities -- --channel <id> --verify",
    },
    schemas: {
      chartIngestion: "schemas/chart-ingestion-input.schema.json",
      animationSpec: "schemas/animation-spec.schema.json",
      visualSelection: "schemas/visual-selection.schema.json",
      managedImage: "schemas/image-asset-manifest.schema.json",
      reviewSession: "schemas/review-session.schema.json",
      visualQa: "schemas/visual-qa-report.schema.json",
      renderedVisualQa: "schemas/rendered-visual-qa-report.schema.json",
    },
    editorialEngine: {
      manual: "docs/animation-engine-operating-manual.md",
      director: "src/modules/editorial-video/visuals/",
      temporalTruth:
        "anchorWordIndex de la transcripción por palabras; atSeconds es derivado.",
      channelRules: "channels/<canal>/brand/editing-rules.json",
      ruleExceptions: "channels/<canal>/brand/rule-exceptions.json",
      soundFamilies: [
        "interface",
        "data",
        "camera",
        "tension",
        "impact",
        "break",
        "rewind",
        "reveal",
        "confirm",
        "texture",
      ],
      soundVariantsPerFamily: 6,
      reports: [
        "cue-coverage.json",
        "rhythm-report.json",
        "sound-report.json",
        "variety-report.json",
        "plan-validation.json",
        "episode-qa.json",
      ],
    },
    artDirections: [
      "editorial-report",
      "documentary-evidence",
      "diagrammatic-system",
      "market-data",
    ],
    compositionIds,
    patterns: patterns.patterns
      .map((pattern) => ({
        id: pattern.id,
        status: pattern.status,
        compositionId: pattern.implementation?.compositionId ?? null,
        variants: pattern.implementation?.variants ?? [],
        component: pattern.implementation?.component ?? null,
        ingestion: pattern.ingestion?.command ?? null,
        supportedFormats:
          pattern.implementation?.component === "ExtendedPatternScene"
            ? ["landscape", "vertical", "square", "portrait"]
            : ["landscape"],
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    effects: effects.effects
      .map((effect) => ({
        id: effect.id,
        status: effect.status,
        component: effect.implementation?.component ?? null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    visuals: {
      icons: icons.icons.map((icon) => icon.id).sort(),
      drawings: drawings.drawings.map((drawing) => drawing.id).sort(),
      images: images.images.map((image) => image.id).sort(),
      selectionModes: [
        "deterministic-catalog",
        "semantic-ontology-fuzzy",
        "llm-catalog-validated",
        "controlled-fallback",
      ],
      fallbackPolicy: "catalog-only-no-freeform-svg",
      managedAssetImport: true,
      svgRasterizationOnImport: true,
      preferenceProfile: preferences.id,
    },
    factualSafety: {
      calibratedCharts: true,
      explicitCalibrationAcceptance: true,
      observedValueLabels: true,
      externalSvgRasterization: true,
      runtimeInputSchemaValidation: true,
    },
    sound: {
      silentAndSfxTargets: true,
      defaultDelivery: effects.soundDesignPolicy.defaultDelivery,
      profiles: effects.soundProfiles.map((profile) => profile.id).sort(),
    },
    design: {
      defaultProfile: brandProfiles.defaultProfile,
      profiles: brandProfiles.profiles.map((profile) => profile.id),
      themes: brandProfiles.profiles.flatMap((profile) => profile.themes),
      motionProfiles: brandProfiles.profiles.flatMap(
        (profile) => profile.motionProfiles,
      ),
      formats: brandProfiles.profiles.flatMap((profile) => profile.formats),
      optionalHeader: true,
      watermarkDefault: false,
      cornerRuleDefault: false,
    },
    review: {
      studioUrl: "/remotion-review/",
      playerPreview: true,
      abVariants: true,
      frameComments: true,
      sourceContext: true,
      safeZones: true,
      approvalGate: "qa-passed",
      statuses: [
        "draft",
        "in-review",
        "changes-requested",
        "approved",
      ],
    },
    quality: {
      staticPropQa: true,
      renderedFrameQa: true,
      labelledContactSheets: true,
      immutableReviewRuns: true,
      chartCameraEdgeGuards: true,
    },
    agentRouting: {
      skill: ".agents/skills/create-remotion-animations/SKILL.md",
      readManifestFirst: true,
      reviewBeforeFinalRender: true,
      preferenceAwareSelection: true,
    },
  };
};
