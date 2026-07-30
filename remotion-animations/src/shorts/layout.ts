import {MotionTheme} from "../motion/DesignSystem";
import geometry from "./geometry.json";

export type ShortLayoutId = "full" | "split" | "stage";

/**
 * Geometria del short 9:16.
 *
 * Los numeros viven en `geometry.json` porque los comparte el validador de reglas
 * de Node (`src/modules/shorts-studio/rules`): la zona segura tiene que medirse
 * con la misma geometria con la que se dibuja, o el aviso no vale nada.
 *
 * `safeBottom` deja libre el ultimo 9% del alto porque la interfaz de Shorts y
 * Reels dibuja ahi el titulo, el avatar y los botones. Nada informativo debe
 * caer por debajo.
 *
 * `captionBottom` ancla el bloque de subtitulos por abajo para que crezca hacia
 * arriba y una pagina de dos o tres lineas no se cuele bajo la zona segura;
 * `captionHeight` es el alto disponible antes de chocar con el escenario.
 */
export const SHORT_LAYOUT = geometry;

/**
 * Ventana de video por layout.
 *
 * `full` es el clip a sangre para hooks y remates. `split` es el reparto por
 * defecto: cara arriba, escenario debajo. `stage` invierte la jerarquia y reduce
 * la cara a una tarjeta, y es el unico layout en el que cabe una captura de texto
 * densa a tamano legible.
 */
export const clipRect = (layout: ShortLayoutId) => geometry.clip[layout] ?? geometry.clip.split;

/** Zona de imagenes y rotulos por layout. */
export const stageRect = (layout: ShortLayoutId) => geometry.stage[layout] ?? geometry.stage.split;

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

const HEADER_HEIGHT = geometry.headerHeight;
const FOOTER_HEIGHT = geometry.footerHeight;
const PODIUM_GAP = geometry.podiumGap;

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
    case "overlay-center":
      return {
        left: stage.left,
        top: geometry.overlay[slot].top,
        width: stage.width,
        height: geometry.overlay[slot].height,
      };
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
