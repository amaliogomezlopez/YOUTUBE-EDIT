import {Easing, interpolate, random, useCurrentFrame} from "remotion";
import {clamp, rgba} from "../motion/Toolkit";
import {IntroEffectCue} from "./schemas";

/**
 * Efectos de montaje de intro.
 *
 * Son de otra familia que los del catalogo editorial: alli un efecto explica un
 * dato (revelar una barra, aislar un tramo de la curva) y aqui marca un golpe de
 * ritmo. Por eso no entran en `catalog/animations/effects.json`, que es un catalogo
 * con contrato de verdad grafica, y viven en su propia lista cerrada.
 *
 * Se reparten en dos mecanismos distintos segun lo que hagan:
 *
 * - Los que deforman la escena entera (temblor, golpe de zoom, aberracion, motion
 *   blur) salen por `sceneEffectStyle`, que devuelve el transform y el filter del
 *   contenedor de la escena.
 * - Los que anaden una capa encima (flash, fuga de luz, grano, lineas, viñeta,
 *   barras, glitch) los pinta `SceneEffects`.
 *
 * Todos duran poco a proposito: un golpe que se nota mas de medio segundo deja de
 * ser un golpe y se convierte en un estilo, y el ojo lo empieza a leer como ruido.
 */

const activeAt = (effect: IntroEffectCue, frame: number) =>
  frame >= effect.fromFrame && frame < effect.fromFrame + effect.durationInFrames;

/** Progreso local del efecto, 0 al entrar y 1 al terminar. */
const progressOf = (effect: IntroEffectCue, frame: number) =>
  interpolate(frame, [effect.fromFrame, effect.fromFrame + effect.durationInFrames], [0, 1], clamp);

/**
 * Envolvente de golpe: ataque casi instantaneo y caida. Es lo que diferencia un
 * impacto de una transicion; con una rampa simetrica el efecto se siente blando.
 */
const hit = (progress: number) =>
  interpolate(progress, [0, 0.12, 1], [0, 1, 0], {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });

export type SceneEffectStyle = {
  transform: string | undefined;
  filter: string | undefined;
  rgbSplitPx: number;
};

/** Deformaciones de la escena completa acumuladas en el frame actual. */
export const sceneEffectStyle = (
  effects: IntroEffectCue[],
  frame: number,
  sceneId: string,
): SceneEffectStyle => {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let blurPx = 0;
  let rgbSplitPx = 0;

  for (const effect of effects) {
    if (!activeAt(effect, frame)) continue;
    const amount = hit(progressOf(effect, frame)) * effect.intensity;
    switch (effect.effect) {
      case "shake": {
        // Ruido determinista por frame: dos semillas distintas para que el temblor
        // no siga una diagonal.
        translateX += (random(`${sceneId}-shake-x-${frame}`) - 0.5) * 28 * amount;
        translateY += (random(`${sceneId}-shake-y-${frame}`) - 0.5) * 20 * amount;
        break;
      }
      case "zoom-punch":
        scale += 0.09 * amount;
        break;
      case "speed-blur":
        blurPx += 9 * amount;
        scale += 0.03 * amount;
        break;
      case "glitch":
        // El glitch desplaza en bloques, no de forma continua: se cuantiza a saltos
        // de 6 px o se percibe como un temblor mas.
        translateX += Math.round(((random(`${sceneId}-glitch-${frame}`) - 0.5) * 40 * amount) / 6) * 6;
        rgbSplitPx += 10 * amount;
        break;
      case "rgb-split":
        rgbSplitPx += 14 * amount;
        break;
      default:
        break;
    }
  }

  const transform = scale === 1 && !translateX && !translateY
    ? undefined
    : `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  return {
    transform,
    filter: blurPx > 0.05 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
    rgbSplitPx,
  };
};

/**
 * Aberracion cromatica real, con un filtro SVG: se aislan los canales rojo y azul
 * con `feColorMatrix`, se desplazan en sentidos opuestos y se recomponen con
 * `screen`. Chromium lo evalua en el render, asi que no hace falta pintar el clip
 * tres veces.
 *
 * El desplazamiento se recalcula cada frame porque el SVG lo vuelve a emitir React;
 * un filtro CSS no puede leer una variable animada.
 */
export const RgbSplitFilter: React.FC<{id: string; offsetPx: number}> = ({id, offsetPx}) => (
  <svg height={0} style={{position: "absolute"}} width={0}>
    <defs>
      <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
        <feColorMatrix
          in="SourceGraphic"
          result="red"
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
        />
        <feColorMatrix
          in="SourceGraphic"
          result="cyan"
          type="matrix"
          values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
        />
        <feOffset dx={offsetPx} dy={0} in="red" result="redShifted" />
        <feOffset dx={-offsetPx} dy={0} in="cyan" result="cyanShifted" />
        <feBlend in="redShifted" in2="cyanShifted" mode="screen" />
      </filter>
    </defs>
  </svg>
);

/** Capas que se pintan encima de la escena. */
export const SceneEffects: React.FC<{
  effects: IntroEffectCue[];
  accent: string;
  width: number;
  height: number;
  sceneId: string;
}> = ({effects, accent, width, height, sceneId}) => {
  const frame = useCurrentFrame();
  const layers: React.ReactNode[] = [];

  for (const effect of effects) {
    if (!activeAt(effect, frame)) continue;
    const progress = progressOf(effect, frame);
    const amount = hit(progress) * effect.intensity;
    const base: React.CSSProperties = {
      position: "absolute",
      left: 0,
      top: 0,
      width,
      height,
      pointerEvents: "none",
    };

    switch (effect.effect) {
      case "flash":
        layers.push(
          <div
            key={effect.id}
            style={{
              ...base,
              background: "#FFFFFF",
              // El flash no llega a blanco puro: a plena opacidad el corte molesta y
              // en YouTube el reencoding lo convierte en un bloque sucio.
              opacity: Math.min(0.85, amount),
              mixBlendMode: "screen",
            }}
          />,
        );
        break;
      case "light-leak":
        layers.push(
          <div
            key={effect.id}
            style={{
              ...base,
              background:
                `radial-gradient(circle at ${18 + progress * 64}% 28%, ` +
                `${rgba(accent, 0.55 * amount)} 0%, ${rgba(accent, 0)} 46%)`,
              mixBlendMode: "screen",
            }}
          />,
        );
        break;
      case "grain":
        layers.push(
          <div key={effect.id} style={{...base, opacity: 0.16 * effect.intensity, mixBlendMode: "overlay"}}>
            <svg height={height} width={width}>
              <filter id={`${sceneId}-grain`}>
                {/* La semilla avanza con el frame: un grano fijo se lee como suciedad
                    en la lente en vez de como grano de pelicula. */}
                <feTurbulence baseFrequency="0.9" numOctaves={2} seed={frame % 32} type="fractalNoise" />
              </filter>
              <rect filter={`url(#${sceneId}-grain)`} height={height} width={width} />
            </svg>
          </div>,
        );
        break;
      case "scanlines":
        layers.push(
          <div
            key={effect.id}
            style={{
              ...base,
              backgroundImage:
                `repeating-linear-gradient(to bottom, ${rgba("#000000", 0.34)} 0px, ` +
                `${rgba("#000000", 0.34)} 1px, transparent 1px, transparent 4px)`,
              opacity: 0.7 * effect.intensity,
            }}
          />,
        );
        break;
      case "vignette-pulse":
        layers.push(
          <div
            key={effect.id}
            style={{
              ...base,
              background:
                `radial-gradient(ellipse at center, transparent 42%, ` +
                `${rgba("#000000", 0.28 + 0.34 * amount)} 100%)`,
            }}
          />,
        );
        break;
      case "letterbox-snap": {
        const barHeight = Math.round(height * 0.11 * Math.min(1, progress * 4));
        layers.push(
          <div key={effect.id} style={base}>
            <div style={{position: "absolute", left: 0, top: 0, width, height: barHeight, background: "#000000"}} />
            <div style={{position: "absolute", left: 0, bottom: 0, width, height: barHeight, background: "#000000"}} />
          </div>,
        );
        break;
      }
      case "glitch": {
        // Tres franjas horizontales desplazadas: es el artefacto que el ojo asocia a
        // una senal rota, y con una sola no se lee.
        layers.push(
          <div key={effect.id} style={base}>
            {[0.22, 0.48, 0.71].map((position, index) => (
              <div
                key={position}
                style={{
                  position: "absolute",
                  left: (random(`${sceneId}-slice-${index}-${frame}`) - 0.5) * 90 * amount,
                  top: height * position,
                  width,
                  height: Math.max(2, height * 0.035),
                  background: rgba(accent, 0.35 * amount),
                  mixBlendMode: "screen",
                }}
              />
            ))}
          </div>,
        );
        break;
      }
      default:
        break;
    }
  }

  return <>{layers}</>;
};
