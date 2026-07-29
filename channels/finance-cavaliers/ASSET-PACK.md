# Paquete visual recomendado — Finance Cavaliers

No conviene descargar una librería masiva sin criterio. Cada episodio debe
partir de una lista de escenas y reunir un paquete pequeño, trazable y
reutilizable.

## Base permanente del canal

- Logos corporativos: los siete Magnificent Seven y las instituciones que se
  repitan. Preferir SVG de Simple Icons o Font Awesome Free Brands; comprobar
  siempre los derechos de marca.
- Iconografía: Lucide para conceptos de mercado, crédito, empleo, consumo,
  industria y riesgo.
- Texturas propias: rejilla, grano, papel, reflejos de pantalla y máscaras.
- Sonido: whoosh, pulso, data tick, impacto suave y cierre, sintetizados
  localmente y guardados en `remotion-animations/public/sfx/`.
- Tipografía: Instrument Sans para editorial y Fragment Mono para datos.

## Paquete por episodio

Objetivo inicial para un vídeo de 6–10 minutos:

- 12–20 clips de b-roll de 5–12 segundos;
- 20–30 imágenes fijas;
- 5–8 capturas de documentos o gráficas oficiales;
- logos de todas las empresas mencionadas;
- datasets CSV o JSON que permitan reconstruir cada gráfica;
- una ficha de procedencia por asset: fuente, autor, licencia, fecha y hash.

## Familias de búsqueda

- Mercados: pantallas financieras, parquet, traders, gráficos y terminales.
- Tecnología: centros de datos, servidores, chips, semiconductores y robótica.
- Empresas: sedes, productos y logos en contexto editorial.
- Economía real: comercios, consumo, logística, fábricas, construcción y
  oficinas.
- Crédito: bancos, préstamos, documentos, firmas y hogares.
- Evidencia: informes regulatorios, páginas de resultados, filings y series
  oficiales.

Pexels o Pixabay sirven para b-roll genérico. Las gráficas y cifras deben
proceder del dataset original o de una fuente identificada; una fotografía de
stock nunca sustituye la evidencia. Openverse y unDraw pueden complementar
imágenes e ilustraciones con licencias abiertas.

Para logos, usar Brandfetch en dos pasos: `Brand Search API` cuando sólo se
conoce el nombre y `Logo API` cuando ya existe un dominio o ticker. Las
alternativas locales de Simple Icons y Font Awesome siguen siendo el fallback
sin red.

## Flujo

1. Buscar candidatos en la vista `Assets`.
2. Revisar licencia, pertinencia y resolución.
3. Importar al catálogo gestionado; no usar URLs remotas en Remotion.
4. Vincular el asset a la escena y registrar la procedencia.
5. Renderizar stills de control antes del vídeo.
