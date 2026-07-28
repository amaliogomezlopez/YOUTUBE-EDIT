#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  validateResearchDossier,
  validateVisualPlan
} from '../src/modules/editorial-video/validator.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EPISODE_ID = 'episode-finance-cavaliers-001';
const CHANNEL_ID = 'finance-cavaliers';
const DEFAULT_EPISODE_DIRECTORY = path.join(
  ROOT,
  'data',
  'channels',
  CHANNEL_ID,
  'episodes',
  '1'
);
const REFERENCE_URL = 'https://www.youtube.com/watch?v=QNFLN6IvB88';
const SLOOS_DDP_URL =
  'https://www.federalreserve.gov/datadownload/Choose.aspx?rel=sloos';
const SLOOS_RELEASE_URL =
  'https://www.federalreserve.gov/data/sloos/sloos-202604.htm';
const SP500_BROCHURE_URL =
  'https://www.spglobal.com/spdji/en/documents/additional-material/sp-500-brochure.pdf';
const SPY_URL =
  'https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy';
const SP500_EARNINGS_URL =
  'https://www.spglobal.com/spdji/en/commentary/article/us-equities-market-attributes';
const SP500_2022_URL =
  'https://www.spglobal.com/spdji/en/commentary/article/us-equities-market-attributes-june-2022/';

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function sha256File(file) {
  return sha256(await readFile(file));
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function parseArgs(argv) {
  const args = {episode: DEFAULT_EPISODE_DIRECTORY, narrationRun: ''};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--episode') args.episode = argv[++index] ?? '';
    else if (token.startsWith('--episode=')) args.episode = token.slice(10);
    else if (token === '--narration-run') args.narrationRun = argv[++index] ?? '';
    else if (token.startsWith('--narration-run=')) {
      args.narrationRun = token.slice('--narration-run='.length);
    } else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Opción desconocida: ${token}`);
  }
  return args;
}

async function findLatestNarrationRun(episodeDirectory) {
  const root = path.join(episodeDirectory, 'narration', 'runs');
  const entries = await readdir(root, {withFileTypes: true});
  const runs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('narration-'))
    .map((entry) => path.join(root, entry.name))
    .sort();
  if (!runs.length) throw new Error(`No hay runs de narración en ${root}.`);
  return runs.at(-1);
}

function sourceRecord(id, title, publisher, canonicalUrl, {
  publishedAt = null,
  status = 'incomplete'
} = {}) {
  return {
    id,
    title,
    publisher,
    canonicalUrl,
    publishedAt,
    sourceHash: sha256(canonicalUrl),
    status
  };
}

function makeClaim({
  id,
  statement,
  type = 'numeric',
  sourceRefs,
  dataRefs = [],
  effectiveAt = null,
  confidence,
  status,
  notes,
  range
}) {
  return {
    id,
    statement,
    type,
    sourceRefs,
    dataRefs,
    effectiveAt,
    confidence,
    status,
    notes,
    range
  };
}

function dossierClaim(claim) {
  const {range: _range, ...result} = claim;
  return result;
}

function claimsForRange(claims, startSeconds, endSeconds) {
  return claims.filter((claim) =>
    claim.range &&
    startSeconds < claim.range.endSeconds &&
    endSeconds > claim.range.startSeconds
  );
}

function buildSceneGroups(segments, durationSeconds) {
  const groups = [];
  let current = [];
  let startSeconds = 0;
  for (const segment of segments) {
    current.push(segment);
    const groupDuration = segment.end - startSeconds;
    const closesSentence = /[.!?]$/.test(String(segment.text).trim());
    if (
      groupDuration >= 8.5 ||
      (groupDuration >= 5.3 && closesSentence)
    ) {
      groups.push({
        startSeconds,
        endSeconds: Number(segment.end),
        segments: current
      });
      startSeconds = Number(segment.end);
      current = [];
    }
  }
  if (current.length) {
    groups.push({
      startSeconds,
      endSeconds: durationSeconds,
      segments: current
    });
  } else if (groups.length) {
    groups.at(-1).endSeconds = durationSeconds;
  }
  return groups;
}

const BEATS = [
  {
    start: 0,
    end: 39,
    title: 'Dos líneas. Dos historias.',
    supporting: 'Lo visible arriba no siempre explica lo que ocurre debajo.',
    kinds: ['split-lines', 'market-ticker', 'kinetic-text']
  },
  {
    start: 39,
    end: 80,
    title: 'El liderazgo se separa',
    supporting: 'La tesis necesita una serie reproducible antes de fijar un porcentaje.',
    kinds: ['split-lines', 'company-orbit', 'market-ticker']
  },
  {
    start: 80,
    end: 117,
    title: 'Siete compañías, un mismo motor',
    supporting: 'IA, escala y concentración en un índice ponderado por capitalización.',
    kinds: ['company-orbit', 'mag7-weights', 'concentration-grid']
  },
  {
    start: 117,
    end: 167,
    title: 'El eco de la puntocom',
    supporting: 'Cisco, Microsoft, Intel y Dell lideraron otra narrativa de dominio.',
    kinds: ['historical-timeline', 'company-orbit', 'kinetic-text']
  },
  {
    start: 167,
    end: 244,
    title: 'La concentración amplifica',
    supporting: 'La comparación histórica sirve; los porcentajes deben probarse.',
    kinds: ['concentration-grid', 'historical-timeline', 'mag7-weights']
  },
  {
    start: 244,
    end: 318,
    title: 'El peso sigue a los beneficios',
    supporting: 'Capital, beneficios y peso de índice forman un circuito.',
    kinds: ['earnings-flow', 'sector-bars', 'historical-timeline']
  },
  {
    start: 318,
    end: 407,
    title: '¿Qué rompe el ciclo?',
    supporting: 'La demanda enlaza hogares, empresas, ingresos y beneficios.',
    kinds: ['earnings-cards', 'credit-flow', 'earnings-flow']
  },
  {
    start: 407,
    end: 455,
    title: 'El crédito como termómetro',
    supporting: 'Porcentaje neto de bancos que endurecen estándares C&I.',
    kinds: ['sloos-chart', 'credit-flow', 'kinetic-text']
  },
  {
    start: 455,
    end: 503,
    title: 'Cuando el grifo se cierra',
    supporting: 'El endurecimiento es señal de estrés, no una regla infalible.',
    kinds: ['credit-flow', 'sloos-chart', 'threshold-lanes']
  },
  {
    start: 503,
    end: 563,
    title: 'Del 50,8 % al 8,1 %',
    supporting: 'Pico 2023Q3 frente a la lectura 2026Q2 de la Reserva Federal.',
    kinds: ['sloos-chart', 'before-after', 'credit-flow']
  },
  {
    start: 563,
    end: 616,
    title: '500 nombres no pesan igual',
    supporting: 'El S&P 500 se pondera por capitalización ajustada por free float.',
    kinds: ['portfolio-grid', 'mag7-weights', 'concentration-grid']
  },
  {
    start: 616,
    end: 641,
    title: 'La historia detrás de los datos',
    supporting: 'Finance Cavaliers',
    kinds: ['brand-cta', 'company-orbit']
  }
];

function beatFor(seconds) {
  return BEATS.find((beat) => seconds >= beat.start && seconds < beat.end) ?? BEATS.at(-1);
}

function patternForKind(kind) {
  const patterns = {
    'split-lines': 'data.line-trend-zoom',
    'market-ticker': 'data.hero-metric',
    'kinetic-text': 'text.kinetic-phrase',
    'company-orbit': 'concept.scale-proportion',
    'mag7-weights': 'data.part-to-whole',
    'concentration-grid': 'concept.accumulation',
    'historical-timeline': 'time.timeline-milestones',
    'earnings-flow': 'process.signal-flow',
    'sector-bars': 'data.bar-focus',
    'earnings-cards': 'data.hero-metric',
    'credit-flow': 'process.signal-flow',
    'sloos-chart': 'data.line-trend-zoom',
    'threshold-lanes': 'comparison.common-baseline',
    'before-after': 'comparison.before-after-wipe',
    'portfolio-grid': 'concept.scale-proportion',
    'brand-cta': 'asset.logo-ecosystem'
  };
  return patterns[kind] ?? 'text.kinetic-phrase';
}

function kindData(kind, sloos) {
  const mag7 = [
    {label: 'NVIDIA', value: 7.66},
    {label: 'APPLE', value: 7.64},
    {label: 'MICROSOFT', value: 4.56},
    {label: 'AMAZON', value: 3.77},
    {label: 'ALPHABET', value: 5.72},
    {label: 'META', value: 2.21},
    {label: 'TESLA', value: 1.67}
  ];
  if (kind === 'mag7-weights' || kind === 'portfolio-grid') {
    return {
      labels: mag7.map((item) => item.label),
      values: mag7.map((item) => item.value),
      metric: {value: 33.23, suffix: '%', label: 'del SPY · 17 JUL 2026'},
      sourceLabel: 'State Street · SPY holdings · 17 Jul 2026'
    };
  }
  if (kind === 'sector-bars') {
    return {
      labels: ['TECNOLOGÍA', 'FINANZAS', 'COMUNICACIÓN', 'CONSUMO DISC.'],
      values: [36.81, 12.38, 9.89, 9.28],
      metric: {value: 36.81, suffix: '%', label: 'TECNOLOGÍA'},
      sourceLabel: 'State Street · SPY sector allocation · 17 Jul 2026'
    };
  }
  if (kind === 'earnings-cards') {
    return {
      labels: ['BENEFICIOS OPERATIVOS', 'VENTAS', 'MARGEN'],
      values: [618, 4.53, 13.62],
      valueLabels: ['618 B USD', '4,53 T USD', '13,62 %'],
      sourceLabel: 'S&P DJI · U.S. Equities Market Attributes · Nov 2025'
    };
  }
  if (kind === 'sloos-chart' || kind === 'before-after') {
    return {
      chartData: sloos.observations.map((datum) => ({
        label: datum.period,
        value: datum.value
      })),
      metric: {value: 8.1, suffix: '%', label: '2026Q2'},
      sourceLabel: 'Federal Reserve · SLOOS · SUBLPDCILS_N.Q'
    };
  }
  if (kind === 'threshold-lanes') {
    return {
      labels: ['≤ 5', '5–10', '10–20', '20–50', '≥ 50'],
      valueLabels: ['SIN CAMBIOS', 'MODESTO', 'MODERADO', 'SIGNIFICATIVO', 'MAYOR'],
      values: [5, 10, 20, 50, 75],
      sourceLabel: 'Federal Reserve · convención descriptiva SLOOS'
    };
  }
  if (kind === 'historical-timeline') {
    return {
      labels: ['1980s', '1999', '2000', '2008', '2022', '2026'],
      sourceLabel: 'Cronología editorial · cifras bloqueadas hasta verificar'
    };
  }
  if (kind === 'company-orbit') {
    return {
      labels: ['NVIDIA', 'APPLE', 'MICROSOFT', 'AMAZON', 'ALPHABET', 'META', 'TESLA']
    };
  }
  if (kind === 'credit-flow') {
    return {
      labels: ['BANCOS', 'CRÉDITO', 'INVERSIÓN', 'EMPLEO', 'DEMANDA', 'BENEFICIOS']
    };
  }
  if (kind === 'earnings-flow') {
    return {
      labels: ['BENEFICIOS', 'ENTRADAS DE CAPITAL', 'PESO EN EL ÍNDICE']
    };
  }
  if (kind === 'concentration-grid') {
    return {
      labels: ['LIDERAZGO', 'PESO', 'CORRELACIÓN', 'RIESGO']
    };
  }
  if (kind === 'split-lines') {
    return {
      labels: ['ÍNDICE', 'LIDERAZGO RELATIVO']
    };
  }
  if (kind === 'market-ticker') {
    return {
      labels: ['SUPERFICIE', 'SEÑAL', 'LECTURA'],
      valueLabels: ['PRECIO', 'LIDERAZGO', 'DIVERGENCIA']
    };
  }
  return {};
}

function factualStatusFor(sceneClaims) {
  if (sceneClaims.some((claim) =>
    claim.status === 'unsupported' || claim.status === 'disputed'
  )) return 'blocked';
  if (sceneClaims.some((claim) => claim.status === 'context-only')) return 'review';
  return 'supported';
}

function buildMarkdownAudit(claims, sources, durationSeconds) {
  const rows = claims.map((claim) => {
    const range = `${formatTime(claim.range.startSeconds)}–${formatTime(claim.range.endSeconds)}`;
    const replacement = claim.notes.replace(/\|/g, '\\|');
    return `| ${range} | ${claim.statement.replace(/\|/g, '\\|')} | ${claim.status} | ${replacement} |`;
  });
  return `# Auditoría factual — Finance Cavaliers · episodio 1

Duración de narración: ${durationSeconds.toFixed(3)} s

Estado: **preview editorial; no publicar hasta resolver los claims bloqueados**

Vídeo de referencia: ${REFERENCE_URL}

La referencia se usa únicamente para estudiar mecánicas visuales y localizar
posibles series. Sus capturas, marcas y gráficas no se reutilizan. Toda gráfica
publicable debe reconstruirse desde una fuente primaria o un dataset con
licencia y procedencia registradas.

## Claims del audio

| Audio | Afirmación | Estado | Decisión editorial |
| --- | --- | --- | --- |
${rows.join('\n')}

## Fuentes registradas

${sources.map((source) =>
    `- **${source.publisher}:** [${source.title}](${source.canonicalUrl})`
  ).join('\n')}

## Bloqueo de publicación

- No mostrar el «20 % relativo» sin definir cesta, ponderación, ventana y serie.
- No mostrar «Four Horsemen = 30 %»: contradice incluso la escala de la referencia.
- No mostrar «energía = un tercio a finales de los 80» sin serie histórica.
- Sustituir «40 % de todo el mercado estadounidense» por el universo correcto:
  las Mag 7 sumaban 33,23 % del SPY el 17-07-2026.
- Sustituir «mínimos» por «muy por debajo del pico de 2023»: 8,1 % en
  2026Q2 frente a 50,8 % en 2023Q3.
- Presentar SLOOS como señal de estrés crediticio, no como predictor infalible.
`;
}

function buildPickupsMarkdown() {
  return `# Tomas de corrección recomendadas

Estas frases evitan que el montaje publique cifras no demostradas.

1. **00:50 — liderazgo relativo**
   - Sustituir el «cerca de un 20 %» por:
   - «A 17 de julio de 2026, las siete grandes tecnológicas sumaban
     aproximadamente un tercio del S&P 500 a través del SPY. Esa concentración
     hace que cualquier pérdida de liderazgo importe al índice completo.»

2. **02:50 — Four Horsemen**
   - Eliminar «representaban aproximadamente el 30 %».
   - Propuesta: «En la burbuja puntocom el mercado también tuvo cuatro grandes
     líderes: Cisco, Microsoft, Intel y Dell. La comparación sirve para estudiar
     el liderazgo, pero no convierte ambos episodios en idénticos.»

3. **03:14 — energía**
   - Eliminar «a finales de los 80» y «un tercio» hasta conseguir una serie
     histórica licenciada.
   - Propuesta: «Décadas antes, la energía también llegó a dominar el índice.
     Cuando un sector concentra mucho peso, su giro se transmite al conjunto.»

4. **03:46 — 40 % de todo el mercado**
   - Sustituir por:
   - «El 17 de julio de 2026, las Mag 7 sumaban 33,23 % del SPY. No es el
     40 % de todo el mercado estadounidense: es aproximadamente un tercio de un
     vehículo que replica el S&P 500.»

5. **04:34 — beneficios y peso tecnológico 1995–2000**
   - No publicar «se duplicaron» ni «15 % a casi 30 %» hasta reconstruir ambas
     series con metodología homogénea.

6. **05:24 — récords**
   - Precisar que los datos disponibles son agregados del S&P 500:
   - «Con el 96 % de las compañías reportadas, S&P DJI estimaba para el trimestre
     618.000 millones de dólares de beneficio operativo, 4,53 billones en ventas
     y un margen del 13,62 %.»

7. **07:55–08:20 — indicador de recesión**
   - Sustituir la certeza causal por:
   - «Un endurecimiento fuerte del crédito es una señal de estrés que merece
     atención, pero no es una regla automática ni infalible.»

8. **08:21 — caída de 2022**
   - Evitar «cayó 25 %» sin decir desde qué máximo a qué mínimo.
   - Propuesta verificable: «En junio de 2022 el S&P 500 ya había entrado en
     mercado bajista, más de un 20 % por debajo de su máximo de cierre.»

9. **08:36 — mínimos actuales**
   - Sustituir por:
   - «La lectura bajó desde 50,8 % en 2023Q3 hasta 8,1 % en 2026Q2: muy por
     debajo del pico, aunque no en mínimos históricos.»

10. **08:58–09:23 — conclusión**
    - Mantenerla como interpretación, no como predicción:
    - «El crédito no confirma por sí solo un colapso inminente. Es una pieza del
      diagnóstico y debe leerse junto a beneficios, empleo y demanda.»
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/build-finance-cavaliers-pilot.js [--episode <dir>] [--narration-run <dir>]');
    return;
  }
  const generatedAt = new Date().toISOString();
  const episodeDirectory = path.resolve(args.episode);
  const narrationRun = args.narrationRun
    ? path.resolve(args.narrationRun)
    : await findLatestNarrationRun(episodeDirectory);
  const transcriptFile = path.join(
    narrationRun,
    'master-narration.faster-whisper.json'
  );
  const narrationResultFile = path.join(narrationRun, 'run-result.json');
  const audioFile = path.join(narrationRun, 'master-narration.m4a');
  const sloosFile = path.join(
    episodeDirectory,
    'research',
    'data',
    'fred',
    'sloos-ci-large-middle-market.json'
  );
  const logoFile = path.join(
    ROOT,
    'channels',
    CHANNEL_ID,
    'assets',
    'brand',
    'logo-primary.png'
  );
  const [transcript, narrationResult, sloos] = await Promise.all([
    readFile(transcriptFile, 'utf8').then(JSON.parse),
    readFile(narrationResultFile, 'utf8').then(JSON.parse),
    readFile(sloosFile, 'utf8').then(JSON.parse)
  ]);
  const durationSeconds = Number(
    narrationResult.masterDurationSeconds ??
    narrationResult.outputDurationSeconds ??
    639.708
  );
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('No se pudo resolver la duración de la narración.');
  }

  const researchDirectory = path.join(episodeDirectory, 'research');
  const storyDirectory = path.join(episodeDirectory, 'story');
  const visualsDirectory = path.join(episodeDirectory, 'visuals');
  const marketDataDirectory = path.join(researchDirectory, 'data', 'manual');
  await Promise.all([
    mkdir(researchDirectory, {recursive: true}),
    mkdir(storyDirectory, {recursive: true}),
    mkdir(visualsDirectory, {recursive: true}),
    mkdir(marketDataDirectory, {recursive: true})
  ]);

  const marketSnapshots = {
    version: 1,
    generatedAt,
    snapshots: [
      {
        id: 'spy-holdings-2026-07-17',
        effectiveAt: '2026-07-17',
        provider: 'State Street',
        sourceUrl: SPY_URL,
        unit: 'percent of SPY',
        values: {
          NVIDIA: 7.66,
          Apple: 7.64,
          Microsoft: 4.56,
          Amazon: 3.77,
          'Alphabet Class A': 3.17,
          'Alphabet Class C': 2.55,
          Meta: 2.21,
          Tesla: 1.67,
          magnificentSevenCombined: 33.23
        },
        method: 'Suma de las ocho líneas de holdings que representan siete empresas; Alphabet combina clases A y C.'
      },
      {
        id: 'spy-sectors-2026-07-17',
        effectiveAt: '2026-07-17',
        provider: 'State Street',
        sourceUrl: SPY_URL,
        unit: 'percent of SPY',
        values: {
          'Information Technology': 36.81,
          Financials: 12.38,
          'Communication Services': 9.89,
          'Consumer Discretionary': 9.28,
          'Health Care': 9.06,
          Industrials: 8.70,
          'Consumer Staples': 4.69,
          Energy: 3.26,
          Utilities: 2.20,
          'Real Estate': 1.91,
          Materials: 1.82
        }
      },
      {
        id: 'sp500-earnings-2025-11',
        effectiveAt: '2025-11',
        provider: 'S&P Dow Jones Indices',
        sourceUrl: SP500_EARNINGS_URL,
        unit: 'mixed; see keys',
        values: {
          reportingSharePercent: 96,
          operatingEarningsUsdBillion: 618,
          salesUsdTrillion: 4.53,
          marginPercent: 13.62
        },
        qualifier: 'Cifras esperadas con el 96% reportado; datos agregados del S&P 500, no sólo de las Mag 7.'
      }
    ]
  };
  const marketSnapshotsFile = path.join(
    marketDataDirectory,
    'verified-market-snapshots.json'
  );
  await writeFile(
    marketSnapshotsFile,
    `${JSON.stringify(marketSnapshots, null, 2)}\n`,
    'utf8'
  );

  const sources = [
    sourceRecord(
      'src-reference-video',
      'Vídeo de inspiración visual QNFLN6IvB88',
      'YouTube / canal tercero',
      REFERENCE_URL
    ),
    sourceRecord(
      'src-fed-sloos-ddp',
      'SLOOS Data Download Program',
      'Board of Governors of the Federal Reserve System',
      SLOOS_DDP_URL,
      {publishedAt: '2026-05-04T00:00:00Z', status: 'ready'}
    ),
    sourceRecord(
      'src-fed-sloos-april-2026',
      'The April 2026 Senior Loan Officer Opinion Survey',
      'Board of Governors of the Federal Reserve System',
      SLOOS_RELEASE_URL,
      {publishedAt: '2026-05-04T00:00:00Z', status: 'ready'}
    ),
    sourceRecord(
      'src-sp500-brochure',
      'S&P 500 — The Gauge of the U.S. Large-Cap Market',
      'S&P Dow Jones Indices',
      SP500_BROCHURE_URL
    ),
    sourceRecord(
      'src-state-street-spy',
      'State Street SPDR S&P 500 ETF Trust — holdings and sectors',
      'State Street',
      SPY_URL
    ),
    sourceRecord(
      'src-sp500-earnings',
      'U.S. Equities Market Attributes',
      'S&P Dow Jones Indices',
      SP500_EARNINGS_URL
    ),
    sourceRecord(
      'src-sp500-2022',
      'U.S. Equities Market Attributes June 2022',
      'S&P Dow Jones Indices',
      SP500_2022_URL
    )
  ];

  const claims = [
    makeClaim({
      id: 'claim-mag7-relative-minus-20',
      statement: 'Las Mag 7 han perdido cerca de 20% de valor relativo en los últimos meses.',
      sourceRefs: ['src-reference-video'],
      confidence: 0.2,
      status: 'unsupported',
      notes: 'Faltan cesta exacta, ponderación, benchmark, fecha inicial, fecha final y serie reproducible.',
      range: {startSeconds: 50, endSeconds: 66}
    }),
    makeClaim({
      id: 'claim-four-horsemen-thirty',
      statement: 'Cisco, Microsoft, Intel y Dell representaban aproximadamente 30% del S&P 500.',
      sourceRefs: ['src-reference-video'],
      confidence: 0.05,
      status: 'unsupported',
      notes: 'La escala de la propia gráfica de referencia ronda un máximo de 14–15%, no 30%. Eliminar la cifra.',
      range: {startSeconds: 170, endSeconds: 184}
    }),
    makeClaim({
      id: 'claim-energy-third-late-eighties',
      statement: 'Energía era cerca de un tercio del índice a finales de los años 80.',
      sourceRefs: ['src-reference-video'],
      confidence: 0.1,
      status: 'unsupported',
      notes: 'La fecha parece desplazada respecto al pico energético histórico. No publicar sin serie.',
      range: {startSeconds: 194, endSeconds: 207}
    }),
    makeClaim({
      id: 'claim-forty-percent-us-market',
      statement: 'Los gigantes tecnológicos representan 40% de todo el mercado bursátil estadounidense.',
      sourceRefs: ['src-reference-video', 'src-state-street-spy'],
      dataRefs: ['data-market-snapshots'],
      confidence: 0.05,
      status: 'disputed',
      notes: 'Confunde empresas, sector, índice y mercado total. La sustitución verificable es Mag 7 = 33,23% del SPY a 17-07-2026.',
      range: {startSeconds: 226, endSeconds: 239}
    }),
    makeClaim({
      id: 'claim-mag7-spy-33',
      statement: 'Las Mag 7 sumaban 33,23% del SPY el 17 de julio de 2026.',
      sourceRefs: ['src-state-street-spy'],
      dataRefs: ['data-market-snapshots'],
      effectiveAt: '2026-07-17T00:00:00Z',
      confidence: 0.98,
      status: 'supported',
      notes: 'Suma NVIDIA, Apple, Microsoft, Amazon, Alphabet A+C, Meta y Tesla.',
      range: {startSeconds: 80, endSeconds: 117}
    }),
    makeClaim({
      id: 'claim-tech-earnings-doubled',
      statement: 'Los beneficios tecnológicos prácticamente se duplicaron entre 1995 y 2000.',
      sourceRefs: ['src-reference-video'],
      confidence: 0.15,
      status: 'unsupported',
      notes: 'Falta definir earnings operativos/reportados/forward y una serie homogénea.',
      range: {startSeconds: 274, endSeconds: 282}
    }),
    makeClaim({
      id: 'claim-tech-weight-fifteen-thirty',
      statement: 'El peso tecnológico pasó de 15% a casi 30% entre 1995 y 2000.',
      sourceRefs: ['src-reference-video', 'src-sp500-brochure'],
      confidence: 0.35,
      status: 'unsupported',
      notes: 'El brochure confirma evolución y 33,1% en 2025, pero no prueba por sí solo los dos puntos narrados.',
      range: {startSeconds: 282, endSeconds: 291}
    }),
    makeClaim({
      id: 'claim-sp500-record-earnings-sales-margin',
      statement: 'El S&P 500 apuntaba a récords trimestrales de beneficios operativos, ventas y margen.',
      sourceRefs: ['src-sp500-earnings'],
      dataRefs: ['data-market-snapshots'],
      effectiveAt: '2025-11-30T00:00:00Z',
      confidence: 0.95,
      status: 'supported',
      notes: '618 B USD, 4,53 T USD y 13,62%, con 96% reportado. Es agregado S&P 500.',
      range: {startSeconds: 324, endSeconds: 346}
    }),
    makeClaim({
      id: 'claim-sloos-definition',
      statement: 'SLOOS mide el porcentaje neto de bancos que endurece estándares de crédito.',
      type: 'fact',
      sourceRefs: ['src-fed-sloos-ddp', 'src-fed-sloos-april-2026'],
      dataRefs: ['data-fed-sloos-ci'],
      effectiveAt: '2026-06-30T00:00:00Z',
      confidence: 1,
      status: 'supported',
      notes: 'Serie SUBLPDCILS_N.Q para préstamos C&I a empresas grandes y medianas.',
      range: {startSeconds: 407, endSeconds: 455}
    }),
    makeClaim({
      id: 'claim-sloos-forty-predicts-crash',
      statement: 'Más de 40% de endurecimiento casi siempre precede los mayores desplomes.',
      type: 'causal',
      sourceRefs: ['src-reference-video', 'src-fed-sloos-ddp'],
      dataRefs: ['data-fed-sloos-ci'],
      confidence: 0.25,
      status: 'disputed',
      notes: 'Es una generalización causal. 2023 superó 40% sin recesión posterior hasta 2026.',
      range: {startSeconds: 475, endSeconds: 501}
    }),
    makeClaim({
      id: 'claim-sp500-2022-minus-25',
      statement: 'En 2022 el mercado cayó 25%.',
      sourceRefs: ['src-sp500-2022'],
      confidence: 0.55,
      status: 'unsupported',
      notes: 'Puede aproximar pico-a-valle, pero el audio no define fechas. La fuente confirma más de 20% desde máximo de cierre en junio.',
      range: {startSeconds: 501, endSeconds: 516}
    }),
    makeClaim({
      id: 'claim-sloos-fifty-eight',
      statement: 'SLOOS bajó de 50,8% en 2023Q3 a 8,1% en 2026Q2.',
      sourceRefs: ['src-fed-sloos-ddp'],
      dataRefs: ['data-fed-sloos-ci'],
      effectiveAt: '2026-06-30T00:00:00Z',
      confidence: 1,
      status: 'supported',
      notes: 'No son mínimos históricos; sí una caída pronunciada desde el pico de 2023.',
      range: {startSeconds: 516, endSeconds: 548}
    }),
    makeClaim({
      id: 'claim-no-imminent-collapse',
      statement: 'Los datos crediticios dicen que no hay colapso inminente.',
      type: 'interpretation',
      sourceRefs: ['src-fed-sloos-ddp'],
      dataRefs: ['data-fed-sloos-ci'],
      confidence: 0.45,
      status: 'context-only',
      notes: 'SLOOS es una pieza del diagnóstico; no basta para descartar recesión o caída de mercado.',
      range: {startSeconds: 538, endSeconds: 563}
    }),
    makeClaim({
      id: 'claim-sp500-float-cap-weighted',
      statement: 'El S&P 500 no reparte el mismo peso entre 500 compañías; se pondera por capitalización ajustada por free float.',
      type: 'fact',
      sourceRefs: ['src-sp500-brochure', 'src-state-street-spy'],
      dataRefs: ['data-market-snapshots'],
      confidence: 1,
      status: 'supported',
      notes: 'La concentración es una propiedad de la metodología, no una anomalía oculta.',
      range: {startSeconds: 563, endSeconds: 616}
    })
  ];

  const dataAssets = [
    {
      id: 'data-fed-sloos-ci',
      kind: 'series',
      sourceUrl: SLOOS_DDP_URL,
      provider: 'Board of Governors of the Federal Reserve System',
      retrievedAt: generatedAt,
      timezone: 'not applicable',
      frequency: 'quarterly',
      unit: 'net percentage of domestic banks',
      currency: null,
      columns: ['period', 'value'],
      range: sloos.range,
      localFile: path.relative(
        episodeDirectory,
        sloosFile
      ).replaceAll('\\', '/'),
      sha256: await sha256File(sloosFile),
      license: 'U.S. Federal Reserve public data; attribute source and series.',
      status: 'confirmed'
    },
    {
      id: 'data-market-snapshots',
      kind: 'snapshot',
      sourceUrl: SPY_URL,
      provider: 'State Street and S&P Dow Jones Indices',
      retrievedAt: generatedAt,
      timezone: 'America/New_York',
      frequency: 'point-in-time',
      unit: 'mixed; declared per snapshot',
      currency: null,
      columns: ['id', 'effectiveAt', 'values', 'sourceUrl'],
      range: {start: '2025-11', end: '2026-07-17'},
      localFile: path.relative(
        episodeDirectory,
        marketSnapshotsFile
      ).replaceAll('\\', '/'),
      sha256: await sha256File(marketSnapshotsFile),
      license: 'Derived factual snapshot for attributed editorial use; do not redistribute source pages.',
      status: 'confirmed'
    }
  ];

  const dossier = {
    version: 1,
    episodeId: EPISODE_ID,
    topic: 'Concentración del S&P 500, liderazgo tecnológico y estándares de crédito',
    selectedCluster: {
      id: 'cluster-concentration-credit',
      title: '¿La debilidad de las grandes tecnológicas anticipa una caída?',
      sourceRefs: sources.map((source) => source.id),
      score: 86,
      reasons: [
        'Conecta concentración, beneficios y crédito con una pregunta clara.',
        'Permite separar datos de mercado de inferencias editoriales.',
        'SLOOS ofrece una serie primaria reproducible.'
      ]
    },
    sources,
    claims: claims.map(dossierClaim),
    dataAssets,
    entities: [
      {id: 'entity-sp500', name: 'S&P 500', type: 'index', aliases: ['The 500']},
      {id: 'entity-mag7', name: 'Magnificent Seven', type: 'equity-group', aliases: ['Mag 7']},
      {id: 'entity-fed', name: 'Federal Reserve', type: 'institution', aliases: ['Fed']},
      {id: 'entity-sloos', name: 'Senior Loan Officer Opinion Survey', type: 'dataset', aliases: ['SLOOS']}
    ],
    timeline: [],
    contradictions: [
      {
        id: 'contradiction-four-horsemen-share',
        claimRefs: ['claim-four-horsemen-thirty'],
        summary: 'La narración dice 30%, mientras la gráfica de referencia parece culminar cerca de 14–15%.',
        status: 'open'
      },
      {
        id: 'contradiction-current-concentration-universe',
        claimRefs: ['claim-forty-percent-us-market', 'claim-mag7-spy-33'],
        summary: 'El 40% del mercado total no es intercambiable con 33,23% del SPY.',
        status: 'resolved-by-source'
      }
    ],
    unknowns: [
      'Serie reproducible de rendimiento relativo Mag 7/S&P 500 y ventana exacta.',
      'Peso conjunto histórico de Cisco, Microsoft, Intel y Dell.',
      'Serie histórica homogénea de pesos sectoriales para energía y tecnología.',
      'Serie de beneficios tecnológicos 1995–2000 con definición explícita.'
    ],
    editorialWarnings: [
      'El vídeo de referencia no es una autoridad factual.',
      'No reutilizar capturas de gráficas con branding de terceros.',
      'No publicar la preview mientras existan claims bloqueados.',
      'Distinguir correlación crediticia, causalidad y predicción.'
    ],
    generatedAt
  };
  validateResearchDossier(dossier, {requireNumericDataRef: true});

  const allWords = transcript.segments.flatMap((segment) => segment.words ?? []);
  const groups = buildSceneGroups(transcript.segments, durationSeconds);
  const renderScenes = groups.map((group, index) => {
    const midpoint = (group.startSeconds + group.endSeconds) / 2;
    const beat = beatFor(midpoint);
    const kind = beat.kinds[index % beat.kinds.length];
    const sceneClaims = claimsForRange(
      claims,
      group.startSeconds,
      group.endSeconds
    );
    const status = factualStatusFor(sceneClaims);
    const words = allWords
      .map((word, wordIndex) => ({...word, wordIndex}))
      .filter((word) =>
        Number(word.end) > group.startSeconds &&
        Number(word.start) < group.endSeconds
      );
    const sourceRefs = [...new Set(
      sceneClaims.flatMap((claim) =>
        claim.status === 'supported' || claim.status === 'context-only'
          ? claim.sourceRefs
          : []
      )
    )];
    const dataRefs = [...new Set(
      sceneClaims.flatMap((claim) =>
        claim.status === 'supported' || claim.status === 'context-only'
          ? claim.dataRefs
          : []
      )
    )];
    return {
      id: `scene-${String(index + 1).padStart(3, '0')}`,
      order: index,
      startSeconds: round(group.startSeconds),
      endSeconds: round(group.endSeconds),
      narrationText: group.segments
        .map((segment) => String(segment.text).trim())
        .join(' '),
      wordRange: {
        startIndex: words[0]?.wordIndex ?? Math.max(0, index),
        endIndex: words.at(-1)?.wordIndex ?? Math.max(0, index)
      },
      claimRefs: sceneClaims.map((claim) => claim.id),
      sourceRefs,
      dataRefs,
      visualIntent:
        kind.includes('chart') ? 'chart'
          : kind.includes('timeline') ? 'timeline'
            : kind.includes('ticker') || kind.includes('cards') ? 'number'
              : kind.includes('text') || kind === 'brand-cta' ? 'text'
                : 'diagram',
      patternId: patternForKind(kind),
      compositionId: 'Finance-Cavaliers-Episode',
      effectIds: [
        index % 3 === 0 ? 'reveal.path-draw' : 'reveal.element-stagger',
        index % 4 === 0 ? 'focus.path-follow' : 'focus.accent-only',
        'exit.clean-fade'
      ],
      assetRefs: kind === 'brand-cta' ? ['finance-cavaliers-logo'] : [],
      themeId: index % 5 === 0 ? 'oxide-documentary' : 'signal-cobalt',
      motionProfile: index % 7 === 0 ? 'kinetic' : 'editorial',
      soundProfile: 'narration-first',
      soundDecision: 'silence',
      header: {
        text: beat.title,
        position: 'top-left'
      },
      props: {
        kind,
        supportingText: beat.supporting,
        factualStatus: status,
        ...kindData(kind, sloos)
      },
      fallback: {
        patternId: 'text.kinetic-phrase',
        compositionId: 'Finance-Cavaliers-Episode',
        reason: 'Fallback editorial determinista sin cifras.',
        props: {
          kind: 'kinetic-text',
          factualStatus: status,
          supportingText: beat.supporting
        }
      }
    };
  });

  const visualPlan = {
    version: 1,
    episodeId: EPISODE_ID,
    audioDurationSeconds: round(durationSeconds),
    fps: 30,
    scenes: renderScenes.map((scene) => {
      const {props, ...base} = scene;
      return {...base, props};
    }),
    coverage: {
      startSeconds: 0,
      endSeconds: round(durationSeconds),
      gaps: [],
      overlaps: []
    },
    generatedAt
  };
  validateVisualPlan(visualPlan);

  const publicEpisodeDirectory = path.join(
    ROOT,
    'remotion-animations',
    'public',
    'assets',
    'library',
    CHANNEL_ID,
    'episodes',
    '1'
  );
  await mkdir(publicEpisodeDirectory, {recursive: true});
  const stagedAudio = path.join(publicEpisodeDirectory, 'master-narration.m4a');
  const stagedLogo = path.join(publicEpisodeDirectory, 'logo-primary.png');
  await Promise.all([
    copyFile(audioFile, stagedAudio),
    copyFile(logoFile, stagedLogo)
  ]);

  const renderProps = {
    episodeId: EPISODE_ID,
    channelName: 'Finance Cavaliers',
    title: 'La concentración del mercado y la señal del crédito',
    durationSeconds: round(durationSeconds),
    audioPath: 'assets/library/finance-cavaliers/episodes/1/master-narration.m4a',
    logoPath: 'assets/library/finance-cavaliers/episodes/1/logo-primary.png',
    accentColor: '#FFC83D',
    previewMode: 'editorial',
    narrationVolume: 1,
    scenes: renderScenes.map((scene) => ({
      id: scene.id,
      startSeconds: scene.startSeconds,
      endSeconds: scene.endSeconds,
      kind: scene.props.kind,
      headline: scene.header.text,
      supportingText: scene.props.supportingText,
      narrationText: scene.narrationText,
      factualStatus: scene.props.factualStatus,
      sourceLabel: scene.props.sourceLabel,
      labels: scene.props.labels ?? [],
      values: scene.props.values ?? [],
      valueLabels: scene.props.valueLabels ?? [],
      metric: scene.props.metric,
      chartData: scene.props.chartData ?? []
    }))
  };

  const visualPlanFile = path.join(visualsDirectory, 'visual-plan.json');
  const renderPropsFile = path.join(visualsDirectory, 'render-props.json');
  const dossierFile = path.join(researchDirectory, 'research-dossier.json');
  const auditJsonFile = path.join(researchDirectory, 'factual-audit.json');
  const auditMarkdownFile = path.join(researchDirectory, 'FACTUAL-AUDIT.md');
  const pickupsFile = path.join(storyDirectory, 'EDITORIAL-PICKUPS.md');
  const guideFile = path.join(visualsDirectory, 'GUIA_DE_MONTAJE.md');
  const auditJson = {
    version: 1,
    episodeId: EPISODE_ID,
    generatedAt,
    publishable: !claims.some((claim) =>
      claim.status === 'unsupported' || claim.status === 'disputed'
    ),
    referencePolicy: {
      referenceUrl: REFERENCE_URL,
      use: 'motion-mechanics-only',
      reuseScreenshots: false,
      reuseBranding: false,
      factualAuthority: false
    },
    claims
  };
  const guide = `# Guía de montaje — Finance Cavaliers · episodio 1

## Máster

- Audio: ${path.basename(audioFile)}
- Duración: ${durationSeconds.toFixed(3)} s
- Formato: 1920×1080, 30 fps
- Frames: ${Math.ceil(durationSeconds * 30)}
- Escenas: ${renderScenes.length}
- Movimiento interno: pulsos, trazados o cambios de foco cada 1,6–2,2 s
- Estado factual: preview editorial, no publicable

## Cobertura

| Tramo | Función | Familias visuales |
| --- | --- | --- |
${BEATS.map((beat) =>
    `| ${formatTime(beat.start)}–${formatTime(Math.min(beat.end, durationSeconds))} | ${beat.title} | ${beat.kinds.join(', ')} |`
  ).join('\n')}

## Reglas

- El logo y el audio son locales; el render no depende de URLs remotas.
- Las gráficas del canal de referencia no se copian ni se desmarcan.
- SLOOS se redibuja desde la descarga oficial de la Reserva Federal.
- Los pesos de SPY son snapshots fechados, no cifras permanentes.
- Una escena bloqueada muestra una banda editorial en preview y evita dibujar
  el número dudoso.
- La versión limpia sólo se habilita después de sustituir las tomas marcadas.

## Comando de preview

\`\`\`powershell
cd remotion-animations
node scripts/render-safe.mjs still finance-cavaliers-episode-1 Finance-Cavaliers-Episode finance-cavaliers-episode-1.png --frame=12600 --props="${renderPropsFile}"
\`\`\`
`;
  await Promise.all([
    writeFile(dossierFile, `${JSON.stringify(dossier, null, 2)}\n`, 'utf8'),
    writeFile(auditJsonFile, `${JSON.stringify(auditJson, null, 2)}\n`, 'utf8'),
    writeFile(
      auditMarkdownFile,
      buildMarkdownAudit(claims, sources, durationSeconds),
      'utf8'
    ),
    writeFile(pickupsFile, buildPickupsMarkdown(), 'utf8'),
    writeFile(visualPlanFile, `${JSON.stringify(visualPlan, null, 2)}\n`, 'utf8'),
    writeFile(renderPropsFile, `${JSON.stringify(renderProps, null, 2)}\n`, 'utf8'),
    writeFile(guideFile, guide, 'utf8')
  ]);
  console.log(`Dossier: ${dossierFile}`);
  console.log(`Auditoría: ${auditMarkdownFile}`);
  console.log(`Tomas: ${pickupsFile}`);
  console.log(`Plan visual: ${visualPlanFile}`);
  console.log(`Props Remotion: ${renderPropsFile}`);
  console.log(`Escenas: ${renderScenes.length}`);
  console.log(`Publicable: ${auditJson.publishable ? 'sí' : 'no'}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
