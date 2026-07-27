# Contrato de entrega y montaje

## Estructura recomendada

Cuando el usuario quiera renders junto a sus clips, crear una carpeta sin alterar los originales:

```text
ANIMACIONES_REMOTION/
└── runs/
    └── 20260726T123456789Z-a1b2c3d4/
        ├── run-start.json
        ├── run-result.json
        ├── animation-plan.json
        ├── GUIA_DE_MONTAJE.md
        ├── PREVIEWS/
        │   └── contact-sheet.png
        ├── TRANSCRIPCIONES/
        │   └── 03.json
        ├── 03/
        │   ├── 03_input_share.mp4
        │   └── 03_input_share_alpha.mov
        └── 10/
            └── 10_comparativa.mp4
```

Omitir `TRANSCRIPCIONES/` si el usuario no pide copiarlas, pero conservar la ruta del artefacto fuente en el plan. No duplicar archivos grandes sin necesidad.

## `animation-plan.json`

Usar un objeto con versión y un array:

```json
{
  "version": 1,
  "project": "ahorrar-limites",
  "sourceDirectory": "C:\\ruta\\clips",
  "animations": [
    {
      "clipNumber": 3,
      "sourceFile": "03.mkv",
      "sourceInSeconds": 12.4,
      "sourceOutSeconds": 20.4,
      "durationSeconds": 8,
      "compositionId": "AL-03-InputShare",
      "concept": "Destacar el peso del input",
      "format": "fullscreen",
      "renderFile": "03\\03_input_share.mp4",
      "editorNote": "Insertar al comenzar la frase sobre el consumo de entrada."
    }
  ]
}
```

Usar tiempos en segundos con decimales. Mantener rutas relativas para artefactos internos y la ruta absoluta solo para la carpeta fuente.

## `GUIA_DE_MONTAJE.md`

Incluir por cada pieza:

- clip fuente y ruta;
- frase o evidencia que la justifica;
- punto de entrada y salida recomendado;
- duración;
- ID de composición;
- archivo MP4 o MOV;
- comportamiento visual;
- props editables;
- nota práctica de montaje.

Añadir al final:

- comandos exactos para reproducir los renders;
- resolución, fps, codec y pixel format verificados;
- ubicación del código fuente;
- warnings o decisiones editoriales pendientes.

## Nombres y copia

- Crear una carpeta `runs/<run-id>/` nueva en cada ejecución mediante
  `scripts/lib/output-run.mjs`. El `run-id` combina fecha, entropía y un
  sufijo de colisión reservado atómicamente.
- Nunca reutilizar, vaciar, limpiar o completar una carpeta de ejecución
  anterior. Una carpeta sin `run-result.json` representa una ejecución
  incompleta y también debe conservarse.
- Resolver cada destino con `outputPathFor()` y abortar si el archivo ya
  existe. Para FFmpeg usar `-n`; no usar `-y` en renders, stills ni previews.
- Empezar cada render por el número del clip: `03_input_share.mp4`.
- Usar minúsculas, guiones bajos y nombres cortos.
- Mantener variantes alfa con sufijo `_alpha.mov`.
- Copiar mediante una carpeta de staging cuando el destino esté fuera del workspace.
- Comparar tamaño y, para una entrega importante, hash SHA-256 entre origen y copia.
- Si se copia una entrega fuera del workspace, crear igualmente un directorio
  nuevo. No sustituir una versión antigua aunque el nombre del clip coincida.

## Respuesta final

Entregar una tabla compacta:

| Clip | Momento | Animación | Duración | Archivo |
| --- | --- | --- | --- | --- |

Enlazar con rutas absolutas la carpeta, la guía, el plan, la hoja de contacto y cada render. Confirmar de forma explícita que los clips originales no se modificaron y que no se subió contenido.
Indicar también el `run-id` y confirmar que no se reutilizó ninguna ejecución
anterior.
