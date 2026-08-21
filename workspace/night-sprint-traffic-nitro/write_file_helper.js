const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const b64 = process.argv[3];
if (!target || !b64) {
  console.error('Usage: node write_file_helper.js <path> <base64>');
  process.exit(1);
}
const dir = path.dirname(target);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
const content = Buffer.from(b64, 'base64').toString('utf-8');
fs.writeFileSync(target, content, 'utf-8');
console.log('Wrote ' + target + ' (' + content.length + ' bytes)');
