# Guía de montaje V4 · Ahorrar límites

Las nueve piezas son inserciones full-screen silenciosas, 1920×1080, 60 fps,
H.264 High `yuv420p`. Los tiempos son relativos al inicio de cada MKV.

| Clip | Entrada sugerida | Duración | Composición | Render |
| --- | ---: | ---: | --- | --- |
| `1.mkv` | `00:00.14` | 7 s | `ALV4-01-CosteCreciente` | `01/01_coste_creciente_v4.mp4` |
| `9.mkv` | `00:06.90` | 8 s | `ALV4-09-DesgloseTokens` | `09/09_carga_entrada_v4.mp4` |
| `12.mkv` | `00:00.00` | 5 s | `ALV4-12-VentanaContexto` | `12/12_ventana_contexto_v4.mp4` |
| `15.mkv` | `00:10.00` | 8 s | `ALV4-15-AtencionDispersa` | `15/15_atencion_dispersa_v4.mp4` |
| `19.mkv` | `00:16.86` | 8 s | `ALV4-19-TresSkills` | `19/19_tres_skills_v4.mp4` |
| `21.mkv` | `00:29.68` | 9 s | `ALV4-21-MarkdownClutter` | `21/21_markdown_clutter_v4.mp4` |
| `23.mkv` | `00:18.88` | 8 s | `ALV4-23-BucleRevision` | `23/23_bucle_revision_v4.mp4` |
| `26.mkv` | `00:00.00` | 8 s | `ALV4-26-Memoria` | `26/26_memoria_repos_v4.mp4` |
| `29.mkv` | `00:00.00` | 6 s | `ALV4-29-HorasPico` | `29/29_horas_valle_v4.mp4` |

## Evidencia y comportamiento

### Clip 01 · Coste creciente

- Evidencia: “el cuarto mensaje [...] cuesta mucho más que el primero”.
- Visual: cuatro barras crecen sobre una base común y la cuarta concentra el
  acento.
- Montaje: entrar desde el inicio de la pregunta. No interpretar las alturas
  como una escala monetaria exacta; expresan una relación cualitativa.

### Clip 09 · Carga de entrada

- Evidencia: una pregunta simple puede gastar miles de tokens en system prompt
  e información de herramientas.
- Visual: una banda se llena antes de revelar la pequeña fracción ocupada por
  la pregunta.
- Montaje: entrar antes de “estamos gastando miles y miles de tokens”. No hay
  porcentajes; los tamaños son cualitativos.

### Clip 12 · Ventana de contexto

- Evidencia: es la cantidad de información que recuerda el modelo.
- Visual: una ventana recibe bloques de conversación hasta quedar llena.
- Montaje: usar al presentar el término por primera vez.

### Clip 15 · Atención dispersa

- Evidencia: el modelo busca con índices la parte esencial sin releer toda la
  conversación.
- Visual: el carril superior hace un barrido completo; el inferior salta desde
  el índice hasta un bloque relevante.
- Montaje: sincronizar el salto con “buscar exactamente con índices”.

### Clip 19 · Skills reutilizables

- Evidencia: skills para servidores, arquitectura y objetivos o rol del agente.
- Visual: tres módulos se acoplan al chat y quedan disponibles como contexto.
- Montaje: entrar cuando empieza la enumeración de ejemplos.

### Clip 21 · Saturación Markdown

- Evidencia: muchos `.md` aumentan consumo y pueden empeorar los resultados.
- Visual: el repositorio acumula documentos, el agente los lee y devuelve dos
  consecuencias.
- Montaje: entrar en “cargado de archivos Markdown”.

### Clip 23 · Bucle de revisión

- Evidencia: tras una solución fallida aparece la tentación de insistir dentro
  del mismo chat.
- Visual: prompt, implementación y revisión cierran un circuito de retorno.
- Montaje: entrar desde “nos veríamos tentados”.

### Clip 26 · Memoria entre repositorios

- Evidencia: la memoria guarda preferencias que quizá no sirvan en otro repo y
  añade coste de lectura.
- Visual: preferencias salen del chip de memoria, chocan con dos repositorios y
  llenan el indicador de coste.
- Montaje: entrar al comenzar la explicación de la memoria.

### Clip 29 · Horas valle

- Evidencia: algunos proveedores estiran más los límites fuera de horas pico.
- Visual: un cursor cruza una franja conceptual de valle/pico y modifica el
  rendimiento del límite.
- Montaje: no usar la franja como horario real; depende del proveedor y su zona.

## Props editables

Cada composición expone en Remotion Studio:

- `title`: titular principal;
- `kicker`: apoyo opcional;
- `accentColor`: color de acento;
- `clipNumber`: metadata del clip;
- `scene`: patrón visual registrado.

## Reproducción

Desde `D:\2-YOUTUBE-EDIT`:

```powershell
npm run remotion:check
npm --prefix remotion-animations run stills:ahorrar-limites-v4
npm --prefix remotion-animations run render:ahorrar-limites-v4
```

El render usa `--codec=h264 --crf=17 --image-format=png
--pixel-format=yuv420p --muted --concurrency=8`.

## Verificación

- Resolución: 1920×1080.
- Velocidad: 60 fps.
- Códec: H.264 High.
- Pixel format: `yuv420p`.
- Audio: ninguna pista.
- Código fuente: `remotion-animations/src/AhorrarLimitesV4.tsx`.
- Registro: folder `Ahorrar-Limites-V4-Editorial` en `src/Root.tsx`.
- Hoja de contacto: `PREVIEWS/contact-sheet-v4.png`.
