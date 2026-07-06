const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipPath = path.join(rootDir, 'dist-cpanel.zip');

if (!fs.existsSync(distDir)) {
  console.error('Missing frontend/dist. Run `npm run build:cpanel` first.');
  process.exit(1);
}

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

const command = [
  'Compress-Archive',
  '-Path',
  "'dist\\*'",
  '-DestinationPath',
  "'dist-cpanel.zip'",
  '-Force',
].join(' ');

const result = spawnSync('powershell', ['-NoProfile', '-Command', command], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
