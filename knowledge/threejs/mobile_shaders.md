# Mobile Shaders & Material Optimization in Three.js

## Best Practices for Mobile Browser Shaders
1. **Prefer `MeshLambertMaterial` or `MeshPhongMaterial`** over complex `MeshPhysicalMaterial` for hordes of enemies.
2. **Avoid Heavy Post-Processing**:
   - Screen-space ambient occlusion (SSAO) and depth-of-field (DOF) are too heavy for low-end mobile web.
   - Use baked ambient occlusion maps or simple vertex color gradients instead.
   - Use bloom only with half-resolution downsampling.
3. **Custom Shader Tips**:
   - Keep precision to `mediump` or `lowp` for fragment shaders.
   - Avoid dependent texture reads and dynamic branch branching inside fragment loops.
   - Calculate lighting normals in the vertex shader whenever possible.
