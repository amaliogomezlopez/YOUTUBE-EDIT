import assert from "node:assert/strict";
import test from "node:test";
import {
  createLinePath,
  dateFraction,
  exactSeriesDatum,
  interpolateIsoDate,
  interpolateSeriesValue,
  mapDateToX,
  mapSeriesToPoints,
  mapValueToY,
  nearestSeriesDatum,
  percentageChange,
} from "../remotion-animations/src/charts/chart-geometry.mjs";

const xAxis = {start: "2025-01-01", end: "2025-12-31"};
const yAxis = {min: 90, max: 130};
const plotRegion = {x: 100, y: 50, width: 1400, height: 600};
const series = [
  {date: "2025-01-01", value: 100},
  {date: "2025-07-02", value: 120},
  {date: "2025-12-31", value: 110},
];

test("calibra fechas y valores sobre el rectángulo de la gráfica", () => {
  assert.equal(mapDateToX("2025-01-01", xAxis, plotRegion), 100);
  assert.equal(mapDateToX("2025-12-31", xAxis, plotRegion), 1500);
  assert.equal(mapValueToY(130, yAxis, plotRegion), 50);
  assert.equal(mapValueToY(90, yAxis, plotRegion), 650);
  assert.equal(dateFraction("2025-07-02", xAxis), 0.5);
});

test("interpola dentro de la serie sin extrapolar fuera de la evidencia", () => {
  assert.equal(interpolateIsoDate("2025-01-01", "2025-12-31", 0.5), "2025-07-02");
  assert.equal(interpolateSeriesValue(series, "2025-04-02"), 110);
  assert.throws(
    () => interpolateSeriesValue(series, "2024-12-01"),
    /fuera de la serie observada/,
  );
  assert.throws(
    () => interpolateSeriesValue(series, "2026-01-01"),
    /fuera de la serie observada/,
  );
});

test("distingue datos observados de posiciones interpoladas", () => {
  assert.equal(nearestSeriesDatum(series, "2025-04-02").date, "2025-01-01");
  assert.equal(nearestSeriesDatum(series, "2025-05-20").date, "2025-07-02");
  assert.equal(exactSeriesDatum(series, "2025-07-02").value, 120);
  assert.throws(
    () => exactSeriesDatum(series, "2025-07-01"),
    /no es un dato observado/,
  );
});

test("transforma la serie en puntos y genera un path determinista", () => {
  const points = mapSeriesToPoints(series, xAxis, yAxis, plotRegion);
  assert.equal(points.length, 3);
  assert.equal(points[0].x, 100);
  assert.equal(points[0].y, 500);
  assert.match(createLinePath(points), /^M 100 500 L /);
});

test("calcula variaciones y rechaza calibraciones imposibles", () => {
  assert.equal(percentageChange(100, 92), -8);
  assert.throws(
    () => mapValueToY(100, {min: 100, max: 100}, plotRegion),
    /mayor/,
  );
  assert.throws(
    () =>
      mapDateToX(
        "2025-06-01",
        {start: "2025-12-31", end: "2025-01-01"},
        plotRegion,
      ),
    /posterior/,
  );
});
