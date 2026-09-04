import {abortableSleep, fetchWithTimeout, retryDelay} from './network.js';

const DEFAULT_SYSTEM = `Eres un editor senior de Shorts/Reels para un canal de IA, machine learning, Python e inversion/trading/bolsa. Evalua clips con criterio de retencion, claridad, emocion, payoff, cortes naturales de inicio/fin y relevancia para sistemas de IA/ML aplicados a mercados. Devuelve solo JSON valido.`;

function env(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : '';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value != null && typeof value !== 'string') return value;
  }
  return '';
}

export function getLlmConfig(overrides = {}) {
  return {
    provider: firstNonEmpty(overrides.provider, env('LLM_PROVIDER'), env('OPENCODE_PROVIDER'), 'off'),
    baseUrl: firstNonEmpty(overrides.baseUrl, env('MINIMAX_API_URL'), env('OPENCODE_BASE_URL'), env('LLM_BASE_URL'), 'https://api.openai.com/v1'),
    apiKey: firstNonEmpty(overrides.apiKey, env('MINIMAX_API_KEY'), env('OPENCODE_API_KEY'), env('LLM_API_KEY'), env('OPENAI_API_KEY')),
    model: firstNonEmpty(overrides.model, env('MINIMAX_MODEL'), env('OPENCODE_MODEL'), env('LLM_MODEL'), 'gpt-4o-mini')
  };
}

export function isLlmEnabled(config) {
  return Boolean(config.apiKey && !['off', 'none', 'false'].includes(String(config.provider).toLowerCase()));
}

function chatUrl(config) {
  const provider = String(config.provider || '').toLowerCase();
  const base = config.baseUrl.replace(/\/$/, '');
  if (provider === 'minimax' || /api\.minimax\.(io|chat)/i.test(base) || /chatcompletion_v2$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

function buildPayload(config, messages, options = {}) {
  const provider = String(config.provider || '').toLowerCase();
  const payload = {
    model: config.model,
    temperature: Number(options.temperature ?? 0.2),
    messages
  };
  if (Number.isFinite(Number(options.maxTokens))) payload.max_tokens = Number(options.maxTokens);
  const minimax = provider === 'minimax' || /api\.minimax\.(io|chat)/i.test(config.baseUrl) || /chatcompletion_v2$/i.test(config.baseUrl);
  if (!minimax && options.json !== false) payload.response_format = {type: 'json_object'};
  return payload;
}

function extractContent(json) {
  const choice = json.choices?.[0];
  if (choice?.message?.content) return choice.message.content;
  if (choice?.text) return choice.text;
  if (json.reply) return json.reply;
  if (json.text) return json.text;
  if (json.content) return json.content;
  throw new Error('LLM response did not include assistant content.');
}

export function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);
  const match = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!match) throw new Error('LLM response did not include JSON.');
  return JSON.parse(match[1]);
}

export async function chatCompletion(messages, options = {}) {
  const config = getLlmConfig(options);
  if (!isLlmEnabled(config)) {
    throw new Error('LLM is not configured. Set LLM_PROVIDER, LLM_BASE_URL, LLM_API_KEY and LLM_MODEL.');
  }
  const retries = Math.max(0, Number(options.retries ?? process.env.LLM_RETRIES ?? 2));
  const timeoutMs = Math.max(1000, Number(options.timeoutMs ?? process.env.LLM_TIMEOUT_MS ?? 120_000));
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(chatUrl(config), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(buildPayload(config, messages, options))
      }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs});
    } catch (error) {
      if (options.signal?.aborted || error?.name === 'AbortError' || attempt >= retries) throw error;
      await (options.sleep || abortableSleep)(retryDelay(attempt), options.signal);
      continue;
    }
    if (response.ok) return extractContent(await response.json());
    const body = await response.text();
    const error = new Error(`LLM request failed (${response.status}): ${body.slice(0, 500)}`);
    error.status = response.status;
    if (![408, 429].includes(response.status) && response.status < 500) throw error;
    if (attempt >= retries) throw error;
    await (options.sleep || abortableSleep)(retryDelay(attempt), options.signal);
  }
  throw new Error('LLM request failed after retries.');
}

export async function chatJson(messages, options = {}) {
  return extractJson(await chatCompletion(messages, options));
}

export async function enrichCandidatesWithLlm(candidates, options = {}) {
  const config = getLlmConfig(options);
  if (!isLlmEnabled(config)) {
    return candidates.map((candidate) => ({...candidate, llmUsed: false}));
  }

  const compact = candidates.slice(0, Number(options.limit ?? 15)).map((candidate) => ({
    id: candidate.id,
    start: candidate.start,
    end: candidate.end,
    heuristicScore: candidate.viralScore,
    text: candidate.text.slice(0, 5000),
    visualEvidence: candidate.visualSummary ?? null
  }));

  const general = options.topicProfile === 'general';
  const user = `Puntua estos clips de 0 a 100 y mejora titulo/hook.
Devuelve JSON valido con una clave "clips" que contenga objetos: id, viralScore, suggestedTitle, hook, critique, reasons, narrative (hook, development, payoff), contextDependency.
No inventes contenido visual: usa solo visualEvidence cuando exista. El hook propuesto debe respetar lo dicho. Valora una idea completa con prueba y cierre, y diversidad entre clips. Se critico: penaliza clips que dependan de contexto externo, empiecen o terminen a mitad de frase, no tengan payoff. ${general ? 'Juzga el tema real de cada clip sin premiar un sector concreto.' : 'Prioriza IA/ML/Python aplicado a inversion, trading, bolsa, datos o automatizacion.'}
Clips:
${JSON.stringify(compact, null, 2)}`;

  const parsed = await chatJson([
    {role: 'system', content: general ? 'Eres un editor senior de Shorts/Reels. Evalua retencion, claridad, emocion, una idea completa y cortes naturales. Adapta el criterio al contenido real; no inventes hechos. Devuelve JSON valido.' : DEFAULT_SYSTEM},
    {role: 'user', content: user}
  ], {...options, ...config, temperature: 0.2});

  const rows = Array.isArray(parsed) ? parsed : parsed.clips ?? parsed.results ?? [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  return candidates.map((candidate) => {
    const row = byId.get(candidate.id);
    if (!row) return {...candidate, llmUsed: true};
    return {
      ...candidate,
      viralScore: Number.isFinite(row.viralScore) ? Math.max(0, Math.min(100, Math.round(row.viralScore))) : candidate.viralScore,
      suggestedTitle: row.suggestedTitle || candidate.suggestedTitle,
      hook: row.hook || null,
      critique: row.critique || null,
      narrative: row.narrative && typeof row.narrative === 'object' ? row.narrative : null,
      contextDependency: row.contextDependency ?? null,
      reasons: Array.isArray(row.reasons) && row.reasons.length ? row.reasons : candidate.reasons,
      llmUsed: true
    };
  }).sort((a, b) => b.viralScore - a.viralScore || a.start - b.start).map((candidate, index) => ({
    ...candidate,
    rank: index + 1
  }));
}
