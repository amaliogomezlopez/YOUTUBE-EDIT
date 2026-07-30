import {MotionTheme} from "../motion/DesignSystem";

export type ShortLayoutId = "full" | "split" | "stage";

/**
 * Geometria del short 9:16.
 *
 * `safeBottom` deja libre el ultimo 9% del alto porque la interfaz de Shorts y
 * Reels dibuja ahi el titulo, el avatar y los botones. Nada informativo debe
 * caer por debajo.
 */
export const SHORT_LAYOUT = {
  width: 1080,
  height: 1920,
  safeX: 64,
  safeTop: 96,
  safeBottom: 1748,
  /**
   * El bloque de subtitulos se ancla por abajo y crece hacia arriba, para que una
   * pagina de dos o tres lineas no se cuele por debajo de la zona segura.
   */
  captionBottom: {full: 1560, split: 1742, stage: 1742},
  /** Alto disponible antes de chocar con el escenario de cada layout. */
  captionHeight: {full: 430, split: 250, stage: 250},
} as const;

/**
 * Ventana de video por layout.
 *
 * `full` es el clip a sangre para hooks y remates. `split` es el reparto por
 * defecto: cara arriba, escenario debajo. `stage` invierte la jerarquia y reduce
 * la cara a una tarjeta, y es el unico layout en el que cabe una captura de texto
 * densa a tamano legible.
 */
export const clipRect = (layout: ShortLayoutId) => {
  switch (layout) {
    case "full":
      return {left: 0, top: 0, width: SHORT_LAYOUT.width, height: SHORT_LAYOUT.height, radius: 0};
    case "stage":
      return {left: SHORT_LAYOUT.safeX, top: 108, width: 392, height: 392, radius: 30};
    default:
      return {left: 0, top: 0, width: SHORT_LAYOUT.width, height: 960, radius: 0};
  }
};

/** Zona de imagenes y rotulos por layout. */
export const stageRect = (layout: ShortLayoutId) => {
  const left = SHORT_LAYOUT.safeX;
  const width = SHORT_LAYOUT.width - SHORT_LAYOUT.safeX * 2;
  if (layout === "stage") return {left, width, top: 552, height: 940};
  return {left, width, top: 988, height: 540};
};

export type ShortSlot =
  | "overlay-top"
  | "overlay-center"
  | "stage-full"
  | "stage-left"
  | "stage-right"
  | "stage-header"
  | "stage-footer"
  | "stage-badge"
  | "podium-1"
  | "podium-2"
  | "podium-3"
  | "podium-3-verdict";

export type SlotRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const HEADER_HEIGHT = 84;
const FOOTER_HEIGHT = 96;
const PODIUM_GAP = 22;

/**
 * Rectangulo de cada slot dentro del escenario del layout activo. Header y footer
 * recortan la zona central, y el podio reparte el ancho en tres columnas iguales,
 * de modo que dos cues en slots distintos nunca compiten por el mismo pixel.
 */
export const slotRect = (
  slot: ShortSlot,
  layout: ShortLayoutId = "split",
  podiumIndex = 0,
): SlotRect => {
  const stage = stageRect(layout);
  const bodyTop = stage.top + HEADER_HEIGHT;
  const bodyHeight = stage.height - HEADER_HEIGHT - FOOTER_HEIGHT;

  switch (slot) {
    case "overlay-top":
      return {left: stage.left, top: SHORT_LAYOUT.safeTop, width: stage.width, height: 320};
    case "overlay-center":
      return {left: stage.left, top: 700, width: stage.width, height: 420};
    case "stage-header":
      return {left: stage.left, top: stage.top, width: stage.width, height: HEADER_HEIGHT};
    case "stage-footer":
      return {
        left: stage.left,
        top: stage.top + stage.height - FOOTER_HEIGHT,
        width: stage.width,
        height: FOOTER_HEIGHT,
      };
    case "stage-full":
      return {left: stage.left, top: bodyTop, width: stage.width, height: bodyHeight};
    case "stage-left":
      return {left: stage.left, top: bodyTop, width: (stage.width - PODIUM_GAP) / 2, height: bodyHeight};
    case "stage-right":
      return {
        left: stage.left + (stage.width + PODIUM_GAP) / 2,
        top: bodyTop,
        width: (stage.width - PODIUM_GAP) / 2,
        height: bodyHeight,
      };
    case "stage-badge":
      return {left: stage.left + stage.width - 168, top: bodyTop + 8, width: 160, height: 160};
    case "podium-1":
    case "podium-2":
    case "podium-3":
    case "podium-3-verdict": {
      const columnWidth = (stage.width - PODIUM_GAP * 2) / 3;
      const index = slot === "podium-3-verdict" ? 2 : podiumIndex;
      const left = stage.left + (columnWidth + PODIUM_GAP) * index;
      if (slot === "podium-3-verdict") {
        return {left, top: bodyTop + bodyHeight - 70, width: columnWidth, height: 70};
      }
      return {left, top: bodyTop, width: columnWidth, height: bodyHeight};
    }
    default:
      return {left: stage.left, top: bodyTop, width: stage.width, height: bodyHeight};
  }
};

export const podiumIndexForSlot = (slot: string): number => {
  if (slot === "podium-1") return 0;
  if (slot === "podium-2") return 1;
  if (slot === "podium-3") return 2;
  return 0;
};

export type CueTone = "neutral" | "accent" | "warning" | "danger" | "positive";

export const toneColor = (tone: CueTone, theme: MotionTheme, accent: string, danger: string) => {
  switch (tone) {
    case "accent":
      return accent;
    case "warning":
      return "#F5B544";
    case "danger":
      return danger;
    case "positive":
      return theme.positive;
    default:
      return theme.ink;
  }
};
