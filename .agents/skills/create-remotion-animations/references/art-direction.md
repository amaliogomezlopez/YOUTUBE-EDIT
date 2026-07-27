# Dirección artística y control de repetición

## Perfiles disponibles

| ID | Uso dominante |
| --- | --- |
| `editorial-report` | Explicación editorial, jerarquía asimétrica y reglas |
| `documentary-evidence` | Captura o documento como evidencia principal |
| `diagrammatic-system` | Procesos, sistemas y relaciones abstractas |
| `market-data` | Series financieras, cifras, fechas y lectura técnica |

Todos usan Schibsted Grotesk para texto editorial y Fragment Mono solo para
datos, fechas y etiquetas técnicas. Las fuentes se cargan localmente desde
`public/fonts/`; no depender de fuentes del sistema o de red.

## Selección

Elegir el perfil por naturaleza de la evidencia, no por variar colores. El
perfil puede cambiar alineación, espacio de cabecera, marco, etiqueta,
atribución y material de fondo. El texto superior sigue siendo opcional:
ocultarlo cuando la animación se entiende sola.

Registrar `artDirection` en props y `variety.selected.artDirection` en
`animation-spec.json`.

## Evitar aspecto repetitivo

Leer `recentSelections` cuando exista. Evitar repetir en las dos piezas
anteriores:

- la misma dirección artística;
- el mismo patrón dominante;
- el mismo zoom como conclusión;
- la misma metáfora o dibujo.

No retirar un efecto necesario para entender la evidencia. Si se repite,
registrarlo en `variety.repeatedEffects` y justificarlo. La variedad debe
cambiar composición y material, no añadir decoración.
