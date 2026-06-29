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

function normalizeHashtags(value) {
  const found = String(value || '').match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const fallback = ['#IA', '#InteligenciaArtificial', '#YouTube', '#Shorts', '#Tecnologia', '#Automatizacion', '#Python', '#MachineLearning', '#Productividad', '#Creator', '#Tutorial', '#Datos', '#Innovacion', '#Aprendizaje'];
  const tags = [];
  for (const tag of [...found, ...fallback]) {
    if (!tags.includes(tag)) tags.push(tag);
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
