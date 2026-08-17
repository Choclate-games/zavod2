# Playgama Bridge: Lifecycle & Orientation Handling

## Visibility and Focus Lifecycle
When a user switches browser tabs, gets a phone call, or an ad banner opens:
1. `bridge.game.on('visibility_state_changed', (state) => { ... })`
2. If `state === 'hidden'`:
   - Pause physics engine.
   - Pause audio master volume.
   - Pause delta time accumulator in game loop.
3. If `state === 'visible'`:
   - If not in an ad or modal pause, resume audio and game loop.
   - Reset delta time tracker to avoid delta time leap!

## Screen Orientation
- Handle `resize` and `orientationchange` events.
- If game is designed for Landscape and user is on mobile portrait, show a responsive non-blocking or blocking overlay: "Please rotate device for best experience".
- For responsive canvas:
```typescript
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
```
