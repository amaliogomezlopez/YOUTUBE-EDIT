# Lenguaje de montaje — Finance Cavaliers

<!-- GENERADO por scripts/render-editing-playbook.js desde
     channels/finance-cavaliers/brand/editing-rules.json.
     No editar a mano: los cambios se pierden en la siguiente generación. -->

Este contrato convierte la locución en decisiones visuales reutilizables. Cada regla nació de una corrección real y tiene id estable, severidad y validador. `editing-playbook.md` se genera desde este fichero: nunca se edita a mano.

## Cómo leer este documento

| Severidad | Efecto |
| --- | --- |
| `error` | Bloquea el build. El plan no se renderiza. |
| `warning` | No bloquea, pero aparece en el informe y exige justificación. |
| `review` | Requiere mirada humana; no hay comprobación geométrica posible. |

| Ámbito | Significado |
| --- | --- |
| `catalog` | Regla universal del catálogo: aplica a cualquier canal. |
| `channel` | Regla de marca de Finance Cavaliers. |

Reglas: **62** · con validador automático: **45** · marcadas `manual`: **17** · sin implementar: **0**.

Una regla `channel` aplicada en dos canales asciende a `catalog` y se documenta en capabilities.manifest.json (ANM-I06).

## 1. La palabra manda

### FC-R-001 · `error` · `catalog`

Cada mención visualizable se convierte en un cue anclado al índice de palabra de la transcripción, no a un segundo escrito a mano.

**Por qué:** El segundo se invalida en cuanto se recorta una pausa; el índice de palabra sobrevive a la reedición.

**Validador:** `anchor-resolution`

### FC-R-002 · `error` · `catalog`

El cambio visual empieza entre 0 y 0,4 s después de la palabra pronunciada.

**Por qué:** Antes de la palabra el efecto la anticipa y la delata; mucho después se lee como error de montaje.

**Validador:** `cue-word-anchoring` · parámetros: `{"maxDelaySeconds":0.4}`

### FC-R-003 · `error` · `channel`

Toda cifra narrada —número, porcentaje o importe— tiene un cue visible.

**Por qué:** Es la promesa central del formato: cuando digo un dato, el dato aparece.

**Validador:** `number-cue-obligation` · parámetros: `{"minCoverage":0.95}`

### FC-R-004 · `review` · `catalog`

No se usan zooms, destellos ni sonidos sin función semántica declarada.

**Por qué:** El movimiento decorativo compite con la información y cansa.

**Validador:** `cue-semantic-function`

### FC-R-005 · `warning` · `catalog`

El mismo estado focal no se mantiene más de 1,5 s sin un cambio de información.

**Por qué:** Un cursor o un pulso sostienen la atención, pero no sustituyen a un cambio real.

**Validador:** `focus-hold-max`

### FC-R-013 · `error` · `channel`

El texto en pantalla no debe repetir literalmente frases de la locución; debe aportar contexto, método, evidencia, relación o conclusión nueva.

**Por qué:** La escena de control repetía «cerca de un 20%» y «sumamente extraño» en lugar de explicar por qué la serie no confirmaba la afirmación.

**Validador:** `screen-text-adds-information`

## 2. Contrato de verdad gráfica

### FC-R-010 · `review` · `catalog`

Una cifra narrada y una cifra visible solo conviven si coinciden métrica, universo, benchmark, ventana temporal, frecuencia y método de cálculo.

**Por qué:** Ajustar una curva para que parezca coincidir es falsear el dato.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-011 · `review` · `catalog`

Si falla una condición de equivalencia, la escena queda `blocked` y la preview editorial muestra la discrepancia y la acción necesaria.

**Validador:** `blocked-scene-explains`

### FC-R-012 · `review` · `catalog`

Las gráficas publicables incluyen ejes, unidades, fechas, fuente y definición; las comparaciones sin escala se marcan como conceptuales.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-024 · `error` · `catalog`

Un adaptador de patrón no puede simplificar la evidencia narrativa de una escena: si la locución y el plan exigen dos series debe renderizar ambas y su relación; si nombra entidades con logos disponibles debe usar esos assets y conservar los cues de foco.

**Por qué:** La migración del episodio 1 a patrones genéricos descartó secondaryChartData y sustituyó siete logos por texto, aunque el plan conservaba ambas evidencias.

**Validador:** `pattern-evidence-preserved`

## 3. Ritmo y variedad

- Catálogo de rotación por contenido: gráfica completa con ejes; zoom sobre un tramo verificable; capa de superficie / capa interna; métrica cinética; logos y relaciones; comparación lado a lado; mapa causal; documento o captura atribuida; tarjeta de auditoría factual; silencio visual intencional antes de un giro.
- El cambio puede ser de encuadre, foco, color, anotación, composición o tipo de visual; nunca un movimiento decorativo.

### FC-R-020 · `error` · `catalog`

Ningún patrón dominante se repite más de dos veces dentro de una ventana de seis escenas sin excepción registrada.

**Por qué:** La monotonía de geometría es el defecto más visible en montajes largos.

**Validador:** `pattern-repetition-window`

### FC-R-021 · `error` · `catalog`

Toda escena de más de cuatro segundos tiene al menos un cambio secundario además del primario.

**Validador:** `scene-secondary-change`

### FC-R-022 · `error` · `catalog`

El hueco máximo sin evento visible es de 2,0 s (1,4 s en el hook, 1,5 s en un giro), salvo respiración declarada con `intent: "breath"`.

**Por qué:** El silencio visual es legítimo cuando es una decisión; no cuando es un olvido.

**Validador:** `event-gap-max`

## 4. Foco, cámara y anotación

### FC-R-030 · `error` · `catalog`

El zoom habitual se mueve entre 1.06 y 1.18, con máximo editorial 1.28.

**Validador:** `camera-zoom-range` · parámetros: `{"min":1.06,"max":1.28}`

### FC-R-031 · `review` · `catalog`

Ejes, fuente y unidades permanecen legibles y fuera de la transformación de cámara.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-032 · `review` · `catalog`

Al enfocar una serie, las demás bajan a 15–35 % de opacidad y pierden brillo.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-033 · `review` · `catalog`

Las bandas de periodo empiezan y terminan en fechas reales del dataset.

**Validador:** revisión humana (sin comprobación geométrica posible)

## 5. Color

### FC-R-040 · `review` · `channel`

Oro para precio y señal principal; cian para fuerza relativa o segunda lectura; verde para dato positivo confirmado; rojo solo para pérdida, contradicción, corrección o giro.

**Por qué:** El rojo usado como adorno destruye su valor de aviso.

**Validador:** `tone-semantics` · parámetros: `{"tones":["gold","cyan","positive","negative","neutral"],"scaffoldingKinds":["date","period"],"reservedTones":["gold","negative"]}`

### FC-R-041 · `review` · `channel`

El fondo de una frase se colorea únicamente durante la mención, entre 0,6 y 1,4 segundos.

**Validador:** `mention-highlight-duration` · parámetros: `{"minSeconds":0.6,"maxSeconds":1.4,"actions":["highlight","shade"]}`

## 6. Sonido

### FC-R-050 · `error` · `catalog`

Cada efecto sonoro se vincula al mismo cue que activa el visual y se pide por familia, nunca por fichero.

**Por qué:** Pedir un fichero concreto es lo que produjo la repetición del episodio 1.

**Validador:** `sound-family-count`

### FC-R-051 · `error` · `catalog`

Ningún fichero de efecto supera el 12 % de las instancias sonoras del episodio.

**Validador:** `sound-file-share`

### FC-R-052 · `warning` · `catalog`

El mismo fichero no se repite antes del cooldown que declara su familia (12 s si la familia no lo declara).

**Validador:** `sound-file-cooldown` · parámetros: `{"cooldownSeconds":12}`

### FC-R-053 · `error` · `catalog`

Máximo tres impactos perceptibles en ocho segundos.

**Validador:** `sound-impact-density`

### FC-R-054 · `error` · `catalog`

Dos alias semánticos nunca comparten fichero.

**Por qué:** En el episodio 1, `alert-sting` y `soft-impact` sonaban idénticos: el giro narrativo y el dato de cierre no se distinguían.

**Validador:** `sound-alias-uniqueness`

### FC-R-055 · `warning` · `catalog`

El episodio declara una capa de lecho continua por acto.

**Validador:** `sound-bed-present`

### FC-R-056 · `warning` · `catalog`

La capa de efectos se atenúa entre −4 y −6 dB durante la locución y se recupera en 180 ms.

**Validador:** `sound-ducking-present`

### FC-R-057 · `warning` · `catalog`

Tres escenas consecutivas no repiten la misma secuencia de familias sonoras.

**Validador:** `sound-family-sequence`

### FC-R-058 · `warning` · `catalog`

Todo episodio genera además su variante silenciosa renderizable.

**Validador:** `silent-variant-present`

## 7. Revisión

### FC-R-060 · `review` · `catalog`

Antes de aprobar una escena se comprueban el frame anterior, el de la palabra y el posterior, y se revisan cinco fotogramas distribuidos con audio.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-061 · `review` · `catalog`

Cada cifra visible se contrasta con su `claimRef` y su `dataRef`.

**Validador:** revisión humana (sin comprobación geométrica posible)

## 8. Seguridad espacial

### FC-R-070 · `error` · `catalog`

Ninguna caja declarada se solapa con otra: etiquetas, tarjetas y llamadas ocupan carriles reservados.

**Validador:** `layout-no-overlap`

### FC-R-071 · `error` · `catalog`

Los conectores terminan en la primera intersección con el borde exterior de su destino; nunca apuntan al centro atravesando su contenido.

**Validador:** `connector-boundary-clipped`

### FC-R-072 · `review` · `catalog`

Se dejan entre 4 y 8 píxeles de respiración antes del borde cuando la línea es discontinua, tiene brillo o incorpora punta.

**Validador:** revisión humana (sin comprobación geométrica posible)

## 9. Alertas narrativas

### FC-R-080 · `warning` · `channel`

Un giro explícito («sin embargo», «atención», «pero») activa alerta con icono, pulso corto, cambio de color y golpe sonoro de la familia `impact`, precedido de riser.

**Validador:** `cue-word-anchoring`

### FC-R-081 · `review` · `channel`

La alerta aparece con la palabra, no antes, y no permanece como decoración.

**Validador:** `alert-cue-transient` · parámetros: `{"alertTones":["negative"]}`

## 10. Pausas de locución

- Separación estándar entre clips: 0,7 s. Las pausas internas superiores a 0,95 s se reducen a 0,55 s.
- Un segundo pase basado en tiempos de palabra limita a 0,7 s cualquier hueco residual que `silencedetect` no reconozca.
- Se preservan respiraciones naturales y pausas expresivas cortas.

### FC-R-090 · `warning` · `channel`

Ningún silencio accidental supera un segundo; una pausa mayor exige decisión editorial registrada.

**Validador:** `narration-pause-max` · parámetros: `{"maxPauseSeconds":1}`

### FC-R-091 · `error` · `catalog`

Después de modificar el audio se recalculan transcripción, escenas y cues; nunca se desplaza solo la pista de audio.

**Por qué:** Con anclaje por índice de palabra, recalcular es `reanchorCues`, no rehacer el episodio.

**Validador:** `anchor-resolution`

## 11. Entregas por bloques de aprobación

- El bloque conserva en su manifiesto los tiempos absolutos del master y desplaza sus escenas a una línea temporal local que empieza en cero.
- El audio se recorta desde el master ya compactado; no se vuelve a procesar la voz ni se encadenan copias con pérdidas.
- Puede añadirse un `tail` máximo de dos segundos solo cuando existe silencio real tras la última palabra.
- Comando base: `npm run episode:review-block -- --props <render-props-master> --from scene-008 --to scene-013 --id 02 --tail 0.6`

### FC-R-100 · `review` · `channel`

El montaje largo se revisa en bloques de aproximadamente un minuto que empiezan y terminan en frontera semántica completa.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-101 · `review` · `channel`

Cada entrega incluye render-props, manifiesto, audio recortado, cinco stills de QA y un MP4 independiente.

**Validador:** `delivery-completeness` · parámetros: `{"files":["render-props.json","manifest.json","audio.m4a","block.mp4"],"minStills":5}`

## 12. Assets remotos

### FC-R-110 · `error` · `catalog`

Todo asset está importado localmente antes del bundle: cero red durante el render.

**Validador:** `asset-local-presence`

### FC-R-111 · `review` · `catalog`

Brand Search API resuelve nombre→dominio e icono; Logo API obtiene después la variante adecuada. Pexels y Pixabay se consultan en paralelo e intercalados.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-112 · `review` · `catalog`

Una fotografía aporta contexto o atmósfera; nunca es fuente de una cifra, una curva o una afirmación económica.

**Validador:** `photo-not-data-source` · parámetros: `{"photoKinds":["photo","stock","image"]}`

## 13. Geometría segura y continuidad espacial

### FC-R-120 · `error` · `catalog`

En cronologías occidentales el pasado queda a la izquierda y el presente a la derecha; un rebobinado parte del presente hacia la izquierda.

**Validador:** `chronology-past-left`

### FC-R-121 · `review` · `catalog`

Se revisan entrada, máximo desplazamiento y salida de cada objeto móvil contra las cajas de las etiquetas.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-122 · `review` · `catalog`

Las etiquetas que nombran un objeto se colocan fuera de su silueta, con separación visible.

**Validador:** revisión humana (sin comprobación geométrica posible)

## 14. Cámara y zoom narrativo

### FC-R-130 · `review` · `catalog`

El origen de cámara se declara semánticamente por escena y el acercamiento vuelve con suavidad antes del siguiente foco.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-131 · `warning` · `catalog`

Se alternan zoom, aislamiento por color, subrayado y cambio de escala: ningún mecanismo de énfasis se repite en más de tres escenas seguidas.

**Validador:** `emphasis-rotation` · parámetros: `{"maxConsecutive":3}`

### FC-R-132 · `error` · `catalog`

Todo `cue.target` pertenece a los `focusTargets` declarados por el patrón.

**Por qué:** Un typo en el target producía un zoom a ninguna parte que el schema aceptaba.

**Validador:** `cue-target-declared`

## 15. Entidades mencionadas

### FC-R-140 · `error` · `catalog`

Cada entidad narrada activa su tarjeta o su logo en su palabra exacta, mientras sus pares se atenúan.

**Validador:** `entity-cue-obligation` · parámetros: `{"minCoverage":0.9}`

### FC-R-141 · `review` · `catalog`

La activación vuelve al estado base antes de la siguiente entidad; no se resaltan todas a la vez si la voz las recorre una a una.

**Validador:** revisión humana (sin comprobación geométrica posible)

## 16. Fuentes visibles y procedencia interna

### FC-R-150 · `error` · `catalog`

El rótulo FUENTE solo aparece junto a una visualización de datos reales y nombra la fuente de los datos.

**Validador:** `source-label-data-only`

### FC-R-151 · `error` · `catalog`

Pexels, Pixabay y equivalentes son procedencia del asset y viven en el catálogo y los manifiestos; nunca se imprimen como FUENTE.

**Validador:** `source-label-data-only`

## 17. Metáforas literales y sonido distintivo

### FC-R-160 · `review` · `catalog`

Si la locución describe una acción visual concreta —pinchar, estallar, arrastrar, rebobinar— la animación ejecuta ese verbo.

**Por qué:** La minería de cues detecta el verbo y propone la metáfora; el agente no puede limitarse a rotularlo.

**Validador:** revisión humana (sin comprobación geométrica posible)

### FC-R-161 · `error` · `catalog`

Se mantienen familias sonoras diferenciadas para interfaz, datos, cámara, tensión, impacto, rotura, rebobinado, revelado, confirmación y textura.

**Validador:** `sound-family-count`

### FC-R-162 · `review` · `catalog`

Se prefieren efectos propios sintetizados y registrados; los assets `library-*` solo se publican con licencia verificada.

**Validador:** `library-asset-licensed` · parámetros: `{"libraryPrefix":"library-"}`

## 18. Bloques aprobados y continuidad de producción

### FC-R-170 · `error` · `catalog`

No se apila automáticamente el mismo whoosh en todos los zooms: el sonido de cámara se decide por familia y presupuesto, no por acción.

**Por qué:** La rama `cameraDriven` apilaba quickWhip+smoothWhoosh en casi todos los cues del episodio 1.

**Validador:** `sound-file-share`

### FC-R-171 · `review` · `channel`

Un bloque pasa a `exports/production-ready/` solo tras visto bueno explícito, conservando rango, duración y hash SHA-256.

**Validador:** `production-ready-approved`

### FC-R-182 · `error` · `channel`

Las instrucciones internas de producción, como regrabar, conseguir material o completar una fuente, nunca aparecen en un frame publicable; se quedan en QA o pickups.

**Por qué:** El cierre mostraba al espectador una orden interna de regrabación que no aporta información editorial.

**Validador:** `no-production-copy-in-frame`

## 19. Propagación y contagio

### FC-R-180 · `error` · `catalog`

El contagio no se representa con una caja global: el origen emite ondas y cada destino cambia individualmente con desfase visible.

**Validador:** `contagion-no-global-box`

### FC-R-181 · `review` · `catalog`

La etiqueta del fenómeno vive en capa independiente de cámara, con fondo opaco, por encima de la envolvente máxima de ondas y conectores.

**Validador:** revisión humana (sin comprobación geométrica posible)

## 20. Divergencia temporal en gráficas

### FC-R-190 · `warning` · `catalog`

Cuando la locución compara el momento en que dos líneas se separan, el foco es el tramo completo de divergencia hasta el hito mencionado, con `focus.divergence-range`.

**Validador:** `divergence-range-for-interval`

### FC-R-191 · `review` · `catalog`

Tras el zoom al intervalo, la escena queda al menos 1,2 s estable para lectura y ambas series siguen visibles.

**Validador:** revisión humana (sin comprobación geométrica posible)

## Ciclo de feedback

```bash
npm run channel:feedback -- --channel finance-cavaliers --note "el conector atraviesa la tarjeta" --section spatial-safety --severity error
```

El comando registra la corrección, crea la regla con id estable, genera el esqueleto del validador y el fixture que la incumple, y regenera este documento. Una corrección dada una vez queda aplicada para siempre y para cualquier agente.

