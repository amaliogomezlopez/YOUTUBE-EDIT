# Economía e historias

Slug provisional confirmado: `economia-historias`.

Este directorio configura el primer canal del motor editorial compartido. El
perfil es explicativo-documental, en español y con episodios horizontales de
seis a diez minutos. Las decisiones definitivas de nombre, fuentes, música y
frecuencia siguen siendo configurables.

## Límites

Compartido:

- LLM, STT, FFmpeg y cola persistente;
- ingestión y selección de assets;
- catálogo, render y revisión de Remotion;
- metadata y publicadores oficiales.

Específico del canal:

- tono, identidad, disclaimers y temas permitidos;
- fuentes y temas autorizados;
- plantillas y prompts editoriales;
- assets propios o con licencia registrada.

Una mecánica visual solo permanecerá bajo el canal si no resulta reutilizable.
El canal no puede copiar ni modificar de forma privada los motores compartidos.

## Activación

La CLI de fundaciones está disponible aunque la UI permanezca oculta. La
interfaz futura solo se mostrará con:

```text
SHORTSMITH_EDITORIAL_VIDEO_UI_ENABLED=true
```

La bandera está desactivada por defecto hasta completar el piloto asistido.

