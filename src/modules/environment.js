export function buildEnvironment(THREE, WORLD) {
  const group = new THREE.Group();

  // Floating island: top disc + tapered dirt
  const topRadius = WORLD.islandRadius;
  const top = new THREE.CylinderGeometry(topRadius, topRadius * 0.92, 1.2, 24, 1, false);
  const topMat = new THREE.MeshStandardMaterial({ color: 0x79d66c, roughness: 0.9, metalness: 0.0, flatShading: true });
  const topMesh = new THREE.Mesh(top, topMat);
  topMesh.castShadow = false; topMesh.receiveShadow = true;
  topMesh.position.y = -0.6; // so surface is near y=0
  group.add(topMesh);

  const bottom = new THREE.ConeGeometry(topRadius * 0.95, topRadius * 1.4, 24);
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0x9c6b3e, roughness: 0.95, flatShading: true });
  const bottomMesh = new THREE.Mesh(bottom, dirtMat);
  bottomMesh.rotation.x = Math.PI;
  bottomMesh.position.y = -1.2 - (topRadius * 0.7);
  bottomMesh.castShadow = true; bottomMesh.receiveShadow = false;
  group.add(bottomMesh);

  // Cute stones around edges
  const stones = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const r = topRadius - 1.2;
    const a = (i / 18) * Math.PI * 2 + (Math.random() * 0.2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const g = new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.4, 0);
    const m = new THREE.MeshStandardMaterial({ color: 0xb7b2a9, roughness: 1, flatShading: true });
    const s = new THREE.Mesh(g, m);
    s.position.set(x, 0, z);
    s.rotation.y = Math.random() * Math.PI;
    s.castShadow = true; s.receiveShadow = true;
    stones.add(s);
  }
  group.add(stones);

  // Sky decor: clouds
  const skyGroup = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const cloud = new THREE.Group();
    const puffCount = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffCount; j++) {
      const g = new THREE.SphereGeometry(1 + Math.random(), 8, 8);
      const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
      const p = new THREE.Mesh(g, m);
      p.position.set(j * 1.1, Math.random() * 0.6, Math.random() * 0.6);
      cloud.add(p);
    }
    cloud.position.set((Math.random() - 0.5) * 80, 8 + Math.random() * 8, (Math.random() - 0.5) * 80);
    skyGroup.add(cloud);
  }

  // Lights
  const hemi = new THREE.HemisphereLight(0xbfdfff, 0x8f7744, 0.55);
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(20, 40, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -60; sun.shadow.camera.right = 60; sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
  sun.shadow.camera.far = 150;

  const lightGroup = new THREE.Group();
  lightGroup.add(hemi);
  lightGroup.add(sun);

  return { groundGroup: group, sun: lightGroup, skyGroup };
}


