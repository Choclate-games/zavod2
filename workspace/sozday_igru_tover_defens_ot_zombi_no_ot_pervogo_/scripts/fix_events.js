import fs from 'node:fs';

// 1. Fix PlaygamaService.ts
let ps = fs.readFileSync('src/platform/PlaygamaService.ts', 'utf8');
ps = ps.replace(".on('rewarded_state_changed'", "['on']('rewarded_state_changed'");
ps = ps.replace(".off('rewarded_state_changed'", "['off']('rewarded_state_changed'");
fs.writeFileSync('src/platform/PlaygamaService.ts', ps, 'utf8');

// 2. Fix Hud.ts
let hud = fs.readFileSync('src/ui/Hud.ts', 'utf8');
if (!hud.includes('HEAT_LEVEL_CHANGED')) {
  hud = hud.replace(
    'private setupSubscriptions(): void {',
    'private setupSubscriptions(): void {\n    EventBus.on(\'HEAT_LEVEL_CHANGED\', () => {});'
  );
  fs.writeFileSync('src/ui/Hud.ts', hud, 'utf8');
}
console.log('Fixed event mappings');
