# Customización visual y assets

## Tres decisiones separadas

No tratar “estilo” como una sola prop. Elegir por separado:

1. `themeId`: material, contraste y paleta.
2. `motionProfile`: tempo, distancia, stagger, escala y carácter.
3. `format`: geometría y safe zones del canal.

Temas operativos:

- `ink-lime`: control room oscuro y acento lima; identidad predeterminada.
- `editorial-ivory`: papel neutro, tinta casi negra y azul editorial.
- `signal-cobalt`: datos y sistemas con rejilla técnica.
- `oxide-documentary`: evidencia, archivo y acabado documental cálido.

Perfiles operativos:

- `restrained`: mínima traslación y lectura pausada.
- `editorial`: equilibrio predeterminado.
- `kinetic`: energía alta para acumulación o ranking.
- `technical`: timing preciso y poco overshoot.
- `cinematic`: parallax o imagen con desplazamiento lento.

Formatos:

- `landscape`: 1920×1080, vídeo largo.
- `vertical`: 1080×1920, Shorts/Reels/TikTok.
- `square`: 1080×1080.
- `portrait`: 1080×1350.

Leer `catalog/design/brand-profiles.json` y conservar los defaults del canal:
encabezado opcional y centrado; watermark y regla de esquina desactivados.

## Texto

- Omitir título y texto de apoyo cuando la animación explica la idea.
- No duplicar subtítulos ni locución.
- Schibsted Grotesk es display y cuerpo; Fragment Mono se reserva a fechas,
  ratios, timecodes y cifras.
- Un título de más de 66 caracteres requiere revisión en todos los formatos;
  más de 96 bloquea QA.

## Importación de assets

Registrar imágenes con:

```powershell
npm run remotion:asset:import -- `
  --file "<ruta>" `
  --id "<slug>" `
  --type screenshot `
  --alt "<descripción>" `
  --source "<origen>" `
  --license "<licencia>" `
  --tags "interfaz,ajuste,evidencia" `
  --focal-x 58 --focal-y 42
```

Tipos: `photo`, `screenshot`, `chart`, `illustration`, `texture`, `logo`.
La importación corrige orientación, elimina metadatos innecesarios, normaliza
PNG/JPEG, rasteriza SVG y actualiza el catálogo con hashes de origen y destino.

Nunca registrar una imagen sin procedencia y licencia. Nunca descargar
recursos durante un render.

## Selector y preferencias

El selector local expande conceptos con una ontología bilingüe, aplica fuzzy
matching y después ajusta el ranking con
`catalog/preferences/channel-profile.json`. El LLM, si se habilita, solo puede
elegir IDs ya existentes.

El fallback es una receta editable de iconos auditados. No autoriza paths SVG
libres. Para enseñar una relación compleja, preferir un `drawing` o un patrón
`ready` antes que encadenar iconos decorativos.
