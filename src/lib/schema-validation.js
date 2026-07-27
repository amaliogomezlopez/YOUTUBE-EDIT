import {readFileSync} from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import {ROOT} from './utils.js';

const validatorCache = new Map();

function formatInstancePath(error) {
  if (error.instancePath) return error.instancePath;
  if (error.params?.missingProperty) return `/${error.params.missingProperty}`;
  return '/';
}

export function validateJsonSchema(data, {
  schemaFile,
  label = 'JSON'
}) {
  const absoluteSchema = path.resolve(schemaFile);
  let validate = validatorCache.get(absoluteSchema);
  if (!validate) {
    const schema = JSON.parse(readFileSync(absoluteSchema, 'utf8'));
    const ajv = new Ajv2020({
      allErrors: true,
      allowUnionTypes: true,
      strict: true,
      strictRequired: false,
      validateFormats: false
    });
    validate = ajv.compile(schema);
    validatorCache.set(absoluteSchema, validate);
  }
  if (validate(data)) return data;
  const details = (validate.errors || [])
    .slice(0, 8)
    .map((error) => `${formatInstancePath(error)} ${error.message}`)
    .join('; ');
  throw new Error(`${label} no cumple su esquema: ${details}`);
}

export function validateChartIngestionInput(data) {
  return validateJsonSchema(data, {
    label: 'Chart ingestion input',
    schemaFile: path.join(
      ROOT,
      'remotion-animations',
      'schemas',
      'chart-ingestion-input.schema.json'
    )
  });
}

export function validateVisualSelection(data) {
  return validateJsonSchema(data, {
    label: 'Visual selection',
    schemaFile: path.join(
      ROOT,
      'remotion-animations',
      'schemas',
      'visual-selection.schema.json'
    )
  });
}
