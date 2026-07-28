# Finance Cavaliers

Slug confirmado: `finance-cavaliers`.

![Logo de Finance Cavaliers](assets/brand/logo-primary.png)

Este directorio configura el canal Finance Cavaliers dentro del motor
editorial compartido. El perfil es explicativo-documental, en español y con
episodios horizontales de seis a diez minutos. Las decisiones sobre fuentes,
música y frecuencia siguen siendo configurables.

## Dónde colocar el material

Identidad versionada y reutilizable:

```text
channels/finance-cavaliers/assets/brand/
```

Material privado pendiente de asignar a un episodio:

```text
data/channels/finance-cavaliers/inbox/
├── thumbnails/
├── assets/
├── scripts/
├── narration/
└── sources/
```

Después de crear un episodio con la CLI, su material debe quedar bajo:

```text
data/channels/finance-cavaliers/episodes/<episode-id>/
├── story/          # guion y revisiones
├── narration/      # voz original y metadatos
├── assets/         # imágenes y documentos del episodio
├── thumbnails/     # propuestas de miniatura
└── sources/        # fuentes recuperadas o aportadas
```

Todo `data/channels/` está ignorado por Git para evitar publicar contenido,
audios o fuentes privadas.

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
