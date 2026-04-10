import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createSpace(scene) {
  const gltfLoader = new GLTFLoader();
  const PLANET_LIGHT_DIRECTION = new THREE.Vector3(0.8, 0.35, -0.45).normalize();
  const animatedPlanets = [];
  const animatedNebulae = [];
  const animatedFields = [];
  const animatedMaterials = [];

  function createGlowTexture({
    size = 256,
    colorStops = [
      { stop: 0, color: 'rgba(255,255,255,1)' },
      { stop: 0.25, color: 'rgba(255,255,255,0.6)' },
      { stop: 1, color: 'rgba(255,255,255,0)' },
    ],
  } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);

    colorStops.forEach(({ stop, color }) => gradient.addColorStop(stop, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createNebulaTexture(seed = 0, palette = ['rgba(84,193,255,0.35)', 'rgba(151,104,255,0.26)', 'rgba(255,129,102,0.18)']) {
    const size = 768;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 20; i++) {
      const angle = (i + 1) * (seed + 2) * 0.73;
      const x = (Math.sin(angle * 1.37) * 0.5 + 0.5) * size;
      const y = (Math.cos(angle * 0.91) * 0.5 + 0.5) * size;
      const radius = 80 + (((i * 53) + (seed * 29)) % 180);
      const color = palette[i % palette.length];
      const gradient = ctx.createRadialGradient(x, y, radius * 0.08, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.45, color.replace(/0\.\d+\)/, '0.14)'));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createBattlefieldTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#07111a';
    ctx.fillRect(0, 0, size, size);

    const radial = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size * 0.48);
    radial.addColorStop(0, 'rgba(70, 168, 230, 0.35)');
    radial.addColorStop(0.5, 'rgba(22, 70, 102, 0.16)');
    radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i <= size; i += 32) {
      const major = i % 128 === 0;
      ctx.strokeStyle = major ? 'rgba(104, 212, 255, 0.18)' : 'rgba(104, 212, 255, 0.06)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(104, 212, 255, 0.11)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, i * 96, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(160, 235, 255, 0.3)';
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18;
      const x = size / 2 + Math.cos(angle) * 240;
      const y = size / 2 + Math.sin(angle) * 240;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.2, 1.8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createStarField({
    count,
    minRadius,
    maxRadius,
    size,
    opacity,
    verticalBias = 0,
  }) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const color = new THREE.Color();
      const variant = Math.random();

      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta) + verticalBias;
      positions[i3 + 2] = radius * Math.cos(phi);

      if (variant > 0.93) color.setHex(0xfff1c7);
      else if (variant > 0.84) color.setHex(0xb5ccff);
      else color.setHex(0xf4fbff);

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size,
      map: createGlowTexture({
        size: 96,
        colorStops: [
          { stop: 0, color: 'rgba(255,255,255,1)' },
          { stop: 0.22, color: 'rgba(255,255,255,0.92)' },
          { stop: 0.55, color: 'rgba(255,255,255,0.22)' },
          { stop: 1, color: 'rgba(255,255,255,0)' },
        ],
      }),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const field = new THREE.Points(geometry, material);
    field.frustumCulled = false;
    scene.add(field);
    animatedFields.push(field);
    return field;
  }

  function createDustField() {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 260;
      positions[i3 + 1] = -12 + Math.random() * 34;
      positions[i3 + 2] = -150 + Math.random() * 270;

      const brightness = 0.55 + Math.random() * 0.45;
      colors[i3] = 0.45 * brightness;
      colors[i3 + 1] = 0.8 * brightness;
      colors[i3 + 2] = brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 1.25,
      map: createGlowTexture({
        size: 96,
        colorStops: [
          { stop: 0, color: 'rgba(255,255,255,0.75)' },
          { stop: 0.35, color: 'rgba(255,255,255,0.28)' },
          { stop: 1, color: 'rgba(255,255,255,0)' },
        ],
      }),
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const dust = new THREE.Points(geometry, material);
    dust.position.set(0, 0, -22);
    dust.frustumCulled = false;
    scene.add(dust);
    animatedFields.push(dust);
    return dust;
  }

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
          float ndotv = max(dot(normalize(vNormal), viewDirection), 0.0);
          float fresnel = pow(1.0 - ndotv, 2.4);
          float softGlow = smoothstep(0.02, 0.92, fresnel);
          float rimGlow = pow(1.0 - ndotv, 4.2);
          float alpha = (softGlow * 0.24) + (rimGlow * 0.14);
          vec3 color = glowColor * (0.32 + softGlow * 0.38 + rimGlow * 0.22);
          gl_FragColor = vec4(color, alpha);
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
        alphaTest: 0.0,
        depthWrite: false,
        blending: THREE.NormalBlending,
        color: new THREE.Color(cloudColor),
        shininess: 18,
      })
    );
    cloudLayer.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;\nvarying vec3 vWorldPosition;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPosition = worldPosition.xyz;\nvWorldNormal = normalize(mat3(modelMatrix) * normal);');

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;\nvarying vec3 vWorldPosition;')
        .replace(
          '#include <output_fragment>',
          `
            float ndotv = max(dot(normalize(vWorldNormal), normalize(cameraPosition - vWorldPosition)), 0.0);
            float edgeFade = smoothstep(0.06, 0.55, ndotv);
            gl_FragColor.a *= edgeFade;
            #include <output_fragment>
          `
        );
    };
    cloudLayer.material.needsUpdate = true;
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
    animatedPlanets.push(planet);
  }

  // 1. Deep Space Background
  scene.background = new THREE.Color(0x0b1726);
  const battleTexture = createBattlefieldTexture();
  const tacticalFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 360),
    new THREE.MeshStandardMaterial({
      color: 0x23465f,
      map: battleTexture,
      emissive: new THREE.Color(0x6fc6f2),
      emissiveMap: battleTexture,
      emissiveIntensity: 0.94,
      transparent: true,
      opacity: 0.74,
      roughness: 0.98,
      metalness: 0.05,
    })
  );
  tacticalFloor.rotation.x = -Math.PI / 2;
  tacticalFloor.position.set(0, -0.72, -20);
  tacticalFloor.receiveShadow = true;
  scene.add(tacticalFloor);
  animatedMaterials.push(tacticalFloor.material);

  const floorGlow = new THREE.Mesh(
    new THREE.CircleGeometry(130, 96),
    new THREE.MeshBasicMaterial({
      map: createGlowTexture({
        size: 512,
        colorStops: [
          { stop: 0, color: 'rgba(85,185,255,0.42)' },
          { stop: 0.4, color: 'rgba(38,112,170,0.16)' },
          { stop: 1, color: 'rgba(0,0,0,0)' },
        ],
      }),
      transparent: true,
      opacity: 0.5,
      color: 0x5dc7ff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, -0.74, -20);
  scene.add(floorGlow);
  animatedMaterials.push(floorGlow.material);

  // 2. Starfield (Points)
  const farStars = createStarField({
    count: 18000,
    minRadius: 500,
    maxRadius: 1150,
    size: 1.85,
    opacity: 1,
  });
  const midStars = createStarField({
    count: 9500,
    minRadius: 260,
    maxRadius: 620,
    size: 2.35,
    opacity: 0.82,
    verticalBias: -40,
  });
  const dustField = createDustField();

  const nebulaConfigs = [
    {
      position: new THREE.Vector3(-220, 65, -420),
      scale: new THREE.Vector3(360, 220, 1),
      rotation: -0.28,
      opacity: 0.34,
      palette: ['rgba(66,178,255,0.36)', 'rgba(90,74,255,0.22)', 'rgba(255,92,130,0.14)'],
    },
    {
      position: new THREE.Vector3(250, -20, -380),
      scale: new THREE.Vector3(320, 210, 1),
      rotation: 0.24,
      opacity: 0.26,
      palette: ['rgba(255,171,88,0.28)', 'rgba(255,86,128,0.22)', 'rgba(115,205,255,0.14)'],
    },
    {
      position: new THREE.Vector3(20, 150, -520),
      scale: new THREE.Vector3(460, 270, 1),
      rotation: 0.05,
      opacity: 0.18,
      palette: ['rgba(95,211,255,0.24)', 'rgba(168,132,255,0.18)', 'rgba(255,255,255,0.06)'],
    },
  ];

  nebulaConfigs.forEach((config, index) => {
    const material = new THREE.SpriteMaterial({
      map: createNebulaTexture(index + 1, config.palette),
      color: 0xffffff,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    material.rotation = config.rotation;

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(config.position);
    sprite.scale.copy(config.scale);
    scene.add(sprite);
    animatedNebulae.push(sprite);
  });

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

  return {
    update(deltaTime, elapsedTime) {
      farStars.rotation.y += deltaTime * 0.002;
      midStars.rotation.y -= deltaTime * 0.0036;
      midStars.rotation.x = Math.sin(elapsedTime * 0.04) * 0.04;
      dustField.rotation.y += deltaTime * 0.012;
      dustField.material.opacity = 0.06 + Math.sin(elapsedTime * 0.85) * 0.018;

      animatedNebulae.forEach((sprite, index) => {
        sprite.material.rotation += deltaTime * (0.004 + index * 0.0015);
        sprite.material.opacity = [0.34, 0.26, 0.18][index] + Math.sin(elapsedTime * (0.18 + index * 0.05)) * 0.018;
      });

      animatedPlanets.forEach((planet, index) => {
        planet.rotation.y += deltaTime * (0.008 + index * 0.003);
        if (planet.userData.cloudLayer) {
          planet.userData.cloudLayer.rotation.y += deltaTime * (0.022 + index * 0.004);
        }
      });

      if (animatedMaterials[0]) {
        animatedMaterials[0].emissiveIntensity = 0.74 + Math.sin(elapsedTime * 0.55) * 0.07;
      }
      if (animatedMaterials[1]) {
        animatedMaterials[1].opacity = 0.38 + Math.sin(elapsedTime * 0.7) * 0.05;
      }
    },
  };
}
