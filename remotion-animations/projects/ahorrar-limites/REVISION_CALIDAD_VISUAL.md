# Revisión de calidad visual: Ahorrar límites

## Diagnóstico general

Las ocho piezas son legibles, coherentes entre sí y fieles a la transcripción. El problema principal es de lenguaje visual: se comportan como diapositivas de dashboard que van revelando contenido, no como motion graphics que demuestran una idea.

Puntuación orientativa actual: **70/100**.

Fortalezas:

- jerarquía inicial clara;
- contraste y legibilidad sólidos;
- correspondencia correcta con cada clip;
- renders técnicamente consistentes;
- metáforas entendibles en los clips 06 y 13.

Problemas transversales:

1. El header, el subtítulo y los textos interiores repiten la misma conclusión.
2. Hay demasiados paneles, bordes, píldoras, glows y degradados.
3. El número de clip y el nombre del proyecto ocupan pantalla, aunque son metadata de montaje.
4. La mayoría de piezas completa su animación hacia la mitad y permanece casi estática después.
5. Varias escenas usan tarjetas para representar conceptos que funcionarían mejor como flujos, objetos o transformaciones.
6. El mismo shell visual hace que conceptos diferentes parezcan variaciones de una misma slide.

## Evidencia temporal

Los strips están extraídos cada dos segundos:

- [Clip 03](../../out/ahorrar-limites/REVIEW-QUALITY/03-timeline.jpg)
- [Clip 06](../../out/ahorrar-limites/REVIEW-QUALITY/06-timeline.jpg)
- [Clip 10](../../out/ahorrar-limites/REVIEW-QUALITY/10-timeline.jpg)
- [Clip 13](../../out/ahorrar-limites/REVIEW-QUALITY/13-timeline.jpg)
- [Clip 17](../../out/ahorrar-limites/REVIEW-QUALITY/17-timeline.jpg)
- [Clip 22](../../out/ahorrar-limites/REVIEW-QUALITY/22-timeline.jpg)
- [Clip 24](../../out/ahorrar-limites/REVIEW-QUALITY/24-timeline.jpg)
- [Clip 27](../../out/ahorrar-limites/REVIEW-QUALITY/27-timeline.jpg)

| Clip | Último cambio narrativo | Duración | Movimiento útil aproximado |
| --- | ---: | ---: | ---: |
| 03 | 3,5 s | 8 s | 44 % |
| 06 | 4,25 s | 8 s | 53 % |
| 10 | 4,0 s | 8 s | 50 % |
| 13 | 3,5 s | 6 s | 58 % |
| 17 | 3,8 s | 8 s | 48 % |
| 22 | 4,25 s | 8 s | 53 % |
| 24 | 5,15 s | 10 s | 52 % |
| 27 | 5,4 s | 10 s | 54 % |

Media: aproximadamente el **49 % de cada pieza queda sin evolución narrativa**. La barra de progreso sigue moviéndose, pero no añade información.

## Revisión por pieza

| Clip | Qué funciona | Qué resta calidad | Rediseño recomendado |
| --- | --- | --- | --- |
| 03 | El 90 % se entiende al instante. | Doble representación del mismo dato, glow excesivo y tres frases redundantes. | Hacer entrar fragmentos de contexto en un único anillo hasta 90 %. Separar el 10 % restante como una pequeña fuga. Dejar solo `90 % INPUT` y una etiqueta breve. |
| 06 | La cadena modelo, harness y resultado tiene causalidad. | Elementos pequeños, grandes vacíos y metáfora mixta entre mecánico y taller. | Usar un núcleo de modelo que atraviese un banco de trabajo. Las cuatro piezas del harness se acoplan y alteran una salida visible. |
| 10 | La comparación rojo y verde se distingue. | Parece una tabla de pricing. La “carga” se expresa con texto, no con una carga visual. | Mostrar dos núcleos iguales y dos carriles de contexto. Uno recibe una pila fija y pesada; el otro, módulos ajustables que se activan o retiran. |
| 13 | Es la metáfora más memorable del lote. | Son cuatro círculos que aparecen, no una bola que acumula. Etiquetas repetidas y mucho glow. | Usar una sola esfera que rueda, absorbe fragmentos de conversación y crece de forma continua. Mostrar la conclusión solo al final. |
| 17 | La comparación antes/después es clara. | Es la pieza más cercana a un dashboard genérico: dos paneles, tarjetas anidadas y demasiado texto. | Hacer que tres paquetes de contexto repetidos colapsen en uno; ese único paquete se divide en cuatro tareas. La transformación debe ocupar casi todo el cuadro. |
| 22 | La escala 10-30 es informativa y fácil de recordar. | Panel exterior innecesario, pills decorativas y franja diagonal de alerta. | Convertir skills en pequeñas marcas o partículas. Entre 10 y 30 se alinean; después de 30 empiezan a colisionar, desenfocarse y generar ruido. |
| 24 | La idea de limpiar contexto se comprende. | Dos grandes ventanas, cinco cajas de texto y casi cinco segundos finales estáticos. | Comprimir el chat antiguo hasta un pequeño paquete de handoff, hacer un corte limpio y desplegar un chat nuevo con dos líneas esenciales. |
| 27 | La jerarquía orquestador y subagentes es correcta. | Organigrama corporativo, tres cards idénticas y microcopy repetida. | Enviar tres pulsos desde el orquestador; cada pulso completa una tarea distinta y los resultados convergen de vuelta en un único resumen. |

## Prioridad de mejora

1. **Clip 17**: mayor oportunidad. Sustituir la slide comparativa por una transformación física.
2. **Clip 10**: convertir “carga” en una magnitud visual, no en etiquetas.
3. **Clip 24**: reducir texto y dramatizar el corte entre contexto viejo y chat nuevo.
4. **Clip 27**: transformar el organigrama en flujo bidireccional.
5. **Clip 13**: conservar la metáfora y mejorar continuidad.
6. **Clip 22**: conservar la escala y eliminar el tratamiento de dashboard.
7. **Clip 06**: simplificar la metáfora y ampliar el foco.
8. **Clip 03**: mantener claridad y eliminar redundancia.

## Dirección futura

Adoptar como lenguaje principal:

> Infografía cinética editorial: una idea, una transformación, una señal de color.

Aplicar estas decisiones:

- eliminar el header de proyecto y número de clip del vídeo final;
- reducir el texto visible entre un 40 % y un 60 %;
- retirar la barra de progreso salvo que represente un dato real;
- usar un solo acento y un único glow breve;
- limitar paneles y tarjetas a objetos que tengan significado;
- mantener evolución narrativa durante al menos el 60 % de la duración;
- diseñar primero cinco frames clave y después interpolar;
- entregar solo piezas que superen 80/100 en la rúbrica de calidad de la skill.

## Evidencia automatizada

El detector visual marcó un `side-tab` en `AhorrarLimites.tsx:125`, correspondiente a la flecha construida con un borde lateral grueso. Es un falso positivo parcial como componente técnico, pero confirma que los acentos laterales y las formas de CSS deben revisarse con intención.

La inspección manual encontró además patrones que el detector no reconoce bien en estilos inline:

- `borderRadius: 32`;
- borde fino más sombra de 80-90 px;
- degradados ambientales repetidos;
- pills y etiquetas en mayúsculas;
- `repeating-linear-gradient` en la zona de más de 30 skills;
- rejillas de tarjetas idénticas;
- progress bar decorativa persistente.
