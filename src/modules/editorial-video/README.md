# Motor de vídeo editorial

Este módulo representa episodios investigados sin depender de un canal
concreto. Sus dependencias permitidas apuntan a `src/lib/` y a configuraciones
cargadas mediante `ChannelRegistry`.

Fundaciones implementadas:

- registro y validación de canales;
- schemas cerrados de fuente, dossier, story, manifest y plan visual;
- repositorio local con escritura atómica y revisión optimista;
- máquina de estados con gates humanos;
- DTOs públicos sin rutas ni payloads internos;
- wrapper de `PersistentJobQueue`;
- CLI de creación, consulta y listado.

Los conectores, dossier, story planner, narración, visuales, API y UI se
añadirán por fases sobre estos contratos. No deben crear adaptadores alternos
de red, LLM, STT, FFmpeg, cola ni Remotion.
