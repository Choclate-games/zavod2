const fs = require("fs");
const path = require("path");
const target = process.argv[2];
const b64 = process.argv[3];
if (!target || !b64) { console.error("missing args"); process.exit(1); }
const full = path.resolve(target);
fs.mkdirSync(path.dirname(full), { recursive: true });
const buf = Buffer.from(b64, "base64");
fs.writeFileSync(full, buf);
console.log("Saved", target, buf.length, "bytes");