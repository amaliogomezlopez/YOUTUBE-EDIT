import {Easing, interpolate} from "remotion";
import {clamp, rgba} from "../motion/Toolkit";

/**
 * Transicion `page-curl`: una hoja blanca que se levanta desde la esquina inferior
 * derecha y descubre la escena. Las transiciones de la intro solo ven la escena que
 * entra (no se solapan con la anterior), asi que la hoja es papel en blanco, como en
 * la referencia medida (Rourke Heath): la escena entrante aparece por detras del
 * pliegue.
 *
 * Geometria: el pliegue es la recta u = x/W + y/H = s, con s bajando de START (la
 * esquina ya levantada) a -BAND (hoja fuera). La escena se ve donde u >= s; el papel plano ocupa
 * u < s y la solapa doblada, la banda justo al otro lado del pliegue.
 */
const W = 1920;
const H = 1080;
const BAND = 0.26;
export const PAGE_CURL_FRAMES = 16;
/** La hoja ya arranca levantada desde la esquina: sin fotogramas en blanco entero. */
const START = 1.55;

type Point = [number, number];

type Plane = (x: number, y: number) => number;

/** Un poligono recortado por el semiplano f(x, y) >= 0 (f lineal: Sutherland-Hodgman). */
const clipBy = (points: Point[], f: Plane): Point[] => {
  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const fa = f(a[0], a[1]);
    const fb = f(b[0], b[1]);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const t = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
};

/** El cuadro recortado por varios semiplanos. */
const clipFrame = (...planes: Plane[]): Point[] =>
  planes.reduce<Point[]>((points, plane) => clipBy(points, plane), [[0, 0], [W, 0], [W, H], [0, H]]);

const polygon = (points: Point[]) =>
  points.length ? `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(", ")})` : "polygon(0 0, 0 0, 0 0)";

const u = (x: number, y: number) => x / W + y / H;

export const pageCurlFold = (frame: number) => {
  const progress = interpolate(frame, [0, PAGE_CURL_FRAMES], [0, 1], {...clamp, easing: Easing.out(Easing.quad)});
  return START - progress * (START + BAND);
};

/** Recorte de la escena entrante: solo lo ya descubierto por el pliegue. */
export const pageCurlClip = (frame: number): string => {
  if (frame >= PAGE_CURL_FRAMES) return "none";
  const s = pageCurlFold(frame);
  return polygon(clipFrame((x, y) => u(x, y) - s));
};

/** Hoja y solapa, por encima de la escena mientras dura la transicion. */
export const PageCurl: React.FC<{frame: number}> = ({frame}) => {
  if (frame >= PAGE_CURL_FRAMES) return null;
  const s = pageCurlFold(frame);
  const band = BAND * interpolate(frame, [0, PAGE_CURL_FRAMES], [0.6, 1], clamp);
  // Degradado a lo ancho de la solapa: direccion de u creciente en el convenio de
  // CSS (0deg = arriba) y paradas en el pliegue (u = s) y en el borde (u = s + band).
  const theta = Math.atan2(1 / W, -1 / H);
  const dir: Point = [Math.sin(theta), -Math.cos(theta)];
  const length = Math.abs(W * dir[0]) + Math.abs(H * dir[1]);
  const at = (value: number) => {
    const point: Point = [(W * value) / 2, (H * value) / 2];
    return (((point[0] - W / 2) * dir[0] + (point[1] - H / 2) * dir[1]) / length + 0.5) * 100;
  };
  const angle = (theta * 180) / Math.PI;
  const stops = `#FFFFFF ${at(s).toFixed(2)}%, #E8E7E3 ${at(s + band * 0.55).toFixed(2)}%, #C9C7C2 ${at(s + band).toFixed(2)}%`;
  const paper = polygon(clipFrame((x, y) => s - u(x, y)));
  const flap = polygon(clipFrame((x, y) => u(x, y) - s, (x, y) => s + band - u(x, y)));
  return (
    <>
      <div style={{position: "absolute", inset: 0, clipPath: paper, background: "#F6F5F2"}} />
      <div style={{position: "absolute", inset: 0, filter: `drop-shadow(-18px -14px 28px ${rgba("#000000", 0.45)})`}}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            clipPath: flap,
            background: `linear-gradient(${angle}deg, ${stops})`,
          }}
        />
      </div>
    </>
  );
};
