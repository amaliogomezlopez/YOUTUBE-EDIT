import "./index.css";
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
import {
  AhorrarLimitesV2,
  ahorrarLimitesV2Schema,
} from "./AhorrarLimitesV2";
import {
  AhorrarLimitesV3,
  ahorrarLimitesV3Schema,
} from "./AhorrarLimitesV3";
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

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
    </>
  );
};

const lineChartDemoProps: LineChartDemoProps = {
  title: "Gráfica de línea con foco",
  data: [
    {label: "ENE", value: 42},
    {label: "FEB", value: 51},
    {label: "MAR", value: 64},
    {label: "ABR", value: 72},
    {label: "MAY", value: 91},
  ],
  focusIndex: 4,
  accentColor: "#42C7F5",
  unit: "%",
};

const histogramDemoProps: HistogramDemoProps = {
  title: "Histograma proporcional",
  data: [
    {label: "A", value: 32},
    {label: "B", value: 54},
    {label: "C", value: 77},
    {label: "D", value: 91},
  ],
  highlightIndex: 3,
  accentColor: "#45E1A4",
  unit: "",
};

const kineticNumberDemoProps: KineticNumberDemoProps = {
  title: "Contador cinético",
  value: 90,
  accentColor: "#FFD43B",
  prefix: "",
  suffix: "%",
  decimals: 0,
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
      kicker: "Un harness configurable permite ajustar lo que acompaña a cada prompt.",
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
      kicker: "Una entrada de contexto puede resolver varias tareas relacionadas.",
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
      kicker: "Más de 30 empieza a introducir ruido: sintetiza lo imprescindible.",
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
      kicker: "Entrega la implementación y pide una revisión crítica desde cero.",
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

const overlayMetadata: CalculateMetadataFunction<
  ChartHighlightProps
> = () => ({
  defaultCodec: "prores",
  defaultVideoImageFormat: "png",
  defaultPixelFormat: "yuva444p10le",
  defaultProResProfile: "4444",
});
