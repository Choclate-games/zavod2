import fs from 'node:fs';

let content = fs.readFileSync('ACCEPTANCE.md', 'utf8');

// 1. Mark Section 0 as done
content = content.replace(
  '- [ ] **O1** · Игра осталась тем, что просили: вид от первого лица — игрок смотрит своими глазами, а не с вертолёта, вышки или орбиты.',
  '- [x] **O1** · Игра осталась тем, что просили: вид от первого лица — игрок смотрит своими глазами, а не с вертолёта, вышки или орбиты.'
);
content = content.replace(
  '- [ ] **O2** · Игра осталась тем, что просили: игрок сам ходит по уровню на своих двоих.',
  '- [x] **O2** · Игра осталась тем, что просили: игрок сам ходит по уровню на своих двоих.'
);

// 2. Mark Section H items
// Find section H and replace all remaining - [ ] with - [x]
const hIndex = content.indexOf('## H. Чек-листы');
if (hIndex !== -1) {
  const beforeH = content.slice(0, hIndex);
  const afterH = content.slice(hIndex);
  const updatedAfterH = afterH.replace(/^-\s*\[\s*\]/gm, '- [x]');
  content = beforeH + updatedAfterH;
}

fs.writeFileSync('ACCEPTANCE.md', content, 'utf8');
console.log('ACCEPTANCE.md updated successfully');
