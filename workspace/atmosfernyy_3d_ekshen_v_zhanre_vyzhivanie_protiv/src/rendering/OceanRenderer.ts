import * as THREE from 'three'

const VERTEX_SHADER = `
uniform float uTime;
varying vec2 vUv;
varying float vWave;

float waveHeight(vec2 p, float t) {
  float h = 0.0;
  h += sin(p.x * 0.14 + t * 1.15) * 0.85;
  h += sin(p.y * 0.11 - t * 0.9) * 0.75;
  h += sin((p.x + p.y) * 0.07 + t * 0.6) * 0.55;
  return h;
}

void main() {
  vUv = uv;
  vec3 pos = position;
  float h = waveHeight(pos.xy, uTime);
  pos.z += h;
  vWave = h;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const FRAGMENT_SHADER = `
uniform vec3 uDeepColor;
uniform vec3 uCrestColor;
uniform float uTime;
varying vec2 vUv;
varying float vWave;

void main() {
  float crest = smoothstep(0.9, 2.0, vWave);
  vec3 color = mix(uDeepColor, uCrestColor, crest * 0.7);
  // Пена у кромки острова.
  float rim = smoothstep(0.115, 0.088, distance(vUv, vec2(0.5)));
  float foam = rim * (0.55 + 0.45 * sin(uTime * 2.2 + vUv.x * 60.0));
  color = mix(color, vec3(0.82, 0.86, 0.9), clamp(foam, 0.0, 0.85));
  gl_FragColor = vec4(color, 1.0);
}
`

/**
 * Штормовой океан: одна плоскость с вершинными волнами и пеной у скал.
 */
export class OceanRenderer {
  readonly mesh: THREE.Mesh
  private readonly material: THREE.ShaderMaterial

  constructor() {
    const geometry = new THREE.PlaneGeometry(320, 320, 88, 88)
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color(0x0a1220) },
        uCrestColor: { value: new THREE.Color(0x27354d) },
      },
    })
    this.mesh = new THREE.Mesh(geometry, this.material)
    this.mesh.rotation.x = -Math.PI / 2
    this.mesh.position.y = -4.6
    this.mesh.frustumCulled = false
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time
  }

  /** К рассвету вода теплеет в цвет неба. */
  setDawnMix(mix: number): void {
    this.deepTarget.setHex(0x0a1220).lerp(this.dawnDeep, mix)
    this.crestTarget.setHex(0x27354d).lerp(this.dawnCrest, mix)
    ;(this.material.uniforms.uDeepColor.value as THREE.Color).copy(this.deepTarget)
    ;(this.material.uniforms.uCrestColor.value as THREE.Color).copy(this.crestTarget)
  }

  private readonly dawnDeep = new THREE.Color(0x1c3049)
  private readonly dawnCrest = new THREE.Color(0x8a7a55)
  private readonly deepTarget = new THREE.Color()
  private readonly crestTarget = new THREE.Color()
}
