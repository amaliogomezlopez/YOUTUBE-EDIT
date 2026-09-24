# Montaje viral con voz en off (`montage-studio`)

Superficie para montar Shorts 9:16 y vídeos largos 16:9 **sin cámara**: una locución
(grabada o sintética) conduce la pieza y encima se encadenan imágenes y vídeos a
pantalla completa que cambian cada pocos segundos. Cada cambio lleva movimiento de
cámara, transición y golpe de sonido, y las cifras dichas saltan a pantalla. Es el
estilo "siempre está pasando algo" de los canales de noticias virales, pensado para
Finance Cavaliers.

No es el motor editorial de Finance Cavaliers (`editorial-video`, sobrio, explica
gráficas y tiene reglas que prohíben justo esta densidad) ni el de shorts
(`shorts-studio`, que exige un clip de vídeo en cada escena).

## Ciclo

```bash
npm run montage -- ingest --slug <slug> --voiceover <audio> --assets <carpeta> [--transcript <json>] [--music <audio>] [--force]
# editar remotion-animations/projects/montage-<slug>/montage-plan.json
npm run montage -- build  --slug <slug> [--format 9x16|16x9]
npm run montage -- render --slug <slug> [--format 9x16|16x9]
```

- **ingest**
  - Normaliza la voz a -16 LUFS.
  - Transcribe con faster-whisper (tiempos por palabra). Si ya hay una transcripción con palabras, se pasa con `--transcript`.
  - Copia los assets y reduce las imágenes de más de 2560 px.
  - Deja `manifest.json` y un `montage-plan.json` inicial.
  - Los ficheros `<asset>.provenance.json` que acompañen a un asset se guardan en el manifest.
- **build**
  - Compila un `montage-build.<formato>.json` por cada formato del plan.
  - Ejecuta las reglas MO-R y regenera `remotion-animations/src/montage/registry-<formato>.generated.ts`.
- **render**
  - Exporta con `remotion-animations/scripts/render-safe.mjs`.
  - Renormaliza la mezcla a -14 LUFS sin recodificar el vídeo.
  - El MP4 sale en `remotion-animations/out/montage-<slug>/runs/`.

Composiciones: `Montage-9x16-<Slug>` y `Montage-16x9-<Slug>`, en la carpeta
`Montajes` del estudio (`npm run remotion:studio`). Tras añadir o quitar una,
ejecutar `npm run remotion:capabilities`.

## El plan: el agente decide dónde, el build decide cuánto

```json
{
  "version": 1,
  "slug": "fed-tipos",
  "profileId": "viral-short",
  "formats": ["9x16", "16x9"],
  "cut": {"fromWord": 0, "toWord": 120},
  "emphasis": [11, 83],
  "overrides": [{"atWord": 43, "assetId": "market-screen", "camera": "punch"}],
  "textPops": [{"atWord": 83, "text": "MÁXIMOS"}]
}
```

- `atWord` es el índice de la palabra en `transcript.json`. Es la única ancla temporal: el plan nunca escribe segundos.
- `cut` recorta la locución por palabras.
- `emphasis` son palabras de golpe:
  - atraen un corte, que llega con `punch`, temblor y sonido `boom`;
  - no se escriben en pantalla.
- `overrides` fija, en una palabra que abre visual, el asset y, si hace falta, estos campos:
  - `camera`, `transition`, `fit` (`cover`/`contain-blur`) y `focus` (`{x, y}` de 0 a 1);
  - `overlay` (`{kind: "stat"|"pop", text}`);
  - `sound` (`{family, intensity}`, o `false` con `soundNote`).
- `textPops` escribe una palabra gancho o una cifra en pantalla. Además, las cifras que dice la locución salen solas ("5,2 por ciento" pasa a "5,2 %"), limitadas por la densidad del perfil.

Lo demás lo hace el planificador (`src/modules/montage-studio/planner.js`):

1. **Reparto.** Divide la locución en visuales dentro de la ventana de ritmo del perfil. Los cortes solo caen en el inicio de una palabra (`video-studio/shot-schedule.js`).
2. **Asset de cada visual.**
   - El asset que la locución nombra (por su nombre de fichero, o por el texto de su captura) entra donde se nombra.
   - El resto rota: primero el menos usado recientemente.
   - Un asset reservado por un override o por una mención posterior no se gasta antes.
   - Si repite, cambia de encuadre.
3. **Cámara y transición.** El movimiento de cámara nunca se repite dos veces seguidas; la transición sale de un patrón y tampoco se repite.
4. **Sonido.** Cada transición suena con su familia (`transitionSound` del perfil). La música, si la hay, baja bajo la voz.
5. **Descartes.** Una imagen que habría que ampliar más de 3 veces (un logo de 80 px) no entra. Si no queda ningún asset, el build falla: nunca se renderiza un hueco.

## Perfiles (`src/modules/montage-studio/montage-profiles.json`)

| Perfil | Visual | Sin corte máx. | Cámara quieta máx. | Cortes/10 s | Zoom |
|---|---|---|---|---|---|
| `viral-short` | 1,5–3 s | 3 s | 0,5 s | 7 | 1,06–1,32 |
| `viral-long` | 2,5–4,5 s | 4,5 s | 0,5 s | 5 | 1,05–1,25 |

El perfil también fija:
- los patrones de cámara y transición;
- la familia de sonido de cada transición;
- el estilo de subtítulos (palabra a palabra en mayúsculas en el short, karaoke en el largo);
- la densidad de textos emergentes.

Para cambiar el *cuánto* se edita el perfil, no el código.

## Reglas (`src/modules/montage-studio/rules/montage-rules.json`)

| Regla | Qué comprueba | Severidad |
|---|---|---|
| MO-R-010 | Cada frame tiene una visual resuelta, sin huecos ni solapes. | error |
| MO-R-020 | Ninguna visual dura más que `maxSecondsWithoutCut`. | error |
| MO-R-021 | La cámara nunca está quieta más de `maxSecondsStatic`. | error |
| MO-R-022 | Duración mínima de una visual y número de cortes por 10 s. | warning |
| MO-R-023 | Dos beats seguidos no repiten movimiento de cámara. | error |
| MO-R-024 | Separación mínima antes de repetir un asset. | warning |
| MO-R-030 | Subtítulos y textos quedan por encima de la zona que tapa la interfaz de cada plataforma. | error |
| MO-R-040 | Ningún texto entra en silencio. Es `cue-not-silent`, de catálogo. | error |

- Los umbrales salen del `budget` del perfil.
- Cada regla tiene validador en `rules/checks/` y fixture en `tests/fixtures/montage-rules/`.

## Remotion (`remotion-animations/src/montage/`)

- `MontageVideo.tsx` compone el vídeo, con las mismas capas en los dos formatos:
  - las visuales, donde cada beat se alarga lo que dura la transición del siguiente;
  - los golpes, compartidos con la intro en `motion/HitEffects.tsx`;
  - los textos emergentes;
  - los subtítulos, con `shorts/StyledCaptionTrack`;
  - la voz, la música y los sonidos (`motion/SoundDesign`).
- `VisualBeat.tsx` pinta cada visual:
  - la imagen o el vídeo a pantalla completa;
  - `contain-blur` para capturas y logos, con el contenido entero sobre una copia desenfocada;
  - la cámara por keyframes con origen en `focus`;
  - la transición de entrada.
- `geometry.json` guarda la zona segura y los rectángulos de subtítulos y textos por formato. Lo leen el renderer y la regla MO-R-030.

## Pendiente

- 16:9 con encuadre por formato y el resto de reglas previstas:
  - procedencia de cada asset;
  - resolución tras el zoom;
  - densidad de sonido;
  - ducking de la música.
- `montage:feedback` y `montage:playbook`.
- Toolkit de assets `montage:assets`:
  - capturas web y de X;
  - descarga de vídeo con yt-dlp y recorte por tramos;
  - descarga de stock de Pexels/Pixabay, todo con procedencia.
- TTS local para pruebas (Chatterbox Multilingual o Kokoro) y más variedad de efectos de sonido de transición.
