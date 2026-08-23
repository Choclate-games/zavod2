import * as THREE from 'three'

const SKY_VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const SKY_FRAGMENT = `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uDawnGlowColor;
uniform float uDawnGlow;
varying vec3 vDir;

void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uHorizon, uZenith, pow(h, 0.8));
  // Тёплое зарево рассвета на востоке.
  float east = clamp(dot(normalize(vec2(vDir.x, -vDir.z)), vec2(1.0, 0.0)) * 0.5 + 0.5, 0.0, 1.0);
  float glow = pow(1.0 - abs(vDir.y), 2.4) * east * uDawnGlow;
  color = mix(color, uDawnGlowColor, glow);
  gl_FragColor = vec4(color, 1.0);
}
`

const RAIN_VERTEX = `
uniform float uTime;
attribute float aSpeed;
attribute float aOffset;
varying float vAlpha;
void main() {
  vec3 pos = position;
  pos.y = mod(pos.y - uTime * aSpeed + aOffset, 46.0) - 6.0;
  vAlpha = clamp(aSpeed * 0.16, 0.12, 0.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  gl_PointSize = clamp(aSpeed * 0.9, 1.0, 2.6);
}
`

const RAIN_FRAGMENT = `
uniform vec3 uRainColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(uRainColor, vAlpha * uOpacity);
}
`

/**
 * Небо-купол с градиентом и заревом рассвета плюс дождь на шейдере точек.
 */
export class AtmosphereRenderer {
  readonly sky: THREE.Mesh
  readonly rain: THREE.Points
  private readonly skyMaterial: THREE.ShaderMaterial
  private readonly rainMaterial: THREE.ShaderMaterial
  private readonly dawnZenith = new THREE.Color(0x27406b)
  private readonly dawnHorizon = new THREE.Color(0xc98a45)

  constructor() {
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x070a13) },
        uHorizon: { value: new THREE.Color(0x10141f) },
        uDawnGlowColor: { value: new THREE.Color(0xd49b42) },
        uDawnGlow: { value: 0.05 },
      },
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 14), this.skyMaterial)
    this.sky.frustumCulled = false

    const count = 1300
    const positions = new Float32Array(count * 3)
    const speeds = new Float32Array(count)
    const offsets = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 10 + Math.random() * 70
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = Math.random() * 46
      positions[i * 3 + 2] = Math.sin(angle) * radius
      speeds[i] = 14 + Math.random() * 18
      offsets[i] = Math.random() * 46
    }
    const rainGeometry = new THREE.BufferGeometry()
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    rainGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    rainGeometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1))
    this.rainMaterial = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uRainColor: { value: new THREE.Color(0x7d90b8) },
        uOpacity: { value: 0.55 },
      },
    })
    this.rain = new THREE.Points(rainGeometry, this.rainMaterial)
    this.rain.frustumCulled = false
  }

  update(time: number): void {
    this.rainMaterial.uniforms.uTime.value = time
  }

  /** Прогресс ночи 0..1 красит небо от штормовой ночи к рассвету. */
  setNightProgress(progress: number): void {
    const dawnMix = Math.max(0, (progress - 0.72) / 0.28)
    ;(this.skyMaterial.uniforms.uZenith.value as THREE.Color).setHex(0x070a13).lerp(this.dawnZenith, dawnMix)
    ;(this.skyMaterial.uniforms.uHorizon.value as THREE.Color).setHex(0x10141f).lerp(this.dawnHorizon, dawnMix)
    this.skyMaterial.uniforms.uDawnGlow.value = 0.05 + dawnMix * 0.85
    this.rainMaterial.uniforms.uOpacity.value = 0.55 - dawnMix * 0.45
  }
}
