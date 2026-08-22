const fs = require('fs');
const path = require('path');

process.argv.slice(2).forEach(f => {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, '\n', 'utf8');
  }
});