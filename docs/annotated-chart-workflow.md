# Gráficas anotadas a partir de imágenes

`AnnotatedChartScene` permite usar una gráfica local como base visual y
superponer anotaciones deterministas en Remotion.

## Niveles de precisión

1. **Imagen solamente**: permite zoom y regiones en coordenadas de píxel.
   No debe mostrar valores inferidos.
2. **Imagen calibrada**: añade el rectángulo de trazado y los límites de los
   ejes. Las fechas y valores ya pueden convertirse en coordenadas.
3. **Imagen calibrada con serie**: la imagen conserva el estilo y la serie
   JSON aporta muestras exactas, variaciones y puntos. La geometría puede
   interpolarse para mover un cursor, pero sus etiquetas solo muestran una
   muestra observada.

La composición nunca extrae cifras de la curva rasterizada. Si no existe una
serie o una escala fiable, la anotación debe mantenerse cualitativa.

## Ingestión automática

El contrato vive en
`remotion-animations/schemas/chart-ingestion-input.schema.json`. El comando:

```powershell
npm run remotion:ingest:chart -- --input "<archivo.json>"
```

inspecciona dimensiones y hash, propone la región de trazado, prepara assets
externos en `public/assets/projects/<proyecto>/charts/`, selecciona
anotaciones y genera:

- `chart-ingestion-report.json`;
- `annotated-chart-props.json`;
- `animation-spec.json`.

La calibración tiene tres estados:

- `confirmed`: región y ejes completos con una aceptación explícita en
  `calibration.confirmation`; props listas.
- `proposed`: visión, heurística o serie han propuesto parte de la
  calibración; requiere revisión.
- `blocked`: faltan ejes suficientes y no se generan props.

`--vision` y `--llm` son opcionales y envían respectivamente la imagen o la
evidencia al proveedor configurado. No se activan por defecto. Toda fecha
propuesta por el selector se valida contra la evidencia; una respuesta
inválida se descarta entera y activa el fallback determinista. El contrato se
valida con JSON Schema durante la ejecución, no solo como documentación.

Una confirmación válida tiene esta forma:

```json
{
  "confirmation": {
    "status": "accepted",
    "scope": "plot-region-and-axes",
    "acceptedBy": "revisor"
  }
}
```

`--allow-proposed` permite generar props para QA, pero no convierte la
procedencia en confirmada.

## Calibración

El asset se registra con dimensiones conocidas:

```json
{
  "publicPath": "assets/library/chart-samples/demo-index-2025.svg",
  "width": 1700,
  "height": 760,
  "plotRegion": {
    "x": 120,
    "y": 70,
    "width": 1460,
    "height": 570
  }
}
```

Los ejes definen la transformación:

```json
{
  "xAxis": {
    "start": "2025-01-01",
    "end": "2025-12-31"
  },
  "yAxis": {
    "min": 95,
    "max": 130,
    "unit": "",
    "decimals": 1
  }
}
```

`plotRegion` siempre se expresa en píxeles del archivo original, no en
píxeles de la composición. La capa SVG comparte el mismo `viewBox`, por lo que
la imagen y las anotaciones siguen alineadas durante el zoom.

## Anotaciones disponibles

- `line-retrace`: redibuja la serie exacta.
- `range-highlight`: aísla un intervalo temporal con máscara.
- `cursor-journey`: recorre la geometría y etiqueta el dato observado más
  cercano, sin presentar interpolaciones como valores exactos.
- `peak-to-trough`: calcula y presenta la variación entre máximo y mínimo.
- `before-after`: compara dos fechas sobre la misma escala.
- `event-marker`: ancla un acontecimiento a una fecha y valor.

Cada anotación declara `startSeconds`, `endSeconds` y, opcionalmente,
`hideAtSeconds`. Todo movimiento depende del frame de Remotion.

## Cámara y sonido

La cámara recibe una fecha y un valor calibrados. El zoom se aplica a la
imagen y al overlay como una sola superficie; el titular y la atribución no
se escalan.

El perfil sonoro es `trend-focus`:

- whoosh suave al comenzar el trazado;
- pulso al fijar un rango;
- tick al terminar el cursor;
- impacto ligero en la conclusión.

Las composiciones silenciosas siguen siendo plenamente comprensibles.

## Composiciones de referencia

- `Chart-Annotated-Range`: rango, cursor, caída y zoom final.
- `Chart-Annotated-Range-Audio`: misma pieza con cues opcionales.
- `Chart-Annotated-Editorial`: jerarquía asimétrica, reglas y etiquetas
  editoriales.
- `Chart-Annotated-Documentary`: la captura domina el plano como evidencia.
- `Chart-Annotated-Market`: retícula técnica, tipografía mono para datos y
  atribución tipo ticker.
- `Chart-Annotated-Events`: eventos y comparación antes-después.
- `Chart-Annotated-Image-Only`: resaltado y zoom de una captura calibrada sin serie ni encabezado.

Los datos incluidos son sintéticos y solo sirven para QA. Para una pieza
editorial deben sustituirse por una fuente aportada y verificable.

Los SVG externos se rasterizan a PNG antes de entrar en `public/`. Los SVG
propios ya versionados dentro de la biblioteca pueden conservarse. Las
variantes mudas y con SFX usan wrappers distintos, por lo que un prop no puede
desactivar por accidente el audio del target sonorizado.

## Tipografía y variedad

Schibsted Grotesk es la voz editorial y Fragment Mono se reserva a fechas,
cifras y etiquetas técnicas. Ambas fuentes se cargan desde `public/fonts/`.
`artDirection` acepta `editorial-report`, `documentary-evidence`,
`diagrammatic-system` y `market-data`.

La ingestión acepta `recentSelections` y escribe `variety` en
`animation-spec.json` para evitar repetir el mismo perfil o efecto dominante
en piezas consecutivas.

## Validación

```powershell
npm run remotion:check
npm run remotion:stills:annotated-chart
npm run remotion:ingest:chart -- --input remotion-animations/projects/chart-ingestion-demo/chart-ingestion-input.json
node --test tests/annotated-chart-geometry.test.js
```

El script de stills crea cinco checkpoints por composición, una hoja de
contacto y un índice dentro de una ejecución inmutable.
