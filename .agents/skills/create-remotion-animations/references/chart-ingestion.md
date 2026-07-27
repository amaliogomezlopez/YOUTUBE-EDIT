# Ingestión automática de gráficas

Usar este flujo cuando el usuario aporte una captura o imagen de una gráfica
y quiera señalar fechas, tramos, eventos, máximos, mínimos o variaciones.

## Comando

Preparar un JSON conforme a
`remotion-animations/schemas/chart-ingestion-input.schema.json` y ejecutar:

```powershell
npm run remotion:ingest:chart -- --input "<archivo.json>"
```

Opciones remotas, solo con autorización explícita:

```powershell
--vision           # VISION_LLM_* propone región y ejes visibles
--llm              # LLM_* selecciona anotaciones desde la evidencia
--allow-proposed    # genera props aunque la calibración requiera revisión
```

Sin esas opciones, la ingestión es local y determinista.

## Estados de calibración

- `confirmed`: región y ejes están completos y
  `calibration.confirmation.status=accepted`,
  `scope=plot-region-and-axes` y `acceptedBy` identifica la revisión.
- `proposed`: la región o los ejes proceden de visión, heurística o límites de
  la serie; revisar antes del render. Sin `--allow-proposed` no se crean props.
- `blocked`: faltan ejes suficientes; conservar el informe y pedir los datos.

Nunca tratar OCR, visión, límites inferidos ni un bloque `calibration` sin
aceptación explícita como confirmación automática. La composición no debe
leer cifras de una curva rasterizada.

## Selección semántica

La salida fija `patternId=asset.annotated-chart` y permite:

- `line-retrace`;
- `range-highlight`;
- `cursor-journey`;
- `peak-to-trough`;
- `before-after`;
- `event-marker`.

Con `--llm`, validar cada tipo, fecha y token numérico editorial contra la
serie, la transcripción y el foco autorizado. Rechazar la respuesta completa
si contiene una fecha o cifra inventada, un tipo incompatible o más de cuatro
anotaciones, y usar el fallback determinista.

Un cursor puede recorrer la geometría interpolada, pero la etiqueta visible
debe saltar entre muestras observadas. `before-after`, `peak-to-trough` y los
eventos derivados de una serie usan fechas exactas de esa serie.

Sin serie, exigir un foco explícito `range` o `event`. No generar porcentajes,
recorridos ni valores interpolados.

## Salidas

Cada ejecución crea:

```text
remotion-animations/out/<proyecto>/runs/<run-id>/
├── run-start.json
├── run-result.json
└── metadata/
    ├── chart-ingestion-report.json
    ├── annotated-chart-props.json
    └── animation-spec.json
```

Los dos últimos solo aparecen cuando `renderReady=true`. Los SVG externos se
rasterizan a PNG y el resto de assets externos se normaliza antes de entrar en
`public/assets/projects/<proyecto>/charts/`, con hash y manifest local.

Usar después el props JSON con `Chart-Annotated-Editorial`,
`Chart-Annotated-Documentary`, `Chart-Annotated-Market`,
`Chart-Annotated-Range-Audio` o `Chart-Annotated-Image-Only`. Los wrappers
silencioso y sonorizado fuerzan su decisión de audio aunque los props lleven
otro valor. Revisar siempre
stills 0/15/45/75/95 antes del render final.
