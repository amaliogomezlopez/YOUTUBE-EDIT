# Catálogos de Remotion

Esta carpeta contiene contratos de selección, no archivos de render.

```text
catalog/
├── capabilities.manifest.json
├── animations/
│   ├── patterns.json
│   └── effects.json
├── design/
│   └── brand-profiles.json
├── preferences/
│   └── channel-profile.json
└── visuals/
    ├── icons.json
    ├── drawings.json
    └── images.json
```

- `animations/` decide qué patrón, efecto y perfil sonoro comunica una idea.
- `visuals/` registra recursos gráficos propios, sus etiquetas semánticas y
  la implementación React/SVG que los dibuja.
- `design/` separa temas, ritmos, tipografía y formatos de los patrones.
- `preferences/` ajusta la selección automática con decisiones aprobadas del
  canal; no reemplaza la evidencia semántica.
- Los IDs son estables. Una composición guarda el ID, nunca markup SVG
  generado libremente.
- Los catálogos se validan con `npm run check:catalog`.
- `capabilities.manifest.json` consolida la superficie ejecutable. Regenerarlo
  con `npm run build:capabilities` después de cambiar catálogos, schemas o
  composiciones.
- Los patrones que admiten ingestión automática declaran comando, esquema,
  estados de confianza y política de análisis externo dentro de `ingestion`.

Los píxeles de imágenes, logos y capturas viven en `public/assets/`; el
registro `visuals/images.json` conserva sus metadatos de selección. Cada
entrada necesita procedencia, licencia, dimensiones y SHA-256 coincidente con
el archivo local.

Importar y normalizar assets desde la raíz con
`npm run remotion:asset:import`. Los SVG externos se rasterizan; el render
nunca descarga imágenes.

El selector ejecutable se invoca desde la raíz con
`npm run remotion:select:visual`. El fallback solo puede componer IDs del
catálogo y nunca produce markup SVG arbitrario.
