import * as THREE from 'three';

export function createSpace(scene) {
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

  // 3. Subtle Nebula (Large faint spheres)
  const createNebula = (color, pos) => {
    const geo = new THREE.SphereGeometry(200, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.03,
      side: THREE.BackSide
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    scene.add(mesh);
  };

  createNebula(0x4400ff, new THREE.Vector3(200, -100, -300));
  createNebula(0xff0088, new THREE.Vector3(-200, 100, -400));
}
