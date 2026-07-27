# Limpieza de artefactos de animación

## Qué se almacena

Remotion conserva cada ejecución en:

```text
remotion-animations/out/<proyecto>/runs/<run-id>/
```

Dentro quedan los MP4/MOV, stills, fotogramas de revisión, hojas de contacto y
manifests. Las salidas creadas antes del sistema de runs permanecen como
artefactos `legacy` dentro de `remotion-animations/out/`.

Animation Scout conserva cada exploración en:

```text
data/review/animation-scout/<scout-id>/
```

Ahí pueden quedar el vídeo descargado, frames, hojas de contacto, análisis y
handoffs. Estos artefactos no se eliminan al cerrar o archivar un chat.

Los clips y jobs generales de Shortsmith viven en `data/jobs/` y
`data/output/`. Su retención se controla por separado mediante
`SHORTSMITH_JOB_RETENTION_DAYS`.

## Herramienta

La simulación es el comportamiento predeterminado:

```powershell
npm run cleanup:animations
```

Política predeterminada:

- revisar Remotion y Animation Scout;
- seleccionar artefactos de más de 30 días;
- conservar siempre los 3 más recientes de cada proyecto o ámbito;
- proteger runs incompletos;
- excluir salidas `legacy`;
- rechazar árboles que contengan enlaces simbólicos.

Ejemplos de simulación:

```powershell
npm run cleanup:animations -- --scope remotion --project scout-catalog --older-than-days 14 --keep-last 3
npm run cleanup:animations -- --scope scout --older-than-days 30 --keep-last 2
```

Solo después de revisar la simulación:

```powershell
npm run cleanup:animations -- --scope scout --older-than-days 30 --keep-last 2 --apply --confirm=DELETE_ANIMATION_ARTIFACTS
```

Opciones de mayor riesgo:

- `--include-incomplete`: permite seleccionar ejecuciones sin manifest final;
- `--include-legacy`: incluye salidas anteriores a la estructura `/runs`;
- `--keep-last 0`: deja de proteger los artefactos más recientes;
- `--older-than-days 0`: permite seleccionar artefactos creados hoy.

`--project` exige `--scope remotion` para impedir que una limpieza acotada a
un proyecto incluya accidentalmente jobs de scouting.

No usar esas opciones por inferencia. El usuario debe pedir expresamente ese
alcance. El borrado es permanente y se realiza por ejecución o job completo,
nunca archivo a archivo.

## Chats

Archivar o borrar un chat solo gestiona el historial de la aplicación. No
elimina renders, vídeos, frames ni hojas del workspace. Para recuperar espacio
de disco hay que ejecutar esta herramienta o la limpieza general de
Shortsmith.

No hay una tarea periódica configurada. Puede programarse más adelante con el
Programador de tareas de Windows, pero únicamente después de acordar días de
retención, cantidad mínima a conservar y tratamiento de ejecuciones
incompletas.
