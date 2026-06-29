import test from 'node:test';
import assert from 'node:assert/strict';
import {findCandidates, scoreCandidate} from '../src/lib/scoring.js';

test('scores hook-heavy clip higher than weak intro', () => {
  const strong = scoreCandidate({
    id: 'a',
    start: 0,
    end: 30,
    text: 'No sabes el error brutal que casi destruye el lanzamiento. Por eso la clave fue cambiar todo el proceso.'
  });
  const weak = scoreCandidate({
    id: 'b',
    start: 0,
    end: 30,
    text: 'Y entonces bueno estuvimos hablando un poco de varias cosas durante bastante tiempo sin una conclusion clara.'
  });
  assert.ok(strong.viralScore > weak.viralScore);
});

test('finds and ranks deduplicated transcript windows', () => {
  const captions = Array.from({length: 12}, (_, index) => ({
    id: `s${index}`,
    start: index * 4,
    end: index * 4 + 3.5,
    text: index < 4
      ? 'No sabes el error brutal del negocio.'
      : 'Por eso la clave fue medir el resultado y ajustar.'
  }));
  const candidates = findCandidates(captions, {minDuration: 8, maxDuration: 20, stride: 1});
  assert.ok(candidates.length > 0);
  assert.equal(candidates[0].rank, 1);
  assert.ok(candidates[0].duration <= 20);
});

test('prioritizes AI and finance topic over generic model talk', () => {
  const focused = scoreCandidate({
    id: 'focused',
    start: 0,
    end: 24,
    cleanStart: true,
    cleanEnd: true,
    text: 'Vamos a ver cómo un modelo de IA con datos de mercado puede analizar una estrategia de inversión en bolsa. La clave es validar señales antes de arriesgar capital.'
  });
  const generic = scoreCandidate({
    id: 'generic',
    start: 0,
    end: 24,
    cleanStart: true,
    cleanEnd: true,
    text: 'Vamos a ver cómo un modelo rápido resume documentos y responde preguntas. La clave es que tiene poca latencia y funciona bien.'
  });
  assert.ok(focused.viralScore > generic.viralScore);
  assert.ok(focused.scoreComponents.topic > generic.scoreComponents.topic);
});

test('penalizes clips that cut off mid sentence', () => {
  const clean = scoreCandidate({
    id: 'clean',
    start: 0,
    end: 18,
    cleanStart: true,
    cleanEnd: true,
    text: 'Esta estrategia de inversión usa IA para detectar riesgo antes de entrar en bolsa. Por eso el cierre importa.'
  });
  const broken = scoreCandidate({
    id: 'broken',
    start: 0,
    end: 18,
    cleanStart: false,
    cleanEnd: false,
    text: 'estrategia de inversión usa IA para detectar riesgo antes de entrar en'
  });
  assert.ok(clean.scoreComponents.boundary > broken.scoreComponents.boundary);
  assert.ok(clean.viralScore > broken.viralScore);
});

test('prioritizes model recommendations and critiques', () => {
  const opinionated = scoreCandidate({
    id: 'opinionated',
    start: 0,
    end: 28,
    cleanStart: true,
    cleanEnd: true,
    text: 'No recomiendo usar ese modelo LLM para producción porque la latencia es cara y falla con contexto largo. Prefiero comparar Nemotron con faster whisper y medir calidad antes de integrarlo.'
  });
  const neutral = scoreCandidate({
    id: 'neutral',
    start: 0,
    end: 28,
    cleanStart: true,
    cleanEnd: true,
    text: 'Un modelo LLM puede recibir tokens, procesar contexto y devolver una respuesta. También se puede integrar en una aplicación usando una API.'
  });
  assert.ok(opinionated.viralScore > neutral.viralScore);
  assert.ok(opinionated.scoreComponents.editorial > neutral.scoreComponents.editorial);
  assert.ok(opinionated.reasons.includes('opinion o recomendacion clara sobre modelos/IA'));
});
