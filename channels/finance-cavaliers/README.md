# Finance Cavaliers

Slug confirmado: `finance-cavaliers`.

![Logo de Finance Cavaliers](assets/brand/logo-primary.png)

Este directorio configura el canal Finance Cavaliers dentro del motor
editorial compartido. El perfil es explicativo-documental, en español y con
episodios horizontales de seis a diez minutos. La identidad visual es una
pizarra negra con tiza crema y oro heráldico (`slate-chalk`), no un dashboard
cian. Las decisiones sobre fuentes, música y frecuencia siguen siendo
configurables.

## Receta de guion (obligatoria)

Antes de elegir tema, escribir guion, título o miniatura, o sacar un Short, se usa la skill global
`guion-video` (`D:\0000-STUDIO\skills\guion-video\SKILL.md`) con las recetas
`D:\0000-STUDIO\formats\youtube-largo\` y `D:\0000-STUDIO\formats\short\`: ficha antes del guion y
comprobación de su `rules.json` antes de aprobar.

- **Promesa del canal** (propuesta, pendiente de que el usuario la confirme): *economía y finanzas
  contadas en clave documental: por qué pasa lo que mueve el dinero y qué consecuencias tiene, con
  datos y fuentes verificables.*
- **Excepciones del canal**: episodios de 6 a 10 minutos (`channel.config.json`), algo más cortos que
  el rango de la receta; la plantilla `causal-explainer` encaja en sus tramos.

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
- Simple Icons y Font Awesome Free Brands para buscar logos desde paquetes
  instalados, sin clave ni llamadas remotas;
- Pexels para fotografías y vídeos, con una API gratuita y
  `PEXELS_API_KEY`;
- Brandfetch, opcional, para ampliar la búsqueda remota de empresas y logos
  con `BRANDFETCH_CLIENT_ID` y la cuota del plan gratuito.

Los resultados remotos son candidatos, no assets de render. Antes de usarlos
se importan a `remotion-animations/public/assets/library/`, se normalizan y se
registran con URL de origen, autor, licencia y hash. Remotion nunca descarga
imágenes o logos durante el render.

Los logos identifican a una empresa en contexto editorial y no implican
afiliación. Deben respetarse las condiciones y derechos de marca del titular.
La propuesta de paquete editorial y sus cantidades recomendadas está en
[`ASSET-PACK.md`](ASSET-PACK.md).

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
