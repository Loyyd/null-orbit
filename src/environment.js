import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createSpace(scene) {
  const gltfLoader = new GLTFLoader();
  const PLANET_LIGHT_DIRECTION = new THREE.Vector3(0.8, 0.35, -0.45).normalize();

  function createCloudTexture(seed = 0) {
    const size = 300;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 140; i++) {
      const x = (Math.sin((i + 1) * (seed + 1) * 13.17) * 0.5 + 0.5) * size;
      const y = (Math.cos((i + 1) * (seed + 1) * 7.91) * 0.5 + 0.5) * size;
      const radius = 10 + (((i * 37) + (seed * 53)) % 42);
      const alpha = 0.05 + ((((i * 11) + (seed * 17)) % 100) / 100) * 0.18;
      const gradient = ctx.createRadialGradient(x, y, radius * 0.15, x, y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
      gradient.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.55})`);
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createAtmosphereMaterial(color) {
    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(color) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
          vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
          float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.8);
          float alpha = fresnel * 0.6;
          gl_FragColor = vec4(glowColor * (0.45 + fresnel * 0.85), alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
  }

  function improvePlanetSurface(root) {
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material) return;
        if ('roughness' in material) material.roughness = Math.min(material.roughness ?? 1, 0.62);
        if ('metalness' in material) material.metalness = Math.min(material.metalness ?? 0, 0.08);
        if ('normalScale' in material) material.normalScale?.set?.(0.55, 0.55);
        if ('emissive' in material) material.emissive?.setHex?.(0x0b1522);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 0.08;
      });
    });
  }

  function addPlanetEffects(planet, {
    cloudSeed,
    cloudColor,
    atmosphereColor,
    cloudOpacity = 0.42,
  }) {
    const bounds = new THREE.Box3().setFromObject(planet);
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.36;

    const cloudTexture = createCloudTexture(cloudSeed);
    const cloudLayer = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.004, 64, 64),
      new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: cloudOpacity,
        alphaTest: 0.03,
        depthWrite: false,
        blending: THREE.NormalBlending,
        color: new THREE.Color(cloudColor),
        shininess: 18,
      })
    );
    cloudLayer.rotation.z = 0.08;
    planet.add(cloudLayer);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.07, 64, 64),
      createAtmosphereMaterial(atmosphereColor)
    );
    planet.add(atmosphere);

    const terminatorGlow = new THREE.DirectionalLight(atmosphereColor, 0.7);
    terminatorGlow.position.copy(PLANET_LIGHT_DIRECTION.clone().multiplyScalar(radius * 5));
    planet.add(terminatorGlow);

    planet.userData.cloudLayer = cloudLayer;
  }

  // 1. Deep Space Background
  scene.background = new THREE.Color(0x020205);

  // 2. Starfield (Points)
  const starCount = 15000;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    // Distribute stars in a large sphere
    const radius = 400 + Math.random() * 600;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);

    starPositions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    starPositions[i3 + 2] = radius * Math.cos(phi);

    // Variation in star colors (white, slight blue, slight yellow)
    const mixedColor = new THREE.Color();
    const type = Math.random();
    if (type > 0.9) mixedColor.setHex(0xaaaaff); // Blueish
    else if (type > 0.8) mixedColor.setHex(0xffffaa); // Yellowish
    else mixedColor.setHex(0xffffff); // White

    starColors[i3] = mixedColor.r;
    starColors[i3 + 1] = mixedColor.g;
    starColors[i3 + 2] = mixedColor.b;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starMaterial = new THREE.PointsMaterial({
    size: 0.7,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });

  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  // 3. Background planets
  const addPlanet = ({ path, position, targetSize, rotationY = 0, cloudSeed = 1, cloudColor = 0xffffff, atmosphereColor = 0x66aaff }) => {
    gltfLoader.load(
      path,
      (gltf) => {
        const planet = new THREE.Group();
        const surface = gltf.scene;
        planet.position.copy(position);
        planet.rotation.y = rotationY;
        planet.add(surface);

        const bounds = new THREE.Box3().setFromObject(surface);
        const size = bounds.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z, 0.001);
        const scale = targetSize / maxDimension;
        surface.scale.setScalar(scale);

        const scaledBounds = new THREE.Box3().setFromObject(surface);
        const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
        surface.position.sub(scaledCenter);

        improvePlanetSurface(surface);
        addPlanetEffects(planet, { cloudSeed, cloudColor, atmosphereColor });

        scene.add(planet);
      },
      undefined,
      (error) => {
        console.error(`Failed to load planet model ${path}:`, error);
      }
    );
  };

  addPlanet({
    path: '/models/planet_1.glb',
    position: new THREE.Vector3(140, -70, -190),
    targetSize: 220,
    rotationY: Math.PI * 0.2,
    cloudSeed: 1,
    cloudColor: 0xf3f8ff,
    atmosphereColor: 0x68b7ff,
  });
  addPlanet({
    path: '/models/planet_2.glb',
    position: new THREE.Vector3(-150, -85, -235),
    targetSize: 220,
    rotationY: -Math.PI * 0.15,
    cloudSeed: 2,
    cloudColor: 0xfff3eb,
    atmosphereColor: 0xff8f5e,
  });
}
