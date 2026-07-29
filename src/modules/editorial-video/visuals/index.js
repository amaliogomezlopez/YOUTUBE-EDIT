/**
 * Capa 2 — Director editorial.
 *
 * Transcripción → cues → plan visual → props. No contiene contenido de ningún
 * episodio ni componentes React: solo reglas de traducción.
 *
 *   CAPA 3  Canal      reglas de marca ejecutables + assets + tono
 *      ↓
 *   CAPA 2  Director   este módulo
 *      ↓
 *   CAPA 1  Catálogo   patrones, efectos, cámara, sonido, layout
 */
export * from './word-index.js';
export * from './cue-anchoring.js';
export * from './cue-lexicon.js';
export * from './cue-mining.js';
export * from './cue-budget.js';
export * from './pattern-registry.js';
export * from './event-timeline.js';
export * from './sound-director.js';
export * from './variety-planner.js';
export * from './entity-resolver.js';
export * from './rules-engine.js';
export * from './plan-validator.js';
export * from './episode-qa.js';
