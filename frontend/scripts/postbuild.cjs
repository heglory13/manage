const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const rawBasePath = (process.env.VITE_APP_BASE_PATH || '/').trim();
const normalizedBasePath =
  rawBasePath === '/' ? '/' : `/${rawBasePath.replace(/^\/+|\/+$/g, '')}/`;

const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase ${normalizedBasePath}

  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . ${normalizedBasePath}index.html [L]
</IfModule>
`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, '.htaccess'), htaccessContent, 'utf8');
