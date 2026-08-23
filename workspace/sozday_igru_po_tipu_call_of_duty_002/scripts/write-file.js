const fs = require('fs');
nconst path = require('path');
const target = process.argv[2];
nconst b64 = process.argv[3];
if (!target || !b64) { process.exit(1); }
const full = path.resolve(target);
fs.mkdirSync(path.dirname(full), { recursive: true });
fs.writeFileSync(full, Buffer.from(b64, 'base64').toString('utf8'), 'utf8');
console.log('Wrote', target);