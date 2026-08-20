import * as THREE from 'three';

/**
 * Sonar Sound Wave Ring Shader Material.
 * Renders expanding concentric circular sound ripples over the ground.
 */
export function createSonarRingMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color('#81c784') },
      uRadius: { value: 0.0 },
      uMaxRadius: { value: 12.0 },
      uThickness: { value: 0.6 },
      uCenter: { value: new THREE.Vector2(0, 0) },
      uAlpha: { value: 1.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uRadius;
      uniform float uMaxRadius;
      uniform float uThickness;
      uniform vec2 uCenter;
      uniform float uAlpha;
      varying vec3 vWorldPos;

      void main() {
        float d = distance(vWorldPos.xz, uCenter);
        float ring = smoothstep(uRadius - uThickness, uRadius, d) - smoothstep(uRadius, uRadius + uThickness, d);
        float fade = clamp(1.0 - (uRadius / uMaxRadius), 0.0, 1.0);
        float finalAlpha = ring * fade * uAlpha;
        if (finalAlpha < 0.01) discard;
        gl_FragColor = vec4(uColor, finalAlpha * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/**
 * Stealth Cloak Shimmer Material.
 */
export function createStealthMaterial(baseColor: string = '#aed581'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseColor) },
      uStealthAmount: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform float uStealthAmount;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 2.5);
        float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
        vec3 col = mix(uBaseColor, vec3(0.5, 0.9, 0.6), fresnel);
        float alpha = mix(1.0, 0.25 + fresnel * 0.5 * pulse, uStealthAmount);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
  });
}
