/**
 * Escaleta de la apertura viral: lo que decide el agente, y su compilacion a
 * `intro-plan.json`.
 *
 * El reparto es el de AGENTS.md: el agente decide *donde* (que intencion tiene cada
 * frase, que palabra pesa, que se ensena y cuando) y el compilador decide *cuanto*
 * (cortes al beat, silencios, camara, transicion, sonido, retenciones) desde las
 * tablas cerradas de `decision-tables.json`. Un modelo pequeno solo tiene que
 * rellenar la escaleta con vocabulario cerrado; todo lo que la valida explica como
 * arreglarlo.
 */
import {readFileSync} from 'node:fs';
import {INTRO_FORMAT, SNAP_ZOOM_AT} from '../intro-studio/constants.js';
import {resolveTextStyle, textStyleIds} from '../intro-studio/text-styles.js';
import {resolveIntroProfile} from '../intro-studio/profiles.js';

const TABLES_URL = new URL('./decision-tables.json', import.meta.url);

export function loadDecisionTables() {
  return JSON.parse(readFileSync(TABLES_URL, 'utf8'));
}

const round3 = (value) => Math.round(value * 1000) / 1000;
const wordsOfText = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean);
const normalize = (word) => String(word).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const COLUMN_LAYOUTS = new Set(['hero-left', 'hero-right']);
const BROLL_LAYOUTS = new Set(['insert', 'frame', 'card-left', 'circle']);

// ---------------------------------------------------------------------------
// Frases: lo que se le ensena al agente y la base de la plantilla
// ---------------------------------------------------------------------------

/**
 * Parte una transcripcion en frases de ~2-4,5 s (la v3 aprobada promedia ~3,6 s por
 * escena). Primero separa donde no hay duda: un silencio de mas de
 * `jumpSilenceSeconds` (ahi el compilador hara jump cut) o un punto. Luego parte cada
 * tramo largo por su mayor pausa interna, con la coma como desempate, porque Whisper
 * apenas puntua y una locucion seguida casi no tiene pausas. Las frases de menos de
 * `minSeconds` se funden con la anterior.
 */
export function phrasesOf(words, {jumpSilenceSeconds = 0.4, minSeconds = 1.5, targetSeconds = 4.5} = {}) {
  if (!words.length) return [];
  const gapAfter = (i) => (words[i + 1]?.start ?? Infinity) - words[i].end;
  const span = (from, to) => words[to].end - words[from].start;
  const chunks = [];
  let from = 0;
  for (let i = 0; i < words.length; i++) {
    const last = i === words.length - 1;
    if (last || gapAfter(i) > jumpSilenceSeconds || (/[.!?…]$/.test(words[i].text) && span(from, i) >= minSeconds)) {
      chunks.push([from, i]);
      from = i + 1;
    }
  }
  const split = ([a, b]) => {
    if (span(a, b) <= targetSeconds) return [[a, b]];
    let best = -1;
    let bestScore = -Infinity;
    for (let k = a; k < b; k++) {
      if (span(a, k) < minSeconds || span(k + 1, b) < minSeconds) continue;
      const score = gapAfter(k) + (/[,;:]$/.test(words[k].text) ? 0.15 : 0) - Math.abs(span(a, k) - span(k + 1, b)) * 0.02;
      if (score > bestScore) { bestScore = score; best = k; }
    }
    return best < 0 ? [[a, b]] : [...split([a, best]), ...split([best + 1, b])];
  };
  const parts = chunks.flatMap(split);
  const merged = [];
  for (const part of parts) {
    const previous = merged.at(-1);
    if (previous && span(part[0], part[1]) < minSeconds) previous[1] = part[1];
    else merged.push([...part]);
  }
  return merged.map(([a, b]) => ({
    from: a, to: b,
    start: words[a].start, end: words[b].end,
    pauseAfter: Number.isFinite(gapAfter(b)) ? round3(gapAfter(b)) : null,
    text: words.slice(a, b + 1).map((word) => word.text).join(' ')
  }));
}

/** Transcripcion con indices de palabra, frase a frase, para que el agente ancle. */
export function transcriptMarkdown({manifest, transcripts, tables = loadDecisionTables()}) {
  const lines = [
    '# Transcripcion con indices de palabra',
    '',
    'Cada linea es una frase: `[desde-hasta]`, tiempos de la toma y cada palabra con su indice.',
    `‖ marca un silencio de mas de ${tables.cuts.jumpSilenceSeconds} s: ahi el compilador corta solo (jump cut).`,
    ''
  ];
  for (const clip of manifest.clips) {
    const words = transcripts[clip.id]?.words ?? [];
    lines.push(`## Toma ${clip.id} (${clip.sourceName}, ${clip.durationSeconds.toFixed(1)} s, ${words.length} palabras)`, '');
    for (const phrase of phrasesOf(words, {jumpSilenceSeconds: tables.cuts.jumpSilenceSeconds})) {
      const indexed = words.slice(phrase.from, phrase.to + 1).map((word) => `${word.index ?? words.indexOf(word)}:${word.text}`).join(' ');
      const pause = phrase.pauseAfter > tables.cuts.jumpSilenceSeconds ? ` ‖${phrase.pauseAfter.toFixed(1)}s` : '';
      lines.push(`- [${phrase.from}-${phrase.to}] ${phrase.start.toFixed(2)}-${phrase.end.toFixed(2)}s  ${indexed}${pause}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Escaleta inicial: una escena por frase, todas `frase` salvo la primera (`gancho`).
 * El agente solo cambia intenciones y anade palabra clave, recurso o cifra; la
 * cobertura de las tomas ya es correcta desde el principio.
 */
export function escaletaTemplate({slug, manifest, transcripts, tables = loadDecisionTables()}) {
  const scenes = [];
  for (const clip of manifest.clips) {
    const words = transcripts[clip.id]?.words ?? [];
    for (const phrase of phrasesOf(words, {jumpSilenceSeconds: tables.cuts.jumpSilenceSeconds})) {
      scenes.push({
        id: `t${clip.id}-${String(phrase.from).padStart(3, '0')}`,
        clip: clip.id,
        from: phrase.from,
        to: phrase.to,
        intent: scenes.length === 0 ? 'gancho' : 'frase',
        dice: phrase.text
      });
    }
  }
  return {
    version: 1,
    slug,
    accentColor: '#FFD60A',
    textStyle: 'anton-impacto',
    titular: null,
    note: 'Rellena intent (tabla de decision-tables.json), keyword, asset, broll, stat y hitWord. `dice` es solo referencia.',
    omit: [],
    scenes
  };
}

// ---------------------------------------------------------------------------
// Validacion
// ---------------------------------------------------------------------------

/**
 * Valida la escaleta contra las tablas, la transcripcion y los recursos ingeridos.
 * Devuelve errores (bloquean la puerta) y avisos (hay que leerlos). Cada mensaje dice
 * que escena falla y como se arregla.
 */
export function validateEscaleta(escaleta, {manifest, transcripts, tables = loadDecisionTables()}) {
  const errors = [];
  const warnings = [];
  const err = (where, message) => errors.push(`${where}: ${message}`);
  const warn = (where, message) => warnings.push(`${where}: ${message}`);

  if (!escaleta || !Array.isArray(escaleta.scenes) || !escaleta.scenes.length) {
    return {errors: ['escaleta: falta `scenes` (una lista de escenas)'], warnings};
  }
  if (!/^#[0-9a-f]{6}$/i.test(escaleta.accentColor ?? '')) {
    err('escaleta', '`accentColor` tiene que ser un color #RRGGBB (el color de la marca del tema)');
  }
  if (escaleta.textStyle !== undefined && escaleta.textStyle !== null && !textStyleIds().includes(escaleta.textStyle)) {
    err('escaleta', `textStyle "${escaleta.textStyle}" no existe (${textStyleIds().join(', ')})`);
  }
  const clips = new Map(manifest.clips.map((clip) => [clip.id, clip]));
  const assets = new Map((manifest.assets ?? []).map((asset) => [asset.id, asset]));
  const intents = tables.intents;
  const seen = new Set();
  let columns = 0;
  const remates = new Map();
  const counts = {};
  const agendas = new Map();

  const inRange = (value, scene) => Number.isInteger(value) && value >= scene.from && value <= scene.to;
  const checkMoney = (where, text, money) => {
    if (money === undefined) return;
    if (typeof money !== 'string' || !money.trim()) {
      err(where, '`money` tiene que ser el motivo en texto ("precio del plan Pro"), no true');
    } else if (!new RegExp(tables.money.pattern, 'i').test(text ?? '')) {
      err(where, `\`money\` solo vale para cifras de dinero con moneda (€, $…); "${text}" no la lleva`);
    }
  };

  for (const [index, scene] of escaleta.scenes.entries()) {
    const where = `escena ${index + 1} (${scene.id ?? 'sin id'})`;
    if (!scene.id || typeof scene.id !== 'string') err(where, 'falta `id` (texto corto y unico)');
    else if (seen.has(scene.id)) err(where, `id repetido "${scene.id}"`);
    seen.add(scene.id);
    const clip = clips.get(scene.clip);
    if (!clip) { err(where, `clip "${scene.clip}" no existe (tomas: ${[...clips.keys()].join(', ')})`); continue; }
    const words = transcripts[clip.id]?.words ?? [];
    if (!Number.isInteger(scene.from) || !Number.isInteger(scene.to) || scene.from < 0 || scene.to >= words.length || scene.from > scene.to) {
      err(where, `rango de palabras [${scene.from}-${scene.to}] invalido: la toma ${clip.id} tiene las palabras 0-${words.length - 1}`);
      continue;
    }
    const intent = intents[scene.intent];
    if (!intent) { err(where, `intent "${scene.intent}" no existe (${Object.keys(intents).join(', ')})`); continue; }
    if (scene.intent === 'gancho' && index !== 0) err(where, '`gancho` solo vale para la primera escena');
    if (index === 0 && scene.intent !== 'gancho') err(where, 'la primera escena tiene que ser `gancho`');

    const allowed = new Set([...intent.fields.required, ...intent.fields.optional]);
    for (const field of ['keyword', 'asset', 'broll', 'stat', 'hitWord', 'agenda', 'agendaPoint', 'pair', 'face']) {
      if (scene[field] !== undefined && scene[field] !== null && !allowed.has(field)) {
        err(where, `\`${field}\` no vale en una escena \`${scene.intent}\` (admite: ${[...allowed].join(', ') || 'nada'}). Cambia la intencion o quita el campo.`);
      }
    }
    for (const field of intent.fields.required) {
      if (scene[field] === undefined || scene[field] === null) err(where, `\`${scene.intent}\` exige \`${field}\``);
    }
    if (scene.hitWord !== undefined && !inRange(scene.hitWord, scene)) {
      err(where, `hitWord ${scene.hitWord} fuera de la escena [${scene.from}-${scene.to}]`);
    }

    if (scene.keyword) {
      const k = scene.keyword;
      const n = wordsOfText(k.text).length;
      if (n < tables.keyword.minWords || n > tables.keyword.maxWords) {
        err(where, `keyword "${k.text}" tiene ${n} palabras; la tabla admite ${tables.keyword.minWords}-${tables.keyword.maxWords}. Condensa la idea, no transcribas.`);
      }
      if (!inRange(k.atWord, scene)) err(where, `keyword.atWord ${k.atWord} fuera de la escena [${scene.from}-${scene.to}]`);
      for (const h of k.highlight ?? []) {
        if (!Number.isInteger(h) || h < 0 || h >= n) err(where, `keyword.highlight ${h} no es un indice de palabra de "${k.text}" (0-${n - 1})`);
      }
      checkMoney(`${where} keyword`, k.text, k.money);
      const spoken = new Set(words.slice(scene.from, scene.to + 1).map((word) => normalize(word.text)));
      const kw = wordsOfText(k.text).map(normalize).filter(Boolean);
      const overlap = kw.filter((word) => spoken.has(word)).length / Math.max(1, kw.length);
      if (kw.length >= 4 && overlap >= tables.keyword.transcriptionOverlap) {
        warn(where, `keyword "${k.text}" repite la locucion palabra por palabra; condensa o anade el dato que la voz no dice`);
      }
    }
    if (scene.asset) {
      const asset = assets.get(scene.asset.id);
      if (!asset) err(where, `asset "${scene.asset.id}" no esta ingerido (recursos: ${[...assets.keys()].join(', ') || 'ninguno'}). Pidelo en asset-requests.json y pasa la puerta assets.`);
      else if (asset.kind !== 'image') err(where, `asset "${scene.asset.id}" es ${asset.kind}; en primer plano solo van imagenes. Un video va en \`broll\` con intent mostrar.`);
      if (!inRange(scene.asset.atWord, scene)) err(where, `asset.atWord ${scene.asset.atWord} fuera de la escena: el recurso entra cuando se nombra`);
    }
    if (scene.broll !== undefined && scene.broll !== null) {
      if (!assets.has(scene.broll)) err(where, `broll "${scene.broll}" no esta ingerido. Pidelo en asset-requests.json y pasa la puerta assets.`);
    }
    if (scene.stat) {
      const s = scene.stat;
      if (!s.text || String(s.text).length > tables.stat.maxChars) {
        err(where, `stat.text "${s.text}" tiene que tener 1-${tables.stat.maxChars} caracteres; lo que sobre va en stat.note ("200 $" + "plan Max al mes")`);
      }
      if (!inRange(s.atWord, scene)) err(where, `stat.atWord ${s.atWord} fuera de la escena`);
      checkMoney(`${where} stat`, s.text, s.money);
    }
    if (scene.face !== undefined && !Object.hasOwn(intent.faces ?? {}, scene.face)) {
      err(where, `face "${scene.face}" no existe (${Object.keys(intent.faces ?? {}).join(', ')})`);
    }
    if (scene.agenda) {
      const items = scene.agenda.items;
      const a = tables.agenda;
      if (!Array.isArray(items) || items.length < a.minItems || items.length > a.maxItems) {
        err(where, `agenda.items tiene que tener de ${a.minItems} a ${a.maxItems} puntos`);
      } else {
        for (const [k, item] of items.entries()) {
          const n = wordsOfText(item.text).length;
          if (!n || n > a.maxWordsPerItem) err(where, `agenda punto ${k + 1} "${item.text}": 1-${a.maxWordsPerItem} palabras`);
          if (item.atWord !== undefined && !inRange(item.atWord, scene)) {
            err(where, `agenda punto ${k + 1}: atWord ${item.atWord} fuera de la escena (quitalo y los puntos entran escalonados)`);
          }
        }
        agendas.set(scene.id, items.length);
      }
    }
    if (scene.agendaPoint) {
      const p = scene.agendaPoint;
      if (!agendas.has(p.of)) err(where, `agendaPoint.of "${p.of}" no es una escena agenda anterior`);
      else if (!Number.isInteger(p.item) || p.item < 1 || p.item > agendas.get(p.of)) {
        err(where, `agendaPoint.item ${p.item}: la agenda "${p.of}" tiene ${agendas.get(p.of)} puntos (se cuenta desde 1)`);
      }
    }
    if (scene.pair) {
      if (!Array.isArray(scene.pair) || scene.pair.length !== 2) {
        err(where, '`pair` son exactamente dos cifras: [{text, atWord}, {text, atWord}]');
      } else {
        for (const [k, p] of scene.pair.entries()) {
          if (!p.text || String(p.text).length > tables.pair.maxChars) err(where, `pair ${k + 1}: "${p.text}" tiene que tener 1-${tables.pair.maxChars} caracteres`);
          if (!inRange(p.atWord, scene)) err(where, `pair ${k + 1}: atWord ${p.atWord} fuera de la escena: cada cifra entra cuando se dice`);
          checkMoney(`${where} pair ${k + 1}`, p.text, p.money);
        }
      }
    }
    counts[scene.intent] = (counts[scene.intent] ?? 0) + 1;
    if (scene.intent === 'cifra') columns++;
    if (scene.intent === 'remate') remates.set(scene.clip, (remates.get(scene.clip) ?? 0) + 1);
  }
  for (const [id, intent] of Object.entries(intents)) {
    if (id !== 'cifra' && intent.maxPerPiece && (counts[id] ?? 0) > intent.maxPerPiece) {
      errors.push(`escaleta: ${counts[id]} escenas \`${id}\`; maximo ${intent.maxPerPiece} por pieza`);
    }
  }
  if (columns > tables.intents.cifra.maxPerPiece) {
    errors.push(`escaleta: ${columns} escenas \`cifra\`; maximo ${tables.intents.cifra.maxPerPiece}. Pasa las demas cifras a una keyword.`);
  }
  for (const [clip, count] of remates) {
    if (count > 1) errors.push(`toma ${clip}: ${count} escenas \`remate\`; como mucho una por toma`);
  }
  if (!escaleta.titular) {
    warnings.push('escaleta: sin `titular`. Va una vez, cuando se dice el nombre del producto o del tema: {text, kicker, clip, atWord}');
  } else {
    const t = escaleta.titular;
    const tw = transcripts[t.clip]?.words ?? [];
    if (!t.text) errors.push('titular: falta `text` (tipo oracion: "Claude Opus 5.5")');
    if (!Number.isInteger(t.atWord) || t.atWord < 0 || t.atWord >= tw.length) errors.push(`titular: atWord ${t.atWord} no existe en la toma ${t.clip}`);
  }
  errors.push(...coverageErrors(escaleta, {manifest, transcripts}));
  return {errors, warnings};
}

/**
 * Los clips se montan enteros: cada palabra de cada toma esta en una escena o en
 * `omit` (con motivo), en orden y sin volver a una toma ya cerrada.
 */
function coverageErrors(escaleta, {manifest, transcripts}) {
  const errors = [];
  const ranges = new Map(manifest.clips.map((clip) => [clip.id, []]));
  for (const scene of escaleta.scenes) {
    if (ranges.has(scene.clip) && Number.isInteger(scene.from) && Number.isInteger(scene.to)) {
      ranges.get(scene.clip).push({from: scene.from, to: scene.to, what: `escena ${scene.id}`});
    }
  }
  for (const omit of escaleta.omit ?? []) {
    if (!omit.reason) errors.push(`omit ${omit.clip}[${omit.from}-${omit.to}]: falta \`reason\` (por que se quita: toma repetida, error…)`);
    if (ranges.has(omit.clip)) ranges.get(omit.clip).push({from: omit.from, to: omit.to, what: 'omit'});
  }
  const order = [];
  for (const scene of escaleta.scenes) if (order.at(-1) !== scene.clip) order.push(scene.clip);
  if (new Set(order).size !== order.length) {
    errors.push(`orden de tomas: ${order.join(' → ')}. Cada toma va entera y seguida; no se vuelve a una toma ya cerrada.`);
  }
  for (const [clipId, list] of ranges) {
    const total = transcripts[clipId]?.words?.length ?? 0;
    if (!total) continue;
    if (!list.length) { errors.push(`toma ${clipId}: no aparece en la escaleta (sus ${total} palabras se perderian)`); continue; }
    const sorted = [...list].sort((a, b) => a.from - b.from);
    let expected = 0;
    for (const range of sorted) {
      if (range.from > expected) errors.push(`toma ${clipId}: faltan las palabras ${expected}-${range.from - 1} (ni en escena ni en omit)`);
      if (range.from < expected) errors.push(`toma ${clipId}: ${range.what} repite palabras desde ${range.from} (ya cubiertas hasta ${expected - 1})`);
      expected = Math.max(expected, range.to + 1);
    }
    if (expected < total) errors.push(`toma ${clipId}: faltan las palabras ${expected}-${total - 1} al final`);
    const scenesInOrder = escaleta.scenes.filter((scene) => scene.clip === clipId);
    for (let i = 1; i < scenesInOrder.length; i++) {
      if (scenesInOrder[i].from < scenesInOrder[i - 1].from) {
        errors.push(`toma ${clipId}: la escena ${scenesInOrder[i].id} va antes en la toma que ${scenesInOrder[i - 1].id}; respeta el orden de la locucion`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Compilacion
// ---------------------------------------------------------------------------

function nearestBeatIndex(beats, seconds) {
  if (!beats.length) return -1;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] < seconds) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(beats[lo - 1] - seconds) <= Math.abs(beats[lo] - seconds)) return lo - 1;
  return lo;
}

/**
 * Parte una escena en los silencios largos (jump cut), salvo donde un cue o un golpe
 * sigue en pantalla: cortar ahi lo dejaria a medias. Solo en layouts de camara
 * (`hero`): un b-roll reiniciaria el video de fondo.
 */
function splitAtSilences(scene, words, layout, tables) {
  // Una agenda o una comparacion viven toda la escena: partirla la cortaria a medias.
  const whole = scene.agenda || scene.agendaPoint || scene.pair;
  if (whole || !tables.cuts.splitableLayouts.includes(layout)) return [{...scene, parts: 1}];
  const busy = [];
  const hold = (atWord, seconds) => {
    if (Number.isInteger(atWord)) busy.push([words[atWord].start, words[atWord].start + seconds]);
  };
  if (scene.keyword) hold(scene.keyword.atWord, keywordHold(scene.keyword.text, tables));
  if (scene.asset) hold(scene.asset.atWord, tables.asset.holdSeconds);
  if (scene.stat) hold(scene.stat.atWord, tables.stat.holdSeconds);
  if (Number.isInteger(scene.hitWord)) hold(scene.hitWord, 0.6);
  const cuts = [];
  for (let i = scene.from; i < scene.to; i++) {
    const gapStart = words[i].end;
    const gapEnd = words[i + 1].start;
    if (gapEnd - gapStart <= tables.cuts.jumpSilenceSeconds) continue;
    if (busy.some(([a, b]) => a < gapEnd && b > gapStart)) continue;
    cuts.push(i);
  }
  if (!cuts.length) return [{...scene, parts: 1}];
  const bounds = [scene.from, ...cuts.map((i) => i + 1)];
  const inside = (value, from, to) => Number.isInteger(value) && value >= from && value <= to;
  return bounds.map((from, k) => {
    const to = k + 1 < bounds.length ? bounds[k + 1] - 1 : scene.to;
    const part = {id: k ? `${scene.id}-${String.fromCharCode(97 + k)}` : scene.id, clip: scene.clip, from, to, intent: scene.intent, jumpBefore: k > 0, parts: bounds.length, partIndex: k};
    if (scene.keyword && inside(scene.keyword.atWord, from, to)) part.keyword = scene.keyword;
    if (scene.asset && inside(scene.asset.atWord, from, to)) part.asset = scene.asset;
    if (scene.stat && inside(scene.stat.atWord, from, to)) part.stat = scene.stat;
    if (inside(scene.hitWord, from, to)) part.hitWord = scene.hitWord;
    return part;
  });
}

/**
 * Cabe un golpe mas en `at` sin pasar de `maxHits` en ninguna ventana de
 * `windowSeconds`? Mismo criterio que IN-R-042: golpes a menos de 120 ms son uno.
 */
function fitsBreathing(times, at, {windowSeconds, maxHits}) {
  const hits = [];
  for (const t of [...times, at].sort((a, b) => a - b)) {
    if (hits.length && t - hits.at(-1) < 0.12) continue;
    hits.push(t);
  }
  return hits
    .filter((h) => h >= at - windowSeconds && h <= at)
    .every((h) => hits.filter((other) => other >= h && other < h + windowSeconds).length <= maxHits);
}

function keywordHold(text, tables) {
  const n = wordsOfText(text).length;
  const {baseSeconds, perWordSeconds, maxSeconds} = tables.keyword.hold;
  return Math.min(maxSeconds, round3(baseSeconds + perWordSeconds * n));
}

/**
 * Compila la escaleta a `intro-plan.json`. Supone una escaleta valida
 * (`validateEscaleta` sin errores). Devuelve el plan y un informe por escena.
 */
export function compileEscaleta(escaleta, {manifest, transcripts, beats = [], tables = loadDecisionTables(), fps = INTRO_FORMAT.fps}) {
  const intents = tables.intents;
  const clipsById = new Map(manifest.clips.map((clip) => [clip.id, clip]));
  const assetsById = new Map((manifest.assets ?? []).map((asset) => [asset.id, asset]));
  const warnings = [];

  // 1. Layout por intencion y reparto de columnas; 2. particion en silencios.
  // Con cifra flotante (estilo de texto) la `cifra` no abre columna: va sobre el
  // plano de camara, a un lado de la cara, sin panel.
  const styleId = escaleta.textStyle ?? resolveIntroProfile(tables.profileId).textStyleId;
  const floatingStat = resolveTextStyle(styleId).stat.presentation === 'floating';
  let columnCount = 0;
  let showCount = 0;
  const expanded = [];
  for (const scene of escaleta.scenes) {
    const intent = intents[scene.intent];
    // `mostrar` pone la cara donde diga `face` o, sin el, rota por la tabla (esquina,
    // tarjeta, esquina, circulo): la esquina es la favorita del usuario.
    const layout = scene.intent === 'cifra'
      ? (floatingStat ? 'hero' : intent.layouts[columnCount++ % intent.layouts.length])
      : scene.intent === 'mostrar'
        ? (scene.face ? intent.faces[scene.face] : intent.layouts[showCount++ % intent.layouts.length])
        : intent.layouts[0];
    const words = transcripts[scene.clip].words;
    for (const part of splitAtSilences(scene, words, layout, tables)) expanded.push({...part, layout, source: scene});
  }

  // 3. Fronteras al beat. `absFrames` es el reloj de la pieza.
  const {jumpSilenceSeconds, headSeconds, tailAirSeconds, boundary} = tables.cuts;
  const continuousWith = (a, b) => {
    if (!a || !b || a.clip !== b.clip || b.jumpBefore || b.from !== a.to + 1) return false;
    const words = transcripts[a.clip].words;
    return words[b.from].start - words[a.to].end <= jumpSilenceSeconds;
  };
  let absFrames = 0;
  let unsnapped = 0;
  const timed = [];
  for (const [i, scene] of expanded.entries()) {
    const words = transcripts[scene.clip].words;
    const clip = clipsById.get(scene.clip);
    const prev = timed.at(-1);
    const continuous = continuousWith(expanded[i - 1], scene);
    const start = continuous ? prev.trim.end : Math.max(0, words[scene.from].start - headSeconds);
    const absStart = absFrames / fps;
    const lastEnd = words[scene.to].end;
    const next = expanded[i + 1];
    let end;
    if (continuousWith(scene, next)) {
      // Audio continuo: cortar en el beat pesa mas que cortar entre palabras, asi que
      // la ventana entra en la ultima palabra (sin pasar de su arranque, que ancla
      // cues) y apenas asoma a la siguiente. De los beats que caben, el mas centrado.
      const nextStart = words[next.from].start;
      const mid = (lastEnd + nextStart) / 2;
      const lo = Math.max(words[scene.to].start + 0.08, lastEnd - boundary.intoLastWordSeconds, start + 0.3);
      const hi = nextStart + boundary.afterNextStartSeconds;
      let best = null;
      for (let b = Math.max(0, nearestBeatIndex(beats, absStart + (lo - start)) - 1); b >= 0 && b < beats.length; b++) {
        const at = start + (beats[b] - absStart);
        if (at > hi) break;
        if (at >= lo && (best === null || Math.abs(at - mid) < Math.abs(best - mid))) best = at;
      }
      if (best === null) unsnapped++;
      end = best ?? mid;
    } else {
      const min = lastEnd + tailAirSeconds;
      let b = nearestBeatIndex(beats, absStart + (min - start));
      if (b >= 0) {
        while (b < beats.length - 1 && start + (beats[b] - absStart) < min) b++;
        end = start + (beats[b] - absStart);
      } else {
        end = min;
      }
      end = Math.min(clip.durationSeconds, end);
    }
    end = round3(end);
    const frames = Math.round((end - start) * fps);
    timed.push({...scene, trim: {start: round3(start), end}, absStart, frames});
    absFrames += frames;
  }
  if (unsnapped) warnings.push(`${unsnapped} corte(s) entre frases seguidas no caen en beat: ningun beat cabe entre el final de la frase y el arranque de la siguiente`);
  if (!beats.length) warnings.push('sin rejilla de beats: los cortes no se alinean a la musica');

  // 4. Camara, transicion, efectos, cues y sonido.
  const scenes = [];
  let insertRotation = 0;
  let previousCamera = null;
  const soundEvents = [];
  const transitionSounds = new Set(tables.sound.transitionSounds);
  const near = tables.sound.simultaneousSeconds;
  const quiet = {sound: false, soundNote: tables.keyword.quietNote};
  let titleBeat = null;
  let titleSeconds = null;
  const agendaItems = new Map();
  const timing = [];

  for (const [i, scene] of timed.entries()) {
    const intent = intents[scene.intent];
    const words = transcripts[scene.clip].words;
    const prev = timed[i - 1];
    const absOf = (wordIndex) => scene.absStart + (words[wordIndex].start - scene.trim.start);
    // El corte al beat puede entrar unos ms en la primera palabra: lo que se ancla al
    // principio de la escena usa la primera palabra que empieza dentro del recorte.
    let firstWord = scene.from;
    while (firstWord < scene.to && words[firstWord].start < scene.trim.start) firstWord++;
    const sceneSeconds = scene.frames / fps;

    // Camara: la de la intencion en la parte que lleva el golpe (o la primera); el
    // resto de partes deriva. Nunca la misma camara dos escenas seguidas.
    const primary = Number.isInteger(scene.source.hitWord)
      ? Number.isInteger(scene.hitWord)
      : !scene.partIndex;
    const options = primary ? intent.cameras : ['drift-right', 'drift-left'];
    const camera = options.find((option) => option !== previousCamera) ?? options[0];
    previousCamera = camera;

    // El tipo de cambio decide la transicion y la situacion de sonido (una familia por
    // situacion, para que el ranking del usuario de cada una no se pise con otra).
    let transitionIn = 'cut';
    let change = null;
    const t = tables.transitions;
    if (!prev) transitionIn = 'cut';
    else if (prev.clip !== scene.clip) { transitionIn = t.newClip; change = 'newClip'; }
    else if (scene.layout === 'circle') { transitionIn = t.intoCircle; change = 'intoCircle'; }
    else if (scene.layout === 'insert' || scene.layout === 'card-left') {
      transitionIn = t.intoInsert[insertRotation++ % t.intoInsert.length];
      if (transitionIn === scenes.at(-1)?.transitionIn) transitionIn = t.intoInsert[insertRotation++ % t.intoInsert.length];
      change = 'intoInsert';
    } else if (scene.layout === 'frame') { transitionIn = t.intoFrame; change = 'intoFrame'; }
    else if (BROLL_LAYOUTS.has(prev.layout)) { transitionIn = t.outOfBroll; change = 'outOfBroll'; }
    else if (COLUMN_LAYOUTS.has(scene.layout)) transitionIn = t.intoColumn;
    else transitionIn = scene.jumpBefore || !continuousWith(prev, scene) ? t.silenceJump : t.sameShot;
    // zoom-blur suena siempre a whoosh inverso, venga de donde venga.
    const transitionFamily = transitionIn === 'zoom-blur' ? t.sounds.intoFrame : change ? t.sounds[change] : null;
    const transitionSound = i > 0 && transitionSounds.has(transitionIn) ? scene.absStart : null;
    if (transitionSound !== null) soundEvents.push({at: transitionSound, what: 'transicion'});
    const clashesWithTransition = (seconds) => transitionSound !== null && Math.abs(seconds - transitionSound) < near;

    const cues = [];
    let moneyAt = null;
    if (scene.keyword) {
      const k = scene.keyword;
      const cue = {
        type: 'keyword',
        slot: tables.keyword.slot[scene.layout] ?? tables.keyword.slot.default,
        text: k.text,
        atWord: k.atWord,
        holdSeconds: keywordHold(k.text, tables),
        ...(k.highlight?.length ? {highlight: k.highlight} : {}),
        ...(k.note ? {note: k.note} : {})
      };
      if (k.money) {
        Object.assign(cue, {soundUse: 'money', soundNote: k.money});
        moneyAt = absOf(k.atWord);
      } else Object.assign(cue, quiet);
      cues.push(cue);
    }
    if (scene.asset) {
      const slots = intent.assetSlots;
      const slot = scene.asset.slot && slots.includes(scene.asset.slot)
        ? scene.asset.slot
        : slots[scenes.filter((s) => s.cues?.some((c) => c.type === 'screenshot')).length % slots.length];
      const cue = {type: 'screenshot', assetId: scene.asset.id, slot, atWord: scene.asset.atWord, holdSeconds: tables.asset.holdSeconds, sound: tables.asset.sound};
      const at = absOf(scene.asset.atWord);
      if (clashesWithTransition(at)) Object.assign(cue, {sound: false, soundNote: 'entra con la transicion; dos sonidos a la vez sobran'});
      else soundEvents.push({at, what: `recurso ${scene.asset.id}`});
      cues.push(cue);
    }
    if (scene.stat) {
      const s = scene.stat;
      const cue = {
        type: 'stat',
        slot: floatingStat
          ? (scenes.filter((s) => s.cues?.some((c) => c.type === 'stat')).length % 2 ? 'fore-left' : 'fore-right')
          : scene.layout === 'hero-left' ? 'fore-right' : 'fore-left',
        text: s.text,
        ...(s.note ? {note: s.note} : {}),
        tone: 'accent',
        atWord: s.atWord,
        holdSeconds: tables.stat.holdSeconds
      };
      const at = absOf(s.atWord);
      if (s.money) {
        Object.assign(cue, {soundUse: 'money', soundNote: s.money});
        moneyAt = at;
      } else if (clashesWithTransition(at)) {
        Object.assign(cue, {sound: false, soundNote: 'entra con la transicion; dos sonidos a la vez sobran'});
      }
      cues.push(cue);
    }
    if (scene.agenda) {
      // Agenda: la lista vive toda la escena; cada punto entra en su palabra o
      // escalonado. Muda: acompana a la voz y el golpe lo lleva el cambio de imagen.
      agendaItems.set(scene.id, scene.agenda.items);
      const first = scene.agenda.items.find((item) => Number.isInteger(item.atWord));
      cues.push({
        type: 'list', slot: 'agenda', atWord: first?.atWord ?? firstWord, holdSeconds: sceneSeconds,
        items: scene.agenda.items.map((item) => ({text: item.text, ...(Number.isInteger(item.atWord) ? {atWord: item.atWord} : {})})),
        sound: false, soundNote: tables.agenda.quietNote
      });
    }
    if (scene.agendaPoint) {
      const items = agendaItems.get(scene.agendaPoint.of);
      cues.push({
        type: 'list', slot: 'agenda', atWord: firstWord, holdSeconds: tables.agenda.recallSeconds,
        items: items.map((item) => ({text: item.text})), active: scene.agendaPoint.item - 1,
        sound: false, soundNote: tables.agenda.quietNote
      });
    }
    if (scene.pair) {
      // Comparacion: la primera cifra en tinta y muda, la segunda en acento y con
      // sonido (dinero si lo es): dos golpes en un segundo cargan.
      // La primera cifra sigue en pantalla hasta que la segunda ha salido y se ha
      // leido: una comparacion con una sola cifra visible no compara nada.
      const gap = Math.max(0, absOf(scene.pair[1].atWord) - absOf(scene.pair[0].atWord));
      scene.pair.forEach((p, k) => {
        const cue = {
          type: 'stat', slot: tables.pair.slots[k], text: p.text, ...(p.note ? {note: p.note} : {}),
          tone: k === 0 ? 'muted' : 'accent', atWord: p.atWord,
          holdSeconds: round3(tables.pair.holdSeconds + (k === 0 ? gap : 0))
        };
        const at = absOf(p.atWord);
        if (k === 0) Object.assign(cue, {sound: false, soundNote: tables.pair.quietNote});
        else if (p.money) { Object.assign(cue, {soundUse: 'money', soundNote: p.money}); moneyAt = at; }
        else if (clashesWithTransition(at)) Object.assign(cue, {sound: false, soundNote: 'entra con la transicion; dos sonidos a la vez sobran'});
        else soundEvents.push({at, what: 'cifra'});
        cues.push(cue);
      });
    }
    if (moneyAt !== null) soundEvents.push({at: moneyAt, what: 'money'});

    const effects = [];
    if (intent.effect && Number.isInteger(scene.hitWord)) {
      const wordAt = absOf(scene.hitWord);
      let b = nearestBeatIndex(beats, wordAt);
      const effect = {id: intent.effect.id, intensity: intent.effect.intensity};
      if (b >= 0) {
        while (b < beats.length - 1 && beats[b] < scene.absStart + 0.02) b++;
        while (b > 0 && beats[b] > scene.absStart + sceneSeconds - 0.1) b--;
        effect.atBeat = b;
      } else {
        effect.atWord = scene.hitWord;
      }
      const at = b >= 0 ? beats[b] : wordAt;
      if ((moneyAt !== null && Math.abs(at - moneyAt) < near) || clashesWithTransition(at)) effect.sound = false;
      else soundEvents.push({at, what: intent.effect.id});
      effects.push(effect);
    }

    const out = {
      id: scene.id,
      clipId: scene.clip,
      layout: scene.layout,
      camera,
      transitionIn,
      ...(transitionFamily && transitionSounds.has(transitionIn) ? {transitionSound: transitionFamily} : {}),
      trim: scene.trim
    };
    const brollId = scene.source.broll;
    if (brollId && BROLL_LAYOUTS.has(scene.layout)) {
      out.backdrop = {assetId: brollId, ...intent.backdrop};
      if (assetsById.get(brollId)?.kind === 'image' && scene.layout === 'insert') out.backdrop.motion = 'slow-zoom';
    }
    if (cues.length) out.cues = cues;
    out.effects = effects;
    scenes.push(out);
    timing.push({out, absStart: scene.absStart, seconds: sceneSeconds, transition: transitionSound !== null});

    const titular = escaleta.titular;
    if (titular && titular.clip === scene.clip && titular.atWord >= scene.from && titular.atWord <= scene.to) {
      titleBeat = beats.length ? nearestBeatIndex(beats, absOf(titular.atWord)) : null;
      titleSeconds = round3(absOf(titular.atWord));
      if (!beats.length) warnings.push('titular sin beat: sin musica se ancla al segundo');
    }
  }

  // 5. Los zooms de camara suenan (preferencia del usuario: chunky camera y Camera
  // Shutter) donde caben en el techo de respiro del perfil; el que no cabe, no suena.
  // El riser del arranque golpea en el primer corte y cuenta como golpe.
  if (tables.sound.openingRiser && timing[1]) soundEvents.push({at: timing[1].absStart, what: 'riser'});
  const breathing = resolveIntroProfile(tables.profileId).hitBreathing;
  const zoom = tables.zoomSound;
  let zoomSounds = 0;
  for (const {out, absStart, seconds, transition} of timing) {
    if (!zoom.cameras.includes(out.camera) || transition) continue;
    const at = out.camera === 'snap-zoom' ? absStart + seconds * SNAP_ZOOM_AT : absStart + 0.05;
    if (soundEvents.some((event) => Math.abs(event.at - at) < zoom.minGapSeconds)) continue;
    if (breathing && !fitsBreathing(soundEvents.map((event) => event.at), at, breathing)) continue;
    out.cameraSound = zoom.family;
    soundEvents.push({at, what: 'zoom'});
    zoomSounds++;
  }

  const plan = {
    profileId: tables.profileId,
    note: escaleta.note ?? `Apertura viral generada desde la escaleta (${escaleta.slug ?? ''}).`,
    accentColor: escaleta.accentColor,
    ...(escaleta.textStyle ? {textStyleId: escaleta.textStyle} : {}),
    ...(manifest.music ? {music: {assetId: 'music', gainDb: tables.music.gainDb}} : {}),
    sound: {library: tables.sound.library, openingRiser: tables.sound.openingRiser},
    scenes
  };
  if (escaleta.titular) {
    plan.titleCard = {
      text: escaleta.titular.text,
      ...(escaleta.titular.kicker ? {kicker: escaleta.titular.kicker} : {}),
      ...(titleBeat !== null ? {atBeat: titleBeat} : titleSeconds !== null ? {atSeconds: titleSeconds} : {}),
      holdSeconds: tables.title.holdSeconds,
      ...(tables.title.sound ? {sound: tables.title.sound} : {})
    };
  }
  return {
    plan,
    warnings,
    report: {
      durationSeconds: round3(absFrames / fps),
      scenes: timed.length,
      declaredScenes: escaleta.scenes.length,
      silenceSplits: timed.length - escaleta.scenes.length,
      strongEffects: scenes.reduce((sum, scene) => sum + scene.effects.length, 0),
      plannedSounds: soundEvents.length,
      zoomSounds,
      offBeatCuts: unsnapped
    }
  };
}
