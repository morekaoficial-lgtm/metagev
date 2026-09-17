/**
 * Verificación de terminología legal (cumplimiento).
 * Falla (exit 1) si en los textos de UI (src/i18n/es.json) aparece algún
 * término prohibido, en cualquier variante de mayúsculas/minúsculas.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, '..', 'src', 'i18n', 'es.json');

const FORBIDDEN = [
  'bono',
  'bonos',
  'incentivo',
  'incentivos',
  'comisión',
  'comision',
  'comisiones',
  'premio',
  'premios',
  'nómina',
  'nomina',
  'nóminas',
  'nominas',
];

const REQUIRED = [
  'Gratificación Extraordinaria Variable',
  'Evaluación',
  'Mis Objetivos',
];

function flatten(value, prefix = '') {
  if (typeof value === 'string') return { [prefix]: value };
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce(
      (acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }),
      {},
    );
  }
  return {};
}

let json;
try {
  json = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`❌ No se pudo leer ${file}: ${e.message}`);
  process.exit(1);
}

const strings = flatten(json);
const errors = [];

for (const [key, text] of Object.entries(strings)) {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN) {
    if (lower.includes(term)) {
      errors.push(`Término prohibido "${term}" en ${key}: "${text}"`);
    }
  }
}

const allText = Object.values(strings).join('\n');
for (const term of REQUIRED) {
  if (!allText.includes(term)) {
    errors.push(`Falta el término obligatorio "${term}" en es.json`);
  }
}

if (errors.length > 0) {
  console.error('❌ Falló la verificación de terminología:');
  for (const e of errors) console.error(`   - ${e}`);
  process.exit(1);
}

console.log('✅ Terminología legal correcta.');
