# Assets visuales preparados

Remotion solo consume archivos locales y deterministas desde esta carpeta.

```text
public/assets/
├── library/   # selección versionada y con licencia conocida
└── projects/  # assets temporales por proyecto, ignorados por Git
```

- Las imágenes se renderizan con `<Img>` y `staticFile()`.
- `library/` debe contener únicamente material propio o con licencia
  documentada.
- `projects/` se reserva para fotos, logos y capturas importadas durante un
  trabajo. No se versiona.
- Los iconos y dibujos propios no se duplican como archivos: viven como
  componentes React/SVG en `src/visuals/`.

No se permiten URLs remotas durante un render final. Primero se valida y
prepara el asset local.
