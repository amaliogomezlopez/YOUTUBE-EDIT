import {MotionTheme} from "../motion/DesignSystem";
import geometry from "./geometry.json";

export type IntroLayoutId = "hero" | "hero-left" | "hero-right" | "frame" | "insert";
export type IntroDepth = "back" | "front";

/**
 * Geometria de la intro 16:9.
 *
 * Los numeros viven en `geometry.json` porque los comparte el validador de reglas
 * de Node (`src/modules/intro-studio/geometry.js`): la zona segura y la oclusion de
 * la cara tienen que medirse con la misma geometria con la que se dibuja.
 *
 * Los slots son rectangulos absolutos declarados, no aritmetica sobre el escenario.
 * En el short el reparto del podio esta replicado en `layout.ts` y en
 * `geometry.js`, y es el sitio donde las dos implementaciones pueden divergir; aqui
 * no hay nada que replicar.
 */
export const INTRO_LAYOUT = geometry;

/**
 * Ventana del sujeto por layout.
 *
 * `hero` es el clip a sangre. `hero-left` y `hero-right` lo dejan ocupando algo
 * mas de la mitad y liberan una columna: es el reparto que hace que un logo se lea
 * "detras" del sujeto sin necesitar mascara de persona, porque el arte cae en la
 * banda que el cuerpo no ocupa y la profundidad la da el desenfoque. `frame`
 * reduce el sujeto a una tarjeta y deja el fondo entero visible alrededor, que es
 * el layout con mas profundidad aparente. `insert` lo manda a una esquina cuando
 * manda el b-roll.
 */
export const subjectRect = (layout: IntroLayoutId) =>
  geometry.subject[layout] ?? geometry.subject.hero;

/** Zona util para arte de primer plano, por layout. */
export const stageRect = (layout: IntroLayoutId) =>
  geometry.stage[layout] ?? geometry.stage.hero;

export type IntroSlot = keyof typeof geometry.slots;

export type SlotRect = {left: number; top: number; width: number; height: number};

export const slotRect = (slot: string): SlotRect =>
  (geometry.slots as Record<string, SlotRect>)[slot] ?? geometry.slots.center;

/** Slots que solo tienen sentido detras del sujeto. */
export const BACK_SLOTS = new Set<string>(geometry.backSlots);

export type IntroTone = "neutral" | "accent" | "warning" | "danger" | "positive";

export const toneColor = (
  tone: IntroTone,
  theme: MotionTheme,
  accent: string,
  danger: string,
) => {
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
