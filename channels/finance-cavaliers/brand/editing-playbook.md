# Lenguaje de montaje — Finance Cavaliers

Este contrato convierte la locución en decisiones visuales reutilizables. Se
aplica al episodio 1 y a los siguientes vídeos del canal.

## 1. La palabra manda

- Cada mención visualizable se convierte en un `semanticCue` con el instante
  exacto de la palabra, medido en la transcripción por palabras.
- El cambio debe comenzar entre 0 y 0,4 segundos después de la palabra.
- Si se dice «esta línea», «este mes», «20 %» o el nombre de una compañía, la
  cámara, el color o la anotación debe señalar exactamente ese elemento.
- No usar zooms, destellos o sonidos sin una función semántica.
- No mantener el mismo estado focal más de 1,5 segundos. Un cursor, barrido o
  pulso puede sostener la atención, pero no sustituye un cambio de información.

## 2. Contrato de verdad gráfica

Una cifra narrada y una cifra visible sólo pueden convivir si coinciden:

1. métrica;
2. universo;
3. benchmark;
4. ventana temporal;
5. frecuencia y tipo de dato;
6. método de cálculo.

Si falla una condición, la escena queda `blocked`. La preview editorial debe
mostrar la discrepancia y la acción necesaria —regrabar o conseguir la serie
exacta—; nunca se modifica una curva para que parezca coincidir.

Las comparaciones visuales sin escala se identifican como conceptuales. Las
gráficas publicables incluyen ejes, unidades, fechas, fuente y definición.

## 3. Ritmo y variedad

No repetir el mismo patrón dominante más de dos veces dentro de seis escenas.
Rotar según el contenido entre:

- gráfica completa con ejes;
- zoom sobre un tramo verificable;
- capa de superficie / capa interna;
- métrica cinética;
- logos y relaciones;
- comparación lado a lado;
- mapa causal;
- documento o captura atribuida;
- tarjeta de auditoría factual;
- silencio visual intencional antes de un giro.

Cada escena debe tener un cambio primario y, si dura más de cuatro segundos,
uno o más cambios secundarios. El cambio puede ser de encuadre, foco, color,
anotación, composición o tipo de visual; no sólo un movimiento decorativo.

## 4. Foco, cámara y anotación

- Presentar contexto antes del detalle.
- Zoom habitual: `1.06–1.18`; máximo editorial: `1.28`.
- Ejes, fuente y unidades permanecen legibles y fuera de la transformación de
  cámara.
- Al enfocar una serie, las demás bajan a 15–35 % de opacidad y pierden brillo.
- Un tramo seleccionado conserva la curva base en gris y superpone sólo el
  intervalo hablado en el color semántico.
- Las bandas de periodo deben empezar y terminar en fechas reales del dataset.

## 5. Color

- Oro: precio, mercado y señal principal.
- Cian: fuerza relativa, segunda lectura o comparación.
- Verde: dato positivo confirmado.
- Rojo: pérdida, contradicción, corrección o giro narrativo.
- El fondo de una frase se colorea únicamente durante la mención. Duración
  habitual: 0,6–1,4 segundos.
- No usar rojo como adorno; debe significar riesgo, caída o incompatibilidad.

## 6. Sonido

- Cada efecto sonoro se vincula al mismo `semanticCue` que activa el visual.
- Usar ticks para datos, whooshes para barridos o recorridos, impactos para
  giros y contradicciones, conteo digital para métricas y chime sólo para
  confirmaciones positivas.
- Evitar repetir el mismo archivo en eventos consecutivos.
- Máximo orientativo: tres impactos perceptibles en ocho segundos.
- La locución siempre domina la mezcla. Los sonidos no deben anticipar una
  palabra importante.

## 7. Revisión

Antes de aprobar una escena:

- comprobar el frame anterior, el frame de la palabra y el frame posterior;
- verificar que el objetivo del zoom es inequívoco;
- contrastar cada cifra visible con su `claimRef` y `dataRef`;
- revisar cinco fotogramas distribuidos y el vídeo con audio;
- confirmar que no hay una pausa accidental de foco superior a 1,5 segundos;
- registrar el patrón usado para evitar monotonía en escenas posteriores.

## 8. Seguridad espacial

- Toda etiqueta, tarjeta o llamada usa un carril reservado y declara las zonas
  que no puede tapar: ejes, fechas, unidades, fuentes y otras anotaciones.
- Una tarjeta no se coloca sólo con coordenadas fijas. Se calcula su caja
  completa y se desplaza al slot libre más cercano cuando colisiona.
- Los conectores terminan en la primera intersección con el borde exterior de
  su tarjeta. Nunca apuntan al centro atravesando su contenido.
- Dejar entre 4 y 8 píxeles de respiración antes del borde cuando la línea sea
  discontinua, tenga brillo o incorpore una punta.
- Revisar siempre los frames de entrada y salida: una tarjeta escalada también
  cambia temporalmente el punto de contacto de sus conectores.

## 9. Alertas narrativas

- Un giro explícito —«sin embargo», «atención», «pero»— puede activar el
  patrón `alert-sting`: icono grande, pulso corto, cambio rojo y golpe sonoro.
- La alerta aparece con la palabra, no antes, y no permanece como decoración.
- El icono debe tener una única función narrativa y dejar libre el título.

## 10. Pausas de locución

- Separación estándar entre clips: 0,7 segundos.
- Las pausas internas superiores a 0,95 segundos se reducen a 0,55 segundos.
- Un segundo pase basado en tiempos de palabra limita a 0,7 segundos cualquier
  hueco residual causado por ruido ambiente que `silencedetect` no reconozca.
- Se preservan respiraciones naturales y pausas expresivas cortas.
- Ningún silencio accidental puede superar un segundo; una pausa mayor exige
  una decisión editorial registrada.
- Después de modificar el audio se recalculan transcripción, escenas y
  `semanticCue`; nunca se desplaza sólo la pista de audio.

## Ejemplo de cue

```json
{
  "id": "corrections",
  "atSeconds": 8.55,
  "durationSeconds": 2.1,
  "action": "zoom",
  "target": "2026-05-28/2026-06-26",
  "label": "CORRECCIÓN RECIENTE",
  "tone": "negative",
  "persist": true,
  "sound": "quick-whip"
}
```
