/**
 * Encuadre de un clip dentro de una ventana de otra proporcion.
 *
 * Se calcula a mano en lugar de usar `objectFit: cover` porque hace falta
 * desplazar el recorte hacia el punto focal: con `cover` el navegador centra el
 * recorte y eso corta la cabeza en 9:16 y descentra al sujeto en un `frame` 16:9.
 *
 * Lo comparten la superficie de shorts y la de intro, y por eso vive en el toolkit
 * de motion y no en ninguna de las dos.
 */
export const coverGeometry = ({
  width,
  height,
  sourceWidth = 1920,
  sourceHeight = 1080,
  focusX,
  focusY,
}: {
  width: number;
  height: number;
  sourceWidth?: number;
  sourceHeight?: number;
  focusX: number;
  focusY: number;
}) => {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const scaledWidth = sourceWidth * scale;
  const scaledHeight = sourceHeight * scale;
  const left = Math.min(0, Math.max(width - scaledWidth, width / 2 - focusX * scaledWidth));
  const top = Math.min(0, Math.max(height - scaledHeight, height / 2 - focusY * scaledHeight));
  return {left, top, width: scaledWidth, height: scaledHeight};
};
