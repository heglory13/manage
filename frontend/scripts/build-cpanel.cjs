const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.production');
const exampleEnvPath = path.join(rootDir, '.env.production.example');

if (!fs.existsSync(envPath)) {
  console.error(
    'Missing frontend/.env.production. Copy frontend/.env.production.example and set VITE_API_URL, VITE_APP_BASE_PATH first.',
  );
  process.exit(1);
}

const envFile = fs.readFileSync(envPath, 'utf8');
const env = { ...process.env };

for (const rawLine of envFile.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const eqIndex = line.indexOf('=');
  if (eqIndex === -1) continue;

  const key = line.slice(0, eqIndex).trim();
  const value = line
    .slice(eqIndex + 1)
    .trim()
    .replace(/^['"]|['"]$/g, '');

  env[key] = value;
}

if (!env.VITE_API_URL || !env.VITE_APP_BASE_PATH) {
  console.error(
    `frontend/.env.production must include VITE_API_URL and VITE_APP_BASE_PATH. See ${path.relative(rootDir, exampleEnvPath)}.`,
  );
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
  env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
