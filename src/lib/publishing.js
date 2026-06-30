import {chatJson, getLlmConfig, isLlmEnabled} from './llm.js';
import {captionsToText} from './transcript.js';
import {round} from './utils.js';

function formatTimestamp(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const TOPIC_HASHTAGS = [
  {pattern: /\bglm[\s.-]?5(?:\.?2)?\b|\bglm\b/i, tags: ['#GLM', '#GLM52', '#IA']},
  {pattern: /\bgpt|chatgpt|openai\b/i, tags: ['#ChatGPT', '#OpenAI', '#IA']},
  {pattern: /\bclaude|anthropic\b/i, tags: ['#Claude', '#Anthropic', '#IA']},
  {pattern: /\bgemini|google\b/i, tags: ['#Gemini', '#Google', '#IA']},
  {pattern: /\bprecio|coste|barato|caro|suscripcion|dinero|tokens?\b/i, tags: ['#Ahorro', '#Productividad', '#IA']},
  {pattern: /\bfallo|error|problema|limite|limitacion|visual\b/i, tags: ['#AITools', '#Tecnologia', '#Review']},
  {pattern: /\bcomparativa|versus|\bvs\b|gana|pierde|mejor|peor\b/i, tags: ['#Comparativa', '#Review', '#InteligenciaArtificial']},
  {pattern: /\bpython|datos|automatizacion|pipeline|agentes?\b/i, tags: ['#Python', '#Automatizacion', '#Datos']},
  {pattern: /\binversion|trading|bolsa|mercado|portfolio\b/i, tags: ['#Inversion', '#Trading', '#Bolsa']}
];

function cleanHashtag(tag) {
  const cleaned = String(tag || '').trim().replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
  return cleaned ? `#${cleaned}` : '';
}

export function normalizeHashtags(value, priority = []) {
  const found = String(value || '').match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const fallback = ['#IA', '#InteligenciaArtificial', '#YouTube', '#Shorts', '#Tecnologia', '#Automatizacion', '#Python', '#MachineLearning', '#Productividad', '#Creator', '#Tutorial', '#Datos', '#Innovacion', '#Aprendizaje'];
  const tags = [];
  for (const rawTag of [...priority, ...found, ...fallback]) {
    const tag = cleanHashtag(rawTag);
    if (tag && !tags.includes(tag)) tags.push(tag);
    if (tags.length === 14) break;
  }
  return tags.join(' ');
}

function generateChapters(captions, minGap = 10) {
  if (!captions.length) return [{start: 0, title: 'Introduccion'}];
  const duration = Math.max(...captions.map((caption) => caption.end));
  if (duration < 30) return [{start: 0, title: 'Introduccion'}];
  const count = duration < 360 ? 3 : Math.min(8, Math.max(4, Math.floor(duration / 180)));
  const step = Math.max(30, duration / count);
  const chapters = [{start: 0, title: 'Introduccion'}];
  for (let target = step; target < duration - minGap; target += step) {
    const caption = captions.reduce((best, item) => (
      Math.abs(item.start - target) < Math.abs(best.start - target) ? item : best
    ), captions[0]);
    const title = caption.text.split(/\s+/).slice(0, 7).join(' ').replace(/[.,;:]$/g, '') || 'Siguiente tema';
    const start = Math.max(0, Math.floor(caption.start));
    if (start - chapters[chapters.length - 1].start >= minGap) {
      chapters.push({start, title: title[0]?.toUpperCase() + title.slice(1)});
    }
  }
  return chapters;
}

function chaptersToLines(chapters) {
  return chapters.map((chapter) => `${formatTimestamp(chapter.start)} ${chapter.title}`);
}

function fallbackTitles() {
  return Array.from({length: 10}, (_, index) => ({
    title: `Idea de titulo ${index + 1}`,
    reason: 'Fallback local; revisar con el contexto del video.',
    score: 70 - index
  }));
}

function inferTopicTags(text, baseHashtags = '') {
  const tags = [];
  for (const topic of TOPIC_HASHTAGS) {
    if (topic.pattern.test(text)) tags.push(...topic.tags);
  }
  tags.push(...String(baseHashtags).split(/\s+/).filter(Boolean));
  return tags;
}

function compactText(text, max = 220) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3).replace(/\s+\S*$/, '')}...`;
}

function titleCore(title) {
  return String(title || '')
    .replace(/#[\p{L}\p{N}_]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 78);
}

function detectSubject(text) {
  const normalized = text.toLowerCase();
  if (/\bglm[\s.-]?5(?:\.?2)?\b|\bglm\b/i.test(text)) return 'GLM 5.2';
  if (/\bchatgpt|gpt\b/i.test(text)) return 'ChatGPT';
  if (/\bclaude\b/i.test(text)) return 'Claude';
  if (/\bgemini\b/i.test(text)) return 'Gemini';
  if (normalized.includes('precio') || normalized.includes('coste')) return 'el precio';
  if (normalized.includes('fallo') || normalized.includes('error')) return 'el fallo';
  return 'esta comparativa';
}

function titleVariants(candidate) {
  const text = candidate.text || '';
  const subject = detectSubject(text);
  const base = titleCore(candidate.suggestedTitle);
  const variants = [
    base,
    `El detalle que cambia ${subject}`,
    `${subject}: lo que si importa`,
    `La prueba que separa hype y realidad`,
    `Por que este clip cambia mi opinion`
  ].filter(Boolean);
  const unique = [];
  for (const variant of variants) {
    const clean = titleCore(variant);
    if (clean && !unique.some((item) => item.toLowerCase() === clean.toLowerCase())) unique.push(clean);
  }
  return unique.slice(0, 5);
}

export function buildClipPublishing(candidate, baseMetadata = {}) {
  const hashtags = normalizeHashtags(baseMetadata.hashtags, inferTopicTags(candidate.text, baseMetadata.hashtags));
  const hashtagList = hashtags.split(/\s+/).filter(Boolean);
  const priorityHashtags = hashtagList.slice(0, 4);
  const titles = titleVariants(candidate);
  const title = titles[0] || 'Clip destacado';
  const hook = compactText(candidate.hook || candidate.text, 170);
  const proof = compactText(candidate.text, 260);
  const firstLine = priorityHashtags.join(' ');
  const shortDescription = `${firstLine}\n\n${hook}\n\n${hashtags}`;
  const youtubeTitle = titleCore(title).slice(0, 90);
  const offsetHours = Math.max(0, Number(candidate.rank ?? 1) - 1) * 36;
  return {
    title: youtubeTitle,
    titleVariants: titles,
    hashtags,
    priorityHashtags,
    schedule: {
      recommendedOffsetHours: offsetHours,
      cadence: 'Publicar 1 clip cada 24-48 horas para no dividir la audiencia semilla.'
    },
    youtube_shorts: {
      title: youtubeTitle,
      description: shortDescription,
      tags: hashtagList.map((tag) => tag.slice(1))
    },
    instagram: {
      caption: `${firstLine}\n\n${hook}\n\n${hashtags}`
    },
    tiktok: {
      caption: `${hook}\n\n${hashtags}`
    },
    x: {
      text: compactText(`${title}\n\n${firstLine}\n\n${hook}`, 280)
    },
    editorial: {
      hook,
      proof,
      antiCannibalization: 'Usar un angulo, titulo y primer frame distinto al resto de clips del mismo video.'
    }
  };
}

export function postForPlatform(metadata = {}, clip = {}, platform) {
  return clip.publishing?.[platform] ?? metadata.platform_posts?.[platform] ?? {};
}

function fallbackMetadata(captions, chapters) {
  const transcript = captionsToText(captions);
  const summary = transcript.slice(0, 280) || 'Resumen pendiente: falta transcripcion util.';
  const hashtags = normalizeHashtags('');
  const titles = fallbackTitles();
  const timestampLines = chaptersToLines(chapters);
  const description = `${summary}\n\nCapitulos:\n${timestampLines.join('\n')}\n\n${hashtags}`;
  return {
    summary: {short: summary.slice(0, 180), medium: summary, youtube_description: description},
    titles: {youtube: titles, youtube_shorts: titles, tiktok: titles, instagram: titles, x: titles},
    hashtags,
    timestamps: timestampLines,
    platform_posts: {
      youtube: {title: titles[0].title, description, tags: hashtags.split(' ').map((tag) => tag.slice(1)), privacy: 'private'},
      youtube_shorts: {title: titles[0].title, description: `${summary.slice(0, 120)}\n\n${hashtags}`, tags: hashtags.split(' ').map((tag) => tag.slice(1))},
      instagram: {caption: `${summary.slice(0, 180)}\n\n${hashtags}`},
      tiktok: {caption: `${summary.slice(0, 150)}\n\n${hashtags}`},
      x: {text: `${summary.slice(0, 220)}\n\n${hashtags}`}
    }
  };
}

function normalizeMetadata(raw, captions, chapters) {
  const fallback = fallbackMetadata(captions, chapters);
  const metadata = {
    ...fallback,
    ...raw,
    summary: {...fallback.summary, ...(raw.summary ?? {})},
    titles: {...fallback.titles, ...(raw.titles ?? {})},
    platform_posts: {...fallback.platform_posts, ...(raw.platform_posts ?? {})}
  };
  metadata.hashtags = normalizeHashtags(metadata.hashtags);
  metadata.timestamps = chaptersToLines(chapters);
  return metadata;
}

export async function generatePublishingMetadata(captions, options = {}) {
  const chapters = generateChapters(captions);
  const config = getLlmConfig(options);
  if (!options.useLlm || !isLlmEnabled(config)) {
    return {...fallbackMetadata(captions, chapters), llmUsed: false};
  }

  const transcript = captionsToText(captions).slice(0, Number(options.maxTranscriptChars ?? 24000));
  const segments = captions.slice(0, 500).map((caption) => ({start: round(caption.start, 2), end: round(caption.end, 2), text: caption.text}));
  const prompt = `A partir de esta transcripcion genera metadata de publicacion para YouTube, YouTube Shorts, Instagram Reels, TikTok y X.
Devuelve JSON valido con esta estructura: summary {short, medium, youtube_description}, titles {youtube, youtube_shorts, tiktok, instagram, x}, hashtags, timestamps, platform_posts.
Reglas:
- 10 titulos por plataforma, cada titulo con title, reason y score.
- Exactamente 14 hashtags, una sola linea, separados por espacios.
- Timestamps en orden, primer timestamp 00:00, capitulos utiles, sin inventar temas.
- Espanol claro, directo y sin clickbait falso.
- Mantener precision: no inventes datos.
Capitulos base sugeridos:
${chaptersToLines(chapters).join('\n')}
Segmentos:
${JSON.stringify(segments)}
Transcripcion completa resumible:
${transcript}`;

  try {
    const raw = await chatJson([
      {role: 'system', content: 'Eres un estratega senior de contenido para video. Devuelve solo JSON valido.'},
      {role: 'user', content: prompt}
    ], {...config, temperature: Number(options.temperature ?? 0.7), maxTokens: Number(options.maxTokens ?? 1800)});
    return {...normalizeMetadata(raw, captions, chapters), llmUsed: true};
  } catch (error) {
    return {...fallbackMetadata(captions, chapters), llmUsed: false, warning: `Publishing metadata LLM failed; using local fallback: ${error.message}`};
  }
}
