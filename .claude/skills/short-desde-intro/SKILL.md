---
name: short-desde-intro
description: Saca un Short vertical 9:16 para TikTok, Instagram Reels y YouTube Shorts de la apertura viral de un vídeo largo que ya se ha montado con intro-viral (los clips 1, 2, 3… a cámara). Reutiliza la escaleta, los cortes, los recursos reales y la media de la apertura, y la monta con el motor de shorts de los vídeos largos (cara abajo y recurso arriba, subtítulos karaoke verdes, logos en placa, sonidos de SONIDOS-REELS). Úsala cuando el encargo sea "haz también el short de la intro", "sácame un vertical de la introducción para TikTok/Instagram", o al retocar ese short. NO es para montar la apertura 16:9 (intro-viral), ni para recortar shorts de un vídeo largo (create-ranked-shorts), ni para un short de clips sueltos sin apertura (shorts-desde-cero).
---

# Short 9:16 desde la apertura viral

El encargo típico llega justo después de montar la apertura: "edítame la intro del
vídeo… y hazme también un short para TikTok e Instagram con esa misma intro". Suelen ser
2-4 tomas y salen 30-60 s de vertical.

**El short no se vuelve a editar desde cero.** La apertura ya decidió lo editorial
(qué frase pesa, qué recurso real se enseña y cuándo, dónde se corta). Este flujo lo
traduce al motor de shorts:

- `src/modules/intro-short/translate.js` (función pura): escaleta + `intro-plan.json`
  de la apertura → `short-plan.json`.
- `src/modules/intro-short/workflow.js`: puertas `plan → render → review → publishing`.
- El montaje lo compila y valida `shorts:build` (reglas SH-R) y lo renderiza el mismo
  Remotion de los shorts de vídeo largo. No hay ingesta ni transcripción nueva: el short
  apunta a la media de `public/projects/intro/<slug>/` y copia sus transcripciones, así
  que los índices de palabra de la escaleta valen tal cual.

## Paso 0: requisitos

1. La apertura existe y su puerta `plan` está superada:
   `npm run intro:viral -- status --slug <slug>`. Si el usuario pide intro y short a la
   vez, termina primero la apertura con la skill `intro-viral` (al menos hasta `plan`;
   lo normal es entregarla antes).
2. Lee `src/modules/shorts-studio/rules/shorts-rules.json` si vas a cambiar escenas a
   mano con `short.json`: son las reglas que corre el build.

`<slug>` es siempre el de la apertura (`data/intro-viral/<slug>/`).

## Las puertas

Cada orden imprime sus comprobaciones (✔ bien, ✖ bloquea, ! aviso que hay que leer) y la
siguiente orden. **No pases de puerta si dice BLOQUEADA.**
`npm run intro:short -- status --slug <slug>` dice en qué punto estás.

### 1. plan

```bash
npm run intro:short -- plan --slug <slug>
```

Crea `remotion-animations/projects/shorts-<slug>/` (manifest que apunta a la media de la
apertura, transcripciones copiadas), escribe `short-plan.json`, crea `short.json` en el
espacio de trabajo si no existe y compila con `shorts:build`.

- Si ya hay un `shorts-<slug>` montado a mano, se bloquea: usa `--short-slug <otro>` o
  `--force` (el plan a mano se guarda como `short-plan.manual.json`).
- **Comprobación:** reglas SH-R sin errores, duración ≤ 180 s. Aviso por encima de 60 s.

### 2. render

```bash
npm run intro:short -- render --slug <slug>
```

Congela la versión, monta un `public` aislado con enlaces duros (evita el ENOSPC del
bundle de Remotion en C:) y renderiza H.264 CRF 17 con QA técnico. Tarda 2-4 minutos.

### 3. review

```bash
npm run intro:short -- review --slug <slug>
```

Saca `review/short-hoja.jpg` (un fotograma vertical por escena), mide la sonoridad
(−14 ± 1 LUFS, pico ≤ −1 dBTP) y escribe `REVIEW-SHORT.md`. **Abre la hoja y mírala**:
marca los puntos de "Revisión visual". Para ver un instante concreto:

```bash
ffmpeg -v error -y -ss 24.6 -i "<mp4>" -frames:v 1 -vf scale=360:-2 frame.png
```

Cuando está bien, entrega junto a las tomas (`SHORT_<slug>_9x16.mp4`; si ya existía, el
anterior queda como `.anterior.mp4`):

```bash
npm run intro:short -- review --slug <slug> --deliver
```

### 4. publishing

```bash
npm run intro:short -- publishing --slug <slug>
```

Títulos, resumen, exactamente 14 hashtags y posts de YouTube Shorts, Instagram y TikTok
(`publishing-metadata.json` del proyecto), con la transcripción del short montado.
**Publicar es otra orden y solo si el usuario lo pide**:
`npm run shorts:publish -- --slug <slug> --platforms youtube,instagram,tiktok`.

## Cómo traduce (para entender el resultado, no para repetirlo a mano)

| Intención en la escaleta | En el short |
|---|---|
| `gancho` con logo | `full` + `punch-in`; el logo entra arriba (`overlay-top`) cuando se nombra, en placa clara |
| `mostrar` / `remate` | `talking-head`: cara abajo, recurso arriba toda la escena. Si el vídeo de apoyo se acaba antes, el resto vuelve a `full` |
| `noticia` | Se parte en la palabra que nombra el recurso: antes cara, después recurso arriba |
| Recurso denso (`captura: "titular"` o `insert: true` en `asset-requests.json`) | `stage` con la captura a lo ancho (lo único que se lee en vertical, SH-R-020) |
| `cifra` / `comparar` | `split` con la cifra; una cifra corta sube la unidad: "7" + "meses sin un Pro" → "7 MESES" / "sin un Pro" |
| `enfasis` | `full` + `punch-in` |
| `frase`, `agenda` | `full` con cámara suave que rota (`drift-right`, `push-out`, `drift-left`) |
| Toma de pantalla con webcam en esquina | `pip` (webcam arriba, pantalla abajo); su recurso no se coloca porque ya se ve la pantalla |

- **Palabras clave de la apertura: no se trasladan.** En vertical el subtítulo karaoke
  ya dice la frase y SH-R-030 prohíbe repetir la locución. El `plan` las lista en el
  informe (`palabrasClaveNoTrasladadas`).
- **Transiciones:** las de la apertura que existen en shorts se conservan; `flash-cut` →
  corte con sonido de cámara, `page-curl` → `slide-up`. Un corte dentro de la misma toma
  es seco. `zoom-blur` suena a whoosh (el whoosh inverso de la apertura se ancla por el
  final y aquí sonaría tarde).
- **Sonido:** la paleta de `SONIDOS-REELS` (con `preferencias.json`) en las familias del
  short. Si no está disponible, suena la librería y el `plan` lo avisa.
- **Música:** la misma pista de la apertura, en cama baja (`volume` 0,22) con ducking.
- **Subtítulos:** el preset verde de los shorts de vídeo largo. No se declaran.

## Retocar: `short.json`, nunca `short-plan.json`

`short-plan.json` se regenera en cada `plan`. Los cambios van en
`data/intro-viral/<slug>/short.json`:

```json
{
  "version": 1,
  "omit": ["recap"],
  "scenes": {"sin-pro": {"camera": "static"}, "por-fin": {"label": "BLOG OFICIAL · 30 SEPT"}},
  "title": "Google lanza Gemini 4 Argon (a medias)",
  "accentColor": "#43F56C",
  "music": {"volume": 0.18}
}
```

- `omit`: ids de escena (los de la apertura) que no entran. Es la forma de bajar de 60 s:
  quita primero recapitulaciones y frases de transición, nunca el gancho ni el remate.
- `scenes`: campos de `short-plan.json` que se pisan en esa escena (ids del plan, que
  pueden llevar sufijo `-recurso` o `-cara` cuando la traducción parte una escena).
- `music: false` quita la cama musical.

Después: `plan → render → review` otra vez.

## Si algo falla

| Síntoma | Arreglo |
|---|---|
| `plan` bloquea por la apertura | Termina `intro:viral -- plan` antes |
| `shorts:build` falla con un par de cues y un slot (SH-R-010) | Un `holdSeconds` largo en `short.json`; acórtalo |
| Una captura no se lee | Marca el recurso con `"insert": true` en `asset-requests.json` (va a `stage`) y repite `plan` |
| Un recurso no corresponde a lo que se dice | Corrige la escaleta de la apertura (afecta a las dos piezas) o `scenes` en `short.json` |
| Más de 60 s | `omit` en `short.json` |
| Sonoridad fuera de −14 ± 1 | `music.volume` en `short.json` |

Si el usuario corrige algo que debería valer para todos los shorts (no solo para este),
va al traductor (`translate.js`, con su test en `tests/intro-short.test.js`) o, si es
medible sobre el montaje, a una regla con `npm run shorts:feedback`.

## Checklist final

- [ ] `npm run intro:short -- status --slug <slug>`: plan, render y review superadas.
- [ ] Hoja vertical abierta y revisada; `REVIEW-SHORT.md` marcado.
- [ ] Entregado con `--deliver` y metadata con `publishing` si el usuario la quiere.
- [ ] Si has tocado código: `npm test` y, tras crear o borrar un proyecto,
      `npm run remotion:capabilities`.
- [ ] Resumen al usuario: duración, escenas, recursos usados, qué no se trasladó y la
      ruta del MP4.
