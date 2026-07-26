# Contrato de análisis visual

## Principio

Describir lo que cambia entre píxeles antes de explicar cómo podría haberse
construido.

## Tres niveles obligatorios

### Observación

Incluir únicamente evidencia visible:

- qué elemento aparece, desaparece o cambia;
- dirección y distancia relativa;
- escala, opacidad, color, máscara o trayectoria;
- orden temporal;
- relación espacial entre capas;
- timestamps absolutos.

Evitar nombres técnicos cuando los píxeles no los justifican.

### Inferencia

Explicar una implementación probable:

- SVG path y `strokeDashoffset`;
- `clipPath` o mask;
- transformaciones de grupo;
- crossfade entre estados alineados;
- layout HTML/SVG;
- cámara, parallax o source blur.

Usar lenguaje como “probablemente”, “compatible con” o “puede reconstruirse
mediante”.

### Incertidumbre

Registrar lo que no puede saberse:

- easing exacto;
- tipografía;
- vectores o assets originales;
- si existe un corte oculto;
- significado factual de datos o iconos;
- parámetros de blur, glow o cámara.

## Estructura de `manual-visual-analysis.json`

Mantener como mínimo:

```json
{
  "version": 1,
  "generatedAt": "ISO-8601",
  "analysisMode": "manual-agent-review",
  "model": null,
  "source": {},
  "privacy": {
    "audioExtracted": false,
    "transcriptionGenerated": false,
    "imagesSentToExternalModel": false
  },
  "sampling": {
    "survey": {},
    "studies": []
  },
  "visualSummary": "",
  "styleFingerprint": {
    "palette": [],
    "typography": "",
    "composition": "",
    "materials": [],
    "motionLanguage": [],
    "timing": ""
  },
  "animationCandidates": [],
  "remotionRecommendations": [],
  "uncertainties": []
}
```

Cada candidato debe incluir:

```json
{
  "id": "slug-estable",
  "startSeconds": 0,
  "endSeconds": 0,
  "confidence": 0,
  "observed": "",
  "inferredMechanism": "",
  "whyWorthStudying": "",
  "layers": [],
  "timeline": [],
  "estimatedEasing": "",
  "remotionPlan": {
    "patternHint": "",
    "effects": [],
    "implementationNotes": []
  },
  "uncertainties": []
}
```

## Confianza

- `0.90-1.00`: mecanismo visible en suficientes frames y sin ambigüedad
  relevante.
- `0.75-0.89`: transformación clara, implementación exacta incierta.
- `0.50-0.74`: candidato útil que necesita otro study o crop.
- Menos de `0.50`: no enviar al catálogo.

La confianza describe la interpretación visual, no la calidad estética.

## Informe humano

Crear también `SCOUT-REPORT.md` con:

- ficha técnica;
- tabla de estudios;
- huella visual;
- candidatos priorizados;
- encaje con el catálogo;
- límites de derechos y evidencia;
- próximos pasos.

No duplicar en el informe todo el JSON. Explicar las decisiones y enlazar los
artefactos.

## Regla editorial

El scouting no autoriza ninguna afirmación del vídeo final. Datos, porcentajes,
comparativas y claims deben proceder de la fuente editorial propia y quedar en
un `animation-spec.json`.
