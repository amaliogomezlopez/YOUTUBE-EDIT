---
name: Shortsmith
description: Control room local para convertir una grabación en contenido revisable y publicable.
colors:
  canvas: "#0a0d14"
  sidebar: "#0d1119"
  surface: "#121724"
  surface-raised: "#182032"
  surface-soft: "#212b40"
  ink: "#f2f5fa"
  muted: "#b4bdd0"
  subtle: "#98a2ba"
  line: "#2a3347"
  line-strong: "#44506b"
  signal-lime: "#b8f345"
  signal-lime-bright: "#d0ff66"
  signal-lime-ink: "#1c2607"
  success: "#4ade9c"
  warning: "#ffc85e"
  danger: "#ff7d74"
  info: "#7cc4ff"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.16
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.8px"
    fontWeight: 700
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
    backgroundColor: "{colors.signal-lime}"
    textColor: "{colors.signal-lime-ink}"
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

Shortsmith se usa durante una sesión real de edición, normalmente con muchas decisiones abiertas y poca tolerancia a la ambigüedad. La interfaz adopta una densidad operativa contenida: navegación estable, superficies de tinta azul para trabajo prolongado y lima reservada para acciones que hacen avanzar el flujo.

El sistema rechaza el aspecto de landing SaaS, los paneles de tarjetas repetidas y cualquier adorno que compita con el vídeo, la metadata o el estado de publicación.

**Key Characteristics:**

- Oscuro, sobrio y apto para sesiones largas.
- Lima escasa para acción, selección y foco.
- Estados siempre expresados con texto además de color.
- Flujo visible de preparación, revisión y publicación.

## Colors

La paleta usa tinta azul en capas y una lima de señal, con colores semánticos reservados para estados.

### Primary

- **Lima Señal:** acción principal y foco; nunca decoración extensa.
- **Bright Lime:** hover, foco de alto contraste y selección activa.

### Neutral

- **Canvas Ink:** fondo general que reduce fatiga visual.
- **Raised Steel:** controles, resultados y áreas editables.
- **Cool Ink:** texto primario; Muted y Subtle se reservan para contexto secundario.

### Semantic

- **Success / Warning / Danger:** estados del flujo, siempre con texto legible.
- **Info Blue:** contexto local o privado (por ejemplo, el motor de voz local); nunca acción primaria.

**The One Signal Rule.** La lima ocupa menos del 10% de una vista y siempre señala una acción o selección.

## Typography

**Display Font:** Inter con fallback system-ui

**Body Font:** Inter con fallback system-ui
**Label/Mono Font:** SFMono-Regular o Consolas para IDs y datos técnicos

**Character:** Una sola familia sans mantiene la interfaz familiar y rápida; el mono aparece únicamente donde la forma del dato importa.

### Hierarchy

- **Headline** (800, 2rem, 1.16): título de la tarea actual.
- **Title** (800, 1.35rem, 1.16): secciones y entregables.
- **Body** (400, 16px, 1.5): instrucciones y contenido, con prosa limitada a 70ch.
- **Label** (700, 12.8px, 1.3): controles y estado, sin convertir frases completas en mayúsculas.

**The Working Type Rule.** Ningún tamaño existe para impresionar; cada salto de escala explica jerarquía o estado.

## Elevation

El sistema es plano por defecto. La profundidad se expresa mediante cambios tonales entre Canvas, Surface y Raised Steel; no se combinan bordes finos con sombras ambientales anchas.

**The Tonal Layers Rule.** Un contenedor gana profundidad mediante tono o borde, nunca mediante ambos más una sombra decorativa.

## Components

### Navigation

La barra lateral permanece estable en escritorio y pasa a navegación horizontal compacta en pantallas pequeñas. Cada entrada usa un icono SVG de trazo consistente; la vista activa combina fondo Steel, icono lima, texto Ink y `aria-current`. Las listas (historial, clips, proyectos de carrusel) exponen una barra de búsqueda, filtro y ordenación sobre el contenido.

### Form Zones

Los formularios largos se dividen en zonas numeradas (01, 02, 03) que ocupan todo el ancho disponible, cada una con título, descripción breve y contenido propio. Nunca se presentan como columnas estrechas ni como hileras de campos sin agrupar.

### Buttons

- **Shape:** curva contenida de 8px.
- **Primary:** Lima Señal, texto oscuro, peso 800 y altura táctil mínima de 44px.
- **Hover / Focus:** Bright Lime y anillo visible; active desplaza 1px.
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
- **Focus:** anillo lima de alto contraste sin eliminar el outline funcional.
- **Error / Disabled:** texto y tratamiento semántico, nunca color aislado.

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
