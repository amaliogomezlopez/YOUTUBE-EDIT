# Biblioteca local de efectos de sonido

## Estructura

- `source-library/`: copia íntegra de la biblioteca del usuario. Se conserva
  fuera de Git por tamaño y por no disponer de metadatos de licencia.
- `../../remotion-animations/public/sfx/`: selección corta normalizada y
  efectos propios usados durante los renders.

No asumir que los archivos de `source-library/` permiten redistribución
pública. Antes de publicar o entregar un efecto aislado, verificar su licencia
en la fuente original.

Preparar de nuevo la selección:

```powershell
cd D:\2-YOUTUBE-EDIT\remotion-animations
npm run prepare:sfx
```

El script convierte los efectos seleccionados a WAV estéreo, 48 kHz y genera
varios sonidos de interfaz propios mediante síntesis local con FFmpeg.
