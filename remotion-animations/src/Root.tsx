import "./index.css";
import "./motion/fonts";
import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import {
  ChartHighlight,
  ChartHighlightProps,
  chartHighlightSchema,
  defaultChartHighlightProps,
} from "./ChartHighlight";
import {
  AhorrarLimitesAnimation,
  ahorrarLimitesSchema,
} from "./AhorrarLimites";
import { AhorrarLimitesV2, ahorrarLimitesV2Schema } from "./AhorrarLimitesV2";
import { AhorrarLimitesV3, ahorrarLimitesV3Schema } from "./AhorrarLimitesV3";
import { AhorrarLimitesV4, ahorrarLimitesV4Schema } from "./AhorrarLimitesV4";
import {
  HistogramDemoProps,
  KineticNumberDemo,
  KineticNumberDemoProps,
  LineChartDemoProps,
  LineChartZoomDemo,
  RisingHistogramDemo,
  histogramDemoSchema,
  kineticNumberDemoSchema,
  lineChartDemoSchema,
} from "./motion/DataVizDemos";
import {
  TextFocusJourneyDemo,
  TextFocusJourneyProps,
  TransversalEffectsDemo,
  TransversalEffectsDemoProps,
  textFocusJourneySchema,
  transversalEffectsDemoSchema,
} from "./motion/EffectsDemos";
import {
  CapacityMatrixDemo,
  ConnectedCardChainDemo,
  RadialOrbitSummaryDemo,
  capacityMatrixDemoProps,
  capacityMatrixDemoSchema,
  connectedCardChainDemoProps,
  connectedCardChainDemoSchema,
  radialOrbitDemoProps,
  radialOrbitDemoSchema,
} from "./motion/ScoutedPatternDemos";
import {
  DrawingCatalogGallery,
  IconCatalogGallery,
  drawingGallerySchema,
  iconGallerySchema,
} from "./visuals/VisualCatalogGallery";
import {
  AnnotatedChartSilent,
  AnnotatedChartWithAudio,
  annotatedChartSchema,
  defaultAnnotatedChartProps,
  documentaryAnnotatedChartProps,
  editorialAnnotatedChartProps,
  eventAnnotatedChartProps,
  imageOnlyAnnotatedChartProps,
  marketAnnotatedChartProps,
} from "./charts/AnnotatedChartScene";
import {
  ContextualPatternPreview,
  ExtendedPatternScene,
  ContextualPreviewProps,
  ExtendedPatternProps,
  contextualPreviewSchema,
  defaultContextualPreviewProps,
  defaultExtendedPatternProps,
  extendedPatternMetadata,
  extendedPatternSchema,
} from "./motion/ExtendedPatterns";
import {
  ContagionSpreadDemo,
  contagionSpreadDemoProps,
  contagionSpreadSchema,
} from "./motion/ContagionSpread";
import {
  KineticPhrase,
  kineticPhraseDemoProps,
  kineticPhraseSchema,
} from "./motion/KineticPhrase";
import {
  LogoEcosystem,
  logoEcosystemDemoProps,
  logoEcosystemSchema,
} from "./motion/LogoEcosystem";
import {
  EditorialEpisode,
  editorialEpisodeMetadata,
  editorialEpisodeSchema,
} from "./editorial/EditorialEpisode";
import {defaultEditorialEpisodeProps} from "./editorial/schemas";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Editorial-Episodes">
        <Composition
          id="Finance-Cavaliers-Episode"
          component={EditorialEpisode}
          durationInFrames={12 * 30}
          fps={30}
          width={1920}
          height={1080}
          schema={editorialEpisodeSchema}
          defaultProps={defaultEditorialEpisodeProps}
          calculateMetadata={editorialEpisodeMetadata}
        />
      </Folder>
      <Folder name="Graficas">
        <Composition
          id="ChartHighlight"
          component={ChartHighlight}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          schema={chartHighlightSchema}
          defaultProps={defaultChartHighlightProps}
        />
        <Composition
          id="ChartHighlightOverlay"
          component={ChartHighlight}
          durationInFrames={150}
          fps={30}
          width={1920}
          height={1080}
          schema={chartHighlightSchema}
          defaultProps={{
            ...defaultChartHighlightProps,
            transparent: true,
          }}
          calculateMetadata={overlayMetadata}
        />
        <Composition
          id="Chart-Annotated-Range"
          component={AnnotatedChartSilent}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={defaultAnnotatedChartProps}
        />
        <Composition
          id="Chart-Annotated-Range-Audio"
          component={AnnotatedChartWithAudio}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={{
            ...defaultAnnotatedChartProps,
            soundEnabled: true,
          }}
        />
        <Composition
          id="Chart-Annotated-Events"
          component={AnnotatedChartSilent}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={eventAnnotatedChartProps}
        />
        <Composition
          id="Chart-Annotated-Image-Only"
          component={AnnotatedChartSilent}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={imageOnlyAnnotatedChartProps}
        />
        <Composition
          id="Chart-Annotated-Editorial"
          component={AnnotatedChartSilent}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={editorialAnnotatedChartProps}
        />
        <Composition
          id="Chart-Annotated-Documentary"
          component={AnnotatedChartSilent}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={documentaryAnnotatedChartProps}
        />
        <Composition
          id="Chart-Annotated-Market"
          component={AnnotatedChartSilent}
          durationInFrames={9 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={annotatedChartSchema}
          defaultProps={marketAnnotatedChartProps}
        />
      </Folder>
      <Folder name="Toolkit-Reutilizable">
        <Composition
          id="Toolkit-LineChartZoom"
          component={LineChartZoomDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={lineChartDemoSchema}
          defaultProps={lineChartDemoProps}
        />
        <Composition
          id="Toolkit-RisingHistogram"
          component={RisingHistogramDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={histogramDemoSchema}
          defaultProps={histogramDemoProps}
        />
        <Composition
          id="Toolkit-KineticNumber"
          component={KineticNumberDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={kineticNumberDemoSchema}
          defaultProps={kineticNumberDemoProps}
        />
        <Composition
          id="Toolkit-TransversalEffects"
          component={TransversalEffectsDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={transversalEffectsDemoSchema}
          defaultProps={transversalEffectsDemoProps}
        />
        <Composition
          id="Toolkit-TransversalEffects-FinalZoom"
          component={TransversalEffectsDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={transversalEffectsDemoSchema}
          defaultProps={{
            ...transversalEffectsDemoProps,
            zoomMode: "final-punch",
          }}
        />
        <Composition
          id="Toolkit-TextFocusJourney"
          component={TextFocusJourneyDemo}
          durationInFrames={6 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={textFocusJourneySchema}
          defaultProps={textFocusJourneyProps}
        />
      </Folder>
      <Folder name="Scout-Catalog">
        <Composition
          id="Scout-RadialOrbitSummary"
          component={RadialOrbitSummaryDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={radialOrbitDemoSchema}
          defaultProps={radialOrbitDemoProps}
        />
        <Composition
          id="Scout-ConnectedCardChain"
          component={ConnectedCardChainDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={connectedCardChainDemoSchema}
          defaultProps={connectedCardChainDemoProps}
        />
        <Composition
          id="Scout-CapacityMatrix"
          component={CapacityMatrixDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={capacityMatrixDemoSchema}
          defaultProps={capacityMatrixDemoProps}
        />
      </Folder>
      <Folder name="Catalogo-Visual">
        <Composition
          id="Catalog-Icons-01"
          component={IconCatalogGallery}
          durationInFrames={180}
          fps={60}
          width={1920}
          height={1080}
          schema={iconGallerySchema}
          defaultProps={{page: 0}}
        />
        <Composition
          id="Catalog-Icons-02"
          component={IconCatalogGallery}
          durationInFrames={180}
          fps={60}
          width={1920}
          height={1080}
          schema={iconGallerySchema}
          defaultProps={{page: 1}}
        />
        <Composition
          id="Catalog-Drawings"
          component={DrawingCatalogGallery}
          durationInFrames={240}
          fps={60}
          width={1920}
          height={1080}
          schema={drawingGallerySchema}
          defaultProps={{showLabels: true}}
        />
      </Folder>
      <Folder name="Patrones-Extendidos">
        {extendedPatternCompositions.map((composition) => (
          <Composition
            key={composition.id}
            id={composition.id}
            component={ExtendedPatternScene}
            durationInFrames={8 * 60}
            fps={60}
            width={1920}
            height={1080}
            schema={extendedPatternSchema}
            defaultProps={composition.props}
            calculateMetadata={extendedPatternMetadata}
          />
        ))}
        <Composition
          id="Pattern-Logo-Ecosystem"
          component={LogoEcosystem}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={logoEcosystemSchema}
          defaultProps={logoEcosystemDemoProps}
        />
        <Composition
          id="Pattern-Kinetic-Phrase"
          component={KineticPhrase}
          durationInFrames={6 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={kineticPhraseSchema}
          defaultProps={kineticPhraseDemoProps}
        />
        <Composition
          id="Pattern-Contagion-Spread"
          component={ContagionSpreadDemo}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={contagionSpreadSchema}
          defaultProps={contagionSpreadDemoProps}
        />
        <Composition
          id="Review-Contextual-Pattern"
          component={ContextualPatternPreview}
          durationInFrames={8 * 60}
          fps={60}
          width={1920}
          height={1080}
          schema={contextualPreviewSchema}
          defaultProps={defaultContextualPreviewProps}
          calculateMetadata={
            extendedPatternMetadata as CalculateMetadataFunction<ContextualPreviewProps>
          }
        />
      </Folder>
      <Folder name="Ahorrar-Limites">
        {ahorrarLimitesCompositions.map((composition) => (
          <Composition
            key={composition.id}
            id={composition.id}
            component={AhorrarLimitesAnimation}
            durationInFrames={composition.durationSeconds * 60}
            fps={60}
            width={1920}
            height={1080}
            schema={ahorrarLimitesSchema}
            defaultProps={composition.props}
          />
        ))}
      </Folder>
      <Folder name="Ahorrar-Limites-V2">
        {ahorrarLimitesV2Compositions.map((composition) => (
          <Composition
            key={composition.id}
            id={composition.id}
            component={AhorrarLimitesV2}
            durationInFrames={composition.durationSeconds * 60}
            fps={60}
            width={1920}
            height={1080}
            schema={ahorrarLimitesV2Schema}
            defaultProps={composition.props}
          />
        ))}
      </Folder>
      <Folder name="Ahorrar-Limites-V3-Audio">
        {ahorrarLimitesV3Compositions.map((composition) => (
          <Composition
            key={composition.id}
            id={composition.id}
            component={AhorrarLimitesV3}
            durationInFrames={composition.durationSeconds * 60}
            fps={60}
            width={1920}
            height={1080}
            schema={ahorrarLimitesV3Schema}
            defaultProps={composition.props}
          />
        ))}
      </Folder>
      <Folder name="Ahorrar-Limites-V4">
        {ahorrarLimitesV4Compositions.map((composition) => (
          <Composition
            key={composition.id}
            id={composition.id}
            component={AhorrarLimitesV4}
            durationInFrames={composition.durationSeconds * 60}
            fps={60}
            width={1920}
            height={1080}
            schema={ahorrarLimitesV4Schema}
            defaultProps={composition.props}
          />
        ))}
      </Folder>
    </>
  );
};

const lineChartDemoProps: LineChartDemoProps = {
  title: "Gráfica de línea con foco",
  showHeader: true,
  data: [
    { label: "ENE", value: 42 },
    { label: "FEB", value: 51 },
    { label: "MAR", value: 64 },
    { label: "ABR", value: 72 },
    { label: "MAY", value: 91 },
  ],
  focusIndex: 4,
  accentColor: "#42C7F5",
  unit: "%",
};

const histogramDemoProps: HistogramDemoProps = {
  title: "Histograma proporcional",
  showHeader: true,
  data: [
    { label: "A", value: 32 },
    { label: "B", value: 54 },
    { label: "C", value: 77 },
    { label: "D", value: 91 },
  ],
  highlightIndex: 3,
  accentColor: "#45E1A4",
  unit: "",
};

const kineticNumberDemoProps: KineticNumberDemoProps = {
  title: "Contador cinético",
  showHeader: true,
  value: 90,
  accentColor: "#FFD43B",
  prefix: "",
  suffix: "%",
  decimals: 0,
};

const extendedPatternCompositions: {
  id: string;
  props: ExtendedPatternProps;
}[] = [
  {
    id: "Pattern-Screenshot-Spotlight",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "screenshot-spotlight",
      title: "La imagen ya contiene la prueba",
      callout: "TRAMO CLAVE",
    },
  },
  {
    id: "Pattern-Before-After-Wipe",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "before-after-wipe",
      themeId: "oxide-documentary",
      title: "El cambio se entiende sobre la misma referencia",
      supportingText: undefined,
      callout: "MISMO ENCUADRE",
    },
  },
  {
    id: "Pattern-Common-Baseline",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "common-baseline",
      themeId: "editorial-ivory",
      title: "Comparar exige una base común",
      supportingText: "La escala y el punto de partida permanecen fijos.",
      callout: "ESCALA COMPARABLE",
    },
  },
  {
    id: "Pattern-Timeline-Milestones",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "timeline-milestones",
      themeId: "signal-cobalt",
      title: "Cuatro hitos explican el recorrido",
      items: [
        {label: "SEÑAL", detail: "Detectar"},
        {label: "ANÁLISIS", detail: "Ordenar"},
        {label: "DECISIÓN", detail: "Priorizar"},
        {label: "RESULTADO", detail: "Medir"},
      ],
      callout: "SECUENCIA COMPLETA",
    },
  },
  {
    id: "Pattern-Ranking",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "ranking",
      title: "El orden importa más que el volumen",
      items: [
        {label: "Contexto", value: 92},
        {label: "Herramientas", value: 78},
        {label: "Memoria", value: 64},
        {label: "Formato", value: 52},
        {label: "Ruido", value: 31},
      ],
      callout: "PRIORIDAD EDITORIAL",
    },
  },
  {
    id: "Pattern-Accumulation",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "accumulation",
      motionProfile: "kinetic",
      title: "Cada turno añade contexto",
      supportingText: undefined,
      callout: "EL COSTE SE ACUMULA",
    },
  },
  {
    id: "Pattern-Funnel-Filter",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "funnel-filter",
      themeId: "signal-cobalt",
      title: "Filtrar antes de cargar",
      primaryLabel: "ENTRADA COMPLETA",
      callout: "SÓLO LO ÚTIL",
    },
  },
  {
    id: "Pattern-Branch-Merge",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "branch-merge",
      title: "Explorar en paralelo, consolidar una vez",
      items: [
        {label: "FUENTE A"},
        {label: "FUENTE B"},
        {label: "FUENTE C"},
        {label: "FUENTE D"},
      ],
      callout: "SÍNTESIS",
    },
  },
  {
    id: "Pattern-Photo-Parallax",
    props: {
      ...defaultExtendedPatternProps,
      pattern: "photo-parallax",
      themeId: "oxide-documentary",
      motionProfile: "cinematic",
      title: "",
      supportingText: undefined,
      showHeader: false,
      callout: "Una imagen puede respirar sin parecer una plantilla",
    },
  },
];

const transversalEffectsDemoProps: TransversalEffectsDemoProps = {
  longText: "La gráfica se construye antes de señalar la conclusión",
  shortText: "FOCO",
  accentColor: "#FFD43B",
  zoomScale: 1.72,
  zoomMode: "path-track",
};

const textFocusJourneyProps: TextFocusJourneyProps = {
  firstText: "La atención empieza en esta idea",
  secondText: "Después, la cámara acompaña la siguiente",
  accentColor: "#FFD43B",
  maxZoomScale: 1.3,
};

const ahorrarLimitesCompositions = [
  {
    id: "AL03-Input-90",
    durationSeconds: 8,
    props: {
      scene: "input-share",
      clipNumber: 3,
      title: "El 90% del consumo está en el input",
      kicker: "El agente gasta sobre todo al leer archivos y reunir contexto.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "AL06-Harness-Taller",
    durationSeconds: 8,
    props: {
      scene: "harness-workshop",
      clipNumber: 6,
      title: "El harness es el taller del modelo",
      kicker: "Herramientas e instrucciones condicionan el resultado.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "AL10-Claude-vs-Pi",
    durationSeconds: 8,
    props: {
      scene: "harness-compare",
      clipNumber: 10,
      title: "Mismo modelo, distinta carga de entrada",
      kicker:
        "Un harness configurable permite ajustar lo que acompaña a cada prompt.",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "AL13-Bola-Contexto",
    durationSeconds: 6,
    props: {
      scene: "context-snowball",
      clipNumber: 13,
      title: "El contexto crece como una bola de nieve",
      kicker: "Cada nuevo prompt arrastra más conversación anterior.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "AL17-Un-Prompt",
    durationSeconds: 8,
    props: {
      scene: "batch-prompts",
      clipNumber: 17,
      title: "Agrupa tareas en un solo prompt",
      kicker:
        "Una entrada de contexto puede resolver varias tareas relacionadas.",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "AL22-Skills-10-30",
    durationSeconds: 8,
    props: {
      scene: "skills-range",
      clipNumber: 22,
      title: "Entre 10 y 30 skills es un buen rango",
      kicker:
        "Más de 30 empieza a introducir ruido: sintetiza lo imprescindible.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "AL24-Chat-Nuevo",
    durationSeconds: 10,
    props: {
      scene: "fresh-chat",
      clipNumber: 24,
      title: "Cuando se atasca, abre un chat nuevo",
      kicker:
        "Entrega la implementación y pide una revisión crítica desde cero.",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "AL27-Subagentes",
    durationSeconds: 10,
    props: {
      scene: "subagents",
      clipNumber: 27,
      title: "Modelo potente arriba, subagentes eficientes abajo",
      kicker: "Para explorar y recopilar información, usa modelos ligeros.",
      accentColor: "#FFD43B",
    },
  },
] as const;

const ahorrarLimitesV2Compositions = [
  {
    id: "ALV2-03-Input-90",
    durationSeconds: 8,
    props: {
      scene: "input-share",
      clipNumber: 3,
      title: "El coste está en la entrada",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV2-06-Harness",
    durationSeconds: 8,
    props: {
      scene: "harness-workshop",
      clipNumber: 6,
      title: "El harness cambia el resultado",
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV2-10-Carga",
    durationSeconds: 8,
    props: {
      scene: "harness-compare",
      clipNumber: 10,
      title: "Mismo modelo. Distinta carga.",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "ALV2-13-Contexto",
    durationSeconds: 6,
    props: {
      scene: "context-snowball",
      clipNumber: 13,
      title: "El contexto se acumula",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV2-17-Un-Prompt",
    durationSeconds: 8,
    props: {
      scene: "batch-prompts",
      clipNumber: 17,
      title: "Una lectura. Varias tareas.",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "ALV2-22-Skills",
    durationSeconds: 8,
    props: {
      scene: "skills-range",
      clipNumber: 22,
      title: "El rango útil está entre 10 y 30",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV2-24-Chat-Nuevo",
    durationSeconds: 10,
    props: {
      scene: "fresh-chat",
      clipNumber: 24,
      title: "Si se atasca, empieza limpio",
      accentColor: "#45E1A4",
    },
  },
  {
    id: "ALV2-27-Subagentes",
    durationSeconds: 10,
    props: {
      scene: "subagents",
      clipNumber: 27,
      title: "Orquesta arriba. Ejecuta abajo.",
      accentColor: "#FFD43B",
    },
  },
] as const;

const ahorrarLimitesV3Compositions = ahorrarLimitesV2Compositions.map(
  (composition) => ({
    ...composition,
    id: composition.id.replace("ALV2", "ALV3A"),
    props: {
      ...composition.props,
      soundEnabled: true,
      soundMix: 0.65,
    },
  }),
);

const ahorrarLimitesV4Compositions = [
  {
    id: "ALV4-01-Coste",
    durationSeconds: 7,
    props: {
      scene: "rising-cost",
      clipNumber: 1,
      title: "El cuarto mensaje cuesta más que el primero",
      kicker: "Cada turno en el mismo chat dispara el consumo.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV4-09-Tokens",
    durationSeconds: 8,
    props: {
      scene: "token-breakdown",
      clipNumber: 9,
      title: "Miles de tokens antes de tu pregunta",
      kicker: "System prompt y herramientas consumen antes de responder.",
      showHeader: false,
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV4-12-Ventana",
    durationSeconds: 6,
    props: {
      scene: "context-window",
      clipNumber: 12,
      title: "La ventana de contexto se llena",
      kicker: "Cada prompt arrastra toda la conversación anterior.",
      showHeader: false,
      accentColor: "#45E1A4",
    },
  },
  {
    id: "ALV4-15-Atencion",
    durationSeconds: 8,
    props: {
      scene: "sparse-attention",
      clipNumber: 15,
      title: "Atención dispersa: índices en vez de releer todo",
      kicker: "El modelo busca la parte relevante con índices.",
      showHeader: false,
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV4-19-Skills",
    durationSeconds: 8,
    props: {
      scene: "three-skills",
      clipNumber: 19,
      title: "Una skill para cada cosa",
      kicker: "Servidores, arquitectura y rol del agente.",
      accentColor: "#FFD43B",
    },
  },
  {
    id: "ALV4-21-Markdown",
    durationSeconds: 9,
    props: {
      scene: "md-clutter",
      clipNumber: 21,
      title: "Los .md acumulan y contaminan el contexto",
      kicker: "Más tokens, peores resultados.",
      accentColor: "#FF6B78",
    },
  },
  {
    id: "ALV4-23-Bucle",
    durationSeconds: 8,
    props: {
      scene: "review-loop",
      clipNumber: 23,
      title: "El bucle de revisión que no termina",
      kicker: "Corregir en el mismo chat empeora el resultado.",
      accentColor: "#FF6B78",
    },
  },
  {
    id: "ALV4-26-Memoria",
    durationSeconds: 8,
    props: {
      scene: "memory-cost",
      clipNumber: 26,
      title: "La memoria guarda preferencias que no viajan entre repos",
      kicker: "Desactívala si trabajas en varios proyectos.",
      accentColor: "#42C7F5",
    },
  },
  {
    id: "ALV4-29-Pico",
    durationSeconds: 7,
    props: {
      scene: "off-peak",
      clipNumber: 29,
      title: "Fuera de horas pico, el límite estira más",
      kicker: "Trabaja en horas valle de tu proveedor.",
      accentColor: "#45E1A4",
    },
  },
] as const;

const overlayMetadata: CalculateMetadataFunction<ChartHighlightProps> = () => ({
  defaultCodec: "prores",
  defaultVideoImageFormat: "png",
  defaultPixelFormat: "yuva444p10le",
  defaultProResProfile: "4444",
});
