import * as THREE from 'three'
import { ThermalPalette } from '../types'

export const ThermalShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0.0 },
    uPalette: { value: 0 }, // 0 = WHITE_HOT, 1 = BLACK_HOT
    uZoom: { value: 1.0 },
    uNoiseIntensity: { value: 0.08 },
    uScanlineIntensity: { value: 0.15 },
    uVignette: { value: 0.3 }
  },

  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform int uPalette;
    uniform float uZoom;
    uniform float uNoiseIntensity;
    uniform float uScanlineIntensity;
    uniform float uVignette;

    varying vec2 vUv;

    // Fast pseudo-random for matrix thermal noise
    float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      // Zoom centering
      vec2 uv = (vUv - 0.5) / uZoom + 0.5;

      // Sample scene texture
      vec4 baseColor = texture2D(tDiffuse, uv);

      // Compute luminance (representing thermal emission / temperature)
      float lum = dot(baseColor.rgb, vec3(0.299, 0.587, 0.114));

      // Emissive boost: brighter objects emit extreme thermal heat
      lum = pow(lum, 1.2) * 1.35;

      // Palette conversion
      vec3 flirColor;
      if (uPalette == 0) {
        // WHITE-HOT: Hot objects are bright white/amber, cold is dark slate
        flirColor = mix(vec3(0.08, 0.10, 0.12), vec3(1.0, 1.0, 1.0), clamp(lum, 0.0, 1.0));
        // Add subtle green/cyan FLIR phosphorescent tint to mid-tones
        flirColor += vec3(0.02, 0.08, 0.04) * lum;
      } else {
        // BLACK-HOT: Hot objects are deep charcoal/black, cold is washed light gray
        flirColor = mix(vec3(0.9, 0.92, 0.94), vec3(0.04, 0.04, 0.05), clamp(lum, 0.0, 1.0));
      }

      // Matrix thermal noise grain
      float noise = (rand(uv * 300.0 + fract(uTime * 15.0)) - 0.5) * uNoiseIntensity;
      flirColor += noise;

      // CRT Scanlines
      float scanline = sin(uv.y * 700.0) * 0.5 + 0.5;
      flirColor *= (1.0 - uScanlineIntensity * scanline);

      // Vignette effect on camera boundaries
      float dist = distance(vUv, vec2(0.5, 0.5));
      float vignette = smoothstep(0.75, 0.45, dist);
      flirColor *= mix(1.0 - uVignette, 1.0, vignette);

      gl_FragColor = vec4(flirColor, 1.0);
    }
  `
}

export class ThermalShaderPass {
  private material: THREE.ShaderMaterial
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private quad: THREE.Mesh
  private renderTarget: THREE.WebGLRenderTarget

  constructor(width: number, height: number) {
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(ThermalShader.uniforms),
      vertexShader: ThermalShader.vertexShader,
      fragmentShader: ThermalShader.fragmentShader
    })

    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.scene.add(this.quad)

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    })
  }

  public setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height)
  }

  public setPalette(palette: ThermalPalette): void {
    this.material.uniforms.uPalette.value = palette === 'WHITE_HOT' ? 0 : 1
  }

  public setZoom(zoom: number): void {
    this.material.uniforms.uZoom.value = zoom
  }

  public getRenderTarget(): THREE.WebGLRenderTarget {
    return this.renderTarget
  }

  public render(renderer: THREE.WebGLRenderer, sceneTexture: THREE.Texture, time: number): void {
    this.material.uniforms.tDiffuse.value = sceneTexture
    this.material.uniforms.uTime.value = time
    renderer.setRenderTarget(null)
    renderer.render(this.scene, this.camera)
  }

  public dispose(): void {
    this.renderTarget.dispose()
    this.material.dispose()
    this.quad.geometry.dispose()
  }
}
