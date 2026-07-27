import {z} from "zod";

export const artDirectionSchema = z.enum([
  "editorial-report",
  "documentary-evidence",
  "diagrammatic-system",
  "market-data",
]);

export type ArtDirection = z.infer<typeof artDirectionSchema>;

export type ArtDirectionProfile = {
  id: ArtDirection;
  headerAlign: "center" | "left";
  headerMaxWidth: number;
  headerTop: number;
  contentTopWithHeader: number;
  headlineMaxSize: number;
  headlineMinSize: number;
  supportingMaxWidth: number;
  background: string;
  showGrid: boolean;
  chartFrame: "rule" | "evidence" | "none";
  labelStyle: "leader" | "evidence" | "terminal";
  sourceStyle: "rail" | "plate" | "ticker";
};

export const ART_DIRECTION_PROFILES: Record<
  ArtDirection,
  ArtDirectionProfile
> = {
  "editorial-report": {
    id: "editorial-report",
    headerAlign: "left",
    headerMaxWidth: 1040,
    headerTop: 54,
    contentTopWithHeader: 194,
    headlineMaxSize: 58,
    headlineMinSize: 38,
    supportingMaxWidth: 900,
    background:
      "linear-gradient(112deg, #07111F 0%, #0A1624 62%, #07111F 100%)",
    showGrid: false,
    chartFrame: "rule",
    labelStyle: "leader",
    sourceStyle: "rail",
  },
  "documentary-evidence": {
    id: "documentary-evidence",
    headerAlign: "left",
    headerMaxWidth: 920,
    headerTop: 46,
    contentTopWithHeader: 154,
    headlineMaxSize: 46,
    headlineMinSize: 34,
    supportingMaxWidth: 820,
    background: "#050A10",
    showGrid: false,
    chartFrame: "evidence",
    labelStyle: "evidence",
    sourceStyle: "plate",
  },
  "diagrammatic-system": {
    id: "diagrammatic-system",
    headerAlign: "center",
    headerMaxWidth: 1500,
    headerTop: 58,
    contentTopWithHeader: 188,
    headlineMaxSize: 56,
    headlineMinSize: 36,
    supportingMaxWidth: 1260,
    background: "#07111F",
    showGrid: false,
    chartFrame: "none",
    labelStyle: "evidence",
    sourceStyle: "plate",
  },
  "market-data": {
    id: "market-data",
    headerAlign: "left",
    headerMaxWidth: 1060,
    headerTop: 42,
    contentTopWithHeader: 158,
    headlineMaxSize: 48,
    headlineMinSize: 34,
    supportingMaxWidth: 940,
    background: "#06101A",
    showGrid: true,
    chartFrame: "none",
    labelStyle: "terminal",
    sourceStyle: "ticker",
  },
};

export const getArtDirectionProfile = (
  artDirection: ArtDirection = "diagrammatic-system",
) => ART_DIRECTION_PROFILES[artDirection];
