const THEMES = {
  'ink-lime': {
    background: '#07110F',
    ink: '#F2F7F3',
    muted: '#9EAEA5',
    accent: '#C6FF4A'
  },
  'editorial-ivory': {
    background: '#F1EEE6',
    ink: '#171713',
    muted: '#68675F',
    accent: '#1D55C5'
  },
  'signal-cobalt': {
    background: '#071322',
    ink: '#EEF5FF',
    muted: '#91A7C1',
    accent: '#4DD4FF'
  },
  'oxide-documentary': {
    background: '#15110F',
    ink: '#F2E9DE',
    muted: '#B7A99B',
    accent: '#E57246'
  },
  'slate-chalk': {
    background: '#0C0D0B',
    ink: '#F3E6C0',
    muted: '#A39474',
    accent: '#E8C04A'
  }
};

const FORMAT_DIMENSIONS = {
  landscape: {width: 1920, height: 1080},
  vertical: {width: 1080, height: 1920},
  square: {width: 1080, height: 1080},
  portrait: {width: 1080, height: 1350}
};

function linearChannel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const normalized = String(hex || '').replace('#', '');
  if (!/^[\da-f]{6}$/i.test(normalized)) return null;
  const channels = [0, 2, 4].map((offset) =>
    linearChannel(Number.parseInt(normalized.slice(offset, offset + 2), 16))
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  if (first === null || second === null) return 0;
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

function issue(severity, code, message, field) {
  return {severity, code, message, field};
}

export function evaluateRemotionProps(props = {}, {
  sourceContext = false,
  requireSoundDecision = true
} = {}) {
  const issues = [];
  const format = FORMAT_DIMENSIONS[props.format || 'landscape'];
  const theme = THEMES[props.themeId || 'ink-lime'];
  const title = String(props.title || '').trim();
  const supportingText = String(props.supportingText || '').trim();
  const items = Array.isArray(props.items) ? props.items : [];

  if (!format) {
    issues.push(issue('blocking', 'UNSUPPORTED_FORMAT', 'El formato no está registrado.', 'format'));
  }
  if (!theme) {
    issues.push(issue('blocking', 'UNKNOWN_THEME', 'El tema visual no está registrado.', 'themeId'));
  }
  if (props.showHeader !== false && !title && !supportingText) {
    issues.push(issue('warning', 'EMPTY_HEADER', 'El encabezado está activo pero no contiene texto.', 'showHeader'));
  }
  if (title.length > 96) {
    issues.push(issue('blocking', 'TITLE_OVERFLOW_RISK', 'El título supera 96 caracteres.', 'title'));
  } else if (title.length > 66) {
    issues.push(issue('warning', 'TITLE_DENSITY', 'El título es largo; revisa el salto de línea en todos los formatos.', 'title'));
  }
  if (supportingText.length > 180) {
    issues.push(issue('blocking', 'SUPPORTING_TEXT_OVERFLOW_RISK', 'El texto de apoyo supera 180 caracteres.', 'supportingText'));
  } else if (supportingText.length > 120) {
    issues.push(issue('warning', 'SUPPORTING_TEXT_DENSITY', 'El texto de apoyo puede competir con la animación.', 'supportingText'));
  }
  if (items.length > 6 && ['vertical', 'portrait'].includes(props.format)) {
    issues.push(issue('warning', 'PORTRAIT_ITEM_DENSITY', 'Más de seis elementos reducen la legibilidad vertical.', 'items'));
  }
  if (items.some((item) => String(item?.label || '').length > 26)) {
    issues.push(issue('warning', 'ITEM_LABEL_LENGTH', 'Hay etiquetas de más de 26 caracteres.', 'items'));
  }
  if (requireSoundDecision && typeof props.soundEnabled !== 'boolean') {
    issues.push(issue('blocking', 'MISSING_SOUND_DECISION', 'Declara explícitamente si la pieza lleva sonido.', 'soundEnabled'));
  }
  if (theme) {
    const bodyContrast = contrastRatio(theme.ink, theme.background);
    const mutedContrast = contrastRatio(theme.muted, theme.background);
    if (bodyContrast < 4.5) {
      issues.push(issue('blocking', 'BODY_CONTRAST', `Contraste principal insuficiente (${bodyContrast.toFixed(2)}:1).`, 'themeId'));
    }
    if (mutedContrast < 3) {
      issues.push(issue('warning', 'MUTED_CONTRAST', `El texto secundario queda en ${mutedContrast.toFixed(2)}:1.`, 'themeId'));
    }
  }
  if (sourceContext && !props.sourceVideo) {
    issues.push(issue('info', 'CONTEXT_PLACEHOLDER', 'La preview usa el fondo de contexto porque no se indicó vídeo fuente.', 'sourceVideo'));
  }

  const blocking = issues.filter((item) => item.severity === 'blocking').length;
  const warnings = issues.filter((item) => item.severity === 'warning').length;
  const score = Math.max(0, 100 - blocking * 28 - warnings * 7);
  return {
    version: 1,
    checkedAt: new Date().toISOString(),
    score,
    passed: blocking === 0 && score >= 80,
    dimensions: format || null,
    checks: {
      blocking,
      warnings,
      info: issues.filter((item) => item.severity === 'info').length
    },
    issues
  };
}

export const remotionQaThemes = THEMES;
export const remotionQaFormats = FORMAT_DIMENSIONS;
