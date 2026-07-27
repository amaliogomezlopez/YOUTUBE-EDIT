---
name: scout-animations
description: "Descarga y explora vídeos de referencia de YouTube o archivos locales para descubrir, estudiar y reconstruir mecánicas de motion graphics, transiciones, gráficas, interfaces y cámara; ejecuta Animation Scout en dos pasadas, analiza hojas de contacto frame a frame, prepara o realiza su integración en el catálogo Remotion de Shortsmith y gestiona la limpieza explícita de sus jobs visuales. Usar cuando el usuario aporte un vídeo o enlace y pida explorar, copiar o recrear el estilo de una animación, extraer patrones visuales, comparar referencias, ampliar el catálogo o limpiar frames y hojas de scouting, sin reutilizar assets, textos o marcas de terceros."
---

# Scout Animations

Convertir vídeos de referencia en mecánicas visuales verificables y
reutilizables. Estudiar píxeles y movimiento; no tratar el vídeo como fuente
editorial ni copiar su identidad.

## Cargar el contexto

1. Trabajar desde `D:\2-YOUTUBE-EDIT` y leer `AGENTS.md`.
2. Leer siempre [workflow.md](references/workflow.md) antes de ejecutar el
   scouting.
3. Leer [analysis-contract.md](references/analysis-contract.md) antes de
   analizar hojas o redactar candidatos.
4. Leer [catalog-integration.md](references/catalog-integration.md) solo cuando
   haya que proponer, catalogar o implementar una mecánica.
5. Consultar `docs/animation-scouting.md` si cambia la CLI, la privacidad o los
   artefactos.
6. Si comienza implementación React/Remotion, continuar con
   `$create-remotion-animations` y `remotion-best-practices`.
7. Leer `docs/animation-artifact-cleanup.md` antes de revisar o borrar jobs,
   frames, vídeos descargados u hojas de scouting.

## Elegir el alcance

- **Explorar**: ejecutar `survey`, elegir rangos y producir estudios densos.
- **Proponer catálogo**: explorar y crear `catalog-proposal.json`; no editar
  todavía el catálogo ni React.
- **Integrar**: actualizar catálogo, implementar primitivas o composiciones,
  generar demos y validarlas. Hacerlo solo cuando el usuario pida incorporar,
  recrear o construir la mecánica.

Si el alcance es ambiguo, completar exploración y propuesta. No implementar
todas las animaciones descubiertas por defecto.

## Ejecutar el flujo

### 1. Preparar la fuente

- Resolver la URL o ruta absoluta y conservar el original sin cambios.
- Usar `yt-dlp` para una URL pública. Reutilizar el MP4 descargado por el job en
  todos los estudios posteriores.
- Obtener duración, resolución y fps mediante el manifest o `ffprobe`.
- No transcribir, extraer audio ni usar Whisper.
- No imprimir `.env`, claves ni tokens. Para verificar configuración, mostrar
  solo presencia booleana y capacidad multimodal.

### 2. Recorrer el vídeo

```powershell
npm run scout:animations -- --source "<url-o-ruta>" --mode survey --goal "<objetivo visual>"
```

- Usar `survey` para cobertura, no para reconstruir movimiento rápido.
- Revisar todas las hojas de contacto. Los scores heurísticos son una señal,
  pero pueden favorecer cortes, ruido o créditos.
- Localizar transformaciones sostenidas: trazados, máscaras, morphs, zooms,
  stagger, trayectorias, cambios de jerarquía y composición.

### 3. Estudiar candidatos

```powershell
npm run scout:animations -- --source "<mp4-local>" --mode study --start <inicio> --end <fin> --fps 12
```

- Usar normalmente 8-12 fps.
- Usar 24-30 fps solo para una transición de hasta unos tres segundos que
  requiera precisión adicional.
- Ajustar `--max-frames` para que no reduzca los fps efectivos del rango.
- Inspeccionar todas las hojas del estudio, no solo su overview.
- Separar movimiento de cámara, motion graphics y simples cortes.

### 4. Analizar

- Usar `--analyze` únicamente con un endpoint que acepte bloques
  `image_url` y data URLs JPEG.
- No enviar imágenes a modelos de solo texto. LongCat no es un proveedor visual.
- Si no existe modelo multimodal, revisar las hojas localmente y generar
  `manual-visual-analysis.json` con el mismo rigor.
- Mantener separados `observed`, `inferredMechanism` y `uncertainties`.
- Estimar easing, capas y propiedades sin presentarlos como parámetros
  originales.

### 5. Preparar el catálogo

- Crear `catalog-proposal.json` siguiendo
  [catalog-integration.md](references/catalog-integration.md).
- Mapear primero contra patrones, efectos y primitivas existentes.
- Proponer una entrada nueva solo cuando la mecánica sea generalizable.
- Reutilizar mecánica, ritmo y jerarquía; excluir logos, ilustraciones,
  tipografías, textos, datos y colores propietarios.
- Antes de implementar una pieza editorial, exigir su propia fuente factual y
  un `animation-spec.json`.

## Puertas de calidad

- Confirmar cada mecanismo en varios frames consecutivos.
- Conservar timestamps absolutos y fps efectivo.
- Rechazar como patrón una simple edición de plano.
- Evitar duplicar una abstracción ya presente en el catálogo.
- No marcar nada como `ready` sin componente reusable, demo y validación.
- Revisar visualmente cualquier mecanismo inferido.
- Mantener todas las incertidumbres relevantes en el handoff.

## Entregar

Indicar:

- vídeo, duración, resolución y fps;
- cobertura del survey y fps efectivo;
- rangos estudiados, fps y número de frames;
- candidatos priorizados y por qué son reutilizables;
- coincidencias y huecos del catálogo;
- enlaces absolutos a `manifest.json`, hojas, análisis, handoff y propuesta;
- si se enviaron imágenes a un modelo externo;
- validaciones ejecutadas y limitaciones reales.

## Limpiar

- Conservar los jobs de scouting por defecto: contienen la evidencia visual y
  el handoff usados para reconstruir la mecánica.
- Simular con
  `npm run cleanup:animations -- --scope scout --older-than-days <días> --keep-last <n>`.
- Borrar solo ante una petición explícita, repitiendo el mismo alcance con
  `--apply --confirm=DELETE_ANIMATION_ARTIFACTS`.
- No usar `--include-incomplete`, `--keep-last 0` ni
  `--older-than-days 0` salvo que el usuario pida ese alcance.
- Confirmar qué jobs se eliminaron y que el borrado no es recuperable. Borrar
  o archivar el chat no elimina estos archivos.

## Invocaciones típicas

```text
Usa $scout-animations con este vídeo de YouTube. Localiza las mejores
transiciones, estúdialas a 12 fps y prepara una propuesta para el catálogo.
```

```text
Usa $scout-animations sobre este MP4 y recrea solo la mecánica del resumen
radial dentro del toolkit Remotion, con nuestra identidad.
```
