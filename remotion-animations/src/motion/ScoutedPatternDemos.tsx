import {zColor} from "@remotion/zod-types";
import {z} from "zod";
import {MotionCanvas} from "./Toolkit";
import {
  CapacityMatrix,
  ConnectedCardChain,
  RadialOrbitSummary,
} from "./ScoutedPatterns";

const radialOrbitItemSchema = z.object({
  label: z.string().min(1).max(16),
});

const radialSideCardSchema = z.object({
  label: z.string().min(1).max(22),
  value: z.string().min(1).max(18),
});

export const radialOrbitDemoSchema = z.object({
  title: z.string().min(1).max(58),
  supportingText: z.string().max(70),
  value: z.number().min(0).max(100),
  suffix: z.string().max(3),
  centerLabel: z.string().min(1).max(18),
  orbitItems: z.array(radialOrbitItemSchema).min(3).max(5),
  sideCards: z.array(radialSideCardSchema).min(1).max(2),
  accentColor: zColor(),
});

export type RadialOrbitDemoProps = z.infer<typeof radialOrbitDemoSchema>;

export const radialOrbitDemoProps: RadialOrbitDemoProps = {
  title: "Una parte activa todo el sistema",
  supportingText: "Demo parametrizable · datos ilustrativos",
  value: 68,
  suffix: "%",
  centerLabel: "PARTE ACTIVA",
  orbitItems: [
    {label: "Descubrir"},
    {label: "Comparar"},
    {label: "Abstraer"},
    {label: "Reutilizar"},
  ],
  sideCards: [
    {label: "MECÁNICA", value: "Órbita focal"},
    {label: "SALIDA", value: "Patrón reusable"},
  ],
  accentColor: "#FFD43B",
};

export const RadialOrbitSummaryDemo: React.FC<RadialOrbitDemoProps> = (
  props,
) => (
  <MotionCanvas
    accentColor={props.accentColor}
    supportingText={props.supportingText}
    title={props.title}
  >
    <RadialOrbitSummary
      accentColor={props.accentColor}
      centerLabel={props.centerLabel}
      orbitItems={props.orbitItems}
      sideCards={props.sideCards}
      suffix={props.suffix}
      value={props.value}
    />
  </MotionCanvas>
);

const chainStateSchema = z.object({
  label: z.string().min(1).max(18),
  caption: z.string().min(1).max(32),
});

const chainNodeSchema = z.object({
  states: z.array(chainStateSchema).min(1).max(3),
});

export const connectedCardChainDemoSchema = z.object({
  title: z.string().min(1).max(58),
  supportingText: z.string().max(70),
  nodes: z.array(chainNodeSchema).min(2).max(4),
  accentColor: zColor(),
});

export type ConnectedCardChainDemoProps = z.infer<
  typeof connectedCardChainDemoSchema
>;

export const connectedCardChainDemoProps: ConnectedCardChainDemoProps = {
  title: "De referencia a patrón reusable",
  supportingText: "El ancla permanece · el estado intermedio evoluciona",
  nodes: [
    {
      states: [{label: "Referencia", caption: "Vídeo local"}],
    },
    {
      states: [
        {label: "Observar", caption: "Cambios entre frames"},
        {label: "Comparar", caption: "Ritmo y continuidad"},
        {label: "Abstraer", caption: "Solo la mecánica"},
      ],
    },
    {
      states: [
        {label: "Patrón", caption: "Contrato visual"},
        {label: "Componente", caption: "Props editables"},
        {label: "Catálogo", caption: "Listo para Remotion"},
      ],
    },
  ],
  accentColor: "#45E1A4",
};

export const ConnectedCardChainDemo: React.FC<
  ConnectedCardChainDemoProps
> = (props) => (
  <MotionCanvas
    accentColor={props.accentColor}
    supportingText={props.supportingText}
    title={props.title}
  >
    <ConnectedCardChain
      accentColor={props.accentColor}
      nodes={props.nodes}
    />
  </MotionCanvas>
);

export const capacityMatrixDemoSchema = z.object({
  title: z.string().min(1).max(58),
  supportingText: z.string().max(70),
  rows: z.number().int().min(3).max(6),
  columns: z.number().int().min(4).max(10),
  activeCount: z.number().int().min(0),
  selectedIndex: z.number().int().min(0),
  accentColor: zColor(),
});

export type CapacityMatrixDemoProps = z.infer<
  typeof capacityMatrixDemoSchema
>;

export const capacityMatrixDemoProps: CapacityMatrixDemoProps = {
  title: "La escala se entiende sin inventar porcentajes",
  supportingText: "Densidad cualitativa · un único elemento en foco",
  rows: 5,
  columns: 8,
  activeCount: 29,
  selectedIndex: 28,
  accentColor: "#42C7F5",
};

export const CapacityMatrixDemo: React.FC<CapacityMatrixDemoProps> = (
  props,
) => (
  <MotionCanvas
    accentColor={props.accentColor}
    supportingText={props.supportingText}
    title={props.title}
  >
    <CapacityMatrix
      accentColor={props.accentColor}
      activeCount={props.activeCount}
      columns={props.columns}
      rows={props.rows}
      selectedIndex={props.selectedIndex}
    />
  </MotionCanvas>
);
