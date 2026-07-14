---
name: Shortsmith
description: Control room local para convertir una grabación en contenido revisable y publicable.
colors:
  canvas: "#0d0f12"
  sidebar: "#111419"
  surface: "#171a20"
  surface-raised: "#1d2128"
  ink: "#f5f6f8"
  muted: "#aeb5c0"
  line: "#343a45"
  forge-orange: "#f05a28"
  forge-orange-bright: "#ff7445"
  success: "#56d49b"
  warning: "#ffc766"
  danger: "#ff8178"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forge-orange}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 11px"
---

# Design System: Shortsmith

## Overview

**Creative North Star: "The Creator Control Room"**

Shortsmith se usa durante una sesión real de edición, normalmente con muchas decisiones abiertas y poca tolerancia a la ambigüedad. La interfaz adopta una densidad operativa contenida: navegación estable, superficies oscuras para trabajo prolongado y naranja reservado para acciones que hacen avanzar el flujo.

El sistema rechaza el aspecto de landing SaaS, los paneles de tarjetas repetidas y cualquier adorno que compita con el vídeo, la metadata o el estado de publicación.

**Key Characteristics:**

- Oscuro, sobrio y apto para sesiones largas.
- Naranja escaso para acción, selección y foco.
- Estados siempre expresados con texto además de color.
- Flujo visible de preparación, revisión y publicación.

## Colors

La paleta usa grafito en capas y un naranja de herramienta física, con colores semánticos reservados para estados.

### Primary

- **Forge Orange:** acción principal y foco; nunca decoración extensa.
- **Bright Forge:** hover, foco de alto contraste y selección activa.

### Neutral

- **Canvas Graphite:** fondo general que reduce fatiga visual.
- **Raised Steel:** controles, resultados y áreas editables.
- **Cool Ink:** texto primario; Muted se reserva para contexto secundario.

**The One Tool Rule.** El naranja ocupa menos del 10% de una vista y siempre señala una acción o selección.

## Typography

**Display Font:** Inter con fallback system-ui

**Body Font:** Inter con fallback system-ui
**Label/Mono Font:** SFMono-Regular o Consolas para IDs y datos técnicos

**Character:** Una sola familia sans mantiene la interfaz familiar y rápida; el mono aparece únicamente donde la forma del dato importa.

### Hierarchy

- **Headline** (700, 2rem, 1.16): título de la tarea actual.
- **Title** (700, 1.3rem, 1.16): secciones y entregables.
- **Body** (400, 15px, 1.5): instrucciones y contenido, con prosa limitada a 70ch.
- **Label** (800, 12px, 1.3): controles y estado, sin convertir frases completas en mayúsculas.

**The Working Type Rule.** Ningún tamaño existe para impresionar; cada salto de escala explica jerarquía o estado.

## Elevation

El sistema es plano por defecto. La profundidad se expresa mediante cambios tonales entre Canvas, Surface y Raised Steel; no se combinan bordes finos con sombras ambientales anchas.

**The Tonal Layers Rule.** Un contenedor gana profundidad mediante tono o borde, nunca mediante ambos más una sombra decorativa.

## Components

### Buttons

- **Shape:** curva contenida de 8px.
- **Primary:** Forge Orange, texto claro, peso 800 y altura táctil mínima de 42px.
- **Hover / Focus:** Bright Forge y anillo visible; active desplaza 1px.
- **Secondary:** superficie transparente, borde Steel y el mismo vocabulario de forma.

### Chips

- **Style:** píldoras compactas solo para score, filtro o estado; nunca sustituyen texto explicativo.
- **State:** color semántico acompañado por nombre legible.

### Cards / Containers

- **Corner Style:** 10px como máximo operativo.
- **Background:** Surface o Raised Steel.
- **Shadow Strategy:** sin sombra en reposo.
- **Border:** Steel de 1px cuando separa regiones contiguas.
- **Internal Padding:** 12–18px según densidad.

### Inputs / Fields

- **Style:** fondo Surface, borde Steel, radio 8px.
- **Focus:** anillo naranja de alto contraste sin eliminar el outline funcional.
- **Error / Disabled:** texto y tratamiento semántico, nunca color aislado.

### Navigation

La barra lateral permanece estable en escritorio y pasa a navegación horizontal compacta en pantallas pequeñas. La vista activa usa naranja, texto y `aria-current`.

## Do's and Don'ts

### Do:

- **Do** organizar cada pantalla según el trabajo del creador y mostrar el siguiente paso.
- **Do** mantener revisión humana y confirmación explícita antes de una publicación externa.
- **Do** usar estados completos: carga, vacío, error, bloqueado, acción manual y éxito.
- **Do** garantizar objetivos táctiles de al menos 42px y foco visible.

### Don't:

- **Don't** crear un panel técnico que obligue a conocer variables o rutas internas.
- **Don't** prometer viralidad ni publicar sin revisión explícita.
- **Don't** usar tarjetas repetidas, adornos SaaS, gradientes morados o glassmorphism.
- **Don't** mezclar creación, revisión, publicación e historias en un formulario interminable.
- **Don't** usar franjas laterales de color como único significado de una alerta.
