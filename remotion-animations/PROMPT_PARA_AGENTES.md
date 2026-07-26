# Prompt base para pedir animaciones

```text
Trabaja dentro de D:\2-YOUTUBE-EDIT\remotion-animations.

Crea una composición Remotion 1920x1080, 30 fps y de [N] segundos llamada
[NOMBRE]. Quiero mostrar [DESCRIPCIÓN VISUAL]. Entre los segundos [A] y [B],
resalta [COLUMNA/NÚMERO/ELEMENTO] con [COLOR/EFECTO], sin inventar datos.

Requisitos:
- Toda animación debe depender de useCurrentFrame() y useVideoConfig().
- No uses CSS animations ni transiciones.
- Expón textos, datos, colores y elemento destacado como Props con esquema Zod.
- Mantén márgenes seguros y tipografía legible para vídeo de YouTube.
- Añade la composición a src/Root.tsx.
- Ejecuta npm run check y genera al menos un still de control.
- Si debe superponerse en el editor, exporta también ProRes 4444 con alfa.

Datos y textos autorizados:
[PEGA AQUÍ LOS DATOS, TEXTO O TRANSCRIPCIÓN]

Al terminar, dime el ID de la composición, los parámetros editables y la ruta
del render.
```

## Ejemplo listo para usar

```text
Usa ChartHighlight. Cambia las barras por 2022=42, 2023=51, 2024=64 y 2025=91.
Resalta 2025 en amarillo a partir del segundo 1,8 y haz que el 91 aparezca con
un glow breve. Título: "El salto de 2025". Unidad: "%". No cambies la duración.
Valida con npm run check y renderiza el MP4.
```
