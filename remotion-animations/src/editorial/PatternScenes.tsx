/**
 * Adaptadores `escena editorial → props del patrón del catálogo`.
 *
 * ANM-E03 — El contrato de una escena editorial (headline, chartData, labels,
 * cues anclados) no es el contrato de un patrón del catálogo. Aquí vive la
 * traducción, y **cada adaptador valida su salida con zod**: una escena que no
 * puede alimentar su patrón lanza, no pinta un panel vacío. Un patrón vacío es
 * peor que un fallo: pasa la validación, entra en el render y nadie lo ve hasta
 * el vídeo montado.
 *
 * El registro se declara por `compositionId` porque es lo que el catálogo dice
 * en `implementation.compositionId`. `assertRoutesInSync` comprueba al cargar
 * que este registro, `pattern-routes.json` y `patterns.json` coinciden.
 */
import React from "react";
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion";
import {z} from "zod";
import {
  ContagionSpread,
  ContagionStateLabel,
  contagionSpreadSchema,
} from "../motion/ContagionSpread";
import {KineticPhrase, kineticPhraseSchema} from "../motion/KineticPhrase";
import {LogoEcosystem, logoEcosystemSchema} from "../motion/LogoEcosystem";
import {
  ExtendedPatternProps,
  ExtendedPatternScene,
  extendedPatternSchema,
} from "../motion/ExtendedPatterns";
import {
  CapacityMatrix,
  ConnectedCardChain,
  RadialOrbitSummary,
} from "../motion/ScoutedPatterns";
import {KineticNumber, LineChartZoom, RisingHistogram} from "../motion/Toolkit";
import {EditorialScene} from "./schemas";

export type PatternSceneProps = {
  scene: EditorialScene;
  accentColor: string;
  logoPath: string;
};

export type PatternRoute = {
  /**
   * `true` cuando el patrón dibuja el cuadro completo (fondo, cabecera y
   * remates). La capa editorial retira entonces su cabecera y su ribete para no
   * imprimir dos titulares sobre el mismo frame.
   */
  ownsFrame: boolean;
  Component: React.FC<PatternSceneProps>;
};

/** Falla nombrando escena y patrón: un error mudo aquí es un frame vacío. */
const parseOrThrow = <T,>(
  schema: z.ZodType<T>,
  value: unknown,
  scene: EditorialScene,
  compositionId: string,
): T => {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const detail = result.error.issues
    .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
    .join("; ");
  throw new Error(
    `La escena ${scene.id} (${scene.kind}, patrón ${scene.patternId}) no puede ` +
      `alimentar «${compositionId}»: ${detail}. Corrige el binding del patrón o ` +
      "aporta la evidencia que el patrón exige; no lo pintes vacío.",
  );
};

/** Zona útil bajo la cabecera editorial para los patrones sin cuadro propio. */
const ContentArea: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      display: "flex",
      justifyContent: "center",
      padding: "210px 100px 96px",
    }}
  >
    {children}
  </AbsoluteFill>
);

const cueById = (scene: EditorialScene, id: string) =>
  scene.semanticCues.find((item) => item.id === id);

/** Envolvente del cue: 0 → 1 → 0 alrededor de su palabra anclada. */
const cuePulse = (
  scene: EditorialScene,
  id: string,
  frame: number,
  fps: number,
) => {
  const item = cueById(scene, id);
  if (!item) return 0;
  const start = item.atSeconds * fps;
  const end = (item.atSeconds + item.durationSeconds) * fps;
  const rise = Math.min(1, Math.max(0, (frame - start) / Math.max(1, 0.3 * fps)));
  const fall = Math.min(
    1,
    Math.max(0, (end - frame) / Math.max(1, 0.22 * fps)),
  );
  return Math.min(rise, fall);
};

const numericItems = (scene: EditorialScene) =>
  scene.labels.map((label, index) => ({
    label,
    value: scene.values[index],
    detail: scene.valueLabels[index],
  }));

// ---------------------------------------------------------------------------
// Toolkit — componentes internos: la capa editorial conserva su cuadro.
// ---------------------------------------------------------------------------

const heroMetricSchema = z.object({
  to: z.number(),
  suffix: z.string(),
  label: z.string().min(1),
  decimals: z.number().int().min(0).max(2),
});

const HeroMetricScene: React.FC<PatternSceneProps> = ({scene, accentColor}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const seconds = durationInFrames / fps;
  // La cifra protagonista sale de `metric` si la escena la declara; si no, del
  // primer valor con su etiqueta. La unidad se recorta de la etiqueta ya
  // formateada ("618 B USD" → " B USD") para no perderla por el camino: una
  // cifra sin unidad es una cifra que el espectador no puede verificar.
  const fallbackValue = scene.values[0];
  const fallbackLabel = scene.valueLabels[0] ?? "";
  const value = scene.metric?.value ?? fallbackValue;
  const props = parseOrThrow(
    heroMetricSchema,
    {
      to: value,
      suffix:
        scene.metric?.suffix ??
        (fallbackLabel ? ` ${fallbackLabel.replace(/^[\d.,\s]+/, "")}`.trimEnd() : ""),
      label: scene.metric?.label ?? scene.labels[0],
      decimals: Number.isInteger(value) ? 0 : 2,
    },
    scene,
    "Toolkit-KineticNumber",
  );
  return (
    <ContentArea>
      <KineticNumber
        accentColor={accentColor}
        decimals={props.decimals}
        endSeconds={Math.min(2.8, Math.max(1.2, seconds * 0.42))}
        label={props.label}
        pulseAtSeconds={Math.min(3, Math.max(1.4, seconds * 0.46))}
        startSeconds={0.35}
        suffix={props.suffix}
        to={props.to}
      />
    </ContentArea>
  );
};

const barFocusSchema = z.object({
  data: z
    .array(z.object({label: z.string().min(1), value: z.number()}))
    .min(2)
    .max(8),
  highlightIndex: z.number().int().min(0),
});

const BarFocusScene: React.FC<PatternSceneProps> = ({scene, accentColor}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const seconds = durationInFrames / fps;
  const props = parseOrThrow(
    barFocusSchema,
    {
      data: numericItems(scene)
        .filter((item) => typeof item.value === "number")
        .slice(0, 8)
        .map((item) => ({label: item.label, value: item.value as number})),
      highlightIndex: 0,
    },
    scene,
    "Toolkit-RisingHistogram",
  );
  return (
    <ContentArea>
      <RisingHistogram
        accentColor={accentColor}
        data={props.data}
        endSeconds={Math.min(3.4, Math.max(1.6, seconds * 0.5))}
        height={520}
        highlightIndex={props.highlightIndex}
        startSeconds={0.3}
        unit={scene.metric?.suffix ?? "%"}
        width={1400}
      />
    </ContentArea>
  );
};

const lineTrendSchema = z.object({
  data: z
    .array(z.object({label: z.string(), value: z.number()}))
    .min(2)
    .max(500),
});

const LineTrendScene: React.FC<PatternSceneProps> = ({scene, accentColor}) => {
  const {durationInFrames, fps} = useVideoConfig();
  const seconds = durationInFrames / fps;
  const props = parseOrThrow(
    lineTrendSchema,
    {data: scene.chartData},
    scene,
    "Toolkit-LineChartZoom",
  );
  const focusIndex =
    scene.focusTarget === "primary"
      ? Math.round((props.data.length - 1) / 2)
      : props.data.length - 1;
  return (
    <ContentArea>
      <LineChartZoom
        accentColor={accentColor}
        data={props.data}
        endSeconds={Math.min(3.6, Math.max(1.8, seconds * 0.46))}
        focusIndex={focusIndex}
        height={600}
        startSeconds={0.25}
        unit={scene.metric?.suffix ?? ""}
        width={1520}
        zoomEndSeconds={Math.max(2.6, seconds * 0.72)}
        zoomStartSeconds={Math.max(2, seconds * 0.55)}
      />
    </ContentArea>
  );
};

// ---------------------------------------------------------------------------
// Scout — componentes internos del catálogo explorado.
// ---------------------------------------------------------------------------

const partToWholeSchema = z.object({
  value: z.number(),
  suffix: z.string(),
  centerLabel: z.string().min(1),
  orbitItems: z.array(z.object({label: z.string().min(1)})).min(2).max(8),
  sideCards: z
    .array(z.object({label: z.string().min(1), value: z.string().min(1)}))
    .max(3),
});

const PartToWholeScene: React.FC<PatternSceneProps> = ({
  scene,
  accentColor,
}) => {
  const items = numericItems(scene);
  const props = parseOrThrow(
    partToWholeSchema,
    {
      value: scene.metric?.value ?? scene.values[0],
      suffix: scene.metric?.suffix ?? "%",
      centerLabel: scene.metric?.label ?? scene.headline,
      orbitItems: items.slice(0, 8).map((item) => ({label: item.label})),
      sideCards: items
        .filter((item) => item.detail)
        .slice(0, 3)
        .map((item) => ({label: item.label, value: item.detail as string})),
    },
    scene,
    "Scout-RadialOrbitSummary",
  );
  return (
    <ContentArea>
      <RadialOrbitSummary accentColor={accentColor} {...props} />
    </ContentArea>
  );
};

const signalFlowSchema = z.object({
  nodes: z
    .array(
      z.object({
        states: z
          .array(z.object({label: z.string().min(1), caption: z.string()}))
          .min(1),
      }),
    )
    .min(2)
    .max(4),
});

const SignalFlowScene: React.FC<PatternSceneProps> = ({scene, accentColor}) => {
  const items = numericItems(scene);
  const props = parseOrThrow(
    signalFlowSchema,
    {
      nodes: items.slice(0, 4).map((item) => ({
        states: [
          {
            label: item.label,
            caption:
              item.detail ??
              (typeof item.value === "number"
                ? item.value.toLocaleString("es-ES")
                : ""),
          },
        ],
      })),
    },
    scene,
    "Scout-ConnectedCardChain",
  );
  return (
    <ContentArea>
      <ConnectedCardChain accentColor={accentColor} nodes={props.nodes} />
    </ContentArea>
  );
};

const scaleProportionSchema = z.object({
  rows: z.number().int().min(3).max(6),
  columns: z.number().int().min(4).max(10),
  activeCount: z.number().int().min(1),
  selectedIndex: z.number().int().min(0),
});

const ScaleProportionScene: React.FC<PatternSceneProps> = ({
  scene,
  accentColor,
}) => {
  const rows = 5;
  const columns = 10;
  // La matriz representa una proporción. Sin proporción declarada no hay nada
  // que representar: el adaptador falla en vez de rellenar una cifra plausible.
  const share =
    scene.metric && scene.metric.suffix.includes("%")
      ? scene.metric.value / 100
      : scene.values.length
        ? scene.values[0] / 100
        : Number.NaN;
  const props = parseOrThrow(
    scaleProportionSchema,
    {
      rows,
      columns,
      activeCount: Math.min(
        rows * columns,
        Math.round(share * rows * columns),
      ),
      selectedIndex: 0,
    },
    scene,
    "Scout-CapacityMatrix",
  );
  return (
    <ContentArea>
      <CapacityMatrix accentColor={accentColor} {...props} />
    </ContentArea>
  );
};

// ---------------------------------------------------------------------------
// Patrones extendidos — dibujan el cuadro completo, cabecera incluida.
// ---------------------------------------------------------------------------

const extendedItemsSchema = z
  .array(
    z.object({
      label: z.string().min(1),
      value: z.number().optional(),
      detail: z.string().optional(),
    }),
  )
  .min(2)
  .max(8);

const makeExtendedScene = (
  pattern: ExtendedPatternProps["pattern"],
  compositionId: string,
): React.FC<PatternSceneProps> => {
  const Adapted: React.FC<PatternSceneProps> = ({scene, accentColor}) => {
    const items = parseOrThrow(
      extendedItemsSchema,
      numericItems(scene).slice(0, 8),
      scene,
      compositionId,
    );
    const props = parseOrThrow(
      extendedPatternSchema,
      {
        pattern,
        format: "landscape",
        // El episodio es oscuro; `signal-cobalt` es el tema del catálogo que no
        // rompe la continuidad, y el acento sigue siendo el de la marca.
        themeId: "signal-cobalt",
        motionProfile: "editorial",
        title: scene.headline,
        supportingText: scene.supportingText,
        showHeader: true,
        primaryLabel: scene.labels[0] ?? "",
        secondaryLabel: scene.labels[1] ?? "",
        // El rótulo de conclusión solo se imprime si la escena trae una cifra o
        // una etiqueta de valor. Reutilizar `labels[0]` pondría el nombre de la
        // primera rama como si fuera el resultado: sería inventar la conclusión.
        callout: scene.metric
          ? `${scene.metric.value.toLocaleString("es-ES")}${scene.metric.suffix} · ${scene.metric.label}`
          : (scene.valueLabels[0] ?? ""),
        items,
        imagePath:
          scene.assets.find((asset) => asset.kind === "image")?.path ?? "",
        focalPoint: {x: 50, y: 50},
        accentColor,
        // La mezcla la decide el director (ANM-D04); el patrón no añade sonido.
        soundEnabled: false,
        soundMix: 0,
      },
      scene,
      compositionId,
    );
    return <ExtendedPatternScene {...props} />;
  };
  Adapted.displayName = `Extended-${pattern}`;
  return Adapted;
};

// ---------------------------------------------------------------------------
// Propagación radial — patrón extraído del componente monolítico.
// ---------------------------------------------------------------------------

const CONTAGION_TARGETS = [
  "FINANZAS",
  "INDUSTRIA",
  "CONSUMO",
  "SALUD",
  "ENERGÍA",
  "MERCADO",
];

const ContagionScene: React.FC<PatternSceneProps> = ({scene, accentColor}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spread = cuePulse(scene, "contagion", frame, fps);
  const reach = cuePulse(scene, "whole-market", frame, fps);
  const sources = scene.assets
    .filter((asset) => asset.kind === "logo")
    .slice(0, 4)
    .map((asset, index) => ({
      label: asset.label.toUpperCase(),
      logoPath: asset.path,
      focus: cuePulse(scene, `company-${asset.label.toLowerCase()}`, frame, fps),
      reveal: Math.min(
        1,
        Math.max(0, (frame / fps - (0.45 + index * 0.12)) / 0.55),
      ),
    }));
  const props = parseOrThrow(
    contagionSpreadSchema,
    {
      targets: CONTAGION_TARGETS,
      sources,
      spread,
      reach,
      spreadLabel: "CONTAGIO",
      reachLabel: "TODO EL MERCADO",
      showLabel: false,
      compactSources: true,
      sourcesTop: 225,
      accentColor,
    },
    scene,
    "Pattern-Contagion-Spread",
  );
  return (
    <>
      <ContagionSpread {...props} />
      <ContagionStateLabel
        reach={props.reach}
        reachLabel={props.reachLabel}
        spreadLabel={props.spreadLabel}
      />
    </>
  );
};

// ---------------------------------------------------------------------------

const LogoEcosystemScene: React.FC<PatternSceneProps> = ({
  scene,
  accentColor,
  logoPath,
}) => {
  const props = parseOrThrow(
    logoEcosystemSchema,
    {
      participants: scene.labels.slice(0, 8).map((label) => ({
        label,
        logoPath: scene.assets.find(
          (asset) =>
            asset.kind === "logo" &&
            asset.label.toLowerCase() === label.toLowerCase(),
        )?.path,
      })),
      coreLogoPath: logoPath,
      coreLabel: "",
      accentColor,
    },
    scene,
    "Pattern-Logo-Ecosystem",
  );
  return (
    <ContentArea>
      <LogoEcosystem {...props} />
    </ContentArea>
  );
};

const KineticPhraseScene: React.FC<PatternSceneProps> = ({
  scene,
  accentColor,
}) => {
  const props = parseOrThrow(
    kineticPhraseSchema,
    {
      phrase: scene.headline,
      resolution: scene.supportingText,
      accentColor,
    },
    scene,
    "Pattern-Kinetic-Phrase",
  );
  return <KineticPhrase {...props} />;
};

export const PATTERN_SCENES: Record<string, PatternRoute> = {
  "Pattern-Logo-Ecosystem": {ownsFrame: false, Component: LogoEcosystemScene},
  "Pattern-Kinetic-Phrase": {ownsFrame: true, Component: KineticPhraseScene},
  "Toolkit-KineticNumber": {ownsFrame: false, Component: HeroMetricScene},
  "Toolkit-RisingHistogram": {ownsFrame: false, Component: BarFocusScene},
  "Toolkit-LineChartZoom": {ownsFrame: false, Component: LineTrendScene},
  "Scout-RadialOrbitSummary": {ownsFrame: false, Component: PartToWholeScene},
  "Scout-ConnectedCardChain": {ownsFrame: false, Component: SignalFlowScene},
  "Scout-CapacityMatrix": {ownsFrame: false, Component: ScaleProportionScene},
  "Pattern-Common-Baseline": {
    ownsFrame: true,
    Component: makeExtendedScene("common-baseline", "Pattern-Common-Baseline"),
  },
  "Pattern-Timeline-Milestones": {
    ownsFrame: true,
    Component: makeExtendedScene(
      "timeline-milestones",
      "Pattern-Timeline-Milestones",
    ),
  },
  "Pattern-Ranking": {
    ownsFrame: true,
    Component: makeExtendedScene("ranking", "Pattern-Ranking"),
  },
  "Pattern-Accumulation": {
    ownsFrame: true,
    Component: makeExtendedScene("accumulation", "Pattern-Accumulation"),
  },
  "Pattern-Funnel-Filter": {
    ownsFrame: true,
    Component: makeExtendedScene("funnel-filter", "Pattern-Funnel-Filter"),
  },
  "Pattern-Branch-Merge": {
    ownsFrame: true,
    Component: makeExtendedScene("branch-merge", "Pattern-Branch-Merge"),
  },
  "Pattern-Contagion-Spread": {ownsFrame: false, Component: ContagionScene},
};

/**
 * La comprobación la dispara `SceneRegistry`, que es quien conoce las dos
 * mitades: las composiciones con adaptador y los `kind` que siguen en el camino
 * heredado.
 */
export const ROUTED_COMPOSITION_IDS = Object.keys(PATTERN_SCENES);
