/**
 * Short vertical 9:16 a partir de una apertura viral ya montada.
 *
 * La apertura (intro-viral) ya ha decidido todo lo editorial: que se dice en cada
 * frase (`escaleta.json`, intenciones y palabras ancla), donde se corta
 * (`intro-plan.json`, recortes con jump cuts) y que recurso real se ensena. El short
 * no vuelve a decidirlo: traduce esas decisiones al vocabulario de shorts-studio, que
 * es el motor de los shorts sacados de video largo (karaoke verde, cara abajo con el
 * recurso arriba, logos con placa medida).
 *
 * Funcion pura: recibe lo leido de disco y devuelve `{plan, report}`. El orquestador
 * (`workflow.js`) la llama, escribe `short-plan.json` y compila con `shorts:build`.
 *
 * Tabla de traduccion (una fila por intencion de la escaleta):
 *
 *   gancho    full + punch-in; su `asset` entra como logo arriba (o como recurso
 *             arriba desde la palabra que lo nombra si es una foto)
 *   mostrar   talking-head: cara abajo, recurso arriba toda la escena
 *   remate    igual que mostrar, con golpe
 *   noticia   la escena se parte en la palabra que nombra el recurso: antes cara,
 *             despues recurso arriba (o captura en `stage` si es texto denso)
 *   cifra     split con la cifra en el escenario
 *   comparar  split con la segunda cifra y la primera como nota
 *   enfasis   full + punch-in
 *   frase     full con camara suave que rota
 *   agenda    full (la lista no se traslada: lo dice el subtitulo)
 *
 * Una captura densa (`captura: "titular"` o `insert: true` en asset-requests) va en
 * `stage`, el unico layout donde se lee (SH-R-020). Las palabras clave de la intro
 * no se trasladan: en vertical el subtitulo karaoke ya dice la frase y SH-R-030
 * prohibe repetirla; quedan en el informe para que el agente decida.
 */
import {isDarkArtOnAlpha, hasSolidDarkBackground} from '../video-studio/artwork.js';

export const SHORT_TRANSITIONS = new Set(['cut', 'fade', 'whip', 'slide-up', 'zoom-blur']);
export const SHORT_CAMERAS = new Set(['static', 'punch-in', 'push-out', 'drift-left', 'drift-right']);

/** Transicion de la intro -> transicion del short (el resto de la intro no existe en vertical). */
export const TRANSITION_MAP = {
  cut: 'cut', whip: 'whip', 'slide-up': 'slide-up', 'zoom-blur': 'zoom-blur', fade: 'fade',
  'flash-cut': 'cut', 'page-curl': 'slide-up', 'glitch-cut': 'whip'
};

/** Camara de la intro -> camara del short. */
export const CAMERA_MAP = {
  static: 'static', 'punch-in': 'punch-in', 'push-out': 'push-out', 'drift-left': 'drift-left',
  'drift-right': 'drift-right', 'snap-zoom': 'punch-in'
};

/** Camara suave para las frases sin golpe: rota para que dos seguidas no se parezcan. */
export const FRASE_CAMERAS = ['drift-right', 'push-out', 'drift-left'];

/** La cara ocupa menos de esto del ancho: es una grabacion de pantalla con webcam. */
export const SCREEN_TAKE_MAX_FACE_SHARE = 0.15;

/** Por debajo de esto un trozo de escena no merece su propio layout. */
export const MIN_PIECE_SECONDS = 0.8;

/** Logo del gancho: cuanto se queda arriba. */
export const HOOK_LOGO_HOLD_SECONDS = 2.2;

/** Duracion maxima recomendada para Shorts, Reels y TikTok sin perder alcance. */
export const TARGET_MAX_SECONDS = 60;

const round = (value, decimals = 3) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Recurso que es texto denso: solo se lee en `stage`. */
export function isDenseAsset(request) {
  return Boolean(request && (request.captura === 'titular' || request.insert === true || request.dense === true));
}

/**
 * Presentacion de un logo medida sobre su arte (SH-R-021/022 la validan). Un logo
 * oscuro o de color sobre alfa va en placa clara: sobre la tarjeta oscura del tema
 * queda un marco marron (Google, gemini-4-argon). Solo un logo casi blanco va en
 * tarjeta oscura, y uno con fondo negro solido se funde con `blend`.
 */
export function logoPresentation(art) {
  if (hasSolidDarkBackground(art)) return 'blend';
  if (isDarkArtOnAlpha(art)) return 'plate';
  return art && art.meanLuma > 0.75 ? 'card' : 'plate';
}

/**
 * Cifra del escenario. En la intro la cifra flota sola ("7") y la nota la explica
 * ("meses sin un Pro"); en vertical una cifra de un caracter se pierde, asi que la
 * unidad sube a la cifra: "7 MESES" / "sin un Pro".
 */
export function shortStat(text, note) {
  const value = String(text ?? '').trim();
  const rest = String(note ?? '').trim();
  if (value.length > 3 || !/^[\d.,+-]/.test(value) || !rest) return {text: value, note: rest || null};
  const [unit, ...tail] = rest.split(/\s+/);
  return {text: `${value} ${unit.toUpperCase()}`, note: tail.join(' ') || null};
}

/** Un asset es un logo (sobre alfa) y no una foto o portada a sangre. */
export function isLogoArt(art) {
  return Boolean(art && Number.isFinite(art.opaqueCoverage) && art.opaqueCoverage < 0.85);
}

/** Caja de la webcam alrededor de la cara en una grabacion de pantalla. */
export function webcamBoxFromFace(faceBox, clip) {
  const w = Math.min(clip.width, faceBox.w * 2.6);
  const h = Math.min(clip.height, faceBox.h * 2.1);
  const cx = faceBox.x + faceBox.w / 2;
  const cy = faceBox.y + faceBox.h / 2 + faceBox.h * 0.1;
  const x = Math.min(clip.width - w, Math.max(0, cx - w / 2));
  const y = Math.min(clip.height - h, Math.max(0, cy - h / 2));
  return {x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h)};
}

export function isScreenTake(clip) {
  return Boolean(clip?.faceBox && clip.width && clip.faceBox.w / clip.width < SCREEN_TAKE_MAX_FACE_SHARE);
}

/** Escena de la escaleta a la que pertenece un trozo del plan compilado de la intro. */
export function matchEscaletaScene(piece, escaleta, transcripts) {
  const candidates = (escaleta.scenes ?? []).filter((scene) => scene.clip === piece.clipId);
  const exact = candidates.find((scene) => scene.id === piece.id);
  if (exact) return exact;
  const words = transcripts[piece.clipId]?.words ?? [];
  const mid = ((piece.trim?.start ?? 0) + (piece.trim?.end ?? 0)) / 2;
  return candidates.find((scene) => {
    const from = words[scene.from];
    const to = words[scene.to];
    return from && to && mid >= from.start - 0.3 && mid <= to.end + 0.3;
  }) ?? candidates.find((scene) => piece.id?.startsWith(scene.id + '-')) ?? null;
}

/** Indices de palabra que empiezan dentro del recorte. */
function wordsIn(words, trim) {
  return words.filter((word) => word.start >= trim.start - 0.001 && word.start < trim.end);
}

/** Corta un recorte en el instante en que empieza una palabra (con 40 ms de margen). */
function splitTrim(trim, seconds) {
  const at = round(Math.max(trim.start, seconds - 0.04));
  return [{start: trim.start, end: at}, {start: at, end: trim.end}];
}

/**
 * Traduce la apertura al plan del short.
 *
 * @param {object} input
 * @param {object} input.escaleta    escaleta.json de intro-viral
 * @param {object} input.introPlan   intro-plan.json compilado (recortes reales)
 * @param {object} input.manifest    manifest de la intro (clips, assets, cara)
 * @param {object} input.transcripts {clipId: {words}}
 * @param {object} [input.requests]  asset-requests.json (para saber que es denso)
 * @param {object} [input.art]       {assetId: medidas de analyzeArtwork}
 * @param {object} [input.sounds]    {palette, metadata} de SONIDOS-REELS, o null
 * @param {object} [input.overrides] short.json del usuario: omit, scenes, title, accentColor, music
 */
export function introToShortPlan({escaleta, introPlan, manifest, transcripts, requests = null, art = {}, sounds = null, overrides = {}}) {
  const report = {scenes: 0, media: [], keywordsDropped: [], dropped: [], warnings: []};
  const clips = new Map(manifest.clips.map((clip) => [clip.id, clip]));
  const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const requestById = new Map((requests?.assets ?? []).map((request) => [request.id, request]));
  const omit = new Set(overrides.omit ?? []);
  const scenes = [];
  let fraseTurn = 0;
  let previousClip = null;

  for (const piece of introPlan.scenes ?? []) {
    const source = matchEscaletaScene(piece, escaleta, transcripts);
    const sceneId = piece.id;
    if (omit.has(sceneId) || (source && omit.has(source.id))) {
      report.dropped.push({scene: sceneId, reason: 'omitida en short.json'});
      continue;
    }
    const clip = clips.get(piece.clipId);
    const words = transcripts[piece.clipId]?.words ?? [];
    const trim = {start: round(piece.trim.start), end: round(piece.trim.end)};
    const inside = wordsIn(words, trim);
    const intent = source?.intent ?? 'frase';
    const screenTake = isScreenTake(clip);
    const transitionIn = TRANSITION_MAP[piece.transitionIn] ?? 'cut';
    const base = {
      id: sceneId,
      clipId: piece.clipId,
      intent,
      reason: `intro: ${intent}${source && source.id !== sceneId ? ` (${source.id})` : ''}`,
      transitionIn: scenes.length ? transitionIn : 'cut',
      trim,
      cues: []
    };
    // Sonido de la transicion: un corte dentro de la misma toma es seco; un salto de
    // toma suena a camara; el whoosh inverso de la intro se ancla por el final y aqui
    // sonaria despues del corte, asi que zoom-blur suena a whoosh.
    if (base.transitionIn === 'cut') {
      base.transitionSound = previousClip && previousClip !== piece.clipId ? 'camera' : false;
    } else if (base.transitionIn === 'zoom-blur') {
      base.transitionSound = 'whoosh';
    }
    previousClip = piece.clipId;
    if (source?.keyword?.text) report.keywordsDropped.push({scene: sceneId, text: source.keyword.text, note: source.keyword.note ?? null});

    if (screenTake) {
      // Grabacion de pantalla: la pantalla ya ensena el recurso. Webcam + pantalla.
      scenes.push({...base, layout: 'pip', webcamBox: webcamBoxFromFace(clip.faceBox, clip), camera: 'static'});
      const media = source?.broll ?? source?.asset?.id;
      if (media) report.dropped.push({scene: sceneId, reason: `recurso ${media} no se coloca: toma de pantalla, se ve la pantalla`});
      continue;
    }

    const mediaId = ['mostrar', 'remate'].includes(intent) ? source?.broll : ['noticia', 'gancho'].includes(intent) ? source?.asset?.id : null;
    const mediaWord = ['noticia', 'gancho'].includes(intent) ? source?.asset?.atWord : null;
    const asset = mediaId ? assets.get(mediaId) : null;
    if (mediaId && !asset) report.warnings.push(`${sceneId}: el recurso ${mediaId} no esta en el manifest de la intro`);

    // Gancho con logo: el logo entra arriba, sobre la cara a sangre.
    if (intent === 'gancho' && asset && isLogoArt(art[mediaId])) {
      const atWord = Number.isInteger(mediaWord) && inside.some((w) => w.index === mediaWord) ? mediaWord : inside[0]?.index;
      scenes.push({
        ...base, layout: 'full', camera: 'punch-in', cameraIntensity: 1.1,
        cues: Number.isInteger(atWord) ? [{
          type: 'logo', assetId: mediaId, atWord, slot: 'overlay-top', presentation: logoPresentation(art[mediaId]),
          holdSeconds: HOOK_LOGO_HOLD_SECONDS, sound: 'hit', soundIntensity: 1.05, note: 'logo del gancho de la intro'
        }] : []
      });
      report.media.push({scene: sceneId, asset: mediaId, as: 'logo'});
      continue;
    }

    if (asset) {
      const dense = isDenseAsset(requestById.get(mediaId));
      // Noticia y gancho: el recurso entra cuando se nombra, no antes.
      const nameWord = Number.isInteger(mediaWord) ? words[mediaWord] : null;
      let lead = null;
      let mediaTrim = trim;
      if (nameWord && nameWord.start - trim.start >= MIN_PIECE_SECONDS && trim.end - nameWord.start >= MIN_PIECE_SECONDS) {
        [lead, mediaTrim] = splitTrim(trim, nameWord.start).map((t) => ({start: t.start, end: t.end}));
      }
      if (lead) {
        scenes.push({...base, layout: 'full', camera: intent === 'gancho' ? 'punch-in' : 'static', trim: lead});
      }
      // Si hay tramo de cara antes, el recurso entra con su propia transicion (y su sonido por defecto).
      const mediaScene = lead
        ? {...base, id: `${sceneId}-recurso`, transitionIn: 'slide-up', trim: mediaTrim, cues: []}
        : {...base, cues: []};
      if (lead) delete mediaScene.transitionSound;
      const firstWord = wordsIn(words, mediaTrim)[0] ?? inside[0];
      if (!firstWord) {
        report.warnings.push(`${sceneId}: sin palabras en el recorte; el recurso ${mediaId} no se puede anclar`);
        scenes.push({...mediaScene, layout: 'full', camera: 'static'});
        continue;
      }
      // El recurso cubre la escena desde su primer fotograma: se ancla a la primera
      // palabra y se adelanta lo que haya de silencio antes de ella.
      const offsetSeconds = round(mediaTrim.start - firstWord.start + 0.002);
      if (dense) {
        scenes.push({
          ...mediaScene, layout: 'stage', camera: 'static',
          ...(source?.keyword?.note ? {label: String(source.keyword.note).toUpperCase().slice(0, 40)} : {}),
          cues: [{type: 'screenshot', assetId: mediaId, atWord: firstWord.index, offsetSeconds, slot: 'stage-full',
            presentation: 'plain', sound: 'reveal', note: `recurso de la intro (${intent})`}]
        });
        report.media.push({scene: mediaScene.id, asset: mediaId, as: 'captura en stage'});
        continue;
      }
      const sceneSeconds = mediaTrim.end - mediaTrim.start;
      const videoSeconds = asset.kind === 'video' ? Number(asset.durationSeconds) : Infinity;
      let holdSeconds = sceneSeconds;
      let tail = null;
      if (videoSeconds < sceneSeconds) {
        // El video de apoyo se acaba antes que la frase: el resto vuelve a la cara.
        holdSeconds = Math.max(0.5, Math.min(videoSeconds - 0.05, sceneSeconds - 0.25));
        const cut = round(mediaTrim.start + holdSeconds);
        tail = {start: cut, end: mediaTrim.end};
        mediaScene.trim = {start: mediaTrim.start, end: cut};
      }
      scenes.push({
        ...mediaScene, layout: 'talking-head', camera: 'static',
        cues: [{type: 'broll', assetId: mediaId, atWord: firstWord.index, offsetSeconds, slot: 'broll-panel',
          presentation: 'plain', dense: false, holdSeconds: round(holdSeconds), mediaFit: 'cover', mediaTransition: 'cut',
          sound: intent === 'remate' ? 'impact' : 'whoosh', note: `recurso de la intro (${intent})`}]
      });
      report.media.push({scene: mediaScene.id, asset: mediaId, as: asset.kind === 'video' ? 'video arriba' : 'imagen arriba'});
      if (tail) {
        scenes.push({...base, id: `${sceneId}-cara`, layout: 'full', camera: 'push-out', transitionIn: 'cut', transitionSound: false, trim: tail, cues: []});
      }
      continue;
    }

    if ((intent === 'cifra' && source?.stat) || (intent === 'comparar' && source?.pair?.length === 2)) {
      const stat = intent === 'cifra' ? source.stat : source.pair[1];
      const shown = intent === 'cifra'
        ? shortStat(stat.text, stat.note)
        : {text: String(stat.text), note: source.pair[1].note ?? `antes ${source.pair[0].text}`};
      const atWord = inside.some((w) => w.index === stat.atWord) ? stat.atWord : inside[0]?.index;
      scenes.push({
        ...base, layout: 'split', camera: 'punch-in', cameraIntensity: 0.8,
        cues: Number.isInteger(atWord) ? [{type: 'stat', atWord, slot: 'stage-full', text: shown.text, note: shown.note,
          tone: 'accent', sound: stat.money ? 'chime' : 'impact', soundIntensity: 1.1}] : []
      });
      report.media.push({scene: sceneId, asset: null, as: `cifra ${shown.text}`});
      continue;
    }

    if (intent === 'enfasis' || intent === 'gancho') {
      scenes.push({...base, layout: 'full', camera: 'punch-in', cameraIntensity: intent === 'gancho' ? 1.1 : 1});
      continue;
    }

    const camera = CAMERA_MAP[piece.camera] && piece.camera !== 'static' && piece.camera !== 'snap-zoom' && piece.camera !== 'punch-in'
      ? CAMERA_MAP[piece.camera]
      : FRASE_CAMERAS[fraseTurn++ % FRASE_CAMERAS.length];
    scenes.push({...base, layout: 'full', camera});
  }

  // Cambios que el usuario pide en short.json, escena a escena, encima de la traduccion.
  for (const [id, patch] of Object.entries(overrides.scenes ?? {})) {
    const scene = scenes.find((item) => item.id === id);
    if (!scene) {
      report.warnings.push(`short.json: la escena ${id} no existe en la traduccion`);
      continue;
    }
    Object.assign(scene, patch);
  }

  report.scenes = scenes.length;
  const plan = {
    slug: overrides.slug ?? escaleta.slug,
    title: overrides.title ?? escaleta.titular?.text ?? escaleta.slug,
    derivedFrom: {surface: 'intro', slug: escaleta.slug, workflow: 'intro-short'},
    themeId: 'oxide-documentary',
    accentColor: overrides.accentColor ?? '#43F56C',
    dangerColor: '#FF5C5C',
    backgroundImage: null,
    sound: {
      enabled: true,
      mix: 0.58,
      clipVolume: 1,
      duckGainDb: -9,
      ...(sounds?.palette ? {palette: sounds.palette, metadata: sounds.metadata} : {}),
      ...(overrides.music === false || !manifest.music?.file ? {} : {
        music: {assetId: 'music', volume: Number(overrides.music?.volume ?? 0.22), duckGainDb: Number(overrides.music?.duckGainDb ?? -10)}
      })
    },
    scenes
  };
  return {plan, report};
}

/** Familias del short que pueden sonar con la biblioteca del usuario. */
export const SHORT_SOUND_FAMILIES = ['whoosh', 'whip', 'camera', 'pop', 'reveal', 'impact', 'hit', 'tick', 'chime', 'ui'];

/**
 * Reduce la paleta de SONIDOS-REELS de la intro a las familias que pide el short. Las
 * familias ancladas por el final (whoosh inverso) se quedan fuera: el short coloca
 * cada sonido por su inicio.
 */
export function shortSoundPalette(userSounds) {
  if (!userSounds?.palette) return null;
  const anchored = new Set(Object.keys(userSounds.endAnchored ?? {}));
  const palette = {};
  const metadata = {};
  for (const family of SHORT_SOUND_FAMILIES) {
    const files = (userSounds.palette[family] ?? []).filter((file) => !anchored.has(file) && /^sfx\/[a-z0-9-]+[.]wav$/.test(file));
    if (!files.length) continue;
    palette[family] = files;
    for (const file of files) if (userSounds.metadata?.[file]) metadata[file] = userSounds.metadata[file];
  }
  return Object.keys(palette).length ? {palette, metadata} : null;
}
