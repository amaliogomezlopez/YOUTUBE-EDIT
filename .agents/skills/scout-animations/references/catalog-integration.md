# Integración con el catálogo Remotion

## Contexto obligatorio

Antes de proponer o integrar, leer:

- `remotion-animations/catalog/animation-patterns.json`;
- `remotion-animations/catalog/animation-effects.json`;
- `remotion-animations/schemas/animation-spec.schema.json`;
- `remotion-animations/src/motion/Toolkit.tsx`;
- `remotion-animations/src/motion/Effects.tsx`;
- `remotion-animations/src/Root.tsx`.

## Clasificar correctamente

- **Patrón**: composición semántica que comunica algo, por ejemplo flujo,
  comparación, parte-total o acumulación.
- **Efecto**: mecanismo transversal, por ejemplo path draw, orbit, wipe,
  stagger, spotlight o camera track.
- **Focus treatment**: forma de aislar el foco sin definir por sí sola una
  composición.
- **Composición de demo**: prueba parametrizable del patrón o efecto; no es una
  pieza editorial final.

No crear un patrón nuevo cuando un efecto adicional resuelva el hueco.

## Decidir entre reutilizar y crear

Reutilizar una entrada existente cuando coincidan:

- verbo de movimiento;
- significado comunicado;
- estructura de capas;
- props necesarias;
- tratamiento de foco.

Proponer una nueva entrada solo si:

- sirve al menos para dos escenarios editoriales distintos;
- no depende de marcas o assets del vídeo;
- tiene un contrato de props general;
- aporta una transformación que el catálogo aún no expresa.

## Estados

- `planned`: contrato y uso definidos, sin primitiva operativa.
- `primitive`: existen piezas técnicas reutilizables, falta una composición
  genérica completa.
- `ready`: componente reusable, props, demo y validaciones operativas.

Nunca elevar a `ready` basándose únicamente en el scouting.

## `catalog-proposal.json`

Guardar la propuesta junto al job survey:

```json
{
  "version": 1,
  "sourceId": "",
  "generatedAt": "ISO-8601",
  "proposals": [
    {
      "candidateId": "",
      "decision": "reuse-existing",
      "existingPatternIds": [],
      "existingEffectIds": [],
      "proposedId": null,
      "proposedKind": null,
      "proposedStatus": null,
      "proposedComponentName": null,
      "motionVerb": "",
      "communicates": "",
      "generalizationExamples": [],
      "requiredProps": [],
      "implementationPlan": [],
      "excludedThirdPartyElements": [],
      "validationPlan": [],
      "rationale": ""
    }
  ]
}
```

Valores de `decision`:

- `reuse-existing`;
- `extend-effect`;
- `add-pattern`;
- `reject`.

Valores de `proposedKind`:

- `pattern`;
- `effect`;
- `focus-treatment`;
- `component`;
- `null`.

Usar IDs de patrón `familia.slug` en minúsculas. Mantener nombres de
componentes React en PascalCase.

Cuando la semántica ya exista pero falte una composición genérica, usar
`decision: reuse-existing`, conservar `proposedId: null`, establecer
`proposedKind: component` y completar `proposedComponentName`.

## Implementar

Cuando el usuario pida integrar:

1. Seleccionar únicamente las propuestas aprobadas o claramente prioritarias.
2. Invocar `$create-remotion-animations`.
3. Implementar props JSON-serializables y esquema Zod.
4. Basar todo movimiento en `useCurrentFrame()` y `useVideoConfig()`.
5. Crear o ampliar primitivas en `Toolkit.tsx` o `Effects.tsx`.
6. Registrar una demo en `Root.tsx`.
7. Actualizar catálogo y estado de forma coherente.
8. No incluir textos, datos, logos, colores o iconos de la referencia.
9. Crear cinco stills al 0/15/45/75/95 %.
10. Ejecutar `npm run remotion:check`.
11. Revisar visualmente los stills y exigir 80/100 según la skill de creación.

Si el patrón se aplicará a una pieza real, crear después un
`animation-spec.json` con evidencia editorial propia.

## Handoff

El handoff debe enlazar:

- job survey;
- estudios densos;
- candidato elegido;
- análisis visual;
- propuesta de catálogo;
- patrón y efectos reutilizados;
- archivos implementados;
- composición de demo;
- stills y validaciones.

Registrar de forma explícita las diferencias respecto a la referencia. La
integración debe adoptar la identidad Shortsmith, no imitar marcas de terceros.
