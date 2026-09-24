import {round} from '../../lib/utils.js';
import {mentions, resourceTokens, sharesText} from '../video-studio/asset-sourcing.js';
import {buildCaptionPages} from '../video-studio/captions.js';
import {partitionAtAnchors} from '../video-studio/shot-schedule.js';
import {createSoundRotation, resolveSoundCue} from '../video-studio/sound-families.js';
import {speechWindows} from '../video-studio/timeline.js';
import {CAMERA_MOVES, TRANSITIONS} from './constants.js';

/**
 * Planificador del montaje viral.
 *
 * El agente decide *donde* (palabras de enfasis, que asset va en que palabra, que
 * cifra se escribe en pantalla) y este modulo decide *cuanto*: reparte la locucion
 * en visuales dentro de la ventana de ritmo del perfil, asigna assets, alterna
 * movimientos de camara y transiciones, y pone un golpe de sonido en cada cambio.
 *
 * Es una funcion pura: recibe palabras, assets, plan, perfil y formato, y devuelve
 * el build del formato sin tocar disco. Asi el mismo plan compila 9:16 y 16:9.
 */

/** Rincones de encuadre para reutilizar un asset sin que parezca el mismo plano. */
const FOCUS_ROTATION = [
  {x: 0.5, y: 0.5}, {x: 0.35, y: 0.4}, {x: 0.65, y: 0.6}, {x: 0.5, y: 0.35}, {x: 0.4, y: 0.62}
];

/** Efecto de golpe que acompana a cada transicion, ademas de su movimiento propio. */
const TRANSITION_HIT = {glitch: 'glitch', flash: 'flash', 'zoom-blur': 'zoom-punch'};

const MAX_UPSCALE = 3;

const HIT_FRAMES = {flash: 10, 'rgb-split': 14, shake: 20, 'zoom-punch': 18, glitch: 14};

const UNIT_WORDS = new Map([
  ['%', '%'], ['euros', '€'], ['euro', '€'], ['dolares', '$'], ['dólares', '$'],
  ['millones', 'M'], ['billones', 'B'], ['puntos', 'pts'], ['años', 'años']
]);

const clean = (text) => String(text ?? '').replace(/^[¿¡"'«(]+|[.,;:!?"'»)]+$/g, '');
const fold = (text) => clean(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Ventana de la locucion que entra en la pieza, en segundos de la voz. */
export function montageWindow(words, voiceDurationSeconds, cut = {}) {
  if (!words?.length) throw new Error('La locucion no tiene palabras con tiempos.');
  const fromWord = Math.max(0, Number(cut.fromWord ?? 0));
  const toWord = Math.min(words.length - 1, Number(cut.toWord ?? words.length - 1));
  if (!(toWord >= fromWord)) throw new Error(`Recorte invalido: palabras ${fromWord}-${toWord}.`);
  const startSeconds = Math.max(0, words[fromWord].start - 0.06);
  const endSeconds = Math.min(voiceDurationSeconds ?? Infinity, words[toWord].end + 0.4);
  return {fromWord, toWord, startSeconds: round(startSeconds, 3), endSeconds: round(endSeconds, 3)};
}

/** Texto emergente automatico para una cifra: "5,2" + "%" -> "5,2 %". */
export function numberPop(words, index) {
  const text = clean(words[index]?.text);
  if (!/\d/.test(text)) return null;
  const next = fold(words[index + 1]?.text);
  const after = fold(words[index + 2]?.text);
  if (next === 'por' && after === 'ciento') return `${text} %`;
  const unit = UNIT_WORDS.get(next) ?? UNIT_WORDS.get(clean(words[index + 1]?.text));
  return unit ? `${text} ${unit}` : text;
}

function assetMatches(asset, text) {
  if (asset.text && sharesText(text, asset.text)) return true;
  const tokens = asset.tokens ?? resourceTokens(asset.name ?? asset.id);
  // Un nombre de fichero numerado ("03.jpg") no nombra nada: solo cuenta el orden.
  if (!tokens.some((token) => /[a-z]/.test(token))) return false;
  return mentions(text, tokens);
}

function coverScale(asset, format) {
  if (!asset.width || !asset.height) return 1;
  return Math.max(format.width / asset.width, format.height / asset.height);
}

/** `contain-blur` cuando recortar a pantalla completa se comeria el contenido. */
function chooseFit(asset, format, override) {
  if (override) return override;
  if (asset.fit === 'contain') return 'contain-blur';
  if (!asset.width || !asset.height) return 'cover';
  const assetAspect = asset.width / asset.height;
  const frameAspect = format.width / format.height;
  const mismatch = Math.max(assetAspect / frameAspect, frameAspect / assetAspect);
  return mismatch > 3.3 ? 'contain-blur' : 'cover';
}

/**
 * Keyframes del movimiento de camara, en fracciones del cuadro. El renderer los
 * interpola sin decidir nada. Los paneos se acotan para que el borde de la imagen
 * nunca entre en cuadro con el origen del zoom en `focus`.
 */
export function cameraKeys(move, {zoom, punchZoom, focus}) {
  const mid = round((zoom.min + zoom.max) / 2, 3);
  const panRange = (scale, f) => ({
    positive: round(0.85 * f * (scale - 1) / scale, 4),
    negative: round(-0.85 * (1 - f) * (scale - 1) / scale, 4)
  });
  const px = panRange(mid, focus.x);
  const py = panRange(mid, focus.y);
  switch (move) {
    case 'push-in':
      return [{t: 0, scale: zoom.min, x: 0, y: 0}, {t: 1, scale: zoom.max, x: 0, y: 0}];
    case 'pull-out':
      return [{t: 0, scale: zoom.max, x: 0, y: 0}, {t: 1, scale: zoom.min, x: 0, y: 0}];
    case 'pan-left':
      return [{t: 0, scale: mid, x: px.positive, y: 0}, {t: 1, scale: mid, x: px.negative, y: 0}];
    case 'pan-right':
      return [{t: 0, scale: mid, x: px.negative, y: 0}, {t: 1, scale: mid, x: px.positive, y: 0}];
    case 'tilt-up':
      return [{t: 0, scale: mid, x: 0, y: py.negative}, {t: 1, scale: mid, x: 0, y: py.positive}];
    case 'tilt-down':
      return [{t: 0, scale: mid, x: 0, y: py.positive}, {t: 1, scale: mid, x: 0, y: py.negative}];
    case 'punch':
      // Golpe seco al entrar y deriva lenta despues: el ojo lee el golpe, no el zoom.
      return [{t: 0, scale: zoom.min, x: 0, y: 0}, {t: 0.12, scale: punchZoom + 0.04, x: 0, y: 0},
        {t: 0.22, scale: punchZoom, x: 0, y: 0}, {t: 1, scale: punchZoom + 0.06, x: 0, y: 0}];
    case 'drift-shake':
      return [{t: 0, scale: mid, x: px.negative / 2, y: 0}, {t: 1, scale: round(mid + 0.04, 3), x: px.positive / 2, y: 0}];
    default:
      throw new Error(`Movimiento de camara desconocido: ${move}`);
  }
}

/** Siguiente elemento del patron que no repite el anterior. */
function rotate(pattern, index, previous) {
  for (let step = 0; step < pattern.length; step += 1) {
    const candidate = pattern[(index + step) % pattern.length];
    if (candidate !== previous) return candidate;
  }
  return pattern[index % pattern.length];
}

/**
 * @param {object} input
 * @param {{text:string,start:number,end:number}[]} input.words palabras de la locucion (segundos de la voz)
 * @param {number} input.voiceDurationSeconds duracion de la voz
 * @param {object[]} input.assets assets del manifest `{id, kind, src, width, height, durationSeconds, name, text, tokens, fit}`
 * @param {object} input.plan `montage-plan.json`
 * @param {object} input.profile perfil de `montage-profiles.json`
 * @param {{id,width,height,fps}} input.format formato del build
 * @param {object} input.geometry rectangulos del formato (`captionRect`, `popRect`)
 */
export function planMontage({words, voiceDurationSeconds, assets: allAssets, plan = {}, profile, format, geometry, musicAvailable = false}) {
  const warnings = [];
  // Una imagen que hay que ampliar mas de 3x para llenar el cuadro se ve pixelada:
  // un logo de 80 px no es material de pantalla completa.
  const assets = (allAssets ?? []).filter((asset) => {
    const tooSmall = asset.kind === 'image' && coverScale(asset, format) > MAX_UPSCALE;
    if (tooSmall) warnings.push(`El asset "${asset.id}" (${asset.width}x${asset.height}) es demasiado pequeno para ${format.id}; no entra en el montaje.`);
    return !tooSmall;
  });
  if (!assets.length) throw new Error('No hay assets utilizables: el montaje no puede tener huecos. Anade imagenes o videos a la carpeta de assets.');
  const {fps} = format;
  const window = montageWindow(words, voiceDurationSeconds, plan.cut);
  const totalFrames = Math.round((window.endSeconds - window.startSeconds) * fps);
  const toFrame = (seconds) => Math.round((seconds - window.startSeconds) * fps);
  const inside = words
    .map((word, index) => ({...word, index}))
    .filter((word) => word.index >= window.fromWord && word.index <= window.toWord);

  const overrides = new Map((plan.overrides ?? []).map((override) => [Number(override.atWord), override]));
  const emphasis = new Set((plan.emphasis ?? []).map(Number));
  for (const atWord of [...overrides.keys(), ...emphasis]) {
    if (!(atWord >= window.fromWord && atWord <= window.toWord)) {
      throw new Error(`atWord ${atWord} queda fuera del recorte ${window.fromWord}-${window.toWord}.`);
    }
  }

  // Anclas: el principio de cada palabra. La primera abre la pieza en el frame 0.
  const nodes = [];
  for (const word of inside) {
    const frame = nodes.length ? toFrame(word.start) : 0;
    if (frame >= totalFrames || nodes.at(-1)?.frame === frame) continue;
    nodes.push({frame, atWord: word.index, text: word.text});
  }
  const bias = (node) => (overrides.has(node.atWord) ? 50 : emphasis.has(node.atWord) ? 0.6 : 0);
  const segments = partitionAtAnchors(nodes, totalFrames, profile, fps, {bias});
  if (!segments) {
    throw new Error(
      `No se puede repartir la locucion en visuales de ${profile.minVisualSeconds}-${profile.maxVisualSeconds} s ` +
      'ancladas a palabras. Revisa el recorte o los tiempos de la transcripcion.'
    );
  }
  const cutWords = new Set(segments.map((segment) => segment.start.atWord));
  for (const atWord of overrides.keys()) {
    if (!cutWords.has(atWord)) {
      throw new Error(`El override en la palabra ${atWord} no cae en un corte: acercalo a otra palabra o cambia el perfil.`);
    }
  }

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const lastUse = new Map();
  const useCount = new Map();
  const videoCursor = new Map();
  const firstMentioned = new Set();
  // Reservados hasta su momento: los que fija un override y los que la locucion nombra
  // mas adelante. Gastarlos antes por rotacion les quitaria su sitio.
  const windowText = inside.map((word) => word.text).join(' ');
  const reserved = new Set([
    ...[...overrides.values()].map((override) => override.assetId).filter(Boolean),
    ...assets.filter((asset) => !asset.text && assetMatches(asset, windowText)).map((asset) => asset.id)
  ]);
  const sound = createSoundRotation();
  const soundCues = [];
  const hitEffects = [];
  const addSound = (family, frame, intensity = 1) => {
    const cue = resolveSoundCue(family, round(frame / fps, 3), intensity, sound(family));
    soundCues.push(cue);
    return {family, file: cue.file};
  };
  const addHit = (effect, fromFrame, intensity = 1) => {
    hitEffects.push({id: `hit-${String(hitEffects.length + 1).padStart(3, '0')}`, effect, intensity,
      fromFrame, durationInFrames: HIT_FRAMES[effect]});
  };

  const pickAsset = (text, frame) => {
    // 1. Un asset que la locucion nombra por primera vez entra donde se nombra.
    const named = assets.find((asset) => !firstMentioned.has(asset.id) && assetMatches(asset, text));
    if (named) {
      firstMentioned.add(named.id);
      reserved.delete(named.id);
      return {asset: named, reason: 'mention'};
    }
    // 2. Rotacion: el menos usado recientemente. Los nunca usados van en orden de carpeta.
    // Un asset que el plan reserva para una palabra no se gasta antes por rotacion.
    const gapFrames = profile.assetRepeatGapSeconds * fps;
    // Un logo solo entra cuando se nombra la marca: rotado sin contexto es ruido.
    const pool = assets.filter((asset) => !reserved.has(asset.id) && asset.role !== 'logo');
    const ranked = [...(pool.length ? pool : assets)].sort((a, b) => (lastUse.get(a.id) ?? -Infinity) - (lastUse.get(b.id) ?? -Infinity));
    const fresh = ranked.find((asset) => !lastUse.has(asset.id) || frame - lastUse.get(asset.id) >= gapFrames);
    return {asset: fresh ?? ranked[0], reason: fresh ? 'rotation' : 'repeat'};
  };

  const beats = [];
  let previousMove = null;
  let previousTransition = null;
  segments.forEach(({start, endFrame}, index) => {
    const override = overrides.get(start.atWord) ?? {};
    const durationInFrames = endFrame - start.frame;
    const spoken = inside
      .filter((word) => toFrame(word.start) >= start.frame && toFrame(word.start) < endFrame)
      .map((word) => word.text).join(' ');

    let picked;
    if (override.assetId) {
      const asset = assetsById.get(override.assetId);
      if (!asset) throw new Error(`El override en la palabra ${start.atWord} pide el asset "${override.assetId}", que no esta en el manifest.`);
      picked = {asset, reason: 'override'};
      firstMentioned.add(asset.id);
      reserved.delete(asset.id);
    } else {
      picked = pickAsset(spoken, start.frame);
    }
    const {asset} = picked;
    const uses = useCount.get(asset.id) ?? 0;
    useCount.set(asset.id, uses + 1);
    lastUse.set(asset.id, start.frame);

    const focus = override.focus ?? asset.focus ?? FOCUS_ROTATION[uses % FOCUS_ROTATION.length];
    const isEmphasis = emphasis.has(start.atWord);
    const move = override.camera ?? (isEmphasis ? 'punch' : rotate(profile.cameraPattern, index, previousMove));
    if (!CAMERA_MOVES.includes(move)) throw new Error(`Movimiento de camara desconocido en la palabra ${start.atWord}: ${move}`);
    const transition = index === 0 ? 'cut' : (override.transition ?? rotate(profile.transitionPattern, index, previousTransition));
    if (!TRANSITIONS.includes(transition)) throw new Error(`Transicion desconocida en la palabra ${start.atWord}: ${transition}`);
    previousMove = move;
    previousTransition = transition;

    let trimSeconds = 0;
    let loop = false;
    if (asset.kind === 'video') {
      const beatSeconds = durationInFrames / fps;
      const cursor = videoCursor.get(asset.id) ?? Number(asset.trimSeconds ?? 0);
      const available = Number(asset.durationSeconds ?? 0);
      trimSeconds = cursor + beatSeconds <= available ? cursor : 0;
      loop = available < beatSeconds;
      videoCursor.set(asset.id, round(trimSeconds + beatSeconds, 3));
    }

    const visual = {
      assetId: asset.id,
      src: asset.src,
      kind: asset.kind,
      width: asset.width ?? null,
      height: asset.height ?? null,
      durationSeconds: asset.durationSeconds ?? null,
      trimSeconds: round(trimSeconds, 3),
      loop,
      fit: chooseFit(asset, format, override.fit),
      focus,
      coverScale: round(coverScale(asset, format), 3),
      reason: picked.reason
    };
    const camera = {
      move,
      easing: move === 'punch' ? 'out-expo' : 'in-out-sine',
      shake: move === 'drift-shake' ? 1 : 0,
      keys: cameraKeys(move, {zoom: profile.zoom, punchZoom: profile.punchZoom, focus})
    };

    const sfx = [];
    const soundRequest = override.sound;
    if (soundRequest === false) {
      if (!override.soundNote) throw new Error(`La palabra ${start.atWord} pide silencio sin "soundNote" que lo justifique.`);
    } else if (index > 0 || soundRequest) {
      const family = soundRequest?.family ?? profile.transitionSound[transition];
      sfx.push(addSound(family, start.frame, Number(soundRequest?.intensity ?? 1)));
    }
    if (TRANSITION_HIT[transition]) addHit(TRANSITION_HIT[transition], start.frame, 0.8);
    if (isEmphasis) {
      sfx.push(addSound(profile.emphasisSound, start.frame, 1.1));
      addHit('shake', start.frame, 0.7);
    }

    beats.push({
      id: `beat-${String(index + 1).padStart(2, '0')}`,
      atWord: start.atWord,
      fromFrame: start.frame,
      durationInFrames,
      spokenText: spoken,
      emphasis: isEmphasis,
      visual,
      camera,
      transitionIn: {kind: transition, frames: profile.transitionFrames[transition] ?? 0},
      sfx,
      overlays: []
    });
  });
  for (const asset of assets) if (!useCount.has(asset.id)) warnings.push(`El asset "${asset.id}" no entra en ningun beat.`);

  // Textos emergentes: los del plan y, si el perfil lo pide, las cifras dichas.
  const pops = [];
  for (const pop of plan.textPops ?? []) pops.push({atWord: Number(pop.atWord), text: String(pop.text), source: 'plan'});
  for (const override of overrides.values()) {
    if (override.overlay?.text) pops.push({atWord: Number(override.atWord), text: String(override.overlay.text), kind: override.overlay.kind, source: 'plan'});
  }
  if (profile.textPops.autoNumbers) {
    for (const word of inside) {
      const text = numberPop(words, word.index);
      if (text && !pops.some((pop) => pop.atWord === word.index)) pops.push({atWord: word.index, text, kind: 'stat', source: 'auto'});
    }
  }
  const holdFrames = Math.round(profile.textPops.holdSeconds * fps);
  const minGapFrames = Math.round((10 / profile.textPops.maxPer10s) * fps);
  let lastPopFrame = -Infinity;
  pops.sort((a, b) => a.atWord - b.atWord);
  for (const pop of pops) {
    const word = words[pop.atWord];
    if (!word || pop.atWord < window.fromWord || pop.atWord > window.toWord) {
      throw new Error(`El texto "${pop.text}" apunta a la palabra ${pop.atWord}, fuera del recorte.`);
    }
    const fromFrame = Math.max(0, toFrame(word.start));
    // Los automaticos ceden ante la densidad; los del plan son decision del agente.
    if (pop.source === 'auto' && fromFrame - lastPopFrame < minGapFrames) continue;
    lastPopFrame = fromFrame;
    const beat = [...beats].reverse().find((candidate) => candidate.fromFrame <= fromFrame);
    const cue = {
      id: `pop-${String(beats.reduce((n, b) => n + b.overlays.length, 0) + 1).padStart(3, '0')}`,
      kind: pop.kind === 'stat' ? 'stat' : 'pop',
      text: pop.text,
      atWord: pop.atWord,
      fromFrame,
      durationInFrames: Math.min(holdFrames, totalFrames - fromFrame),
      source: pop.source,
      sound: addSound(profile.popSound, fromFrame, 0.9)
    };
    beat.overlays.push(cue);
  }

  const captionPages = buildCaptionPages(inside, window, {
    mode: profile.captions.mode,
    maxWords: profile.captions.maxWords,
    maxPageChars: profile.captions.maxPageChars,
    strictMaxWords: true
  }).map((page, index, pages) => ({
    fromFrame: Math.round(page.startSeconds * fps),
    // El final se redondea como instante, no como duracion, y nunca pisa la pagina
    // siguiente: con dos redondeos independientes se solapaban un frame.
    durationInFrames: Math.max(1, Math.min(
      Math.round(page.endSeconds * fps),
      pages[index + 1] ? Math.round(pages[index + 1].startSeconds * fps) : Infinity
    ) - Math.round(page.startSeconds * fps)),
    ...(page.heroIndex !== undefined ? {heroIndex: page.heroIndex} : {}),
    words: page.words.map((word) => ({
      text: word.text,
      fromFrame: Math.round(word.start * fps),
      toFrame: Math.max(Math.round(word.start * fps) + 1, Math.round(word.end * fps))
    }))
  }));

  const duckGainDb = plan.music?.duckGainDb ?? profile.music.duckGainDb;
  return {
    window,
    durationInFrames: totalFrames,
    durationSeconds: round(totalFrames / fps, 3),
    beats,
    hitEffects: hitEffects.sort((a, b) => a.fromFrame - b.fromFrame),
    soundCues: soundCues.sort((a, b) => a.startSeconds - b.startSeconds),
    duckWindows: musicAvailable ? speechWindows(inside, window, 0, duckGainDb) : [],
    captions: {
      pages: captionPages,
      mode: profile.captions.mode,
      rect: geometry.captionRect,
      appearance: {
        uppercase: profile.captions.uppercase,
        baseFontSize: profile.captions.baseFontSize,
        activeColor: profile.captions.activeColor,
        outlineSize: 3,
        shadow: 4
      }
    },
    warnings
  };
}
