import * as THREE from 'three';

/**
 * Run a fragment shader once into a texture.
 *
 * Several things in this scene are expensive to compute per fragment and
 * completely static once computed — the nebula clouds are the clearest
 * case: multi-octave noise across two near-fullscreen quads, every frame,
 * for an image that never changes. Evaluating them once at init and
 * sampling the result afterwards costs one texture fetch instead, and looks
 * identical.
 */
export function bakeTexture(
  renderer: THREE.WebGLRenderer,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  size: number
): { texture: THREE.Texture; dispose(): void } {
  const target = new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
      }
    `,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  quad.frustumCulled = false;
  scene.add(quad);

  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previousTarget);

  quad.geometry.dispose();
  material.dispose();

  // The texture belongs to the target, so the target has to stay alive for
  // as long as the texture is used — and be released with it.
  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
