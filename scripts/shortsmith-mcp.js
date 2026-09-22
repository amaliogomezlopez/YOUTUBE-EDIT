#!/usr/bin/env node
/**
 * Minimal MCP server (stdio, JSON-RPC 2.0) exposing the editing workflow to any
 * agent with tool use. Tools wrap the existing CLIs; nothing here edits video on
 * its own. stdout carries protocol messages only: child output is captured.
 */
import path from 'node:path';
import {createInterface} from 'node:readline';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {run} from '../src/lib/utils.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = (name) => path.join(ROOT, 'scripts', name);
const str = (description) => ({type: 'string', description});

const TOOLS = [
  {name: 'edit_video', description: 'Primer montaje completo desde una carpeta de tomas numeradas (1.mkv, 2.mkv...): ingesta, capturas, plan con el estilo medido del autor, render y QA. Tarda minutos. Devuelve REVIEW.md.',
    inputSchema: {type: 'object', required: ['source', 'slug'], properties: {source: str('Carpeta con las tomas'), slug: str('Nombre del proyecto en minusculas-con-guiones'),
      urls: str('Archivo de notas con URLs de posts o paginas a mostrar'), intents: str('JSON de intenciones (emphasis, topicShiftTakes, hookPunchRefs)'),
      render: {type: 'boolean', description: 'false para solo planificar'}}},
    args: (a) => [script('youtube-edit.js'), '--source', a.source, '--slug', a.slug, ...(a.urls ? ['--urls', a.urls] : []), ...(a.intents ? ['--intents', a.intents] : []), ...(a.render === false ? ['--no-render'] : [])]},
  {name: 'plan_video', description: 'Solo el plan (sin render) para un proyecto ya ingerido. Usar para iterar intenciones antes de renderizar.',
    inputSchema: {type: 'object', required: ['project', 'output'], properties: {project: str('remotion-animations/projects/youtube-SLUG'), output: str('Carpeta nueva de salida'),
      intents: str('JSON de intenciones'), assets: str('assets.json de capture')}},
    args: (a) => [script('youtube-autoplan.js'), 'plan', '--project', a.project, '--output', a.output, ...(a.intents ? ['--intents', a.intents] : []), ...(a.assets ? ['--assets', a.assets] : [])]},
  {name: 'capture_assets', description: 'Captura posts de X (oEmbed oficial) y paginas web publicas con procedencia. Lo que falla queda en pendientes.',
    inputSchema: {type: 'object', required: ['urls', 'output'], properties: {urls: {type: 'array', items: {type: 'string'}}, output: str('Carpeta de salida')}},
    args: (a) => [script('youtube-autoplan.js'), 'capture', '--output', a.output, ...a.urls.flatMap((u) => ['--url', u])]},
  {name: 'qa_render', description: 'QA sin referencia de un MP4: negros, congelados, saturacion, volumen y cortes con voz; genera hoja de revision.',
    inputSchema: {type: 'object', required: ['video', 'plan', 'output'], properties: {video: str('MP4'), plan: str('edit-plan.json'), output: str('Carpeta')}},
    args: (a) => [script('youtube-autoplan.js'), 'qa', '--video', a.video, '--plan', a.plan, '--output', a.output]},
  {name: 'style_profile', description: 'Resumen del estilo medido del autor (habitos de corte, zoom, sonido, marca). Leer antes de proponer cambios.',
    inputSchema: {type: 'object', properties: {}},
    read: () => readFile(path.join(ROOT, 'data/editorial-memory/corpus/ESTILO.md'), 'utf8')},
  {name: 'record_feedback', description: 'Guarda un comentario REAL del autor ligado a un fotograma del paquete renderizado. No inventar comentarios.',
    inputSchema: {type: 'object', required: ['package', 'frame', 'category', 'quote', 'output'], properties: {package: str('render-package.json'), frame: {type: 'integer'},
      category: str('camera | sound | cut | asset | text'), quote: str('Palabras exactas del autor'), output: str('JSON nuevo')}},
    args: (a) => [script('youtube-feedback.js'), '--package', a.package, '--frame', String(a.frame), '--category', a.category, '--quote', a.quote, '--output', a.output]}
];

async function call(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw Error('Herramienta desconocida: ' + name);
  for (const key of tool.inputSchema.required ?? []) if (args?.[key] == null) throw Error('Falta ' + key);
  if (tool.read) return tool.read();
  const result = await run(process.execPath, tool.args(args), {cwd: ROOT}).catch((error) => error);
  const text = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(-12000);
  if (result instanceof Error) throw Error(text || result.message);
  return text;
}

const send = (message) => process.stdout.write(JSON.stringify({jsonrpc: '2.0', ...message}) + '\n');
const lines = createInterface({input: process.stdin});
lines.on('line', async (line) => {
  let msg;
  try {msg = JSON.parse(line);} catch {return send({id: null, error: {code: -32700, message: 'Parse error'}});}
  const {id, method, params} = msg;
  if (id === undefined) return; // notifications (initialized, cancelled)
  try {
    if (method === 'initialize') return send({id, result: {protocolVersion: params?.protocolVersion ?? '2024-11-05', capabilities: {tools: {}},
      serverInfo: {name: 'shortsmith', version: '0.1.0'}, instructions: 'Montaje de YouTube con el estilo medido del autor. Empieza por style_profile; edit_video hace todo; plan_video + qa_render para iterar.'}});
    if (method === 'ping') return send({id, result: {}});
    if (method === 'tools/list') return send({id, result: {tools: TOOLS.map(({name, description, inputSchema}) => ({name, description, inputSchema}))}});
    if (method === 'tools/call') {
      try {
        return send({id, result: {content: [{type: 'text', text: await call(params.name, params.arguments ?? {})}]}});
      } catch (error) {
        return send({id, result: {content: [{type: 'text', text: error.message}], isError: true}});
      }
    }
    send({id, error: {code: -32601, message: 'Metodo no soportado: ' + method}});
  } catch (error) {
    send({id, error: {code: -32603, message: error.message}});
  }
});
