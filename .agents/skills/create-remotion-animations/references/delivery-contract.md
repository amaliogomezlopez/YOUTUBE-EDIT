# Contrato de entrega y montaje

## Estructura recomendada

Cuando el usuario quiera renders junto a sus clips, crear una carpeta sin alterar los originales:

```text
ANIMACIONES_REMOTION/
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

- Empezar cada render por el número del clip: `03_input_share.mp4`.
- Usar minúsculas, guiones bajos y nombres cortos.
- Mantener variantes alfa con sufijo `_alpha.mov`.
- Copiar mediante una carpeta de staging cuando el destino esté fuera del workspace.
- Comparar tamaño y, para una entrega importante, hash SHA-256 entre origen y copia.
- No sobrescribir un render existente con contenido distinto sin dejarlo claro; usar un sufijo de versión cuando proceda.

## Respuesta final

Entregar una tabla compacta:

| Clip | Momento | Animación | Duración | Archivo |
| --- | --- | --- | --- | --- |

Enlazar con rutas absolutas la carpeta, la guía, el plan, la hoja de contacto y cada render. Confirmar de forma explícita que los clips originales no se modificaron y que no se subió contenido.
