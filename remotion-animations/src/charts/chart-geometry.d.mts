export type DateAxis = {
  start: string;
  end: string;
};

export type ValueAxis = {
  min: number;
  max: number;
};

export type PlotRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SeriesDatum = {
  date: string;
  value: number;
};

export type ChartPoint = SeriesDatum & {
  x: number;
  y: number;
};

export const clamp01: (value: number) => number;
export const parseIsoDate: (value: string) => number;
export const dateFraction: (date: string, axis: DateAxis) => number;
export const valueFraction: (value: number, axis: ValueAxis) => number;
export const mapDateToX: (
  date: string,
  axis: DateAxis,
  plotRegion: PlotRegion,
) => number;
export const mapValueToY: (
  value: number,
  axis: ValueAxis,
  plotRegion: PlotRegion,
) => number;
export const mapChartPoint: (
  datum: SeriesDatum,
  xAxis: DateAxis,
  yAxis: ValueAxis,
  plotRegion: PlotRegion,
) => ChartPoint;
export const normalizeSeries: (
  series: SeriesDatum[],
) => Array<SeriesDatum & {timestamp: number}>;
export const mapSeriesToPoints: (
  series: SeriesDatum[],
  xAxis: DateAxis,
  yAxis: ValueAxis,
  plotRegion: PlotRegion,
) => ChartPoint[];
export const interpolateSeriesValue: (
  series: SeriesDatum[],
  date: string,
) => number;
export const nearestSeriesDatum: (
  series: SeriesDatum[],
  date: string,
) => SeriesDatum & {timestamp: number};
export const exactSeriesDatum: (
  series: SeriesDatum[],
  date: string,
) => SeriesDatum & {timestamp: number};
export const interpolateIsoDate: (
  from: string,
  to: string,
  progress: number,
) => string;
export const percentageChange: (
  fromValue: number,
  toValue: number,
) => number;
export const createLinePath: (
  points: Array<{x: number; y: number}>,
) => string;
