/**
 * Motor de reglas de montaje.
 *
 * ANM-I01 · ANM-I03 · ANM-I05 — Cada regla del playbook tiene id, severidad y
 * validador. Un agente que la incumple recibe un error con el id de la regla,
 * no un consejo que puede olvidar a mitad de episodio.
 */
import {readFile} from 'node:fs/promises';
import path from 'node:path';

export const SEVERITIES = ['error', 'warning', 'review'];

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function fail(message, extra = {}) {
  return [{message, ...extra}];
}

/**
 * Checks que consumen incidencias ya calculadas por los validadores
 * especializados. Evita duplicar lógica y mantiene una sola fuente por métrica.
 */
const CODE_MAPPED_CHECKS = {
  'event-gap-max': ['event-gap-max', 'event-gap-warn', 'breath-too-long'],
  'focus-hold-max': ['focus-hold-max'],
  'scene-secondary-change': ['scene-secondary-change'],
  'pattern-repetition-window': ['variety-window'],
  'cue-target-declared': [
    'cue-target-unknown',
    'cue-target-missing',
    'cue-target-unresolved',
    'pattern-binding-missing',
    'pattern-unknown',
    'pattern-not-a-candidate'
  ],
  'divergence-range-for-interval': ['range-target-without-divergence-effect'],
  'sound-file-share': ['sound-file-share'],
  'sound-family-count': ['sound-family-count', 'sound-distinct-files'],
  'sound-impact-density': ['sound-impact-density'],
  'sound-family-sequence': ['sound-family-sequence'],
  'anchor-resolution': [
    'anchor-not-found',
    'anchor-missing',
    'anchor-outside-scene',
    'anchor-out-of-bounds'
  ]
};

/** Cada check recibe el contexto completo del plan y devuelve incidencias. */
export const CHECKS = {
  /** §1 — La palabra manda: el cambio empieza entre 0 y 0,4 s tras la palabra. */
  'cue-word-anchoring'(context, rule) {
    const maxDelay = rule.params?.maxDelaySeconds ?? 0.4;
    const issues = [];
    for (const scene of context.scenes) {
      for (const cue of scene.cues ?? []) {
        if (!Number.isInteger(cue.anchorWordIndex)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: 'El cue no está anclado a una palabra de la transcripción.'
          });
          continue;
        }
        const word = context.words?.[cue.anchorWordIndex];
        if (!word) continue;
        const delay = Number(cue.absoluteSeconds ?? 0) - Number(word.start);
        if (delay < -0.001 || delay > maxDelay) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El cue empieza ${round(delay)} s respecto a su palabra ` +
              `(admitido 0–${maxDelay} s).`
          });
        }
      }
    }
    return issues;
  },

  /** §4 y §14 — Rango de zoom y retorno. */
  'camera-zoom-range'(context, rule) {
    const min = rule.params?.min ?? 1.06;
    const max = rule.params?.max ?? 1.28;
    const issues = [];
    for (const scene of context.scenes) {
      const zoom = scene.camera?.zoom ?? scene.props?.cameraZoom;
      if (!Number.isFinite(zoom)) continue;
      if (zoom < min || zoom > max) {
        issues.push({
          sceneId: scene.id,
          message: `Zoom declarado ${zoom} fuera del rango editorial ${min}–${max}.`
        });
      }
    }
    return issues;
  },

  /** §14 — Alternar mecanismos de énfasis para que el zoom no sea un tic. */
  'emphasis-rotation'(context, rule) {
    const maxConsecutive = rule.params?.maxConsecutive ?? 3;
    const issues = [];
    let streak = 0;
    let previous = null;
    for (const scene of context.scenes) {
      const emphasis = scene.emphasis ?? 'zoom';
      streak = emphasis === previous ? streak + 1 : 1;
      previous = emphasis;
      if (streak > maxConsecutive) {
        issues.push({
          sceneId: scene.id,
          message: `«${emphasis}» se repite en ${streak} escenas seguidas ` +
            `(máximo ${maxConsecutive}).`
        });
      }
    }
    return issues;
  },

  /** §16 — `FUENTE` solo junto a datos reales; nunca sobre foto de stock. */
  'source-label-data-only'(context) {
    const dataGeometries = new Set([
      'line', 'bars', 'lanes', 'metric-card', 'grid', 'timeline', 'audit-card'
    ]);
    const issues = [];
    for (const scene of context.scenes) {
      const label = scene.sourceLabel ?? scene.props?.sourceLabel;
      if (!label) continue;
      const geometry = scene.geometry ?? 'unknown';
      const dataIntent = ['chart', 'number', 'timeline', 'map'].includes(
        scene.visualIntent
      );
      if (!dataGeometries.has(geometry) && !dataIntent) {
        issues.push({
          sceneId: scene.id,
          message: `La escena imprime FUENTE «${label}» sobre geometría ` +
            `«${geometry}», que no es una visualización de datos reales.`
        });
      }
      if (/pexels|pixabay|unsplash/i.test(label)) {
        issues.push({
          sceneId: scene.id,
          message: `«${label}» es procedencia del asset, no fuente factual.`
        });
      }
    }
    return issues;
  },

  /** §13 — Cronología occidental: pasado a la izquierda. */
  'chronology-past-left'(context) {
    const issues = [];
    for (const scene of context.scenes) {
      const binding = context.registry?.get(scene.componentKey ?? scene.kind);
      if (binding?.chronology !== 'past-left') continue;
      const declared = scene.props?.chronology ?? scene.chronology ?? 'past-left';
      if (declared !== 'past-left') {
        issues.push({
          sceneId: scene.id,
          message: `La cronología declara «${declared}»; el pasado debe quedar ` +
            'a la izquierda y el rebobinado avanzar hacia ella.'
        });
      }
    }
    return issues;
  },

  /** §19 — El contagio no se pinta con una caja global. */
  'contagion-no-global-box'(context) {
    const issues = [];
    for (const scene of context.scenes) {
      const binding = context.registry?.get(scene.componentKey ?? scene.kind);
      if (binding?.patternId !== 'process.contagion-spread') continue;
      if (scene.props?.globalOverlay || scene.props?.contagionBox) {
        issues.push({
          sceneId: scene.id,
          message: 'El contagio usa una caja global; debe emitir ondas y cambiar ' +
            'cada destino individualmente con desfase visible.'
        });
      }
      if (!(scene.effectIds ?? []).includes('focus.boundary-clipped-connectors')) {
        issues.push({
          sceneId: scene.id,
          message: 'Los conectores del contagio deben usar ' +
            '`focus.boundary-clipped-connectors` para nacer en el borde del núcleo.'
        });
      }
    }
    return issues;
  },

  /** §1 y ANM-B03 — Una cifra narrada obliga a un cue visible. */
  'number-cue-obligation'(context, rule) {
    const minRatio = rule.params?.minCoverage ?? 0.95;
    const coverage = context.coverage ?? [];
    const issues = [];
    for (const entry of coverage) {
      const numeric = entry.mentions.filter((mention) =>
        ['number', 'percent', 'currency'].includes(mention.kind)
      );
      if (!numeric.length) continue;
      const covered = numeric.filter((mention) => mention.covered).length;
      const ratio = covered / numeric.length;
      if (ratio < minRatio) {
        issues.push({
          sceneId: entry.sceneId,
          message: `Solo ${covered}/${numeric.length} cifras narradas tienen cue ` +
            `(mínimo ${Math.round(minRatio * 100)} %): ` +
            numeric.filter((mention) => !mention.covered)
              .map((mention) => `«${mention.anchorText}»`).join(', ')
        });
      }
    }
    return issues;
  },

  /** §15 — Una entidad narrada activa su tarjeta o su logo. */
  'entity-cue-obligation'(context, rule) {
    const minRatio = rule.params?.minCoverage ?? 0.9;
    const issues = [];
    for (const entry of context.coverage ?? []) {
      const entities = entry.mentions.filter((mention) => mention.kind === 'entity');
      if (!entities.length) continue;
      const covered = entities.filter((mention) => mention.covered).length;
      if (covered / entities.length < minRatio) {
        issues.push({
          sceneId: entry.sceneId,
          message: `Entidades narradas sin activación: ` +
            entities.filter((mention) => !mention.covered)
              .map((mention) => `«${mention.anchorText}»`).join(', ')
        });
      }
    }
    return issues;
  },

  /** §8 y §13 — Ninguna caja declarada puede solaparse con otra. */
  'layout-no-overlap'(context) {
    const issues = [];
    for (const scene of context.scenes) {
      const boxes = scene.layoutBoxes ?? scene.props?.layoutBoxes ?? [];
      for (let left = 0; left < boxes.length; left += 1) {
        for (let right = left + 1; right < boxes.length; right += 1) {
          const a = boxes[left];
          const b = boxes[right];
          const overlap =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;
          if (overlap) {
            issues.push({
              sceneId: scene.id,
              message: `Las cajas «${a.id}» y «${b.id}» se solapan; usa un carril ` +
                'libre o retira el elemento anterior antes de revelar el nuevo.'
            });
          }
        }
      }
    }
    return issues;
  },

  /** §8 y §19 — Los conectores terminan en el borde, no en el centro. */
  'connector-boundary-clipped'(context) {
    const issues = [];
    for (const scene of context.scenes) {
      for (const connector of scene.connectors ?? scene.props?.connectors ?? []) {
        if (connector.endpoint === 'center' || connector.clipped === false) {
          issues.push({
            sceneId: scene.id,
            message: `El conector «${connector.id}» apunta al centro de su destino; ` +
              'debe terminar en la primera intersección con su borde exterior.'
          });
        }
      }
    }
    return issues;
  },

  /** §12 y ANM-G05 — Cero red durante el render. */
  'asset-local-presence'(context) {
    const issues = [];
    const missing = context.assets?.missing ?? [];
    for (const asset of missing) {
      issues.push({
        assetId: asset.id,
        message: `El asset «${asset.id}» no existe localmente (${asset.path}).`
      });
    }
    for (const scene of context.scenes) {
      for (const asset of scene.assets ?? scene.props?.assets ?? []) {
        if (/^https?:/i.test(String(asset.path ?? ''))) {
          issues.push({
            sceneId: scene.id,
            message: `El asset «${asset.id}» apunta a una URL remota; debe estar ` +
              'importado al catálogo gestionado antes del bundle.'
          });
        }
      }
    }
    return issues;
  },

  /** ANM-D05 — Cooldown por fichero. */
  'sound-file-cooldown'(context, rule) {
    // El cooldown es una propiedad de la familia (un tick de datos puede volver
    // en 6 s; un rewind, no antes de 20). Medir contra una constante plana
    // convertía en incidencia lo que el catálogo autoriza.
    const fallback = rule.params?.cooldownSeconds ?? 12;
    const declared = new Map(
      (context.soundCatalog?.families ?? []).map((family) => [family.id, family.cooldownSeconds])
    );
    const cooldownFor = (familyId) => {
      const value = declared.get(familyId);
      return Number.isFinite(value) ? value : fallback;
    };
    const lastUsed = new Map();
    const issues = [];
    const instances = (context.sound?.scenes ?? [])
      .flatMap((scene) => scene.cues)
      .sort((left, right) => left.absoluteSeconds - right.absoluteSeconds);
    for (const instance of instances) {
      const cooldown = cooldownFor(instance.family);
      const previous = lastUsed.get(instance.file);
      const elapsed = previous === undefined ? Infinity : instance.absoluteSeconds - previous;
      if (cooldown > 0 && elapsed < cooldown) {
        issues.push({
          sceneId: instance.sceneId,
          cueId: instance.cueId,
          message: `${instance.file} se repite a ${round(elapsed)} s del uso anterior ` +
            `(la familia «${instance.family}» declara ${cooldown} s).`
        });
      }
      lastUsed.set(instance.file, instance.absoluteSeconds);
    }
    return issues;
  },

  /** ANM-D03 — Ningún alias semántico comparte fichero con otro. */
  'sound-alias-uniqueness'(context) {
    const aliases = context.soundCatalog?.legacyAliases ?? {};
    const byVariant = new Map();
    const issues = [];
    for (const [alias, entry] of Object.entries(aliases)) {
      const key = `${entry.family}:${entry.variant}`;
      if (byVariant.has(key)) {
        issues.push({
          message: `Los alias «${byVariant.get(key)}» y «${alias}» apuntan al mismo ` +
            'fichero: dos nombres semánticos no pueden sonar igual.'
        });
      }
      byVariant.set(key, alias);
    }
    return issues;
  },

  /** ANM-D07 — Lecho continuo declarado por acto. */
  'sound-bed-present'(context) {
    const bed = context.sound?.bedTrack ?? [];
    if (!bed.length) {
      return fail('El episodio no declara capa de lecho; el silencio debe ser una ' +
        'decisión, no un hueco.');
    }
    return [];
  },

  /** ANM-D09 — Ducking real contra la locución. */
  'sound-ducking-present'(context) {
    if (!(context.words ?? []).length) {
      return notEvaluable('Sin transcripción por palabras no hay locución contra la ' +
        'que medir el ducking; pasa --words.');
    }
    const ducking = context.sound?.ducking ?? [];
    if (!ducking.length) {
      return fail('No hay ventanas de ducking: la locución no se separa de los impactos.');
    }
    const wrong = ducking.filter((window) => (window.gainDb ?? 0) > -4);
    if (wrong.length) {
      return fail(`${wrong.length} ventanas de ducking atenúan menos de −4 dB.`);
    }
    return [];
  },

  /** ANM-D11 — Variante silenciosa renderizable. */
  'silent-variant-present'(context) {
    if (!context.artifacts) {
      return notEvaluable('El contexto no declara artefactos de build; solo el build ' +
        'completo sabe si la variante silenciosa se generó.');
    }
    if (!context.artifacts.silentPropsFile) {
      return fail('No se ha generado la variante silenciosa del episodio ' +
        '(`render-props.silent.json`).');
    }
    return [];
  },

  /** §10 — Ningún silencio accidental supera un segundo. */
  'narration-pause-max'(context, rule) {
    const maxPause = rule.params?.maxPauseSeconds ?? 1;
    const issues = [];
    const words = context.words ?? [];
    if (!words.length) {
      return notEvaluable('Sin transcripción por palabras no se pueden medir las ' +
        'pausas; pasa --words.');
    }
    for (let position = 1; position < words.length; position += 1) {
      const gap = Number(words[position].start) - Number(words[position - 1].end ?? words[position - 1].start);
      if (gap > maxPause) {
        issues.push({
          message: `Pausa de ${round(gap)} s en ${round(words[position - 1].end ?? 0)} s ` +
            `(máximo ${maxPause} s sin decisión editorial registrada).`
        });
      }
    }
    return issues;
  },

  /** §1 — Ningún efecto decorativo: todo cue declara qué hace y sobre qué. */
  'cue-semantic-function'(context) {
    const issues = [];
    for (const scene of context.scenes) {
      for (const cue of scene.cues ?? []) {
        const missing = ['action', 'target'].filter((field) => !cue[field]);
        if (missing.length) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El cue no declara ${missing.join(' ni ')}: sin función ` +
              'semántica declarada es decoración.'
          });
        }
        // Un sonido sin palabra que lo motive es el «whoosh porque hay un zoom».
        if (cue.sound && !Number.isInteger(cue.anchorWordIndex)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: 'El cue lleva sonido pero no está anclado a ninguna palabra.'
          });
        }
      }
    }
    return issues;
  },

  /** §2 — Una escena bloqueada explica la discrepancia y la acción necesaria. */
  'blocked-scene-explains'(context) {
    const issues = [];
    for (const scene of context.scenes) {
      if (scene.props?.factualStatus !== 'blocked') continue;
      const explanation = (scene.props?.supportingText ?? '').trim();
      if (!explanation) {
        issues.push({
          sceneId: scene.id,
          message: 'La escena está bloqueada pero no explica la discrepancia ni ' +
            'la acción necesaria; la preview editorial no puede mostrarlas.'
        });
      }
    }
    return issues;
  },

  /**
   * §4 — Vocabulario cerrado de tono. El oro marca precio y señal principal, así
   * que un andamio cronológico (fecha o periodo) no puede llevarlo, ni vestirse
   * de pérdida: no es ni señal ni giro.
   */
  'tone-semantics'(context, rule) {
    const allowed = new Set(
      rule.params?.tones ?? ['gold', 'cyan', 'positive', 'negative', 'neutral']
    );
    const scaffolding = new Set(rule.params?.scaffoldingKinds ?? ['date', 'period']);
    const reserved = new Set(rule.params?.reservedTones ?? ['gold', 'negative']);
    const issues = [];
    for (const scene of context.scenes) {
      for (const cue of scene.cues ?? []) {
        if (cue.tone && !allowed.has(cue.tone)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `Tono «${cue.tone}» fuera del vocabulario del canal ` +
              `(${[...allowed].join(', ')}).`
          });
          continue;
        }
        if (scaffolding.has(cue.kind) && reserved.has(cue.tone)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `Un cue de tipo «${cue.kind}» lleva tono «${cue.tone}», ` +
              'reservado a precio, señal principal o pérdida.'
          });
        }
      }
    }
    return issues;
  },

  /** §4 — El resalte de una mención dura lo que la mención, no más. */
  'mention-highlight-duration'(context, rule) {
    const min = rule.params?.minSeconds ?? 0.6;
    const max = rule.params?.maxSeconds ?? 1.4;
    const actions = new Set(rule.params?.actions ?? ['highlight', 'shade']);
    const issues = [];
    for (const scene of context.scenes) {
      for (const cue of scene.cues ?? []) {
        if (!actions.has(cue.action)) continue;
        const duration = Number(cue.durationSeconds);
        if (!Number.isFinite(duration)) continue;
        if (duration < min || duration > max) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El resalte dura ${round(duration)} s (admitido ${min}–${max} s).`
          });
        }
      }
    }
    return issues;
  },

  /** §8 — La alerta llega con la palabra y se va; no se queda de decoración. */
  'alert-cue-transient'(context, rule) {
    const alertTones = new Set(rule.params?.alertTones ?? ['negative']);
    const issues = [];
    for (const scene of context.scenes) {
      for (const cue of scene.cues ?? []) {
        if (!alertTones.has(cue.tone)) continue;
        if (!Number.isInteger(cue.anchorWordIndex)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: 'La alerta no está anclada a la palabra que la motiva.'
          });
        }
        if (cue.persist === true) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: 'La alerta persiste tras su mención: queda como decoración.'
          });
        }
      }
    }
    return issues;
  },

  /** §10 — Una entrega incompleta no es un bloque aprobable. */
  'delivery-completeness'(context, rule) {
    const required = rule.params?.files ?? [
      'render-props.json',
      'manifest.json',
      'audio.m4a',
      'block.mp4'
    ];
    const minStills = rule.params?.minStills ?? 5;
    const blocks = context.artifacts?.reviewBlocks;
    if (!blocks?.length) {
      return notEvaluable('El contexto no declara bloques de revisión; solo el ' +
        'empaquetado de bloque sabe qué se ha entregado.');
    }
    const issues = [];
    for (const block of blocks) {
      const present = new Set(block.files ?? []);
      const missing = required.filter((file) => !present.has(file));
      if (missing.length) {
        issues.push({
          message: `El bloque ${block.id} no incluye ${missing.join(', ')}.`
        });
      }
      const stills = (block.files ?? []).filter((file) => /still.*\.(png|jpg)$/i.test(file));
      if (stills.length < minStills) {
        issues.push({
          message: `El bloque ${block.id} aporta ${stills.length} stills de QA ` +
            `(mínimo ${minStills}).`
        });
      }
    }
    return issues;
  },

  /** §11 — Las uniones de bloques nunca parten una palabra. */
  'block-boundary-word-safe'(context) {
    const blocks = context.artifacts?.reviewBlocks;
    const words = context.words ?? [];
    if (!blocks?.length || !words.length) {
      return notEvaluable('Sin bloques de revisión y transcripción por palabras no se puede comprobar la seguridad de las fronteras.');
    }
    const normalizedWords = words.map((word) => ({
      text: String(word.text ?? '').trim(),
      start: Number(word.start ?? word.startSeconds),
      end: Number(word.end ?? word.endSeconds ?? word.start ?? word.startSeconds),
    })).filter((word) => Number.isFinite(word.start) && Number.isFinite(word.end));
    if (!normalizedWords.length) {
      return notEvaluable('La transcripción no contiene intervalos de palabra utilizables.');
    }
    const issues = [];
    const epsilon = 0.005;
    const checkBoundary = (block, boundary, edge) => {
      if (!Number.isFinite(boundary)) return;
      const word = normalizedWords.find((candidate) =>
        candidate.start + epsilon < boundary && boundary < candidate.end - epsilon
      );
      if (word) {
        issues.push({
          blockId: block.id,
          boundarySeconds: boundary,
          message: `La frontera ${edge} del bloque ${block.id} cae en mitad de «${word.text}» (${word.start.toFixed(3)}–${word.end.toFixed(3)} s).`,
        });
      }
    };
    for (const block of blocks) {
      checkBoundary(block, Number(block.sourceStartSeconds), 'inicial');
      checkBoundary(block, Number(block.sourceEndSeconds), 'final');
    }
    return issues;
  },

  /** §11 — Una fotografía da atmósfera; nunca sostiene una cifra. */
  'photo-not-data-source'(context, rule) {
    const photoKinds = new Set(rule.params?.photoKinds ?? ['photo', 'stock', 'image']);
    const issues = [];
    for (const scene of context.scenes) {
      const photos = new Set(
        (scene.assets ?? [])
          .filter((asset) => photoKinds.has(asset.kind))
          .map((asset) => asset.id)
      );
      if (!photos.size) continue;
      for (const cue of scene.cues ?? []) {
        if (cue.numericValue === undefined) continue;
        if (photos.has(cue.target)) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `La cifra apunta a «${cue.target}», que es una fotografía: ` +
              'no puede ser la fuente de un dato.'
          });
        }
      }
    }
    return issues;
  },

  /** §11 — Los assets de librería solo se publican con licencia verificada. */
  'library-asset-licensed'(context, rule) {
    const prefix = rule.params?.libraryPrefix ?? 'library-';
    const issues = [];
    for (const scene of context.scenes) {
      for (const asset of scene.assets ?? []) {
        if (!String(asset.id ?? '').startsWith(prefix)) continue;
        if (!asset.license) {
          issues.push({
            sceneId: scene.id,
            message: `El asset de librería «${asset.id}» no declara licencia ` +
              'verificada.'
          });
        }
      }
    }
    return issues;
  },

  /** §12 — Nada llega a production-ready sin aprobación y hash. */
  'production-ready-approved'(context) {
    const entries = context.artifacts?.productionReady;
    if (!entries?.length) {
      return notEvaluable('El contexto no declara entregas en production-ready; ' +
        'solo el empaquetado sabe qué se ha promovido.');
    }
    const issues = [];
    for (const entry of entries) {
      const missing = ['approvedBy', 'sha256', 'rangeSeconds'].filter(
        (field) => !entry[field]
      );
      if (missing.length) {
        issues.push({
          message: `La entrega ${entry.id} no declara ${missing.join(', ')}.`
        });
      }
    }
    return issues;
  }
};

for (const [checkId, codes] of Object.entries(CODE_MAPPED_CHECKS)) {
  CHECKS[checkId] = (context) =>
    (context.issues ?? [])
      .filter((issue) => codes.includes(issue.code))
      .map((issue) => ({
        sceneId: issue.sceneId,
        cueId: issue.cueId,
        message: issue.message,
        sourceCode: issue.code,
        sourceSeverity: issue.severity
      }));
}

/**
 * ANM-I04 — Validadores nacidos de un feedback concreto.
 * Cada fichero de `visuals/checks/` exporta `{id, run(context, rule)}` y queda
 * disponible sin tocar este módulo.
 */
export async function loadCustomChecks({
  directory = new URL('./checks/', import.meta.url)
} = {}) {
  const {readdir} = await import('node:fs/promises');
  let entries = [];
  try {
    entries = await readdir(directory);
  } catch {
    return [];
  }
  const loaded = [];
  for (const entry of entries.filter((name) => name.endsWith('.js'))) {
    const module = await import(new URL(entry, directory).href);
    const check = module.default ?? module;
    if (!check?.id || typeof check.run !== 'function') continue;
    CHECKS[check.id] = check.run;
    loaded.push(check.id);
  }
  return loaded;
}

export function registerCheck(id, run) {
  CHECKS[id] = run;
}

/**
 * «No evaluable» ≠ «incumplida». Si el contexto no trae la locución o la lista
 * de artefactos, el validador no puede opinar: reportarlo como incidencia
 * enseña a ignorar avisos, que es justo lo que este motor existe para evitar.
 */
const NOT_EVALUABLE = Symbol('not-evaluable');

export function notEvaluable(reason) {
  return {[NOT_EVALUABLE]: true, reason};
}

function readSkip(found) {
  return found && !Array.isArray(found) && found[NOT_EVALUABLE] ? found.reason : null;
}

export async function loadChannelRules(channelId, {root = process.cwd()} = {}) {
  const file = path.join(root, 'channels', channelId, 'brand', 'editing-rules.json');
  return JSON.parse(await readFile(file, 'utf8'));
}

/**
 * Ejecuta el conjunto de reglas contra el contexto de un episodio.
 * @returns {{results: object[], issues: object[], summary: object}}
 */
/**
 * Excepciones registradas: una regla se puede rebajar a `review` para un
 * episodio o una escena concreta, siempre con motivo. Es el mecanismo previsto
 * para material producido antes de que existiera la regla; no un silenciador.
 */
function findException(exceptions, rule, issue, episodeId) {
  return (exceptions ?? []).find((exception) =>
    exception.ruleId === rule.id &&
    (!exception.episodeId || exception.episodeId === episodeId) &&
    (!exception.sceneId || exception.sceneId === issue.sceneId)
  ) ?? null;
}

export function runRuleEngine(ruleSet, context) {
  const results = [];
  const issues = [];
  const exceptions = context.exceptions ?? [];
  const episodeId = context.plan?.episodeId ?? null;
  for (const rule of ruleSet.rules ?? []) {
    if (rule.check === 'manual') {
      results.push({ruleId: rule.id, checkId: 'manual', status: 'manual', issues: []});
      continue;
    }
    const check = CHECKS[rule.check];
    if (!check) {
      results.push({
        ruleId: rule.id,
        checkId: rule.check,
        status: 'missing-check',
        issues: []
      });
      issues.push({
        ruleId: rule.id,
        code: 'rule-check-missing',
        severity: 'error',
        message: `La regla ${rule.id} declara el validador «${rule.check}», que no existe.`
      });
      continue;
    }
    const found = check(context, rule) ?? [];
    const skipReason = readSkip(found);
    if (skipReason) {
      results.push({
        ruleId: rule.id,
        checkId: rule.check,
        status: 'skipped',
        reason: skipReason,
        issues: []
      });
      continue;
    }
    const ruleIssues = found.map((issue) => {
      const baseSeverity = issue.sourceSeverity && rule.severity === 'error'
        ? issue.sourceSeverity
        : rule.severity;
      const exception = findException(exceptions, rule, issue, episodeId);
      return {
        ruleId: rule.id,
        code: rule.check,
        severity: exception ? 'review' : baseSeverity,
        statement: rule.statement,
        ...(exception ? {exception: exception.reason, waivedFrom: baseSeverity} : {}),
        ...issue
      };
    });
    issues.push(...ruleIssues);
    const blocking = ruleIssues.some((issue) => issue.severity === 'error');
    results.push({
      ruleId: rule.id,
      checkId: rule.check,
      status: ruleIssues.length ? (blocking ? 'fail' : 'warn') : 'pass',
      issues: ruleIssues
    });
  }
  const summary = {
    total: results.length,
    passed: results.filter((result) => result.status === 'pass').length,
    failed: results.filter((result) => result.status === 'fail').length,
    warned: results.filter((result) => result.status === 'warn').length,
    waived: issues.filter((issue) => issue.exception).length,
    manual: results.filter((result) => result.status === 'manual').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    missingCheck: results.filter((result) => result.status === 'missing-check').length,
    errors: issues.filter((issue) => issue.severity === 'error').length,
    warnings: issues.filter((issue) => issue.severity === 'warning').length,
    reviews: issues.filter((issue) => issue.severity === 'review').length
  };
  return {results, issues, summary};
}

/** Cobertura del contrato: ¿queda alguna regla sin validador ni marca manual? */
export function auditRuleCoverage(ruleSet) {
  const rules = ruleSet.rules ?? [];
  const automated = rules.filter((rule) => rule.check && rule.check !== 'manual');
  const missing = automated.filter((rule) => !CHECKS[rule.check]);
  return {
    total: rules.length,
    automated: automated.length,
    manual: rules.filter((rule) => rule.check === 'manual').length,
    missingCheck: missing.map((rule) => ({id: rule.id, check: rule.check})),
    coverageRatio: rules.length
      ? round((automated.length - missing.length + rules.filter((rule) => rule.check === 'manual').length) / rules.length, 4)
      : 1
  };
}
