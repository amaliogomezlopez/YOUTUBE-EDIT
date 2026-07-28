# Canales editoriales

Cada subdirectorio define un canal mediante configuración versionada. El motor
compartido vive en `src/modules/editorial-video/` y nunca debe importar una
configuración concreta.

Un canal puede definir:

- identidad y reglas editoriales;
- políticas de fuentes y temas;
- plantillas narrativas;
- prompts sujetos a contratos cerrados;
- un catálogo pequeño de assets propios o licenciados.

No se guardan aquí artículos recuperados, audio, transcripciones, datasets de
trabajo, previews ni renders. Esos artefactos viven bajo `data/channels/` y
permanecen ignorados por Git.

