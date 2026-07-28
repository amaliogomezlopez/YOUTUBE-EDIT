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

## Buscador de assets

La vista `Assets` de Shortsmith combina:

- el catálogo local registrado, disponible sin conexión;
- Pexels para fotografías y vídeos, con `PEXELS_API_KEY`;
- Brandfetch para buscar empresas y logos por nombre, dominio o ticker, con
  `BRANDFETCH_CLIENT_ID`.

Los resultados remotos son candidatos, no assets de render. Antes de usarlos
se importan a `remotion-animations/public/assets/library/`, se normalizan y se
registran con URL de origen, autor, licencia y hash. Remotion nunca descarga
imágenes o logos durante el render.

Los logos identifican a una empresa en contexto editorial y no implican
afiliación. Deben respetarse las condiciones y derechos de marca del titular.

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
