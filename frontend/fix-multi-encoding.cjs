const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'src');
const TARGET_EXTENSIONS = new Set(['.ts', '.tsx']);
const MOJIBAKE_RE =
  /(?:Ã.|Â.|â€|â€™|â€œ|â€\x9d|â€“|â€”|â€¦|Ä‘|Æ°|á»|áº)/;

function decodeLatin1AsUtf8(text) {
  return Buffer.from(text, 'latin1').toString('utf8');
}

function countMojibake(text) {
  return (text.match(MOJIBAKE_RE) || []).length;
}

function maybeRepairFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const repaired = decodeLatin1AsUtf8(original);

  if (original === repaired) {
    return false;
  }

  if (countMojibake(repaired) >= countMojibake(original)) {
    return false;
  }

  fs.writeFileSync(filePath, repaired, 'utf8');
  console.log(`fixed ${path.relative(__dirname, filePath)}`);
  return true;
}

function scan(dir) {
  let fixedCount = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      fixedCount += scan(fullPath);
      continue;
    }

    if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    if (maybeRepairFile(fullPath)) {
      fixedCount += 1;
    }
  }

  return fixedCount;
}

const fixedCount = scan(ROOT);
console.log(`fixed ${fixedCount} file(s)`);
