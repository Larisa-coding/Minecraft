import * as THREE from 'three';

export interface SkyState {
  top: THREE.Color;
  horizon: THREE.Color;
  bottom: THREE.Color;
  light: THREE.Vector3;
  intensity: number;
  ambient: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  sunVisible: boolean;
  moonVisible: boolean;
  exposure: number;
  fog: THREE.Color;
}

const lerpColor = (a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) => out.copy(a).lerp(b, THREE.MathUtils.clamp(t, 0, 1));

export const skyState = (time: number, target: SkyState): SkyState => {
  const angle = time * Math.PI * 2;
  const sunY = Math.sin(angle);
  const sunX = Math.cos(angle);
  const sunZ = 0.32;
  const length = Math.hypot(sunX, sunY, sunZ) || 1;
  target.light.set(sunX / length, Math.max(-1, sunY / length), sunZ / length);
  const day = THREE.MathUtils.smoothstep(sunY, -0.08, 0.35);
  const sunset = Math.exp(-sunY * sunY * 10) * (1 - day * 0.25);
  const dayTop = new THREE.Color('#79b7ff');
  const nightTop = new THREE.Color('#10182e');
  const sunsetTop = new THREE.Color('#ff8b62');
  const dayHorizon = new THREE.Color('#d9eeff');
  const nightHorizon = new THREE.Color('#2a3a62');
  const sunsetHorizon = new THREE.Color('#ffd0a4');
  lerpColor(nightTop, dayTop, day, target.top);
  target.top.lerp(sunsetTop, sunset * 0.85);
  lerpColor(nightHorizon, dayHorizon, day, target.horizon);
  target.horizon.lerp(sunsetHorizon, sunset);
  target.bottom.copy(target.horizon).multiplyScalar(0.55);
  target.intensity = 0.08 + day * 1.15;
  target.ambient = 0.28 + day * 0.32;
  target.hemiSky.copy(target.top);
  target.hemiGround.set('#6d7a55').lerp(new THREE.Color('#1d2436'), 1 - day);
  target.sunVisible = sunY > -0.05;
  target.moonVisible = sunY < 0.08;
  target.exposure = 0.92 + day * 0.18;
  target.fog.copy(target.horizon);
  if (sunY < 0) target.light.multiplyScalar(-1);
  return target;
};

export class SkyDome {
  readonly mesh: THREE.Mesh;
  readonly sun: THREE.Mesh;
  readonly moon: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  private readonly uniforms: { top: { value: THREE.Color }; horizon: { value: THREE.Color }; bottom: { value: THREE.Color } };

  constructor() {
    this.uniforms = {
      top: { value: new THREE.Color('#79b7ff') },
      horizon: { value: new THREE.Color('#d9eeff') },
      bottom: { value: new THREE.Color('#8aa4c4') },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      glslVersion: THREE.GLSL1,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top;
        uniform vec3 horizon;
        uniform vec3 bottom;
        void main() {
          float h = normalize(vPos).y;
          vec3 color = mix(horizon, top, smoothstep(0.0, 0.65, h));
          color = mix(bottom, color, smoothstep(-0.35, 0.08, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(420, 24, 16), material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -2;
    this.sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#ffe7b0', depthWrite: false, fog: false }),
    );
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(5, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#dfe7f5', depthWrite: false, fog: false }),
    );
    const clouds = document.createElement('canvas');
    clouds.width = 256;
    clouds.height = 128;
    const ctx = clouds.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 256, 128);
      for (let i = 0; i < 28; i += 1) {
        ctx.fillStyle = `rgba(255,255,255,${0.18 + (i % 5) * 0.05})`;
        ctx.beginPath();
        ctx.ellipse(20 + ((i * 47) % 230), 20 + ((i * 29) % 90), 18 + (i % 4) * 8, 8 + (i % 3) * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const cloudTexture = new THREE.CanvasTexture(clouds);
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    this.clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(380, 380),
      new THREE.MeshBasicMaterial({ map: cloudTexture, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 78;
  }

  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh, this.sun, this.moon, this.clouds);
  }

  update(state: SkyState, anchor: THREE.Vector3, time: number, effects: boolean): void {
    this.mesh.position.copy(anchor);
    this.uniforms.top.value.copy(state.top);
    this.uniforms.horizon.value.copy(state.horizon);
    this.uniforms.bottom.value.copy(state.bottom);
    this.sun.position.copy(anchor).addScaledVector(state.light, 220);
    this.sun.visible = state.sunVisible && effects;
    this.moon.position.copy(anchor).addScaledVector(state.light, -200);
    this.moon.visible = state.moonVisible && effects;
    this.clouds.position.x = anchor.x + time * 40;
    this.clouds.position.z = anchor.z + 10;
    this.clouds.visible = effects;
    (this.clouds.material as THREE.MeshBasicMaterial).opacity = 0.18 + (state.sunVisible ? 0.28 : 0.05);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.sun.geometry.dispose();
    (this.sun.material as THREE.Material).dispose();
    this.moon.geometry.dispose();
    (this.moon.material as THREE.Material).dispose();
    this.clouds.geometry.dispose();
    const material = this.clouds.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.dispose();
  }
}
