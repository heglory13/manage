const fs = require('fs');
const path = require('path');

const MOJIBAKE_RE =
  /(?:Ã.|Â.|â€|â€™|â€œ|â€\x9d|â€“|â€”|â€¦|Ä‘|Æ°|á»|áº)/;

function decodeLatin1AsUtf8(text) {
  return Buffer.from(text, 'latin1').toString('utf8');
}

function shouldRewrite(original, repaired) {
  if (original === repaired) return false;

  const originalHits = (original.match(MOJIBAKE_RE) || []).length;
  const repairedHits = (repaired.match(MOJIBAKE_RE) || []).length;

  return repairedHits < originalHits;
}

function repairFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const repaired = decodeLatin1AsUtf8(original);

  if (!shouldRewrite(original, repaired)) {
    console.log(`skip ${filePath}`);
    return false;
  }

  fs.writeFileSync(filePath, repaired, 'utf8');
  console.log(`fixed ${filePath}`);
  return true;
}

function main() {
  const targets = process.argv.slice(2);

  if (targets.length === 0) {
    console.error('Usage: node fix-decoder.cjs <file1> <file2> ...');
    process.exitCode = 1;
    return;
  }

  let fixedCount = 0;

  for (const target of targets) {
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      console.log(`missing ${target}`);
      continue;
    }

    if (repairFile(resolved)) {
      fixedCount += 1;
    }
  }

  console.log(`fixed ${fixedCount} file(s)`);
}

main();
