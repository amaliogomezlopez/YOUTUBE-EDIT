---
name: carouselsmith
description: Crea, revisa y exporta carruseles editoriales informativos con Shortsmith a partir de noticias, transcripciones o notas verificables. Úsalo para publicaciones estáticas de 5 a 10 diapositivas para Instagram, TikTok o Stories, con imágenes generadas o importadas, overlays, evidencia y exportación 4:5 o 9:16.
---

# Carouselsmith

Construye un proyecto de carrusel persistente y editable. Usa IA para el relato y, cuando haga falta, para ilustraciones sin texto; deja la composición final al renderer SVG determinista.

## Flujo de trabajo

1. Reúne una fuente verificable de al menos 80 caracteres; no añadas hechos externos.
2. Crea el proyecto con `npm run carousel -- create --source-file "ruta.txt" --title "Título" --slides 7 --theme forge`.
3. Revisa el JSON con `npm run carousel -- show --id <id>`, especialmente `evidenceRefs` y `assetSlots`.
4. Para cada slot, genera una imagen original sin texto, logos ni marcas de agua y respeta `subjectPosition` y `reservedTextZone`.
5. Importa la imagen con `npm run carousel -- import --id <id> --slide <slide-id> --slot <slot-id> --image "imagen.png" --provider codex-imagegen --prompt "..."`.
6. Revisa y corrige el proyecto en el dashboard.
7. Exporta con `npm run carousel -- render --id <id> --formats instagram-feed,vertical`.
8. Comprueba la hoja de contacto y todas las piezas antes de publicar. La validación debe quedar sin overflow ni colisiones en ambos formatos.

## Reglas editoriales

- Mantén entre 5 y 10 piezas; la primera es portada y la última CTA.
- Cita evidencia mediante `evidenceRefs`; una CTA puede no llevarla.
- Usa imágenes como apoyo visual, nunca como fuente factual.
- No incluyas texto en imágenes generadas: el renderer compone el overlay.
- Prioriza un símbolo principal reconocible por imagen, comprueba el recorte focal en 4:5 y 9:16 y evita escenas llenas de objetos decorativos pequeños.
- No imites exactamente el estilo de otro creador; aplica identidad propia.
- Trata el proyecto como borrador hasta revisar la hoja de contacto.

## Formatos

- `instagram-feed`: 1080 × 1350, principal 4:5.
- `vertical`: 1080 × 1920, para Stories, TikTok y piezas verticales.

Recompón ambos desde el master estructurado; nunca estires una exportación.
