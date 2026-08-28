"use client";

import { useEffect, useRef } from "react";

const TEX = {
  earth:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_atmos_2048.jpg",
  lights:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_lights_2048.png",
  clouds:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/planets/earth_clouds_1024.png",
};

export function CinematicGlobe({
  haste = false,
}: {
  haste?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let frame = 0;
    let renderer: import("three").WebGLRenderer | undefined;
    let resize: (() => void) | undefined;

    void (async () => {
      const THREE = await import("three");
      if (disposed || !canvasRef.current) return;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x02050a, 0.012);
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
      camera.position.set(-0.15, 0.12, 3.65);
      camera.lookAt(0.55, 0, 0);

      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setClearColor(0x02050a, 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;

      const stars = makeStars(THREE);
      scene.add(stars);

      scene.add(new THREE.AmbientLight(0x6b7c93, 0.62));
      const sun = new THREE.DirectionalLight(0xfff1d6, 2.55);
      sun.position.set(-1.6, 1.0, 2.8);
      scene.add(sun);
      const rim = new THREE.PointLight(0xc4a35a, 1.25, 10);
      rim.position.set(2.4, 0.35, 1.4);
      scene.add(rim);

      const earth = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64),
        new THREE.MeshPhongMaterial({
          color: 0x8899aa,
          shininess: 8,
          specular: 0x222222,
        }),
      );
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(1.018, 64, 64),
        new THREE.MeshLambertMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        }),
      );
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.12, 48, 48),
        new THREE.ShaderMaterial({
          vertexShader: `
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
              gl_FragColor = vec4(0.42, 0.62, 1.0, 1.0) * intensity;
            }
          `,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          transparent: true,
        }),
      );
      const planet = new THREE.Group();
      planet.position.set(1.08, -0.06, 0);
      planet.add(earth, clouds, atmosphere);
      scene.add(planet);

      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(TEX.earth, (map) => {
        if (disposed) {
          map.dispose();
          return;
        }
        map.colorSpace = THREE.SRGBColorSpace;
        const mat = earth.material as import("three").MeshPhongMaterial;
        mat.map = map;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
      });
      loader.load(TEX.lights, (map) => {
        if (disposed) {
          map.dispose();
          return;
        }
        const mat = earth.material as import("three").MeshPhongMaterial;
        mat.emissive = new THREE.Color(0xffc070);
        mat.emissiveMap = map;
        mat.emissiveIntensity = 0.85;
        mat.needsUpdate = true;
      });
      loader.load(TEX.clouds, (map) => {
        if (disposed) {
          map.dispose();
          return;
        }
        map.colorSpace = THREE.SRGBColorSpace;
        const mat = clouds.material as import("three").MeshLambertMaterial;
        mat.map = map;
        mat.opacity = 0.42;
        mat.needsUpdate = true;
      });

      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const earthSpeed = reduced ? 0 : haste ? 0.012 : 0.0016;
      const cloudSpeed = reduced ? 0 : haste ? 0.016 : 0.0021;

      resize = () => {
        if (!renderer) return;
        const parent = canvas.parentElement ?? canvas;
        const width = Math.max(1, parent.clientWidth);
        const height = Math.max(1, parent.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      resize();
      window.addEventListener("resize", resize);

      const clock = new THREE.Clock();
      const tick = () => {
        if (disposed || !renderer) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        planet.rotation.y += earthSpeed * dt * 60;
        clouds.rotation.y += (cloudSpeed - earthSpeed) * dt * 60;
        stars.rotation.y += 0.00012 * dt * 60;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      if (resize) window.removeEventListener("resize", resize);
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, [haste]);

  return (
    <canvas
      ref={canvasRef}
      className="cinematic-globe"
      aria-hidden="true"
    />
  );
}

function makeStars(THREE: typeof import("three")) {
  const count = 2200;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 18 + Math.random() * 28;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xe8e2d4,
      size: 0.09,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    }),
  );
}
