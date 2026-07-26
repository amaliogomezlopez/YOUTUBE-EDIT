# Estándar de calidad visual

## Norte creativo

Crear una infografía cinética editorial, no una diapositiva de dashboard.

Aplicar esta regla a cada pieza:

> Una idea, una transformación, una señal de color.

La animación debe demostrar el verbo central de la locución. Si la frase habla de acumular, hacer que algo se acumule. Si habla de delegar, dividir una tarea y devolver resultados. Si habla de comparar, mostrar dos recorridos sobre una base común.

## Jerarquía y densidad

- Mantener un único foco dominante que ocupe aproximadamente el 55-70 % del área útil.
- Usar como máximo tres grupos de texto visibles a la vez.
- Limitar el titular a unas 8 palabras y el apoyo a unas 12. El visual debe cargar con el resto de la explicación.
- No repetir la misma idea en titular, subtítulo, tarjeta y callout.
- Tratar el número de clip como metadata de archivo. No mostrarlo dentro del vídeo.
- Reservar la marca para una firma pequeña y estable. No competir con la información.
- Evitar paneles como envoltorio automático. Usar contenedor solo cuando representa un objeto real, como una ventana, una cola o un sistema.
- Usar radios de 8-16 px en superficies. Reservar la píldora para etiquetas breves.

## Tipografía

- Usar una sola familia sans, preferiblemente Inter, y contraste de peso antes que más tamaños.
- Mantener dos niveles principales: dato o titular y etiqueta de apoyo.
- Reservar mayúsculas para etiquetas de tres palabras o menos.
- Evitar tracking amplio en frases.
- Ajustar texto variable con medición real cuando exista riesgo de overflow.
- Comprobar la pieza al 25 % de tamaño. Si el mensaje principal deja de leerse, simplificarlo.

## Color y materiales

- Elegir un solo acento por composición. Mantenerlo por debajo del 10-12 % del área visible.
- Usar un segundo color saturado solo si tiene significado semántico real.
- Preferir fondos casi planos con una ligera variación tonal. Evitar varios gradientes ambientales compitiendo.
- No usar texto con gradiente.
- Aplicar glow únicamente al foco principal, con poca opacidad y durante un momento breve.
- No combinar borde fino, gran radio y sombra ambiental ancha en el mismo panel.
- Evitar franjas diagonales, glassmorphism, rejillas de tarjetas idénticas y decoración que recuerde a una plantilla SaaS.
- Expresar profundidad mediante escala, oclusión y movimiento, no mediante una colección de sombras.

## Movimiento profesional

- Hacer que el primer cambio significativo ocurra antes de 0,4 segundos.
- Mantener movimiento narrativo durante el 60-75 % de la duración.
- Reservar un hold final de 1-2 segundos y una salida de 0,3-0,6 segundos.
- No dejar una composición estática durante más de 1,5 segundos salvo que el editor haya pedido un hold limpio.
- Construir una trayectoria principal continua. Evitar que toda la animación consista en elementos apareciendo uno detrás de otro.
- Mantener continuidad espacial: un objeto que cambia debe conservar posición, dirección o identidad para que el espectador entienda la causa.
- Usar ease-out fuerte para entradas y ease-in para salidas. Evitar rebotes y elasticidad.
- Usar stagger solo para elementos de una misma familia y limitarlo a 3-5 pasos.
- Añadir movimiento secundario únicamente si refuerza la idea: pulsos que viajan, partículas que se acumulan, nodos que responden o una línea que se traza.
- Para un efecto hipnótico, preferir flujo continuo, ritmo y repetición coherente. No sumar destellos, zooms o vibración aleatoria.

## Información y gráficas

- Mostrar una conclusión principal por gráfica.
- Etiquetar directamente el dato importante y reducir ejes, leyendas y cajas.
- Empezar barras desde una base común y evitar escalas truncadas.
- No inventar cifras para una relación cualitativa.
- Para “más” o “menos”, usar densidad, longitud, velocidad o cantidad relativa sin números ficticios.
- Hacer que el highlight ocurra después de que el espectador entienda la base.
- Mantener el dato destacado legible durante al menos 1,2 segundos.

## Patrones visuales preferidos

Elegir uno antes de escribir código:

1. **Transformación continua**: un objeto absorbe, se divide, se comprime o cambia de estado.
2. **Flujo causal**: paquetes o pulsos atraviesan etapas y producen un resultado.
3. **Comparación sobre base común**: dos carriles comparten escala, núcleo o línea temporal.
4. **Gráfica focal**: una única serie o rango se construye y luego se destaca.
5. **Overlay de precisión**: una máscara, contorno o spotlight resalta una zona real del vídeo.

Evitar la comparación de dos grandes tarjetas salvo que las tarjetas sean el propio objeto explicado.

## Storyboard obligatorio

Antes del render final, producir cinco stills:

- 0 %: estado inicial claro.
- 15 %: promesa visual.
- 45 %: transformación en marcha.
- 75 %: conclusión o highlight.
- 95 %: hold limpio para montaje.

Cada still debe diferenciarse del anterior por una evolución con significado. Si solo aparece más texto, rediseñar la secuencia.

## Pruebas rápidas

- **Prueba de silencio**: entender la idea general sin audio.
- **Prueba de tres segundos**: localizar el foco y la dirección de lectura antes de tres segundos.
- **Prueba de entrecerrar los ojos**: distinguir un único elemento dominante.
- **Prueba de miniatura**: conservar jerarquía al 25 %.
- **Prueba de continuidad**: reconocer qué objeto causa el cambio entre dos frames consecutivos.
- **Prueba anti-plantilla**: no parecer un dashboard, una slide corporativa o un conjunto genérico de cards.

## Rúbrica de 100 puntos

| Criterio | Puntos |
| --- | ---: |
| Claridad inmediata y foco | 20 |
| Integridad factual | 15 |
| Narrativa de movimiento | 15 |
| Composición y uso del espacio | 15 |
| Contención visual | 10 |
| Tipografía y legibilidad | 10 |
| Coherencia de marca | 5 |
| Calidad técnica del render | 10 |

Exigir:

- 80/100 o más para entregar;
- 15/15 en integridad factual;
- al menos 16/20 en claridad;
- ningún texto cortado;
- ningún tramo estático accidental superior a 1,5 segundos;
- stills revisados visualmente, no solo generados.

## Señales de rechazo inmediato

- El titular y el cuerpo interior dicen lo mismo.
- La mitad de la pieza permanece inmóvil.
- Hay más de un glow dominante.
- El número de clip aparece como contenido editorial.
- El resultado depende de leer cinco o más bloques.
- La composición usa paneles para llenar espacio.
- La animación podría reemplazarse por una slide estática sin perder significado.
