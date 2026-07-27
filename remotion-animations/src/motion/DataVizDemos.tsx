import {zColor} from "@remotion/zod-types";
import {z} from "zod";
import {
  KineticNumber,
  LineChartZoom,
  MotionCanvas,
  RisingHistogram,
} from "./Toolkit";

const datumSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const lineChartDemoSchema = z.object({
  title: z.string(),
  showHeader: z.boolean().optional(),
  data: z.array(datumSchema).min(2),
  focusIndex: z.number().int().min(0),
  accentColor: zColor(),
  unit: z.string(),
});

export type LineChartDemoProps = z.infer<typeof lineChartDemoSchema>;

export const LineChartZoomDemo: React.FC<LineChartDemoProps> = ({
  title,
  showHeader,
  data,
  focusIndex,
  accentColor,
  unit,
}) => (
  <MotionCanvas
    accentColor={accentColor}
    showHeader={showHeader}
    title={title}
  >
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100%",
        justifyContent: "center",
      }}
    >
      <LineChartZoom
        accentColor={accentColor}
        data={data}
        endSeconds={4.4}
        focusIndex={focusIndex}
        startSeconds={0.35}
        unit={unit}
        zoomEndSeconds={6.6}
        zoomStartSeconds={4.5}
      />
    </div>
  </MotionCanvas>
);

export const histogramDemoSchema = z.object({
  title: z.string(),
  showHeader: z.boolean().optional(),
  data: z.array(datumSchema).min(1),
  highlightIndex: z.number().int().min(0),
  accentColor: zColor(),
  unit: z.string(),
});

export type HistogramDemoProps = z.infer<typeof histogramDemoSchema>;

export const RisingHistogramDemo: React.FC<HistogramDemoProps> = ({
  title,
  showHeader,
  data,
  highlightIndex,
  accentColor,
  unit,
}) => (
  <MotionCanvas
    accentColor={accentColor}
    showHeader={showHeader}
    title={title}
  >
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100%",
        justifyContent: "center",
      }}
    >
      <RisingHistogram
        accentColor={accentColor}
        data={data}
        endSeconds={5.4}
        height={610}
        highlightIndex={highlightIndex}
        startSeconds={0.35}
        unit={unit}
        width={1260}
      />
    </div>
  </MotionCanvas>
);

export const kineticNumberDemoSchema = z.object({
  title: z.string(),
  showHeader: z.boolean().optional(),
  value: z.number(),
  accentColor: zColor(),
  prefix: z.string(),
  suffix: z.string(),
  decimals: z.number().int().min(0).max(3),
});

export type KineticNumberDemoProps = z.infer<typeof kineticNumberDemoSchema>;

export const KineticNumberDemo: React.FC<KineticNumberDemoProps> = ({
  title,
  showHeader,
  value,
  accentColor,
  prefix,
  suffix,
  decimals,
}) => (
  <MotionCanvas
    accentColor={accentColor}
    showHeader={showHeader}
    title={title}
  >
    <div
      style={{
        alignItems: "center",
        display: "flex",
        height: "100%",
        justifyContent: "center",
      }}
    >
      <KineticNumber
        accentColor={accentColor}
        decimals={decimals}
        endSeconds={4.8}
        fontSize={250}
        prefix={prefix}
        pulseAtSeconds={5.1}
        startSeconds={0.25}
        suffix={suffix}
        to={value}
      />
    </div>
  </MotionCanvas>
);
