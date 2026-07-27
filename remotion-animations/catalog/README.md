# Catálogos de Remotion

Esta carpeta contiene contratos de selección, no archivos de render.

```text
catalog/
├── animations/
│   ├── patterns.json
│   └── effects.json
└── visuals/
    ├── icons.json
    ├── drawings.json
    └── images.json
```

- `animations/` decide qué patrón, efecto y perfil sonoro comunica una idea.
- `visuals/` registra recursos gráficos propios, sus etiquetas semánticas y
  la implementación React/SVG que los dibuja.
- Los IDs son estables. Una composición guarda el ID, nunca markup SVG
  generado libremente.
- Los catálogos se validan con `npm run check:catalog`.

Los píxeles de imágenes, logos y capturas viven en `public/assets/`; el
registro `visuals/images.json` conserva sus metadatos de selección. Empieza
vacío para no incorporar recursos sin procedencia ni licencia verificadas.
