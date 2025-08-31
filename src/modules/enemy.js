let idCounter = 1;

export function createEnemyManager(THREE, scene, WORLD, getHouseState, wallColliders) {
  const enemies = new Map();
  const enemyGroup = new THREE.Group();
  scene.add(enemyGroup);
  let pendingSpawns = 0;
  const scheduled = new Set();
  let hasSpawnedThisWave = false;

  function spawnOne() {
    const id = idCounter++;
    // Spawn around the island edge, slightly off and above to "jump" in
    const angle = Math.random() * Math.PI * 2;
    const r = WORLD.islandRadius + 2 + Math.random() * 2;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = 2 + Math.random() * 1.5;

    const enemy = buildBald(THREE);
    enemy.position.set(x, y, z);
    enemy.rotation.y = -angle + Math.PI/2;
    enemy.castShadow = true;
    enemyGroup.add(enemy);

    enemies.set(id, {
      id,
      mesh: enemy,
      health: 100,
      velocity: new THREE.Vector3(0, 0, 0),
      state: 'jumping', // jumping -> chasing
    });
    hasSpawnedThisWave = true;
    if (pendingSpawns > 0) pendingSpawns -= 1;
  }

  function spawnWave(day) {
    const count = 5 + Math.floor(day * 2.5);
    pendingSpawns = count;
    hasSpawnedThisWave = false;
    // Spawn one immediately so HUD/logic sees active enemies
    spawnOne();
    // Schedule the rest
    for (let i = 1; i < count; i++) {
      const t = setTimeout(() => { spawnOne(); scheduled.delete(t); }, i * 400);
      scheduled.add(t);
    }
  }

  function raycastHit(raycaster) {
    const targets = [];
    enemies.forEach((e) => { if (e.mesh.hitTarget) targets.push(e.mesh.hitTarget); });
    if (targets.length === 0) return null;
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length) {
      const obj = hits[0].object;
      const ent = Array.from(enemies.values()).find(e => e.mesh.hitTarget === obj);
      if (ent) return { id: ent.id };
    }
    return null;
  }

  function damage(id, amount) {
    const ent = enemies.get(id);
    if (!ent) return;
    ent.health -= amount;
    flash(ent.mesh);
    if (ent.health <= 0) kill(id);
  }

  function kill(id) {
    const ent = enemies.get(id);
    if (!ent) return;
    enemyGroup.remove(ent.mesh);
    disposeMesh(ent.mesh);
    enemies.delete(id);
  }

  function disposeMesh(root) {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

  function flash(mesh) {
    const mats = [];
    mesh.traverse((o) => {
      if (o.isMesh && o.material && o.material.color) mats.push(o.material);
    });
    const olds = mats.map(m => m.color.getHex());
    mats.forEach(m => m.color.setHex(0xff9999));
    setTimeout(() => mats.forEach((m, i) => m.color.setHex(olds[i])), 80);
  }

  const tmp = new THREE.Vector3();
  function update(dt, playerPos, onPlayerHit, onHouseHit) {
    const houseCenter = new THREE.Vector3(0, 0, 0);
    const houseR = 4.2;
    const houseState = getHouseState();
    const idsToKill = [];
    enemies.forEach((ent) => {
      const pos = ent.mesh.position;
      if (ent.state === 'jumping') {
        // Parabolic fall onto island
        ent.velocity.y -= WORLD.gravity * dt * 0.7;
        pos.addScaledVector(ent.velocity, dt);
        if (pos.y <= 0) { pos.y = 0; ent.state = 'chasing'; }
      } else if (ent.state === 'chasing') {
        // Pick target: if close to player, chase player, else attack house
        const toPlayer = tmp.copy(playerPos).sub(pos);
        const distanceToPlayerSq = toPlayer.lengthSq();
        const target = (distanceToPlayerSq < 9*9) ? playerPos : houseCenter;
        const speed = 2.6;
        tmp.copy(target).sub(pos).setY(0).normalize();
        pos.addScaledVector(tmp, speed * dt);
        pos.y = 0; // keep glued to ground plane
        ent.mesh.rotation.y = Math.atan2(-tmp.z, tmp.x) + Math.PI/2;

        // Discrete collision-based attack and suicide
        // Player: horizontal distance check
        const dx = pos.x - playerPos.x;
        const dz = pos.z - playerPos.z;
        const horizDist = Math.hypot(dx, dz);
        if (horizDist < 1.15) {
          onPlayerHit(20); // apply once
          idsToKill.push(ent.id);
          return;
        }
        // House: touching any house wall collider (expanded by enemy radius)
        const ENEMY_RADIUS = 0.35;
        if (Math.abs(pos.x) < 6 && Math.abs(pos.z) < 6) {
          let touchedHouse = false;
          for (const box of wallColliders) {
            const minX = box.min.x - ENEMY_RADIUS;
            const maxX = box.max.x + ENEMY_RADIUS;
            const minZ = box.min.z - ENEMY_RADIUS;
            const maxZ = box.max.z + ENEMY_RADIUS;
            const insideX = pos.x > minX && pos.x < maxX;
            const insideZ = pos.z > minZ && pos.z < maxZ;
            const insideY = 1.0 > (box.min.y - 0.1) && 1.0 < (box.max.y + 0.1);
            if (insideX && insideZ && insideY) { touchedHouse = true; break; }
          }
          // Also allow damaging if they reach the interior area (so doorway path counts)
          if (touchedHouse || pos.length() < houseR) {
            onHouseHit(12);
            idsToKill.push(ent.id);
            return;
          }
        }

        // No wall push-out for enemies; they explode on contact instead
      }
    });
    // Apply queued kills after iteration to avoid mutating during traversal
    if (idsToKill.length) {
      idsToKill.forEach((id) => kill(id));
    }
  }

  function getRemaining() { return enemies.size; }
  function getRemainingTotal() { return enemies.size + pendingSpawns; }
  function hadAnySpawn() { return hasSpawnedThisWave; }
  function clearAll() {
    scheduled.forEach((t) => clearTimeout(t));
    scheduled.clear();
    pendingSpawns = 0;
    Array.from(enemies.keys()).forEach(kill);
    hasSpawnedThisWave = false;
  }

  return { spawnWave, update, getRemaining, getRemainingTotal, hadAnySpawn, raycastHit, damage, clearAll };
}

function buildBald(THREE) {
  const g = new THREE.Group();
  // Torso
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 4, 8), new THREE.MeshStandardMaterial({ color: 0x77a6ff, roughness: 1, flatShading: true }));
  body.position.y = 1.1; body.castShadow = true; g.add(body);
  // Head (bald)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.9, flatShading: true }));
  head.position.y = 1.9; head.castShadow = true; g.add(head);
  // Eyes
  const eyeG = new THREE.SphereGeometry(0.05, 8, 8);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 1 });
  const e1 = new THREE.Mesh(eyeG, eyeM); e1.position.set(0.1, 1.95, 0.29); g.add(e1);
  const e2 = new THREE.Mesh(eyeG, eyeM); e2.position.set(-0.1, 1.95, 0.29); g.add(e2);
  // Arms
  const armG = new THREE.CylinderGeometry(0.09, 0.09, 0.8, 6);
  const armM = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 1, flatShading: true });
  const a1 = new THREE.Mesh(armG, armM); a1.position.set(0.5, 1.1, 0); a1.rotation.z = 0.4; g.add(a1);
  const a2 = new THREE.Mesh(armG, armM); a2.position.set(-0.5, 1.1, 0); a2.rotation.z = -0.4; g.add(a2);
  // Legs
  const legG = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6);
  const legM = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1, flatShading: true });
  const l1 = new THREE.Mesh(legG, legM); l1.position.set(0.2, 0.45, 0); g.add(l1);
  const l2 = new THREE.Mesh(legG, legM); l2.position.set(-0.2, 0.45, 0); g.add(l2);

  // Larger hit target capsule around torso and head
  const hitTarget = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 0.9, 4, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitTarget.position.y = 1.3; g.add(hitTarget);
  g.hitTarget = hitTarget;

  return g;
}


