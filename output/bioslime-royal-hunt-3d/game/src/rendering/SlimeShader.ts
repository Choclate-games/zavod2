import * as THREE from 'three';

export interface SlimeShaderUniforms {
  uTime: { value: number };
  uVelocity: { value: THREE.Vector3 };
  uSquashFactor: { value: number };
  uColorPrimary: { value: THREE.Color };
  uColorCore: { value: THREE.Color };
  uColorRim: { value: THREE.Color };
  uHitPulse: { value: number };
  uNoiseScale: { value: number };
  uNoiseStrength: { value: number };
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uVelocity;
  uniform float uSquashFactor;
  uniform float uHitPulse;
  uniform float uNoiseScale;
  uniform float uNoiseStrength;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying float vNoise;

  // 3D Simplex noise helper
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);

    // Compute wobble & squash displacement
    vec3 pos = position;
    float speed = length(uVelocity);
    vec3 moveDir = speed > 0.001 ? normalize(uVelocity) : vec3(0.0);

    // Dynamic noise wave
    float noiseVal = snoise(pos * uNoiseScale + vec3(0.0, uTime * 2.5, 0.0));
    vNoise = noiseVal;

    // Wobble amplitude clamped to prevent tearing
    float wobble = clamp(noiseVal * uNoiseStrength, -0.25, 0.25);
    pos += normal * wobble;

    // Elongate in move direction, squash perpendicular
    float align = dot(normal, moveDir);
    float stretch = clamp(speed * 0.04 * uSquashFactor, 0.0, 0.45);
    pos += moveDir * (align * stretch);
    pos.y -= (1.0 - abs(pos.y)) * (stretch * 0.5); // Squash bottom

    // Hit pulse ripple
    if (uHitPulse > 0.001) {
      pos += normal * (sin(uTime * 25.0) * uHitPulse * 0.2);
    }

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;

    vec4 mvPosition = viewMatrix * worldPos;
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColorPrimary;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform float uHitPulse;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec3 vWorldPosition;
  varying float vNoise;

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel Rim Glow
    float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
    float rimPower = pow(fresnel, 2.2);

    // Subsurface translucency approximation
    float coreFactor = clamp(dot(viewDir, normal), 0.0, 1.0);
    vec3 baseColor = mix(uColorCore, uColorPrimary, coreFactor * 0.7 + vNoise * 0.15);

    // Add glowing rim
    vec3 finalColor = mix(baseColor, uColorRim, rimPower * 0.85);

    // Specular highlight
    vec3 lightDir = normalize(vec3(0.4, 0.9, 0.5));
    vec3 halfVector = normalize(lightDir + viewDir);
    float NdotH = max(dot(normal, halfVector), 0.0);
    float specular = pow(NdotH, 48.0) * 0.6;
    finalColor += vec3(1.0, 1.0, 1.0) * specular;

    // Hit flash
    if (uHitPulse > 0.01) {
      finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), uHitPulse * 0.7);
    }

    gl_FragColor = vec4(finalColor, 0.88 + rimPower * 0.12);
  }
`;

export function createSlimeMaterial(primaryColor = 0x00ff66, coreColor = 0x008f39, rimColor = 0x39ff14): THREE.ShaderMaterial {
  const uniforms: SlimeShaderUniforms = {
    uTime: { value: 0.0 },
    uVelocity: { value: new THREE.Vector3() },
    uSquashFactor: { value: 1.0 },
    uColorPrimary: { value: new THREE.Color(primaryColor) },
    uColorCore: { value: new THREE.Color(coreColor) },
    uColorRim: { value: new THREE.Color(rimColor) },
    uHitPulse: { value: 0.0 },
    uNoiseScale: { value: 2.2 },
    uNoiseStrength: { value: 0.12 }
  };

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: true,
    side: THREE.FrontSide
  });
}
