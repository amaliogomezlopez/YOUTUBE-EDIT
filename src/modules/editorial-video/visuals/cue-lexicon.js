/**
 * Léxico de minería de cues (español).
 *
 * ANM-B01 — Vive en la capa de catálogo: no conoce ningún canal. Un canal puede
 * ampliarlo con `channels/<id>/brand/cue-lexicon.json`, nunca sustituirlo.
 */

// `un`/`una` quedan fuera a propósito: en español son artículos mucho más a
// menudo que cifras, y generaban falsos positivos en la minería.
export const NUMBER_WORDS = new Map([
  ['dos', 2], ['tres', 3], ['cuatro', 4], ['cinco', 5],
  ['seis', 6], ['siete', 7], ['ocho', 8], ['nueve', 9], ['diez', 10],
  ['once', 11], ['doce', 12], ['quince', 15], ['veinte', 20], ['treinta', 30],
  ['cuarenta', 40], ['cincuenta', 50], ['sesenta', 60], ['setenta', 70],
  ['ochenta', 80], ['noventa', 90], ['cien', 100], ['ciento', 100],
  ['mil', 1000], ['millon', 1e6], ['millones', 1e6], ['billon', 1e12],
  ['billones', 1e12]
]);

export const MAGNITUDE_WORDS = new Set([
  'millones', 'millon', 'billones', 'billon', 'trillones', 'miles',
  'puntos', 'basicos', 'porcentuales', 'veces'
]);

export const CURRENCY_WORDS = new Set([
  'dolares', 'dolar', 'euros', 'euro', 'centavos', 'usd', 'eur'
]);

export const MONTH_WORDS = new Set([
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'setiembre', 'octubre', 'noviembre', 'diciembre'
]);

export const PERIOD_WORDS = new Set([
  'decada', 'decadas', 'trimestre', 'trimestres', 'semestre', 'siglo',
  'ejercicio', 'temporada'
]);

/** Frases que abren un giro narrativo (playbook §9). */
export const TURN_PHRASES = [
  'sin embargo', 'pero', 'atencion', 'el problema', 'de hecho', 'ahora bien',
  'la realidad', 'lo cierto', 'en realidad', 'y aqui', 'aqui esta',
  'lo preocupante', 'lo llamativo', 'lo extrano', 'no obstante'
];

/** Frases comparativas: piden dos objetos en pantalla, no uno. */
export const COMPARISON_PHRASES = [
  'frente a', 'mientras que', 'el doble', 'la mitad', 'comparado con',
  'a diferencia de', 'en cambio', 'mas que', 'menos que', 'igual que',
  'por encima de', 'por debajo de', 'respecto a'
];

/** Periodos relativos: exigen banda temporal, no un punto. */
export const RELATIVE_PERIOD_PHRASES = [
  'ultimos meses', 'ultimos anos', 'ultimas semanas', 'finales de los',
  'principios de los', 'mediados de los', 'en lo que va de', 'hasta ahora',
  'desde entonces', 'este ano', 'el ano pasado'
];

/**
 * Verbos visualizables (playbook §17): la animación ejecuta el verbo, no se
 * limita a rotularlo. Cada entrada declara metáfora, acción y familia sonora.
 */
export const VISUAL_VERBS = new Map([
  ['estalla', {metaphor: 'burst', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['estallar', {metaphor: 'burst', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['estallo', {metaphor: 'burst', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['pincha', {metaphor: 'puncture', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['pinchazo', {metaphor: 'puncture', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['revienta', {metaphor: 'burst', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['rompe', {metaphor: 'break', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['arrastra', {metaphor: 'drag', action: 'connect', soundFamily: 'tension', tone: 'negative'}],
  ['arrastran', {metaphor: 'drag', action: 'connect', soundFamily: 'tension', tone: 'negative'}],
  ['rebobinar', {metaphor: 'rewind', action: 'scan', soundFamily: 'rewind', tone: 'neutral'}],
  ['retrocedemos', {metaphor: 'rewind', action: 'scan', soundFamily: 'rewind', tone: 'neutral'}],
  ['volvamos', {metaphor: 'rewind', action: 'scan', soundFamily: 'rewind', tone: 'neutral'}],
  ['separan', {metaphor: 'diverge', action: 'shade', soundFamily: 'tension', tone: 'negative'}],
  ['separando', {metaphor: 'diverge', action: 'shade', soundFamily: 'tension', tone: 'negative'}],
  ['divergen', {metaphor: 'diverge', action: 'shade', soundFamily: 'tension', tone: 'negative'}],
  ['cae', {metaphor: 'fall', action: 'zoom', soundFamily: 'impact', tone: 'negative'}],
  ['caen', {metaphor: 'fall', action: 'zoom', soundFamily: 'impact', tone: 'negative'}],
  ['cayo', {metaphor: 'fall', action: 'zoom', soundFamily: 'impact', tone: 'negative'}],
  ['hunde', {metaphor: 'sink', action: 'zoom', soundFamily: 'impact', tone: 'negative'}],
  ['colapsa', {metaphor: 'collapse', action: 'highlight', soundFamily: 'break', tone: 'negative'}],
  ['dispara', {metaphor: 'spike', action: 'zoom', soundFamily: 'camera', tone: 'positive'}],
  ['sube', {metaphor: 'rise', action: 'focus', soundFamily: 'camera', tone: 'positive'}],
  ['crece', {metaphor: 'rise', action: 'focus', soundFamily: 'camera', tone: 'positive'}],
  ['contagia', {metaphor: 'spread', action: 'connect', soundFamily: 'tension', tone: 'negative'}],
  ['propaga', {metaphor: 'spread', action: 'connect', soundFamily: 'tension', tone: 'negative'}],
  ['concentra', {metaphor: 'concentrate', action: 'focus', soundFamily: 'interface', tone: 'gold'}],
  ['acelera', {metaphor: 'accelerate', action: 'scan', soundFamily: 'camera', tone: 'neutral'}],
  ['frena', {metaphor: 'brake', action: 'shade', soundFamily: 'tension', tone: 'negative'}],
  ['revela', {metaphor: 'reveal', action: 'scan', soundFamily: 'reveal', tone: 'neutral'}],
  ['multiplica', {metaphor: 'multiply', action: 'reveal', soundFamily: 'data', tone: 'gold'}]
]);

export const NEGATIVE_CONTEXT = new Set([
  'perdido', 'pierde', 'perdida', 'perdidas', 'cae', 'caida', 'caida',
  'baja', 'bajada', 'retroceso', 'correccion', 'riesgo', 'burbuja',
  'contradiccion', 'debil', 'debiles', 'menos', 'peor', 'desplome'
]);

export const POSITIVE_CONTEXT = new Set([
  'sube', 'subida', 'gana', 'ganancia', 'crece', 'crecimiento', 'record',
  'maximos', 'maximo', 'recuperacion', 'saludable', 'mejor', 'revalorizado'
]);

/** Perfil por tipo de mención: acción, familia sonora, prioridad y obligación. */
export const CUE_KIND_PROFILES = {
  percent: {action: 'highlight', soundFamily: 'data', priority: 9, mandatory: true},
  number: {action: 'highlight', soundFamily: 'data', priority: 8, mandatory: true},
  currency: {action: 'highlight', soundFamily: 'data', priority: 9, mandatory: true},
  magnitude: {action: 'highlight', soundFamily: 'data', priority: 7, mandatory: false},
  entity: {action: 'focus', soundFamily: 'reveal', priority: 8, mandatory: true},
  date: {action: 'reveal', soundFamily: 'interface', priority: 5, mandatory: false},
  period: {action: 'shade', soundFamily: 'interface', priority: 6, mandatory: false},
  turn: {action: 'highlight', soundFamily: 'impact', priority: 7, mandatory: true},
  verb: {action: 'highlight', soundFamily: 'impact', priority: 7, mandatory: false},
  comparison: {action: 'connect', soundFamily: 'camera', priority: 6, mandatory: false}
};

export function mergeLexiconOverrides(overrides = {}) {
  return {
    turnPhrases: [...TURN_PHRASES, ...(overrides.turnPhrases ?? [])],
    comparisonPhrases: [...COMPARISON_PHRASES, ...(overrides.comparisonPhrases ?? [])],
    relativePeriodPhrases: [
      ...RELATIVE_PERIOD_PHRASES,
      ...(overrides.relativePeriodPhrases ?? [])
    ],
    visualVerbs: new Map([
      ...VISUAL_VERBS,
      ...Object.entries(overrides.visualVerbs ?? {})
    ]),
    kindProfiles: {...CUE_KIND_PROFILES, ...(overrides.kindProfiles ?? {})}
  };
}
