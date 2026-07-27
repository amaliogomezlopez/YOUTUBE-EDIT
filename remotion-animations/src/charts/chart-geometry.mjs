const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const assertFiniteNumber = (value, label) => {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número finito.`);
  }
  return value;
};

export const clamp01 = (value) => Math.max(0, Math.min(1, value));

export const parseIsoDate = (value) => {
  const match = ISO_DATE.exec(String(value ?? ""));
  if (!match) {
    throw new Error(`Fecha ISO no válida: ${value}`);
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Fecha ISO no válida: ${value}`);
  }
  return timestamp;
};

export const dateFraction = (date, axis) => {
  const start = parseIsoDate(axis.start);
  const end = parseIsoDate(axis.end);
  if (end <= start) {
    throw new Error("El final del eje temporal debe ser posterior al inicio.");
  }
  return clamp01((parseIsoDate(date) - start) / (end - start));
};

export const valueFraction = (value, axis) => {
  const min = assertFiniteNumber(axis.min, "yAxis.min");
  const max = assertFiniteNumber(axis.max, "yAxis.max");
  if (max <= min) {
    throw new Error("yAxis.max debe ser mayor que yAxis.min.");
  }
  return clamp01((assertFiniteNumber(value, "value") - min) / (max - min));
};

export const mapDateToX = (date, axis, plotRegion) =>
  assertFiniteNumber(plotRegion.x, "plotRegion.x") +
  dateFraction(date, axis) *
    assertFiniteNumber(plotRegion.width, "plotRegion.width");

export const mapValueToY = (value, axis, plotRegion) =>
  assertFiniteNumber(plotRegion.y, "plotRegion.y") +
  (1 - valueFraction(value, axis)) *
    assertFiniteNumber(plotRegion.height, "plotRegion.height");

export const mapChartPoint = (
  datum,
  xAxis,
  yAxis,
  plotRegion,
) => ({
  date: datum.date,
  value: assertFiniteNumber(datum.value, `Valor de ${datum.date}`),
  x: mapDateToX(datum.date, xAxis, plotRegion),
  y: mapValueToY(datum.value, yAxis, plotRegion),
});

export const normalizeSeries = (series) => {
  if (!Array.isArray(series) || series.length < 2) {
    throw new Error("La serie necesita al menos dos datos.");
  }
  const normalized = series
    .map((datum) => ({
      date: String(datum.date),
      value: assertFiniteNumber(datum.value, `Valor de ${datum.date}`),
      timestamp: parseIsoDate(datum.date),
    }))
    .sort((left, right) => left.timestamp - right.timestamp);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].timestamp === normalized[index].timestamp) {
      throw new Error(`Fecha duplicada en la serie: ${normalized[index].date}`);
    }
  }
  return normalized;
};

export const mapSeriesToPoints = (
  series,
  xAxis,
  yAxis,
  plotRegion,
) =>
  normalizeSeries(series).map((datum) =>
    mapChartPoint(datum, xAxis, yAxis, plotRegion),
  );

export const interpolateSeriesValue = (series, date) => {
  const normalized = normalizeSeries(series);
  const target = parseIsoDate(date);
  if (target < normalized[0].timestamp) {
    throw new Error(
      `La fecha ${date} queda fuera de la serie observada (${normalized[0].date} → ${normalized.at(-1).date}).`,
    );
  }
  if (target === normalized[0].timestamp) {
    return normalized[0].value;
  }
  const last = normalized[normalized.length - 1];
  if (target > last.timestamp) {
    throw new Error(
      `La fecha ${date} queda fuera de la serie observada (${normalized[0].date} → ${last.date}).`,
    );
  }
  if (target === last.timestamp) {
    return last.value;
  }

  for (let index = 1; index < normalized.length; index += 1) {
    const right = normalized[index];
    if (target <= right.timestamp) {
      const left = normalized[index - 1];
      const progress =
        (target - left.timestamp) / (right.timestamp - left.timestamp);
      return left.value + (right.value - left.value) * progress;
    }
  }
  return last.value;
};

export const nearestSeriesDatum = (series, date) => {
  const normalized = normalizeSeries(series);
  const target = parseIsoDate(date);
  if (
    target < normalized[0].timestamp ||
    target > normalized.at(-1).timestamp
  ) {
    throw new Error(
      `La fecha ${date} queda fuera de la serie observada (${normalized[0].date} → ${normalized.at(-1).date}).`,
    );
  }
  return normalized.reduce((nearest, datum) =>
    Math.abs(datum.timestamp - target) <
    Math.abs(nearest.timestamp - target)
      ? datum
      : nearest,
  );
};

export const exactSeriesDatum = (series, date) => {
  const target = parseIsoDate(date);
  const datum = normalizeSeries(series).find(
    (candidate) => candidate.timestamp === target,
  );
  if (!datum) {
    throw new Error(`La fecha ${date} no es un dato observado de la serie.`);
  }
  return datum;
};

export const interpolateIsoDate = (from, to, progress) => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  const timestamp = start + (end - start) * clamp01(progress);
  return new Date(timestamp).toISOString().slice(0, 10);
};

export const percentageChange = (fromValue, toValue) => {
  const from = assertFiniteNumber(fromValue, "Valor inicial");
  const to = assertFiniteNumber(toValue, "Valor final");
  if (from === 0) {
    throw new Error("No se puede calcular una variación desde cero.");
  }
  return ((to - from) / Math.abs(from)) * 100;
};

export const createLinePath = (points) => {
  if (!Array.isArray(points) || points.length < 2) {
    return "";
  }
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${assertFiniteNumber(
          point.x,
          "point.x",
        )} ${assertFiniteNumber(point.y, "point.y")}`,
    )
    .join(" ");
};
