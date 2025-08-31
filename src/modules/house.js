export function buildHouse(THREE) {
  const house = new THREE.Group();
  const state = { health: 100 };

  // Foundation platform/carpet
  const floorG = new THREE.BoxGeometry(8, 0.2, 8);
  const floorM = new THREE.MeshStandardMaterial({ color: 0xe6d4b5, roughness: 0.9, flatShading: true });
  const floor = new THREE.Mesh(floorG, floorM);
  floor.position.y = 0.101; // offset to avoid z-fighting with island top
  floor.receiveShadow = true; floor.castShadow = false;
  house.add(floor);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff2d5, roughness: 0.95, flatShading: true });
  const wallThickness = 0.3;
  const wallHeight = 3;
  const wallLen = 8;
  const wallZ = new THREE.BoxGeometry(wallLen, wallHeight, wallThickness);
  const wallX = new THREE.BoxGeometry(wallThickness, wallHeight, wallLen);
  const w1 = new THREE.Mesh(wallZ, wallMat); w1.position.set(0, wallHeight/2, -wallLen/2 + wallThickness/2);
  // Front wall will be split around the door; add only back and sides here
  const w3 = new THREE.Mesh(wallX, wallMat); w3.position.set(-wallLen/2 + wallThickness/2, wallHeight/2, 0);
  const w4 = new THREE.Mesh(wallX, wallMat); w4.position.set(wallLen/2 - wallThickness/2, wallHeight/2, 0);
  for (const w of [w1, w3, w4]) { w.castShadow = true; w.receiveShadow = true; }
  house.add(w1, w3, w4);

  // Door opening on front wall (positive Z side): we will hide a section to act like a door frame
  const doorWidth = 1.6, doorHeight = 2.3;
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, doorHeight, wallThickness * 0.9), new THREE.MeshStandardMaterial({ color: 0xc7b8a3, roughness: 0.9, flatShading: true }));
  // Slightly proud of the wall so visible from outside
  doorFrame.position.set(0, doorHeight/2, wallLen/2 - wallThickness/2 + 0.03);
  doorFrame.castShadow = true; doorFrame.receiveShadow = true;
  house.add(doorFrame);

  // Front wall segments left/right of the door (visuals)
  const frontSegWidth = (wallLen - doorWidth) / 2;
  const frontLeft = new THREE.Mesh(new THREE.BoxGeometry(frontSegWidth, wallHeight, wallThickness), wallMat);
  frontLeft.position.set(-doorWidth/2 - frontSegWidth/2, wallHeight/2, wallLen/2 - wallThickness/2);
  const frontRight = new THREE.Mesh(new THREE.BoxGeometry(frontSegWidth, wallHeight, wallThickness), wallMat);
  frontRight.position.set(doorWidth/2 + frontSegWidth/2, wallHeight/2, wallLen/2 - wallThickness/2);
  for (const w of [frontLeft, frontRight]) { w.castShadow = true; w.receiveShadow = true; }
  house.add(frontLeft, frontRight);

  // Lintel above door for visual completeness
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(doorWidth + 0.2, 0.3, wallThickness), new THREE.MeshStandardMaterial({ color: 0xc7b8a3, roughness: 0.9, flatShading: true }));
  lintel.position.set(0, doorHeight + 0.15, wallLen/2 - wallThickness/2 + 0.01);
  lintel.castShadow = true; house.add(lintel);

  // Roof: stylized red gable
  const roofG = new THREE.ConeGeometry(7.6, 3.8, 4);
  const roofM = new THREE.MeshStandardMaterial({ color: 0xff5d5d, roughness: 0.8, flatShading: true });
  const roof = new THREE.Mesh(roofG, roofM);
  roof.rotation.y = Math.PI / 4; // align to square
  roof.position.y = wallHeight + 1.6;
  roof.castShadow = true;
  house.add(roof);

  // Windows: four cartoony blue panes with frames
  const winMat = new THREE.MeshStandardMaterial({ color: 0x9ed8ff, roughness: 0.6, metalness: 0.1, flatShading: true, emissive: 0x2b6cb0, emissiveIntensity: 0.05 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x9a7b54, roughness: 0.9, flatShading: true });
  function windowUnit(x, y, z) {
    const g = new THREE.BoxGeometry(1.2, 0.9, 0.08);
    const pane = new THREE.Mesh(g, winMat);
    pane.position.set(x, y, z);
    pane.castShadow = false; pane.receiveShadow = false;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.09), frameMat);
    frame.position.set(x, y, z + 0.02*Math.sign(z || 1));
    frame.castShadow = true;
    house.add(pane, frame);
  }
  windowUnit(-2.2, 1.6, -wallLen/2 + wallThickness/2 + 0.05);
  windowUnit( 2.2, 1.6, -wallLen/2 + wallThickness/2 + 0.05);
  windowUnit(-2.2, 1.6,  wallLen/2 - wallThickness/2 - 0.05);
  windowUnit( 2.2, 1.6,  wallLen/2 - wallThickness/2 - 0.05);

  // Interior: bed, table, plant, rug, lamp, bookshelf
  const bed = new THREE.Group();
  const bedBase = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x9f5a3c, roughness: 0.95, flatShading: true }));
  bedBase.position.y = 0.4; bedBase.castShadow = true; bed.add(bedBase);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 1.1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }));
  mattress.position.y = 0.85; mattress.castShadow = true; bed.add(mattress);
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.95, flatShading: true }));
  pillow.position.set(0.6, 1.1, -0.3); pillow.castShadow = true; bed.add(pillow);
  // Place bed snug in the back-left corner (inside)
  bed.position.set(-wallLen/2 + wallThickness + 1.2, 0, -wallLen/2 + wallThickness + 0.8);
  house.add(bed);

  const table = new THREE.Group();
  const tabletop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xc48c5a, roughness: 0.95, flatShading: true }));
  tabletop.position.y = 1.0; tabletop.castShadow = true; table.add(tabletop);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 1, flatShading: true }));
  leg.position.y = 0.5; leg.castShadow = true; table.add(leg);
  table.position.set(1.6, 0, -2.2);
  house.add(table);

  const plant = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xa0522d, roughness: 1, flatShading: true }));
  pot.position.y = 0.35; plant.add(pot);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 1, flatShading: true }));
  leaf.position.y = 0.65; plant.add(leaf);
  plant.position.set(wallLen/2 - wallThickness - 0.5, 0, wallLen/2 - wallThickness - 0.6);
  house.add(plant);

  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.01, 24), new THREE.MeshStandardMaterial({ color: 0x77c3ff, roughness: 1, flatShading: true }));
  // Slightly above the foundation to prevent z-fighting
  rug.position.set(0, 0.11, 0); rug.receiveShadow = true; house.add(rug);

  // Lamp
  const lamp = new THREE.Group();
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1, flatShading: true }));
  stand.position.y = 0.75; lamp.add(stand);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe08a, emissiveIntensity: 0.2, roughness: 0.7, flatShading: true }));
  shade.position.y = 1.3; lamp.add(shade);
  lamp.position.set(-2.6, 0, 2.2);
  house.add(lamp);

  // Shelf with books
  const shelf = new THREE.Group();
  const shelfBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 2.6), new THREE.MeshStandardMaterial({ color: 0x8b5e34, roughness: 1, flatShading: true }));
  // Pull slightly away from the inner wall to avoid z-fighting/clipping
  shelfBase.position.set(-wallLen/2 + wallThickness + 0.4, 1.2, 0);
  shelfBase.castShadow = true; shelf.add(shelfBase);
  for (let i = 0; i < 8; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3 + Math.random()*0.5, 0.18), new THREE.MeshStandardMaterial({ color: randomColor(), roughness: 1, flatShading: true }));
    book.position.set(-wallLen/2 + wallThickness + 0.45, 0.5 + i*0.2, -0.9 + (i%4)*0.6);
    book.rotation.z = (Math.random()-0.5) * 0.1;
    book.castShadow = true; shelf.add(book);
  }
  house.add(shelf);

  function randomColor() {
    const palette = [0xff8a80, 0xffd180, 0xffff8d, 0xccff90, 0x80d8ff, 0xb388ff, 0xff8ed1];
    return palette[Math.floor(Math.random() * palette.length)];
  }

  // Door trigger box for starting wave when leaving
  const doorTrigger = new THREE.Box3(
    new THREE.Vector3(-doorWidth/2, 0, wallLen/2 - wallThickness - 0.6),
    new THREE.Vector3(doorWidth/2, doorHeight, wallLen/2 + 0.6)
  );

  const getDoorTrigger = () => doorTrigger.clone();
  const getBedPos = () => new THREE.Vector3(-2.0, 1.6, -2.2);
  const houseGroup = house;

  // Simple wall colliders (axis-aligned), excluding the door opening on the front wall
  function getColliders() {
    const colliders = [];
    const yMin = 0, yMax = wallHeight;
    // Back wall (single segment)
    {
      const z = -wallLen/2 + wallThickness/2;
      const min = new THREE.Vector3(-wallLen/2, yMin, z - wallThickness/2);
      const max = new THREE.Vector3( wallLen/2, yMax, z + wallThickness/2);
      colliders.push(new THREE.Box3(min, max));
    }
    // Front wall (two segments around door)
    {
      const z = wallLen/2 - wallThickness/2;
      // Left of door
      colliders.push(new THREE.Box3(
        new THREE.Vector3(-wallLen/2, yMin, z - wallThickness/2),
        new THREE.Vector3(-doorWidth/2, yMax, z + wallThickness/2)
      ));
      // Right of door
      colliders.push(new THREE.Box3(
        new THREE.Vector3(doorWidth/2, yMin, z - wallThickness/2),
        new THREE.Vector3(wallLen/2, yMax, z + wallThickness/2)
      ));
    }
    // Left wall (x negative)
    {
      const x = -wallLen/2 + wallThickness/2;
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - wallThickness/2, yMin, -wallLen/2),
        new THREE.Vector3(x + wallThickness/2, yMax,  wallLen/2)
      ));
    }
    // Right wall (x positive)
    {
      const x = wallLen/2 - wallThickness/2;
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - wallThickness/2, yMin, -wallLen/2),
        new THREE.Vector3(x + wallThickness/2, yMax,  wallLen/2)
      ));
    }
    return colliders;
  }

  return { houseGroup, getDoorTrigger, getBedPos, getColliders, houseState: state };
}

// No external getter; houseState is returned from buildHouse so callers can keep the same reference.


