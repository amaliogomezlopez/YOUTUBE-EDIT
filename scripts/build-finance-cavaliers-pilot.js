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
const MARKET_SERIES_FILE = path.join(
  ROOT,
  'channels',
  CHANNEL_ID,
  'data',
  'mags-spy-relative-2025-2026.json'
);
const COMPANY_LOGO_ASSETS = [
  {
    id: 'finance-cavaliers-nvidia',
    kind: 'logo',
    label: 'NVIDIA',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-nvidia.png'
  },
  {
    id: 'finance-cavaliers-apple',
    kind: 'logo',
    label: 'APPLE',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-apple.png'
  },
  {
    id: 'finance-cavaliers-microsoft',
    kind: 'logo',
    label: 'MICROSOFT',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-microsoft.png'
  },
  {
    id: 'finance-cavaliers-amazon',
    kind: 'logo',
    label: 'AMAZON',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-amazon.png'
  },
  {
    id: 'finance-cavaliers-alphabet',
    kind: 'logo',
    label: 'ALPHABET',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-alphabet.png'
  },
  {
    id: 'finance-cavaliers-meta',
    kind: 'logo',
    label: 'META',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-meta.png'
  },
  {
    id: 'finance-cavaliers-tesla',
    kind: 'logo',
    label: 'TESLA',
    path: 'assets/library/finance-cavaliers-company-logos/finance-cavaliers-tesla.png'
  }
];
const DOTCOM_LOGO_ASSETS = [
  {
    id: 'finance-cavaliers-cisco',
    kind: 'logo',
    label: 'CISCO',
    path: 'assets/library/finance-cavaliers-dotcom-logos/finance-cavaliers-cisco.png'
  },
  COMPANY_LOGO_ASSETS.find((asset) => asset.label === 'MICROSOFT'),
  {
    id: 'finance-cavaliers-intel',
    kind: 'logo',
    label: 'INTEL',
    path: 'assets/library/finance-cavaliers-dotcom-logos/finance-cavaliers-intel.png'
  },
  {
    id: 'finance-cavaliers-dell',
    kind: 'logo',
    label: 'DELL',
    path: 'assets/library/finance-cavaliers-dotcom-logos/finance-cavaliers-dell.png'
  }
].filter(Boolean);
const MARKET_IMAGE_ASSET = {
  id: 'finance-cavaliers-market-screen',
  kind: 'image',
  label: 'Pantalla de mercados',
  path: 'assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-screen.jpg'
};
const AI_SERVERS_IMAGE_ASSET = {
  id: 'finance-cavaliers-ai-servers',
  kind: 'image',
  label: 'Centro de datos',
  path: 'assets/library/finance-cavaliers-editorial-images/finance-cavaliers-ai-servers.jpg'
};
const MARKET_ANALYST_IMAGE_ASSET = {
  id: 'finance-cavaliers-market-analyst',
  kind: 'image',
  label: 'Analista de mercados',
  path: 'assets/library/finance-cavaliers-editorial-images/finance-cavaliers-market-analyst.jpg'
};
const FIRST_MINUTE_BLUEPRINTS = [
  {
    kind: 'market-seed',
    headline: 'El mercado empieza a separarse',
    supportingText: 'Dos señales reales, normalizadas para poder compararlas.',
    semanticCues: [
      {id: 'decade', anchorText: 'Por', atSeconds: 0.82, durationSeconds: 1.35, action: 'highlight', target: 'context', label: 'MÁS DE UNA DÉCADA', tone: 'gold', sound: 'smooth-whoosh'},
      {id: 'two-lines', anchorText: 'dos', atSeconds: 4.6, durationSeconds: 1.2, action: 'reveal', target: 'series-seeds', label: 'DOS LÍNEAS', tone: 'cyan', sound: 'data-tick'},
      {id: 'lines-reveal', anchorText: 'líneas', atSeconds: 4.9, durationSeconds: 2.5, action: 'reveal', target: 'both-series', tone: 'neutral', sound: 'rise-whoosh'},
      {id: 'separation', anchorText: 'separando', atSeconds: 7.58, durationSeconds: 2.2, action: 'shade', target: 'divergence-gap', tone: 'negative', sound: 'quick-whip'},
      {id: 'drastic', anchorText: 'drástica', atSeconds: 8.46, durationSeconds: 1.35, action: 'highlight', target: 'divergence-gap', label: 'SEPARACIÓN DRÁSTICA', tone: 'negative', sound: 'soft-impact'}
    ]
  },
  {
    kind: 'market-xray',
    headline: 'Superficie / señal interna',
    supportingText: 'La misma pantalla cuenta dos historias distintas.',
    semanticCues: [
      {id: 'reveal', anchorText: 'revela', atSeconds: 0.1, durationSeconds: 1.25, action: 'scan', target: 'chart-layers', label: 'LO QUE REVELA', tone: 'neutral', sound: 'processing'},
      {id: 'below-surface', anchorText: 'bajo', atSeconds: 4, durationSeconds: 2.3, action: 'reveal', target: 'relative-layer', label: 'BAJO LA SUPERFICIE', tone: 'negative', sound: 'smooth-whoosh'},
      {id: 'first-line', anchorText: 'primera', atSeconds: 6.54, durationSeconds: 2.05, action: 'zoom', target: 'spy-layer', label: 'PRIMERA LÍNEA', tone: 'gold', sound: 'ui-pulse'}
    ]
  },
  {
    kind: 'market-health',
    headline: 'El precio parece saludable',
    supportingText: 'Cierre de SPY normalizado a base 100.',
    semanticCues: [
      {id: 'price', anchorText: 'precio', atSeconds: 0.5, durationSeconds: 1.25, action: 'focus', target: 'spy-line', label: 'PRECIO DEL S&P 500', tone: 'gold', sound: 'data-tick'},
      {id: 'first-view', anchorText: 'primera', atSeconds: 4.47, durationSeconds: 1.25, action: 'highlight', target: 'full-chart', label: 'A PRIMERA VISTA', tone: 'positive', sound: 'pop'},
      {id: 'healthy', anchorText: 'saludable', atSeconds: 6.59, durationSeconds: 1.45, action: 'shade', target: 'chart-background', label: 'SALUDABLE', tone: 'positive', sound: 'success-chime'},
      {id: 'corrections', anchorText: 'correcciones', atSeconds: 8.55, durationSeconds: 2.1, action: 'zoom', target: '2026-05-28/2026-06-26', label: 'CORRECCIÓN RECIENTE', tone: 'negative', sound: 'quick-whip'}
    ]
  },
  {
    kind: 'market-recovery',
    headline: 'Recuperación del índice',
    supportingText: 'Cambio desde la base inicial de la serie.',
    semanticCues: [
      {id: 'revalued', anchorText: 'revalorizado', atSeconds: 0.48, durationSeconds: 1.35, action: 'reveal', target: 'recovery-arrow', label: 'REVALORIZADO', tone: 'positive', sound: 'rise-whoosh'},
      {id: 'recovered', anchorText: 'recuperando', atSeconds: 3.1, durationSeconds: 1.4, action: 'highlight', target: 'base-gain', label: 'RECUPERANDO TERRENO', tone: 'positive', sound: 'digital-count'},
      {id: 'highs', anchorText: 'máximos', atSeconds: 5.3, durationSeconds: 1.3, action: 'zoom', target: 'latest-spy-value', label: 'MÁXIMOS', tone: 'positive', sound: 'soft-impact'},
      {id: 'historical', anchorText: 'históricos', atSeconds: 6.02, durationSeconds: 1.2, action: 'focus', target: 'latest-spy-value', label: 'HISTÓRICOS', tone: 'gold', sound: 'ui-pulse'},
      {id: 'celebrate', anchorText: 'celebra', atSeconds: 7.72, durationSeconds: 0.4, action: 'highlight', target: 'market-recovery', label: 'EL MERCADO LO CELEBRA', tone: 'positive', sound: 'success-chime'}
    ]
  },
  {
    kind: 'market-contrast',
    headline: 'Sin embargo',
    supportingText: 'La fuerza relativa cuenta una historia distinta.',
    semanticCues: [
      {id: 'however', anchorText: 'Sin', atSeconds: 1.58, durationSeconds: 4.8, action: 'highlight', target: 'scene-tone', label: 'SIN EMBARGO', tone: 'negative', sound: 'alert-sting'},
      {id: 'second-line', anchorText: 'segunda', atSeconds: 3.72, durationSeconds: 2.55, action: 'focus', target: 'relative-line', label: 'SEGUNDA LÍNEA', tone: 'cyan', sound: 'data-tick'},
      {id: 'distinct', anchorText: 'distinto', atSeconds: 5.96, durationSeconds: 0.45, action: 'shade', target: 'recent-relative-segment', label: 'ALGO MUY DISTINTO', tone: 'negative', sound: 'quick-whip'}
    ]
  },
  {
    kind: 'mag7-relationship',
    headline: 'Los siete magníficos',
    supportingText: 'Siete compañías comparadas como grupo frente al índice.',
    semanticCues: [
      {id: 'seven', anchorText: 'siete', atSeconds: 2.68, durationSeconds: 1.4, action: 'reveal', target: 'seven-company-logos', label: 'SIETE EMPRESAS', tone: 'gold', sound: 'rise-whoosh'},
      {id: 'relationship', anchorText: 'relación', atSeconds: 4.32, durationSeconds: 1.55, action: 'connect', target: 'mag7-to-spy', label: 'EN RELACIÓN CON EL MERCADO', tone: 'cyan', sound: 'data-tick'}
    ]
  },
  {
    kind: 'claim-audit',
    headline: 'La cifra debe coincidir',
    supportingText: 'La locución y la serie deben medir exactamente lo mismo.',
    semanticCues: [
      {id: 'months', anchorText: 'últimos', atSeconds: 0.56, durationSeconds: 2.1, action: 'focus', target: 'measurement-window', label: 'ÚLTIMOS MESES', tone: 'neutral', sound: 'ui-pulse'},
      {id: 'lost', anchorText: 'perdido', atSeconds: 3.3, durationSeconds: 2.2, action: 'reveal', target: 'narrated-loss', label: 'HAN PERDIDO', tone: 'negative', sound: 'smooth-whoosh'},
      {id: 'twenty', anchorText: '20', atSeconds: 5.48, durationSeconds: 1.45, action: 'highlight', target: 'narrated-20-percent', label: '20% EN LA LOCUCIÓN', tone: 'negative', sound: 'soft-impact'},
      {id: 'verified', anchorText: 'relativo', atSeconds: 6.94, durationSeconds: 6.6, action: 'verify', target: 'mags-spy-supported-value', label: 'SERIE REPRODUCIBLE', tone: 'cyan', sound: 'data-tick'},
      {id: 'strange', anchorText: 'sumamente', atSeconds: 14.09, durationSeconds: 2.3, action: 'highlight', target: 'claim-mismatch', label: 'SUMAMENTE EXTRAÑO', tone: 'negative', sound: 'soft-impact'}
    ]
  }
];
const SECOND_MINUTE_BLUEPRINTS = [
  {
    kind: 'market-engine',
    headline: 'El motor del mercado',
    supportingText: 'Las mismas compañías que impulsaron el índice.',
    semanticCues: [
      {id: 'same-companies', anchorText: 'mismas', atSeconds: 0.4, durationSeconds: 1.6, action: 'reveal', target: 'company-logos', label: 'LAS MISMAS EMPRESAS', tone: 'gold', sound: 'rise-whoosh'},
      {id: 'engine', anchorText: 'motor', atSeconds: 3.6, durationSeconds: 3, action: 'focus', target: 'market-engine', label: 'MOTOR DEL ÍNDICE', tone: 'gold', sound: 'digital-count'},
      {id: 'whole-market', anchorText: 'mercado', atSeconds: 4.6, durationSeconds: 2.1, action: 'connect', target: 'market-output', label: 'TODO EL MERCADO', tone: 'cyan', sound: 'soft-impact'},
      {id: 'named-companies', anchorText: 'Microsoft', atSeconds: 6.2, durationSeconds: 5.4, action: 'highlight', target: 'named-company-logos', label: 'MICROSOFT · NVIDIA · ALPHABET · AMAZON · META', tone: 'cyan'},
      {id: 'company-microsoft', anchorText: 'Microsoft', atSeconds: 6.28, durationSeconds: 0.82, action: 'focus', target: 'company-card-microsoft', label: 'MICROSOFT', tone: 'cyan', sound: 'logo-shimmer'},
      {id: 'company-nvidia', anchorText: 'Nvidia', atSeconds: 7.34, durationSeconds: 0.82, action: 'focus', target: 'company-card-nvidia', label: 'NVIDIA', tone: 'positive', sound: 'logo-shimmer'},
      {id: 'company-alphabet', anchorText: 'Alphabet', atSeconds: 8.24, durationSeconds: 0.82, action: 'focus', target: 'company-card-alphabet', label: 'ALPHABET', tone: 'cyan', sound: 'logo-shimmer'},
      {id: 'company-amazon', anchorText: 'Amazon', atSeconds: 9.1, durationSeconds: 0.82, action: 'focus', target: 'company-card-amazon', label: 'AMAZON', tone: 'gold', sound: 'logo-shimmer'},
      {id: 'company-meta', anchorText: 'Meta', atSeconds: 9.86, durationSeconds: 0.9, action: 'focus', target: 'company-card-meta', label: 'META', tone: 'cyan', sound: 'logo-shimmer'}
    ]
  },
  {
    kind: 'ai-core',
    headline: 'El núcleo del boom de la IA',
    supportingText: 'Tecnología, escala y una década de liderazgo bursátil.',
    semanticCues: [
      {id: 'ai-boom', anchorText: 'inteligencia', atSeconds: 0.7, durationSeconds: 3, action: 'focus', target: 'ai-core', label: 'BOOM DE LA IA', tone: 'cyan', sound: 'processing'},
      {id: 'gains', anchorText: 'ganancias', atSeconds: 4.4, durationSeconds: 2.2, action: 'connect', target: 'market-gains', label: 'GANANCIAS DE LA BOLSA', tone: 'positive', sound: 'rise-whoosh'},
      {id: 'decade', anchorText: 'década', atSeconds: 6.6, durationSeconds: 2, action: 'highlight', target: 'decade-track', label: 'UNA DÉCADA', tone: 'gold', sound: 'soft-impact'},
      {id: 'however', anchorText: 'Sin', atSeconds: 8.2, durationSeconds: 3, action: 'shade', target: 'scene-turn', label: 'SIN EMBARGO', tone: 'negative', sound: 'alert-sting'}
    ]
  },
  {
    kind: 'correction-alert',
    headline: 'La corrección activa las alarmas',
    supportingText: 'La locución habla de una corrección significativa, sin fijar una cifra.',
    semanticCues: [
      {id: 'correction', anchorText: 'corrección', atSeconds: 0.3, durationSeconds: 2.2, action: 'highlight', target: 'correction-zone', label: 'CORRECCIÓN SIGNIFICATIVA', tone: 'negative', sound: 'quick-whip'},
      {id: 'analysts', anchorText: 'analistas', atSeconds: 2.4, durationSeconds: 2, action: 'reveal', target: 'analyst-wave', label: 'OLEADA DE ANALISTAS', tone: 'cyan', sound: 'data-tick'},
      {id: 'alarm', anchorText: 'alarma', atSeconds: 4.5, durationSeconds: 1.5, action: 'focus', target: 'warning-signal', label: 'VOZ DE ALARMA', tone: 'negative', sound: 'alert-sting'}
    ]
  },
  {
    kind: 'bubble-trigger',
    headline: '¿El catalizador de la burbuja?',
    supportingText: 'Una advertencia, no una predicción demostrada.',
    semanticCues: [
      {id: 'warning', anchorText: 'Advierte', atSeconds: 0.3, durationSeconds: 1.4, action: 'reveal', target: 'warning-label', label: 'ADVERTENCIA', tone: 'negative', sound: 'ui-pulse'},
      {id: 'catalyst', anchorText: 'catavizador', atSeconds: 2.1, durationSeconds: 2.2, action: 'connect', target: 'catalyst-pin', label: 'CATALIZADOR', tone: 'gold', sound: 'tension-swell'},
      {id: 'bubble', anchorText: 'burbuja', atSeconds: 5.4, durationSeconds: 2.4, action: 'highlight', target: 'tech-bubble', label: 'BURBUJA TECNOLÓGICA', tone: 'negative', sound: 'bubble-burst'},
      {id: 'wall-street', anchorText: 'Wall', atSeconds: 8.6, durationSeconds: 2.3, action: 'focus', target: 'wall-street-rule', label: 'REGLA NO ESCRITA', tone: 'neutral', sound: 'smooth-whoosh'}
    ]
  },
  {
    kind: 'market-gravity',
    headline: 'La misma fuerza, en dos direcciones',
    supportingText: 'Impulso arriba. Riesgo de arrastre abajo.',
    semanticCues: [
      {id: 'rise', anchorText: 'subir', atSeconds: 0.3, durationSeconds: 2.2, action: 'zoom', target: 'upward-force', label: 'IMPULSO', tone: 'positive', sound: 'rise-whoosh'},
      {id: 'also', anchorText: 'también', atSeconds: 2.6, durationSeconds: 1.4, action: 'shade', target: 'direction-switch', label: 'TAMBIÉN', tone: 'negative', sound: 'quick-whip'},
      {id: 'drag', anchorText: 'arrastrarlo', atSeconds: 4.1, durationSeconds: 2, action: 'focus', target: 'downward-force', label: 'ARRASTRE', tone: 'negative', sound: 'soft-impact'},
      {id: 'abyss', anchorText: 'abismo', atSeconds: 5.7, durationSeconds: 1.2, action: 'highlight', target: 'abyss', label: 'ABISMO', tone: 'negative', sound: 'alert-sting'}
    ]
  },
  {
    kind: 'history-rewind',
    headline: 'Este libreto ya ocurrió',
    supportingText: 'La comparación histórica empieza en la burbuja puntocom.',
    semanticCues: [
      {id: 'not-first', anchorText: 'primera', atSeconds: 0.5, durationSeconds: 1.8, action: 'highlight', target: 'not-first-time', label: 'NO ES LA PRIMERA VEZ', tone: 'gold', sound: 'ui-pulse'},
      {id: 'same-script', anchorText: 'visto', atSeconds: 2.5, durationSeconds: 2.6, action: 'reveal', target: 'history-track', label: 'EL MISMO LIBRETO', tone: 'cyan', sound: 'processing'},
      {id: 'past', anchorText: 'pasado', atSeconds: 4.5, durationSeconds: 1.2, action: 'zoom', target: 'dotcom-destination', label: 'REBOBINAR', tone: 'negative', sound: 'rewind-sweep'}
    ]
  }
];
const THIRD_MINUTE_BLUEPRINTS = [
  {
    kind: 'historical-leaders',
    headline: 'Los cuatro jinetes de la puntocom',
    supportingText: 'Cuatro nombres concentraron la narrativa tecnológica de finales de los noventa.',
    semanticCues: [
      {id: 'dotcom-era', anchorText: 'burbuja', atSeconds: 0.5, durationSeconds: 1.8, action: 'zoom', target: 'dotcom-era', label: 'FINALES DE LOS 90', tone: 'gold', sound: 'keyboard'},
      {id: 'four-horsemen', anchorText: 'cuatro', atSeconds: 4.1, durationSeconds: 1.5, action: 'reveal', target: 'dotcom-company-row', label: 'LOS CUATRO JINETES', tone: 'cyan', sound: 'rise-whoosh'},
      {id: 'company-cisco', anchorText: 'Cisco', atSeconds: 7.1, durationSeconds: 0.85, action: 'focus', target: 'dotcom-company-cisco', label: 'CISCO', tone: 'cyan', sound: 'logo-shimmer'},
      {id: 'company-microsoft', anchorText: 'Microsoft', atSeconds: 8.1, durationSeconds: 0.85, action: 'focus', target: 'dotcom-company-microsoft', label: 'MICROSOFT', tone: 'cyan', sound: 'logo-shimmer'},
      {id: 'company-intel', anchorText: 'Intel', atSeconds: 9.1, durationSeconds: 0.85, action: 'focus', target: 'dotcom-company-intel', label: 'INTEL', tone: 'cyan', sound: 'logo-shimmer'},
      {id: 'company-dell', anchorText: 'Dell', atSeconds: 10.1, durationSeconds: 0.9, action: 'focus', target: 'dotcom-company-dell', label: 'DELL', tone: 'cyan', sound: 'logo-shimmer'}
    ]
  },
  {
    kind: 'dominance-facade',
    headline: 'Parecían imparables',
    supportingText: 'La narrativa de dominio creció hasta parecer incuestionable.',
    semanticCues: [
      {id: 'dominant-force', anchorText: 'dominante', atSeconds: 0.4, durationSeconds: 2.3, action: 'zoom', target: 'dominant-core', label: 'FUERZA DOMINANTE', tone: 'gold', sound: 'soft-impact'},
      {id: 'unstoppable', anchorText: 'imparables', atSeconds: 4.2, durationSeconds: 2, action: 'highlight', target: 'unstoppable-ring', label: 'IMPARABLES', tone: 'positive', sound: 'success-chime'},
      {id: 'no-competition', anchorText: 'nadie', atSeconds: 6.3, durationSeconds: 2.5, action: 'focus', target: 'competition-lock', label: 'NADIE PODÍA COMPETIR', tone: 'cyan', sound: 'processing'},
      {id: 'approaching-peak', anchorText: 'punto', atSeconds: 9.3, durationSeconds: 1.9, action: 'zoom', target: 'peak-warning', label: 'CERCA DEL PUNTO MÁS ALTO', tone: 'negative', sound: 'tension-swell'}
    ]
  },
  {
    kind: 'leadership-lag',
    headline: 'La debilidad apareció antes',
    supportingText: 'Los líderes empezaron a quedarse atrás antes del techo general.',
    semanticCues: [
      {id: 'peak', anchorText: 'alto', atSeconds: 0.4, durationSeconds: 1.5, action: 'zoom', target: 'market-peak', label: 'TECHO DEL MERCADO', tone: 'gold', sound: 'soft-impact'},
      {id: 'months-before', anchorText: 'meses', atSeconds: 4.1, durationSeconds: 2.2, action: 'focus', target: 'early-window', label: 'MESES ANTES', tone: 'cyan', sound: 'rewind-sweep'},
      {id: 'leaders-lag', anchorText: 'líderes', atSeconds: 7.1, durationSeconds: 3.2, action: 'zoom', target: 'leaders-drop', label: 'LOS LÍDERES SE QUEDAN ATRÁS', tone: 'negative', sound: 'quick-whip'}
    ]
  },
  {
    kind: 'contagion-spread',
    headline: 'La debilidad dejó de ser secreta',
    supportingText: 'El deterioro pasó de los líderes al resto del mercado.',
    semanticCues: [
      {id: 'quiet-weakness', anchorText: 'silencio', atSeconds: 0.3, durationSeconds: 2.4, action: 'focus', target: 'weak-leaders', label: 'DEBILIDAD SILENCIOSA', tone: 'negative', sound: 'data-loading'},
      {id: 'performance-fades', anchorText: 'flojear', atSeconds: 3.2, durationSeconds: 2.1, action: 'highlight', target: 'leader-pulse', label: 'EL RENDIMIENTO FLOJEA', tone: 'negative', sound: 'digital-count'},
      {id: 'contagion', anchorText: 'contagiándose', atSeconds: 5.7, durationSeconds: 3.3, action: 'zoom', target: 'contagion-wave', label: 'CONTAGIO', tone: 'negative', sound: 'bubble-burst'},
      {id: 'whole-market', anchorText: 'mercado', atSeconds: 8.2, durationSeconds: 1.1, action: 'focus', target: 'whole-market-grid', label: 'TODO EL MERCADO', tone: 'negative', sound: 'alert-sting'}
    ]
  },
  {
    kind: 'claim-evidence-gap',
    headline: 'La cifra necesita una fuente',
    supportingText: 'No convertimos una afirmación no verificada en una gráfica.',
    semanticCues: [
      {id: 'four-companies', anchorText: 'cuatro', atSeconds: 0.5, durationSeconds: 2, action: 'reveal', target: 'claim-companies', label: 'CUATRO COMPAÑÍAS', tone: 'cyan', sound: 'logo-shimmer'},
      {id: 'claimed-thirty', anchorText: '30', atSeconds: 4.1, durationSeconds: 3, action: 'verify', target: 'unsupported-thirty', label: '≈ 30 % · SIN VERIFICAR', tone: 'negative', sound: 'alert-sting'},
      {id: 'index-impact', anchorText: 'índice', atSeconds: 9.1, durationSeconds: 2.6, action: 'zoom', target: 'index-risk', label: 'EL PESO AMPLIFICA EL IMPACTO', tone: 'gold', sound: 'tension-swell'}
    ]
  }
];
const EDITORIAL_BLUEPRINTS = [
  ...FIRST_MINUTE_BLUEPRINTS,
  ...SECOND_MINUTE_BLUEPRINTS,
  ...THIRD_MINUTE_BLUEPRINTS
];
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

function normalizeCueToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%]/g, '');
}

function resolveSemanticCues(cues, words, sceneStartSeconds) {
  const normalizedWords = words.map((word) => normalizeCueToken(word.text));
  return cues.map((definition) => {
    const {
      anchorText,
      anchorOffsetSeconds = 0,
      ...cue
    } = definition;
    if (!anchorText) return cue;
    const anchorTokens = String(anchorText)
      .split(/\s+/)
      .map(normalizeCueToken)
      .filter(Boolean);
    const anchorIndex = normalizedWords.findIndex((_, index) =>
      anchorTokens.every(
        (token, offset) => normalizedWords[index + offset] === token
      )
    );
    if (anchorIndex < 0) return cue;
    return {
      ...cue,
      atSeconds: round(Math.max(
        0,
        Number(words[anchorIndex].start) -
          sceneStartSeconds +
          anchorOffsetSeconds
      ))
    };
  });
}

async function readLegacyTimeMap(narrationRun) {
  try {
    const payload = JSON.parse(await readFile(
      path.join(narrationRun, 'legacy-time-map.json'),
      'utf8'
    ));
    return Array.isArray(payload.mapping) ? payload.mapping : [];
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function mapSourceToOutput(seconds, mapping) {
  if (!mapping.length) return seconds;
  const segment = mapping.find((candidate) =>
    seconds >= candidate.sourceStartSeconds &&
    seconds <= candidate.sourceEndSeconds
  );
  if (segment) {
    return segment.outputStartSeconds +
      (seconds - segment.sourceStartSeconds);
  }
  const previous = [...mapping]
    .reverse()
    .find((candidate) => seconds > candidate.sourceEndSeconds);
  return previous?.outputEndSeconds ?? mapping[0].outputStartSeconds;
}

function mapOutputToSource(seconds, mapping) {
  if (!mapping.length) return seconds;
  const segment = mapping.find((candidate) =>
    seconds >= candidate.outputStartSeconds &&
    seconds <= candidate.outputEndSeconds
  );
  if (segment) {
    return segment.sourceStartSeconds +
      (seconds - segment.outputStartSeconds);
  }
  const previous = [...mapping]
    .reverse()
    .find((candidate) => seconds > candidate.outputEndSeconds);
  return previous?.sourceEndSeconds ?? mapping[0].sourceStartSeconds;
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
    title: 'SPY frente a MAGS/SPY',
    supporting: 'Precio del índice y fuerza relativa, ambos con base cien.',
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

function beatFor(seconds, legacyTimeMap = []) {
  const sourceSeconds = mapOutputToSource(seconds, legacyTimeMap);
  return BEATS.find(
    (beat) => sourceSeconds >= beat.start && sourceSeconds < beat.end
  ) ?? BEATS.at(-1);
}

function patternForKind(kind) {
  const patterns = {
    'split-lines': 'data.line-trend-zoom',
    'market-seed': 'data.line-trend-zoom',
    'market-xray': 'comparison.common-baseline',
    'market-health': 'data.line-trend-zoom',
    'market-recovery': 'data.hero-metric',
    'market-contrast': 'comparison.common-baseline',
    'mag7-relationship': 'process.signal-flow',
    'claim-audit': 'comparison.before-after-wipe',
    'market-engine': 'process.signal-flow',
    'ai-core': 'concept.accumulation',
    'correction-alert': 'process.signal-flow',
    'bubble-trigger': 'concept.accumulation',
    'market-gravity': 'comparison.common-baseline',
    'history-rewind': 'time.timeline-milestones',
    'historical-leaders': 'asset.logo-ecosystem',
    'dominance-facade': 'data.part-to-whole',
    'leadership-lag': 'data.line-trend-zoom',
    'contagion-spread': 'process.signal-flow',
    'claim-evidence-gap': 'comparison.before-after-wipe',
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

function kindData(kind, sloos, marketSeries) {
  const mag7 = [
    {label: 'NVIDIA', value: 7.66},
    {label: 'APPLE', value: 7.64},
    {label: 'MICROSOFT', value: 4.56},
    {label: 'AMAZON', value: 3.77},
    {label: 'ALPHABET', value: 5.72},
    {label: 'META', value: 2.21},
    {label: 'TESLA', value: 1.67}
  ];
  const marketData = {
    labels: [
      'SPY · CIERRE, BASE 100',
      'MAGS / SPY · FUERZA RELATIVA'
    ],
    chartData: marketSeries.series.map((datum) => ({
      label: datum.date,
      value: datum.spy
    })),
    secondaryChartData: marketSeries.series.map((datum) => ({
      label: datum.date,
      value: datum.mag7Relative
    })),
    metric: {
      value: marketSeries.summary.relativeChangeFromPeakPercent,
      suffix: '%',
      label: 'DESDE MÁX. RELATIVO · 29 OCT 2025'
    },
    sourceLabel:
      'Yahoo Finance (MAGS y SPY) · cierres diarios · 02 Ene 2025–17 Jul 2026 · cálculo propio MAGS/SPY, base 100'
  };
  if ([
    'market-seed',
    'market-xray',
    'market-health',
    'market-recovery',
    'market-contrast',
    'claim-audit'
  ].includes(kind)) {
    return marketData;
  }
  if (kind === 'mag7-relationship') {
    return {
      labels: mag7.map((item) => item.label),
      values: mag7.map((item) => item.value),
      valueLabels: mag7.map((item) => `${item.value.toFixed(2)} %`),
      sourceLabel:
        'State Street · composición SPY · 17 Jul 2026; relación MAGS/SPY calculada con cierres diarios'
    };
  }
  if (kind === 'market-engine') {
    return {
      labels: ['NVIDIA', 'APPLE', 'MICROSOFT', 'AMAZON', 'ALPHABET', 'META', 'TESLA'],
      sourceLabel: 'State Street · SPY holdings · 17 Jul 2026'
    };
  }
  if (kind === 'ai-core') {
    return {
      labels: ['MICROSOFT', 'NVIDIA', 'ALPHABET', 'AMAZON', 'META'],
      sourceLabel: 'Foto: panumas nikhomkhai · Pexels · recurso editorial'
    };
  }
  if (kind === 'correction-alert') {
    return {
      labels: ['MICROSOFT', 'NVIDIA', 'ALPHABET', 'AMAZON', 'META'],
      sourceLabel: 'Foto: AlphaTradeZone · Pexels · recurso editorial'
    };
  }
  if (['bubble-trigger', 'market-gravity', 'history-rewind'].includes(kind)) {
    return {
      sourceLabel: 'Ilustración conceptual · sin cifras ni escala'
    };
  }
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
    return marketData;
  }
  if ([
    'historical-leaders',
    'dominance-facade',
    'leadership-lag',
    'contagion-spread',
    'claim-evidence-gap'
  ].includes(kind)) {
    return {
      labels: ['CISCO', 'MICROSOFT', 'INTEL', 'DELL']
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

- La serie reproducible MAGS/SPY muestra −10,4 % desde el máximo relativo del
  29-10-2025 hasta el 17-07-2026; regrabar el «casi 20 %».
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
   - «Desde su máximo relativo del 29 de octubre de 2025 hasta el 17 de julio de
     2026, MAGS perdió un 10,4 % frente a SPY. La comparación usa cierres diarios
     y normaliza el cociente MAGS dividido por SPY a base cien.»

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
  const [transcript, narrationResult, sloos, marketSeries] = await Promise.all([
    readFile(transcriptFile, 'utf8').then(JSON.parse),
    readFile(narrationResultFile, 'utf8').then(JSON.parse),
    readFile(sloosFile, 'utf8').then(JSON.parse),
    readFile(MARKET_SERIES_FILE, 'utf8').then(JSON.parse)
  ]);
  const legacyTimeMap = await readLegacyTimeMap(narrationRun);
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
  const marketSeriesSnapshotFile = path.join(
    marketDataDirectory,
    'mags-spy-relative-2025-2026.json'
  );
  await copyFile(MARKET_SERIES_FILE, marketSeriesSnapshotFile);

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
      'src-yahoo-mags-history',
      'Roundhill Magnificent Seven ETF (MAGS) — historical data',
      'Yahoo Finance',
      marketSeries.source.landingPages[0],
      {status: 'ready'}
    ),
    sourceRecord(
      'src-yahoo-spy-history',
      'SPDR S&P 500 ETF Trust (SPY) — historical data',
      'Yahoo Finance',
      marketSeries.source.landingPages[1],
      {status: 'ready'}
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

  const sourceClaims = [
    makeClaim({
      id: 'claim-mag7-relative-minus-20',
      statement: 'Las Mag 7 han perdido cerca de 20% de valor relativo en los últimos meses.',
      sourceRefs: [
        'src-reference-video',
        'src-yahoo-mags-history',
        'src-yahoo-spy-history'
      ],
      dataRefs: ['data-mags-spy-relative'],
      confidence: 1,
      status: 'disputed',
      notes: `La serie reproducible MAGS/SPY muestra ${marketSeries.summary.relativeChangeFromPeakPercent}% desde el máximo relativo de ${marketSeries.summary.relativePeakDate} hasta ${marketSeries.range.end}; regrabar el audio.`,
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
  const claims = sourceClaims.map((claim) => ({
    ...claim,
    range: claim.range ? {
      startSeconds: round(
        mapSourceToOutput(claim.range.startSeconds, legacyTimeMap)
      ),
      endSeconds: round(
        mapSourceToOutput(claim.range.endSeconds, legacyTimeMap)
      )
    } : claim.range
  }));

  const dataAssets = [
    {
      id: 'data-mags-spy-relative',
      kind: 'series',
      sourceUrl: marketSeries.source.landingPages[0],
      provider: 'Yahoo Finance; cálculo editorial propio',
      retrievedAt: generatedAt,
      timezone: 'America/New_York',
      frequency: 'daily close; weekly visual sample',
      unit: 'index, base 100',
      currency: null,
      columns: ['date', 'spy', 'mag7Relative'],
      range: {
        start: marketSeries.range.start,
        end: marketSeries.range.end
      },
      localFile: path.relative(
        episodeDirectory,
        marketSeriesSnapshotFile
      ).replaceAll('\\', '/'),
      sha256: await sha256File(marketSeriesSnapshotFile),
      license: 'Third-party market data; attribute Yahoo Finance and retain methodology. Do not present as an official Bloomberg index.',
      status: 'confirmed'
    },
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
    const beat = beatFor(midpoint, legacyTimeMap);
    const blueprint = EDITORIAL_BLUEPRINTS[index];
    const kind =
      blueprint?.kind ??
      beat.kinds[index % beat.kinds.length];
    const headline = blueprint?.headline ?? beat.title;
    const supportingText =
      blueprint?.supportingText ?? beat.supporting;
    const sceneClaims = claimsForRange(
      claims,
      group.startSeconds,
      group.endSeconds
    );
    const status = factualStatusFor(sceneClaims);
    const companyAssets = [
      'company-orbit',
      'mag7-weights',
      'mag7-relationship',
      'market-engine',
      'ai-core',
      'correction-alert',
      'portfolio-grid',
      'market-ticker'
    ].includes(kind)
      ? COMPANY_LOGO_ASSETS
      : [
          'historical-leaders',
          'dominance-facade',
          'leadership-lag',
          'contagion-spread',
          'claim-evidence-gap'
        ].includes(kind)
        ? DOTCOM_LOGO_ASSETS
        : [];
    const sceneAssets = [
      ...companyAssets,
      ...(kind === 'market-ticker' && index % 4 === 1 ? [MARKET_IMAGE_ASSET] : []),
      ...(kind === 'ai-core' ? [AI_SERVERS_IMAGE_ASSET] : []),
      ...(kind === 'correction-alert' ? [MARKET_ANALYST_IMAGE_ASSET] : [])
    ];
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
        kind.includes('chart') ||
          ['market-seed', 'market-xray', 'market-health', 'market-contrast'].includes(kind)
          ? 'chart'
          : kind.includes('timeline') ? 'timeline'
            : kind.includes('ticker') || kind.includes('cards') ||
              ['market-recovery', 'claim-audit'].includes(kind) ? 'number'
              : kind.includes('text') || kind === 'brand-cta' ? 'text'
                : 'diagram',
      patternId: patternForKind(kind),
      compositionId: 'Finance-Cavaliers-Episode',
      effectIds: [
        ['split-lines', 'market-seed', 'market-health', 'market-contrast'].includes(kind)
          ? 'reveal.path-draw'
          : 'reveal.element-stagger',
        ['split-lines', 'market-health', 'market-contrast'].includes(kind)
          ? 'focus.path-follow'
          : 'focus.accent-only',
        ...([
          'split-lines',
          'market-xray',
          'market-health',
          'market-recovery',
          'market-contrast'
        ].includes(kind)
          ? ['camera.focus-zoom', 'focus.desaturate-peers']
          : []),
        'exit.clean-fade'
      ],
      assetRefs: [
        ...(kind === 'brand-cta' ? ['finance-cavaliers-logo'] : []),
        ...sceneAssets.map((asset) => asset.id)
      ],
      themeId: index % 5 === 0 ? 'oxide-documentary' : 'signal-cobalt',
      motionProfile: index % 7 === 0 ? 'kinetic' : 'editorial',
      soundProfile: blueprint ? 'word-synced-semantic' :
        kind === 'split-lines' ? 'trend-focus' : 'editorial-semantic',
      soundDecision: 'cue',
      header: {
        text: headline,
        position: 'centered'
      },
      props: {
        kind,
        supportingText,
        factualStatus: status,
        assets: sceneAssets,
        focusTarget: kind === 'split-lines' ? 'both' : undefined,
        semanticCues: resolveSemanticCues(
          blueprint?.semanticCues ?? [],
          words,
          group.startSeconds
        ),
        ...kindData(kind, sloos, marketSeries)
      },
      fallback: {
        patternId: 'text.kinetic-phrase',
        compositionId: 'Finance-Cavaliers-Episode',
        reason: 'Fallback editorial determinista sin cifras.',
        props: {
          kind: 'kinetic-text',
          factualStatus: status,
          supportingText
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
    soundEnabled: true,
    soundMix: 0.62,
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
      chartData: scene.props.chartData ?? [],
      secondaryChartData: scene.props.secondaryChartData ?? [],
      focusTarget: scene.props.focusTarget ?? 'both',
      assets: scene.props.assets ?? [],
      semanticCues: scene.props.semanticCues ?? []
    }))
  };
  const silentRenderProps = {
    ...renderProps,
    soundEnabled: false
  };
  const firstMinuteSceneCount = Math.min(
    FIRST_MINUTE_BLUEPRINTS.length,
    renderProps.scenes.length
  );
  const firstMinuteScenes = renderProps.scenes.slice(0, firstMinuteSceneCount);
  const firstMinuteDurationSeconds =
    firstMinuteScenes.at(-1)?.endSeconds ?? Math.min(60, durationSeconds);
  const firstMinuteRenderProps = {
    ...renderProps,
    durationSeconds: firstMinuteDurationSeconds,
    scenes: firstMinuteScenes
  };
  const firstMinuteSilentRenderProps = {
    ...firstMinuteRenderProps,
    soundEnabled: false
  };

  const visualPlanFile = path.join(visualsDirectory, 'visual-plan.json');
  const renderPropsFile = path.join(visualsDirectory, 'render-props.json');
  const silentRenderPropsFile = path.join(
    visualsDirectory,
    'render-props-silent.json'
  );
  const firstMinuteRenderPropsFile = path.join(
    visualsDirectory,
    'render-props-first-minute.json'
  );
  const firstMinuteSilentRenderPropsFile = path.join(
    visualsDirectory,
    'render-props-first-minute-silent.json'
  );
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
- Movimiento interno: cambio semántico o de foco como máximo cada 1,5 s
- Estado factual: preview editorial, no publicable

## Cobertura

| Tramo | Función | Familias visuales |
| --- | --- | --- |
${BEATS.map((beat) =>
    `| ${formatTime(beat.start)}–${formatTime(Math.min(beat.end, durationSeconds))} | ${beat.title} | ${beat.kinds.join(', ')} |`
  ).join('\n')}

## Reglas

- El logo y el audio son locales; el render no depende de URLs remotas.
- Los primeros siete bloques usan cues sincronizados a palabras concretas.
- Aplicar \`channels/finance-cavaliers/brand/editing-playbook.md\` al resto.
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
    writeFile(
      silentRenderPropsFile,
      `${JSON.stringify(silentRenderProps, null, 2)}\n`,
      'utf8'
    ),
    writeFile(
      firstMinuteRenderPropsFile,
      `${JSON.stringify(firstMinuteRenderProps, null, 2)}\n`,
      'utf8'
    ),
    writeFile(
      firstMinuteSilentRenderPropsFile,
      `${JSON.stringify(firstMinuteSilentRenderProps, null, 2)}\n`,
      'utf8'
    ),
    writeFile(guideFile, guide, 'utf8')
  ]);
  console.log(`Dossier: ${dossierFile}`);
  console.log(`Auditoría: ${auditMarkdownFile}`);
  console.log(`Tomas: ${pickupsFile}`);
  console.log(`Plan visual: ${visualPlanFile}`);
  console.log(`Props Remotion: ${renderPropsFile}`);
  console.log(`Props sin efectos: ${silentRenderPropsFile}`);
  console.log(`Props primer minuto: ${firstMinuteRenderPropsFile}`);
  console.log(`Props primer minuto sin efectos: ${firstMinuteSilentRenderPropsFile}`);
  console.log(`Escenas: ${renderScenes.length}`);
  console.log(`Publicable: ${auditJson.publishable ? 'sí' : 'no'}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
