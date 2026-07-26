# Carouselsmith v1

Carouselsmith es un componente separado de Storysmith y del pipeline de vídeo. Convierte una fuente verificable en un proyecto editable de 5 a 10 piezas estáticas y conserva el master estructurado en `data/carousels/<id>/project.json`.

## Contrato

- Primera pieza: `cover-hero`.
- Última pieza: `cta`.
- Layouts disponibles: `cover-hero`, `photo-annotation`, `feature-list`, `pros-cons`, `comparison`, `stat`, `steps`, `quote`, `verdict`, `cta`.
- Los layouts `comparison` y `pros-cons` aceptan cabeceras semánticas mediante `accent` con el formato `COLUMNA A | COLUMNA B`; si no se indica, conservan sus etiquetas predeterminadas.
- El layout `stat` reutiliza ese mismo contrato para etiquetar dos cifras separadas por `/`, por ejemplo `ENTRADA | SALIDA` para `$2 / $10`.
- Cada afirmación editorial conserva `evidenceRefs` hacia fragmentos de la fuente. La CTA puede no citar evidencia.
- Las imágenes son apoyo visual. No se consideran evidencia y se validan por contenido real con Sharp.
- El renderer SVG compone imagen y texto sobre zonas seguras por layout. Registra las cajas de texto e imagen, bloquea overflows y solapamientos y usa `assetSlots[].composition.subjectPosition` como punto focal del recorte.
- `feature-list` añade pictogramas semánticos deterministas para razonamiento, herramientas, programación y seguridad. Las imágenes generadas deben llegar sin texto, logos ni marcas de agua.
- Exportaciones: PNG y JPEG a 1080 × 1350 (`instagram-feed`) y 1080 × 1920 (`vertical`), más hoja de contacto.
- Una validación bloquea la exportación si detecta recuento inválido, layout desconocido, titular vacío, overflow, colisión entre cajas o contraste principal insuficiente.

## Dashboard

La vista **Carruseles** permite crear, reabrir, editar, reordenar, cambiar tema o formato de preview, asignar imágenes y exportar. Los renders se sirven únicamente si aparecen en el manifest del proyecto.

## CLI

```bash
npm run carousel -- create --source-file "fuente.txt" --title "Tema" --slides 7 --theme forge
npm run carousel -- show --id carousel-...
npm run carousel -- import --id carousel-... --slide slide-01 --slot slide-01-visual-01 --image "hero.png"
npm run carousel -- render --id carousel-... --formats instagram-feed,vertical
npm run carousel -- list
```

## API local

- `GET /api/carousels`
- `POST /api/carousels`
- `GET /api/carousels/:id`
- `PATCH /api/carousels/:id`
- `POST /api/carousels/:id/assets`
- `GET /api/carousels/:id/preview/:slideId?format=instagram-feed|vertical`
- `POST /api/carousels/:id/render`
- `GET /api/carousels/:id/render-files/...`

Las mutaciones usan la misma protección de origen, CSRF, autenticación y rate limit del servidor local.

## Integración con Codex Image Generation

La skill del repositorio vive en `.agents/skills/carouselsmith`. Al invocarla, Codex crea el proyecto, lee los prompts de `assetSlots`, genera solo las imágenes necesarias y las importa conservando proveedor, prompt, dimensiones, tamaño y SHA-256. El render final siempre se realiza de forma determinista en Shortsmith.
