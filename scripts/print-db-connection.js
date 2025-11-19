const fs = require('node:fs');
const path = require('node:path');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const [key, ...rest] = line.split('=');
      acc[key] = rest.join('=');
      return acc;
    }, {});
};

const localEnvPath = path.resolve(process.cwd(), '.env.local');
const exampleEnvPath = path.resolve(process.cwd(), '.env.example');

const localVars = parseEnvFile(localEnvPath);
const exampleVars = parseEnvFile(exampleEnvPath);

const pick = (key, fallback = '') =>
  process.env[key] || localVars[key] || exampleVars[key] || fallback;

const host = pick('SUPABASE_DB_HOST', 'db.gkpkyjuxqunsawnwhwf.supabase.co');
const port = Number(pick('SUPABASE_DB_PORT', '5432'));
const database = pick('SUPABASE_DB_NAME', 'postgres');
const user = pick('SUPABASE_DB_USER', 'postgres');
const password = pick('SUPABASE_DB_PASSWORD', 'Pxfull0pro80');
const sslMode = pick('SUPABASE_DB_SSL', 'require');

const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;

const instructions = `\nString de conexão pronta:\n${connectionString}\n\nComando psql equivalente:\nPGPASSWORD=${password} psql --host=${host} --port=${port} --username=${user} --dbname=${database} --set=sslmode=${sslMode}\n`;

console.log('==============================================');
console.log('Supabase – conexão direta com o Postgres');
console.log('==============================================');
console.log(instructions);
console.log('Dica: copie o conteúdo para o Supabase SQL Editor ou para qualquer cliente Postgres compatível com SSL.');
