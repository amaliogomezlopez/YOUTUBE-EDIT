# Review Studio y aprobación

## Cuándo usarlo

Usar Review Studio antes del render final cuando:

- el usuario quiere iterar visualmente;
- hay dos o más opciones razonables de tema, layout o ritmo;
- la pieza debe convivir con vídeo fuente;
- se entregará un lote y conviene fijar un lenguaje antes de procesarlo.

No hace falta crear tres variantes si la decisión ya está cerrada. La
comparación A/B/C debe responder a una hipótesis concreta.

## Arranque

```powershell
npm run remotion:review:build
npm run server
```

Abrir:

```text
http://127.0.0.1:3000/remotion-review/
```

El estudio usa `@remotion/player` y guarda sesiones en
`data/review/remotion/`, excluido de Git. Cada sesión contiene:

- proyecto, variantes y props;
- variante seleccionada;
- contexto de vídeo y trim;
- checkpoints;
- comentarios con frame y categoría;
- resultado de QA;
- estado editorial y revisión optimista.

Estados: `draft`, `in-review`, `changes-requested`, `approved`.

## Ciclo de feedback

1. Crear una sesión.
2. Preparar A/B/C cambiando una decisión dominante por variante.
3. Reproducir, pausar y recorrer checkpoints.
4. Activar contexto y safe zones para comprobar convivencia.
5. Anclar comentarios a frames exactos.
6. Aplicar cambios en props y volver a revisar.
7. Ejecutar QA.
8. Aprobar solo con `qa.passed=true`.

Cambiar props invalida el QA anterior. Añadir un comentario a una pieza
aprobada la devuelve a `changes-requested`.

## Paquete reproducible

```powershell
npm run remotion:review:package -- --session "<review-id>"
```

El comando crea un run inmutable bajo
`remotion-animations/out/<proyecto>/runs/<run-id>/` con:

- stills por variante y checkpoint;
- `preview-index.json`;
- `visual-qa.json`;
- hoja de contacto etiquetada;
- props usados;
- `run-start.json` y `run-result.json`.

La preview interactiva acelera feedback. El paquete de stills sigue siendo
obligatorio para comparar el lote, archivar la decisión y detectar frames
vacíos o divergencias.
