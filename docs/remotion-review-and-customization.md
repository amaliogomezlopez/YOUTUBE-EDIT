# Review, customización y assets de Remotion

## Arquitectura

La ampliación conserva un único proyecto Remotion:

```text
remotion-animations/
├── catalog/
│   ├── animations/      # patrones y efectos
│   ├── design/          # perfil de marca, temas y ritmos
│   ├── preferences/     # preferencias del selector
│   └── visuals/         # iconos, dibujos e imágenes
├── review/              # fuente React del Review Studio
├── schemas/             # contratos de props, QA y revisión
├── scripts/             # build, importación y paquetes reproducibles
└── src/motion/          # sistema visual y componentes
```

Los outputs permanecen en runs inmutables. Las sesiones y comentarios son
estado local y viven en `data/review/remotion/`, excluido de Git.

## Decisiones de diseño

- El encabezado es opcional y se centra cuando aporta contexto.
- No hay watermark ni regla de esquina predeterminados.
- Tema, ritmo y formato son independientes.
- Cada patrón funciona sin audio; el sonido es una decisión explícita.
- La animación usa datos y frame de Remotion, no CSS temporal.
- La IA selecciona IDs registrados; no escribe SVG libre.

## Flujo recomendado

1. Leer `catalog/capabilities.manifest.json`.
2. Elegir un patrón `ready` por significado y evidencia.
3. Importar assets locales con procedencia y licencia.
4. Preparar variantes únicamente para decisiones reales.
5. Revisar en `/remotion-review/` con contexto y safe zones.
6. Anclar feedback al frame.
7. Ejecutar QA y aprobar.
8. Crear el paquete de revisión.
9. Renderizar la variante aprobada mediante un run nuevo.

## Comandos

```powershell
npm run remotion:capabilities
npm run remotion:asset:import -- --file "<ruta>" --id "<slug>" --type screenshot --alt "<texto>" --source "<origen>" --license "<licencia>" --tags "tag1,tag2"
npm run remotion:review:build
npm run server
npm run remotion:review:package -- --session "<review-id>"
npm run remotion:check
```

## Límites actuales

- El QA renderizado detecta frames con riesgo de estar vacíos y conserva
  hashes/métricas; no sustituye la revisión humana del contacto etiquetado.
- El vídeo fuente debe ser una URL que el servidor/renderer pueda leer.
- Los patrones heredados siguen siendo 16:9 salvo que el manifest declare
  formatos adicionales.
- El selector semántico es local y auditable; el LLM es opcional y sólo elige
  candidatos del catálogo.
