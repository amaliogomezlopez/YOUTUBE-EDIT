---
name: intro-viral
description: Monta enteros los primeros clips a cámara de un vídeo largo de YouTube (los numerados 1, 2, 3…) como una apertura viral 16:9 con zooms, b-roll real a pantalla completa, palabras clave, cortes en el beat y los sonidos del usuario de SONIDOS-REELS. Procedimiento con puertas (`npm run intro:viral`) y tablas de decisión cerradas, pensado para que cualquier modelo lo siga. Úsala cuando el encargo sea "edita los clips 1, 2 y 3 con estilo viral", "hazme el arranque del vídeo", "mete imágenes, vídeos y efectos al principio del vídeo", o al iterar esa apertura. NO es para una cabecera corta de 10-20 s con logo (intro-a-camara), Shorts verticales, montaje con voz en off sin cámara (montaje-viral) ni el montaje completo del vídeo largo (montaje-youtube).
---

# Apertura viral de un vídeo largo

La apertura es el primer minuto y medio del vídeo largo: los primeros clips a cámara
montados enteros, con jump cuts, zooms, recursos reales y sonido en cada cambio de
imagen. Sale un MP4 1920×1080 a 60 fps que el usuario coloca al principio del vídeo en
su editor. **No se publica sola** y no lleva metadata.

**Cómo está repartido el trabajo** (no lo cambies):

- **Tú decides DÓNDE**: qué intención tiene cada frase, qué palabra pesa, qué recurso
  se enseña y cuándo, qué texto sale. Lo escribes en `escaleta.json` con vocabulario
  cerrado.
- **El compilador decide CUÁNTO**: cortes al beat, jump cuts en los silencios, cámara,
  transición, sonido, retenciones, slots. Sale de
  `src/modules/intro-viral/decision-tables.json` y del perfil `hype-apertura`.
- **Las reglas deciden SI VALE**: `intro:build` ejecuta IN-R-0xx y el orquestador
  bloquea cada puerta hasta que está en verde.

Nunca edites `intro-plan.json` a mano: se regenera desde la escaleta en cada `plan`.

Referencia aprobada: `intro-opus-5-5` (Claude Opus 5.5, v3, "brutal"). Su escaleta
está en `references/escaleta.opus-5-5.json`: úsala como ejemplo de cómo se rellena.

## Paso 0: lee esto antes de empezar

1. Esta skill entera, en especial las **Preferencias del usuario** y las tablas.
2. `src/modules/intro-viral/decision-tables.json`: el vocabulario de intenciones.
3. `SONIDOS-REELS/CATALOGO.md`: qué sonido hay para cada uso.
4. `references/escaleta.opus-5-5.json`: la v3 aprobada expresada como escaleta.

## El procedimiento: cinco puertas

Cada orden imprime sus comprobaciones (✔ bien, ✖ bloquea, ! aviso que hay que leer) y
dice cuál es la siguiente. **No pases a la siguiente puerta si la actual dice
BLOQUEADA.** `npm run intro:viral -- status --slug <slug>` dice en qué punto estás.

Todo el trabajo vive en `data/intro-viral/<slug>/` (fuera de Git).

### Puerta 1: start (tomas y música)

- **Entrada:** carpeta con las tomas `1.mkv`, `2.mkv`…; los números que pide el
  usuario; una pista de música.
- **Música:** `C:\Users\amalio\Desktop\VIDEOS-YOUTUBE\VIDEOS YOUTUBE\BACKGROUND_MUSIC`.
  Pulso claro y más larga que las tomas. `EPIC SONG.mp3` (180 BPM) funcionó.
- **Orden:**
  ```bash
  npm run intro:viral -- start --source "<carpeta de tomas>" --clips 1,2,3 --slug <slug> --music "<pista>"
  ```
- **Salida:** `TRANSCRIPCION.md` (cada palabra con su índice), `escaleta.json`
  (plantilla: una escena por frase), `asset-requests.json` vacío.
- **Comprobación:** todas las tomas transcritas, cara detectada, rejilla de beats,
  música más larga que las tomas + 5 s.
- **Si falla:** el mensaje dice qué falta. Una toma sin cara es aviso, no bloqueo.

### Puerta 2: assets (recursos reales)

1. Lee `TRANSCRIPCION.md` y apunta **cada cosa que se nombra y se puede enseñar**:
   productos, modelos, noticias, webs, demos, cifras con fuente.
2. Busca el recurso con la tabla **R** y escríbelo en `asset-requests.json`.
3. Ejecuta:
   ```bash
   npm run intro:viral -- assets --slug <slug>
   ```
- **Salida:** `assets/<id>.png|mp4` con su `.provenance.json`, reingesta hecha y la
  lista de ids disponibles para la escaleta.
- **Comprobación:** cada recurso ingerido; cada vídeo entre 2 y 12 s (ideal 4-8).
- **Si falla un recurso:** una página protegida (Cloudflare, 403) **no se salta**:
  captúrala a mano o pide otra fuente, y deja el fichero como `assets/<id>.png`. Vuelve
  a ejecutar `assets` (lo ya resuelto no se repite; `--force` lo rehace).

**Contrato de `asset-requests.json`** (un recurso por idea):

```json
{"version": 1, "assets": [
  {"id": "opus-portada", "kind": "web", "url": "https://www.anthropic.com/news/claude-opus-5-5", "reason": "se nombra la noticia (01:28)"},
  {"id": "trailer", "kind": "youtube", "url": "https://www.youtube.com/watch?v=…", "start": 12.5, "duration": 6, "reason": "demo que se describe (03:21)"},
  {"id": "tabla-precios", "kind": "web", "url": "https://…/pricing", "insert": true, "reason": "se leen los precios (03:101)"},
  {"id": "grabacion", "kind": "local", "path": "D:/…/demo.mp4", "start": 3, "duration": 5, "reason": "vídeo que da el usuario"}
]}
```

**Tabla R: qué recurso pedir**

| Lo que se nombra | `kind` | Cómo encontrarlo |
|---|---|---|
| Un producto o modelo con página oficial | `web` (og:image) o `image` (CDN oficial) | `curl` de la página y `grep` de las URLs de imagen; la `og:image` suele ser la portada con el nombre |
| Una noticia o un anuncio que se cita | `web` con `"captura": "titular"` | La URL de la noticia: se guarda una **captura real de la página encuadrada en su titular** (antetítulo, titular, fecha y arranque del texto), con esquinas redondeadas. No la og:image: suele ser una tarjeta con el titular reescrito y el usuario la prefiere así (2026-09-25) |
| La portada o imagen de un producto | `web` (og:image, `"captura": "portada"` por defecto) | La página oficial del producto |
| Algo que se ve funcionando (demo, tráiler) | `youtube` con `start` y `duration` (4-8 s) | Canal oficial; elige el tramo con una hoja de contacto (abajo) |
| Un post de X | `x` | La URL del post (oEmbed oficial) |
| Una captura con texto que irá a pantalla completa | cualquiera + `"insert": true` | Se reduce sobre lienzo 1920×1080 para que la esquina de la cara no tape el texto |
| Algo que da el usuario | `local` | Ruta del fichero; en vídeo, `start`/`duration` |

- **Un recurso por idea**, y cada vídeo en un tramo de 4-8 s: el fondo se reproduce
  desde el principio y en bucle.
- **yt-dlp:** el del sistema es antiguo y solo baja 360p. Instala uno reciente en el
  scratchpad y apúntalo:
  `python -m pip install --target <scratch>/ytdlp -U "yt-dlp[default]"`, luego
  `YTDLP_PYTHONPATH=<scratch>/ytdlp` al ejecutar `assets`.
- **Hoja de contacto** para elegir el tramo de un vídeo:
  `ffmpeg -i video.mp4 -vf "fps=1/2,scale=384:-2,drawtext=text='%{pts\:hms}':x=8:y=8:fontcolor=white:box=1:boxcolor=black,tile=6x4" -frames:v 1 hoja.jpg`
- Anota la fuente de cada recurso: la procedencia queda en `<id>.<ext>.provenance.json`.

### Puerta 3: plan (la escaleta)

Rellena `escaleta.json`. La plantilla ya trae una escena por frase con la cobertura
correcta de las tomas: **tu trabajo es cambiar intenciones y añadir campos**, no
recortar. Puedes unir dos escenas contiguas (el `to` de una pasa a la otra) o partir
una, pero cada palabra de cada toma tiene que estar en una escena o en `omit` con
`reason` (una toma repetida, un error de dicción).

```bash
npm run intro:viral -- plan --slug <slug>
```

- **Salida:** `intro-plan.json` compilado e `intro-build.json`.
- **Comprobación:** escaleta sin errores; `intro:build` con **0 errores y 0 avisos**.
  Los avisos de escaleta (`!`) se leen y se corrigen salvo que haya motivo.
- **Si falla:** cada mensaje nombra la escena y el arreglo. Los avisos de regla tienen
  su arreglo en la tabla **F**. Arregla la escaleta, nunca el plan compilado.

**Forma de una escena** (campos opcionales según la intención):

```json
{"id": "motivos", "clip": "01", "from": 10, "to": 24, "intent": "enfasis", "hitWord": 23,
 "keyword": {"text": "Con motivos serios", "atWord": 22, "highlight": [2]}}
```

| Campo | Qué es |
|---|---|
| `clip`, `from`, `to` | Toma y rango de índices de palabra (`TRANSCRIPCION.md`) |
| `intent` | Tabla **A** |
| `hitWord` | Índice de la palabra que pesa (tabla **B**). El golpe se ancla al beat más cercano |
| `keyword` | `{text, atWord, highlight?, note?, money?}`: tabla **C** |
| `asset` | `{id, atWord}`: imagen en primer plano cuando se nombra (`noticia`, `gancho`) |
| `broll` | id de vídeo o imagen a pantalla completa (`mostrar`, `remate`) |
| `stat` | `{text, note, atWord, money?}`: cifra estrella (`cifra`) |
| `face` | Solo en `mostrar`: `esquina` (la favorita), `tarjeta` (cara grande a la izquierda: collage, portada, imagen) o `circulo` (grabación de pantalla que hay que leer). Sin `face`, rotan esquina → tarjeta → esquina → círculo |
| `agenda` | `{items: [{text, atWord?}]}`: 2-8 puntos de 1-4 palabras (`agenda`). Sin `atWord`, entran escalonados |
| `agendaPoint` | `{of: "<id de la escena agenda>", item: n}`: recuerda la agenda con el punto `n` (desde 1) resaltado. En `frase` o `enfasis`, cuando se cuenta ese punto |
| `pair` | `[{text, note?, atWord}, {text, note?, atWord, money?}]`: dos cifras que se comparan (`comparar`), ≤ 8 caracteres cada una |

Arriba del todo: `accentColor` (color de la marca del tema, `#RRGGBB`) y `titular`
`{text, kicker, clip, atWord}`: una vez, cuando se dice el nombre del producto, en tipo
oración ("Claude Opus 5.5") con antetítulo corto.

**Tabla A: qué intención tiene la escena.** Recórrela en orden; **gana la primera que
encaje**.

| # | Pregunta sobre lo que DICE la frase | Intención | Lleva |
|---|---|---|---|
| 1 | ¿Es la primera escena del vídeo? | `gancho` | `hitWord` y `asset` opcionales (logo o portada cuando se nombra) |
| 2 | ¿Anuncia lo que viene: motivos, pasos, temas ("por dos motivos", "vas a aprender")? | `agenda` | `agenda` (una por pieza) |
| 3 | ¿Compara dos cifras en la misma frase (de X a Y, un plan frente a otro)? | `comparar` | `pair` |
| 4 | ¿Da LA cifra de la pieza (precio, porcentaje clave) y aún no hay 2 `cifra`? | `cifra` | `stat` (texto ≤ 6 caracteres) |
| 5 | ¿Habla de algo que se puede ENSEÑAR y tienes vídeo o captura? | `mostrar` | `broll` + `keyword` (+ `face`) |
| 6 | ¿Nombra una noticia, anuncio o producto con portada? | `noticia` | `asset` + `keyword` |
| 7 | ¿Cierra una idea o una toma con una frase contundente, y hay recurso para el fondo? | `remate` | `broll` + `hitWord` + `keyword` (máx. 1 por toma) |
| 8 | ¿Tiene una palabra que pesa (adjetivo fuerte, negación rotunda, giro "pero ahora")? | `enfasis` | `hitWord` + `keyword` |
| 9 | Ninguna de las anteriores | `frase` | `keyword` solo si añade un dato |

Cuando más tarde se cuenta un punto de la agenda, esa escena (`frase` o `enfasis`)
lleva `agendaPoint` en vez de una palabra clave que repita el punto.

Reparto de la v3 aprobada, para 25 escenas: 1 `gancho`, 7 `enfasis`, 3 `noticia`,
7 `mostrar`, 2 `cifra`, 2 `remate` y 3 `frase`. **Varía**: no pongas dos `enfasis`
seguidas si puedes evitarlo, y mete un `mostrar` cada 3-4 escenas si hay recursos.

**Tabla B: cuándo va un golpe (`hitWord`)**

| Situación | Golpe |
|---|---|
| La palabra que pesa de una frase `enfasis` | Sí: esa palabra |
| La última palabra fuerte de un `remate` | Sí (`shake`) |
| El nombre del producto en el `gancho` | Opcional |
| `frase`, `noticia`, `mostrar`, `cifra` | Nunca: ahí manda el cambio de imagen |
| Dos golpes en menos de 1,5 s | No: quita uno (IN-R-042 lo bloqueará) |

Como mucho un golpe por escena, y muchas escenas sin ninguno. Entre golpes, la cámara
se mueve sola y en silencio.

**Tabla C: qué texto sacar (`keyword`)**

| Regla | Bien | Mal |
|---|---|---|
| 2-5 palabras que **condensan o añaden** | "Un lanzamiento pésimo" | "El lanzamiento pésimo que fue Sonnet 5" (transcribe) |
| La cifra cuando se dice | "+25 % de uso", "100 $ al mes" | "Muchísimo más uso" |
| `highlight`: índice (dentro del texto) de la palabra clave | "Con motivos **serios**" → `[2]` | Resaltar todo |
| `atWord`: la palabra de la locución que la motiva | se escribe cuando se dice | antes de que se diga |
| `note`: antetítulo corto opcional | "Motivo 1", "Plan Max 5x" | una frase |
| `money`: motivo, solo si hay moneda | `"money": "precio del plan Pro"` | en un porcentaje |

Lleva `keyword`: `enfasis` (siempre), `mostrar` y `noticia` (casi siempre), `remate`
(sí), `frase` (solo si añade un dato). El validador avisa cuando una palabra clave
repite la locución palabra por palabra.

**Tabla D: sonido (lo pone el compilador; aquí solo para entenderlo)**

Cada momento es una **situación** de `SONIDOS-REELS/preferencias.json`, que dice qué
sonidos usa y en qué orden rotan (repetir uno le da más peso). La página
`SONIDOS-REELS/ESCUCHA.html` (`npm run sonidos:escucha`) sirve para escucharlos y
reordenarlos.

| Momento | Situación | Suena (preferencias del usuario) |
|---|---|---|
| Zoom de cámara (`punch-in`, `snap-zoom` en el salto, `push-out`) | `zoom` | chunky camera y Camera Shutter, sobre todo; solo si cabe en el techo de respiro |
| Toma nueva | `toma-nueva` | Camera Shutter, chunky camera y algún whoosh corto |
| Entrar a un b-roll | `entrar-broll` | chunky / Camera Shutter alternando con whooshes de la biblioteca |
| Volver del b-roll a cámara | `salir-broll` | Camera Shutter / chunky alternando con swooshes cortos |
| Transición `zoom-blur` | `zoom-inverso` | Whoosh inverso: su pico cae en el corte |
| Hoja que se pliega (`page-curl`) | `papel` | Papel |
| Portada o logo junto a la cara | `captura` | Pops y clics |
| `zoom-punch` (golpe de `enfasis`/`gancho`) | `golpe-palabra` | Impactos graves (cola cortada a 0,9 s) |
| `shake` (golpe de `remate`) | `remate` | Impactos con cuerpo (cola cortada a 1,4 s) |
| Cifra que no es dinero | `cifra` | Dings |
| Cifra de dinero (`money`) | `dinero` | `money.mp3`, caja registradora, billetes |
| Palabra clave, agenda, primera cifra de un par | — | Nada: acompañan a la voz |
| Corte dentro de la misma toma | — | Nada: corte seco (salvo que la cámara haga zoom) |
| Arranque | `arranque` | Riser metálico, una vez, terminando en el primer corte |

Si dos sonidos caen a menos de 0,12 s, el compilador silencia el de menos prioridad
(dinero > transición > golpe > recurso).

**Tabla E: transición (la calcula el compilador)**

| Cambio | Transición |
|---|---|
| Toma nueva | `flash-cut` |
| Entrar a `mostrar` con la cara en esquina o tarjeta | rotación `slide-up` → `whip` → `zoom-blur` |
| Entrar a `mostrar` con la cara en círculo (pantalla) | `page-curl` (hoja que se pliega) |
| Entrar a `remate` | `zoom-blur` |
| Salir de un b-roll a cámara | `whip` |
| Entrar a una `cifra` | `cut` (lo lleva la cámara) |
| Misma toma, frase siguiente o silencio | `cut` mudo |

**Tabla F: cómo arreglar cada aviso de `plan`**

| Aviso | Arreglo en la escaleta |
|---|---|
| IN-R-042 (demasiados golpes) | Pasa a `frase` la `enfasis` más cercana del tramo, o quita el `hitWord` del `gancho`. Nunca subas el techo |
| IN-R-060 (tramo sin cambio) | Añade una `keyword` en esa escena o pártela en dos |
| IN-R-011 (tapa la cara) | Cambia la escena a `mostrar` o quita el `asset` |
| IN-R-040 (golpe fuera de beat) | Mueve `hitWord` a la palabra fuerte más cercana |
| keyword repite la locución | Condénsala (Tabla C) |
| corte fuera de beat | Aceptable si son pocos; si molesta, une o parte escenas en otra palabra |

### Puerta 4: render

```bash
npm run intro:viral -- render --slug <slug>
```

- **Salida:** MP4 en `remotion-animations/out/intro-<slug>/runs/…`.
- **Comprobación:** Remotion sale con 0 y el MP4 existe. Tarda varios minutos: no
  lances `npx remotion still` (cada uno copia más de 5 GB); revisa sobre el MP4.

### Puerta 5: review

```bash
npm run intro:viral -- review --slug <slug>
```

- **Salida:** `review/hoja-20.jpg` (un fotograma representativo por escena, con
  tiempo y texto) y `REVIEW.md`.
- **Comprobación automática:** reglas en verde, IN-R-042 sin avisos, sonoridad
  −14 ± 1 LUFS con pico ≤ −1 dBTP, todos los sonidos de SONIDOS-REELS.
- **Comprobación visual: la haces tú, abriendo la hoja.** Marca en `REVIEW.md` cada
  punto de "Revisión visual": texto sin cajas ni pastillas, cara libre, b-roll que
  corresponde a lo que se dice, capturas legibles, titular una vez. Si algo falla,
  vuelve a la escaleta y repite `plan` → `render` → `review`.
- **Entrega**, cuando todo está marcado:
  ```bash
  npm run intro:viral -- review --slug <slug> --deliver
  ```
  Copia `INTRO_1-2-3_viral.mp4` junto a las tomas.

## Estilos de texto y versiones

La fuente, los tamaños, el color, cómo se revela el texto (`letters`, `words`,
`mask`, `fade`), el resalte (color, subrayado que barre, cursiva) y cómo sale una
cifra (columna lateral o flotante sin panel, con contador) son **tokens** de
`src/modules/intro-studio/text-styles.json`. La escaleta elige uno con
`"textStyle": "<id>"`; sin él sale la v3 (`v3-fraunces`). Un estilo nuevo es una
entrada de ese JSON (y su fuente en `remotion-animations/src/motion/fonts.ts`), nunca
un componente. Ninguno pone cajas ni pastillas detrás del texto.

Para comparar estilos sobre la misma edición:

```bash
npm run intro:viral -- variants --slug <slug>            # compila y pasa reglas
npm run intro:viral -- variants --slug <slug> --render   # renderiza y hace la hoja
```

Cada línea de `data/intro-viral/<slug>/variantes.json` es una versión (`id`,
`textStyle`, `accentColor`). Cada versión es un proyecto `intro-<slug>-<id>` que
comparte la media del base. Salen `review/variantes.jpg` (una fila por versión, los
mismos momentos en columnas) y `VARIANTES.md`. Tras crear o borrar versiones:
`npm run remotion:capabilities`.

Cuando el usuario vota, la ganadora pasa a `defaultStyle` de `text-styles.json` (o a
la escaleta), y el porqué a "Preferencias". Con una cifra flotante, el compilador pone
la escena `cifra` sobre la cámara y la cifra en un lado; si tapa la cara, IN-R-011 lo
bloquea.

## Preferencias del usuario (fuente: sus correcciones)

Son decisiones del usuario, no sugerencias. Si una choca con lo que harías por defecto,
gana esta lista. Las medibles ya están en las tablas y en las reglas; aquí queda el
porqué.

**Ritmo y cámara**
- Los clips se montan enteros, sin recortar contenido, pero sin aire: jump cut en cada
  silencio de más de ~0,4 s (el compilador lo hace solo).
- **Deja respirar.** La v2 tenía un golpe cada 0,96 s y resultó "demasiado cargante";
  la v3, uno cada ~2,8 s y nunca más de 3 en 4 s (IN-R-042).
- El golpe va donde la frase lo pide: la palabra que pesa, el remate, la cifra. Entre
  golpes, cámara (`punch-in`, `push-out`, `drift-*`, `snap-zoom`) que se mueve y no
  suena. Nada de `rgb-split`, `light-leak` ni `vignette-pulse` de relleno.

**Recursos**
- Imágenes y vídeos reales del tema: página oficial, vídeos del usuario, portadas
  oficiales de las noticias citadas.
- **El b-roll a pantalla completa con la cara en la esquina (`mostrar`, layout
  `insert`) es lo que más gusta.**
- Una captura se pone cuando la locución la nombra, no antes.

**Texto**
- **Nada** de pastillas, cajas ni rectángulos de color con esquinas redondeadas detrás
  del texto. Tampoco etiquetas (`chip`) en las esquinas.
- La columna lateral (`cifra`) como máximo dos veces por pieza.
- La palabra clave va abajo.
- **Tipografía: Anton** (estilo `anton-impacto`, por defecto del perfil
  `hype-apertura`), en mayúsculas, palabra a palabra, para palabras clave, cifras y
  titular; Instrument Sans en versalitas para antetítulos. Lo eligió el 2026-09-25
  entre seis versiones de la misma apertura (Fraunces, Instrument Serif, Bricolage,
  Anton, Fraunces ligera y mixta): "el que más me gusta en cuanto a la letra".
  Schibsted Grotesk y Fragment Mono le parecen genéricas.
- **Color: casi todo en blanco y solo las palabras destacadas en amarillo**
  (`accentColor: "#FFD60A"`, `accentMode: highlight`). Marca en `highlight` la
  palabra que importa; el resto va en blanco.
- Las cifras estrella flotan sobre el vídeo, sin panel ni columna, y cuentan desde
  cero.
- La palabra clave añade o condensa: 2-5 palabras, nunca la frase entera.

**Sonido**
- **Sus** sonidos de `SONIDOS-REELS`, y solo en lo que **cambia la imagen de verdad**.
  Entre planos de la misma toma, corte seco sin sonido.
- La palabra clave entra en silencio, salvo las cifras de dinero (`money.mp3`).
- Nunca dos sonidos en el mismo instante.
- Riser una sola vez, al arranque, terminando en el primer corte.
- **Abusar de chunky camera y Camera Shutter en zooms y transiciones** (petición
  del 2026-09-25): se repiten en las listas de `zoom`, `toma-nueva`,
  `entrar-broll` y `salir-broll` de `preferencias.json`. Los zooms suenan, pero
  solo donde cabe en el techo de respiro: el techo manda.
- Su biblioteca clasificada (`EFECTOS_VIDEO/AUDIO_EFECTOS`) es la fuente para ampliar:
  la selección vive en `SONIDOS-REELS/apertura/` (no entra en los Reels) y cada
  fichero se elige midiendo duración útil, ataque y cola.
- Impactos, whoosh inverso, clics, dings, glitch y tecleo ya son del usuario
  (prefijos de fichero; ver `SONIDOS-REELS/LEEME.md`). La librería sintetizada solo
  suena si falta un uso, y la revisión lo marca.

## Checklist final (antes de decir "hecho")

- [ ] `status` con las cinco puertas superadas.
- [ ] Reglas en verde e IN-R-042 sin avisos.
- [ ] Hoja de 20 fotogramas abierta y revisada; puntos visuales de `REVIEW.md` marcados.
- [ ] Sonoridad −14 ± 1 LUFS.
- [ ] Si has tocado código: `npm test` y `npm run intro:playbook:check` en verde.
- [ ] Resumen al usuario: duración, escenas, recursos con su fuente y lo que no se pudo
      conseguir (páginas protegidas).

## Trampas que ya han costado tiempo

- `String.replace` en JS interpreta `$'` y `$&` del texto de reemplazo: un precio como
  `'20 $'` duplicó medio fichero. Edita con la herramienta de ficheros.
- Una `stat` de más de 6 caracteres se parte en dos líneas: la cifra corta ("200 $") en
  `text` y el resto en `note`. El validador lo bloquea.
- Texto de color sobre fondo claro (portadas beige de Anthropic) no se lee. La
  `keyword` lleva su propio degradado abajo.
- Un heredoc de bash con comillas simples y `$` dentro rompe el comando. Escribe los
  ficheros con la herramienta de ficheros.
- El aviso de Remotion "Use the objectFit prop" en los vídeos de fondo no afecta al
  encuadre.

## Cuando el usuario corrige

Cada corrección va a **un** sitio, y se anota de dónde viene:

| Tipo de corrección | Dónde va |
|---|---|
| Medible sobre el montaje ("más de X por segundo", "tapa la cara") | Regla con `npm run intro:feedback` (validador y fixture) |
| Cuánto de algo (ritmo, duración, techo de golpes) | Perfil `hype-apertura` en `intro-profiles.json` |
| Qué intención, transición, sonido o retención toca en cada caso | `decision-tables.json` (y su test) |
| Gusto no medible (tipografía, qué recursos le gustan) | Sección "Preferencias" de esta skill |
| Un sonido que falta o sobra | Fichero en `SONIDOS-REELS` con su prefijo y `CATALOGO.md` |
