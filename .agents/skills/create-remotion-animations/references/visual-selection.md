# Selector semántico de recursos visuales

## Fuente de verdad

Leer primero:

- `remotion-animations/catalog/capabilities.manifest.json`;
- `remotion-animations/catalog/visuals/icons.json`;
- `remotion-animations/catalog/visuals/drawings.json`;
- `remotion-animations/catalog/visuals/images.json`.

El manifest enumera composiciones, patrones, efectos, perfiles artísticos,
schemas y comandos disponibles. Si no coincide con los catálogos, ejecutar
`npm run remotion:capabilities` y validar con `npm run remotion:check`.

## Selección ejecutable

```powershell
npm run remotion:select:visual -- --query "<concepto>"
npm run remotion:select:visual -- --query "<concepto>" --kind drawing
npm run remotion:select:visual -- --query "<concepto>" --allow-fallback
```

El modo local puntúa ID, etiqueta, tags, categoría y verbo de movimiento. La
salida incluye la selección y alternativas auditables.

`--llm` solo puede elegir un ID y tipo existentes. Una respuesta fuera del
catálogo se rechaza completa.

## Fallback controlado

`--allow-fallback` no autoriza SVG libre. Produce una receta
`controlled-composite` de uno a tres iconos existentes con layout `cluster` o
`flow`. El renderer compone esos glifos ya auditados.

No generar path SVG arbitrario desde texto. Si la receta no comunica la idea,
registrar un hueco de catálogo y diseñar un recurso reutilizable con revisión
humana.
