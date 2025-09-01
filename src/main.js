import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import { buildEnvironment } from './modules/environment.js';
import { buildHouse } from './modules/house.js';
import { createHUD } from './modules/hud.js';
import { createEnemyManager } from './modules/enemy.js';
import { clamp } from './modules/math.js';

const WORLD = {
  islandRadius: 26,
  gravity: 30,
  jumpSpeed: 8.5,
};

let renderer, scene, camera, controls;
let player = {
  velocity: new THREE.Vector3(),
  onGround: true,
  health: 100,
  canShoot: false,
  alive: true,
};

let clock = new THREE.Clock();
let lastShotTime = 0;
const SHOOT_INTERVAL_MS = 160; // QoL: mild fire rate limit

// Systems
let enemyManager;
let hud;
let state = {
  day: 1,
  inWave: false,
  sleeping: false,
  gameOver: false,
  canStartWave: true,
};

// DOM
const overlay = document.getElementById('overlay');
const fade = document.getElementById('fade');
const hurt = document.getElementById('hurt');
const message = document.getElementById('message');
const crosshairEl = document.getElementById('crosshair');

init();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0xa8e6ff, 1);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xa8e6ff, 60, 140);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 1.6, 0);

  controls = new PointerLockControls(camera, document.body);

  const { groundGroup, sun, skyGroup } = buildEnvironment(THREE, WORLD);
  scene.add(groundGroup);
  scene.add(skyGroup);
  scene.add(sun);

  const { houseGroup, getDoorTrigger, getBedPos, getColliders, houseState } = buildHouse(THREE);
  scene.add(houseGroup);
  const wallColliders = getColliders();

  hud = createHUD();
  enemyManager = createEnemyManager(THREE, scene, WORLD, () => houseState, wallColliders);

  // Start inside house, at bed
  const bedStart = getBedPos();
  controls.getObject().position.copy(bedStart.clone().add(new THREE.Vector3(0, 0.2, 0)));
  scene.add(controls.getObject());

  // Interaction
  const overlayBox = overlay.querySelector('.overlay-box');
  const defaultOverlayHTML = overlayBox.innerHTML;
  overlay.addEventListener('click', () => {
    if (state.gameOver) return; // on game over, require R to restart
    controls.lock();
  });
  controls.addEventListener('lock', () => {
    overlay.classList.add('hidden');
    player.canShoot = true; // drew weapon
  });
  controls.addEventListener('unlock', () => {
    overlay.classList.remove('hidden');
    player.canShoot = false;
  });

  // Input
  const keys = { forward: false, backward: false, left: false, right: false, jump: false, sprint: false };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') keys.forward = true;
    if (e.code === 'KeyS') keys.backward = true;
    if (e.code === 'KeyA') keys.left = true;
    if (e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space') keys.jump = true;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sprint = true;
    if (e.code === 'KeyE') onInteract();
    if (e.code === 'KeyR' && state.gameOver) restart();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') keys.forward = false;
    if (e.code === 'KeyS') keys.backward = false;
    if (e.code === 'KeyA') keys.left = false;
    if (e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space') keys.jump = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.sprint = false;
  });

  window.addEventListener('mousedown', (e) => {
    if (!player.canShoot || !player.alive || state.sleeping) return;
    if (e.button !== 0) return; // only left click shoots
    shoot();
  });

  function onInteract() {
    if (state.sleeping || state.gameOver) return;
    // Sleep only after wave complete and when near bed
    if (!state.inWave && enemyManager.getRemaining() === 0) {
      const nearBed = controls.getObject().position.distanceTo(getBedPos()) < 2.2;
      if (nearBed) {
        sleepAndAdvance();
      }
    }
  }

  // Track leaving the house to start wave
  const doorTrigger = getDoorTrigger();
  function updateStartTrigger() {
    if (state.inWave || state.sleeping || !state.canStartWave) return;
    const p = controls.getObject().position;
    // Require player to step a bit beyond the outside of the doorway
    const halfDoor = (doorTrigger.max.x - doorTrigger.min.x) / 2;
    if (Math.abs(p.x) < halfDoor + 0.4 && p.z > doorTrigger.max.z + 0.2) {
      beginWave();
    }
  }

  // Resize
  window.addEventListener('resize', onResize);
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Game loop
  const tmpDir = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();

  function resolveCollisions(position) {
    // Only collide with house walls region for simplicity
    if (Math.abs(position.x) > 6 || Math.abs(position.z) > 6) return;
    const PLAYER_RADIUS = 0.4;
    for (const box of wallColliders) {
      const minX = box.min.x - PLAYER_RADIUS;
      const maxX = box.max.x + PLAYER_RADIUS;
      const minZ = box.min.z - PLAYER_RADIUS;
      const maxZ = box.max.z + PLAYER_RADIUS;
      const insideX = position.x > minX && position.x < maxX;
      const insideZ = position.z > minZ && position.z < maxZ;
      const insideY = 1.6 > (box.min.y - 0.1) && 1.6 < (box.max.y + 0.1);
      if (insideX && insideZ && insideY) {
        const dxLeft = Math.abs(position.x - minX);
        const dxRight = Math.abs(maxX - position.x);
        const dzNear = Math.abs(position.z - minZ);
        const dzFar = Math.abs(maxZ - position.z);
        const minPen = Math.min(dxLeft, dxRight, dzNear, dzFar);
        const eps = 0.001;
        if (minPen === dxLeft) position.x = minX - eps;
        else if (minPen === dxRight) position.x = maxX + eps;
        else if (minPen === dzNear) position.z = minZ - eps;
        else position.z = maxZ + eps;
      }
    }
  }
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(0.033, clock.getDelta());

    if (!state.sleeping && controls.isLocked) {
      // Movement (with sprint)
      const baseSpeed = 6.0;
      const speed = keys.sprint ? baseSpeed * 1.5 : baseSpeed;
      const forwardFactor = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
      const rightFactor = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      camera.getWorldDirection(tmpForward);
      tmpForward.y = 0; tmpForward.normalize();
      tmpRight.copy(tmpForward).cross(new THREE.Vector3(0, 1, 0)).normalize();
      tmpDir.copy(tmpForward).multiplyScalar(forwardFactor).add(tmpRight.multiplyScalar(rightFactor));
      if (tmpDir.lengthSq() > 0) tmpDir.normalize();

      player.velocity.x = tmpDir.x * speed;
      player.velocity.z = tmpDir.z * speed;

      // Gravity
      player.velocity.y -= WORLD.gravity * dt;
      const obj = controls.getObject();
      // integrate horizontally first and resolve collisions
      obj.position.x += player.velocity.x * dt;
      obj.position.z += player.velocity.z * dt;
      resolveCollisions(obj.position);
      // integrate vertical
      obj.position.y += player.velocity.y * dt;

      // Ground collision (island top at y=0)
      if (obj.position.y < 1.6) {
        player.velocity.y = 0;
        obj.position.y = 1.6;
        player.onGround = true;
      } else {
        player.onGround = false;
      }
      if (keys.jump && player.onGround) {
        player.velocity.y = WORLD.jumpSpeed;
      }

      // Constrain to island radius (allow fall if goes too far)
      const r = Math.hypot(obj.position.x, obj.position.z);
      if (r > WORLD.islandRadius - 1) {
        const scale = (WORLD.islandRadius - 1) / r;
        obj.position.x *= scale;
        obj.position.z *= scale;
      }

      // Start trigger
      updateStartTrigger();
    }

    if (state.inWave) {
      const p = controls.getObject().position;
      enemyManager.update(dt, p, onPlayerHit, onHouseHit);
      const remainingNow = enemyManager.getRemaining();
      const remainingTotal = enemyManager.getRemainingTotal ? enemyManager.getRemainingTotal() : remainingNow;
      if (remainingNow > 0 || remainingTotal > 0 || !enemyManager.hadAnySpawn()) {
        // Wave ongoing
      } else {
        state.inWave = false;
        message.textContent = 'All clear. Return to bed and press E to sleep.';
      }
    }

    const remainingDisplay = enemyManager.getRemainingTotal ? enemyManager.getRemainingTotal() : enemyManager.getRemaining();
    hud.update(player.health, houseState.health, state.day, remainingDisplay);

    // Contextual sleep prompt near bed when all clear
    if (!state.sleeping && !state.inWave && !state.gameOver && enemyManager.getRemaining() === 0) {
      const nearBed = controls.getObject().position.distanceTo(getBedPos()) < 2.2;
      const desired = nearBed ? 'Press E to sleep and start a new day.' : 'All clear. Return to bed and press E to sleep.';
      if (message.textContent !== desired) message.textContent = desired;
    }

    renderer.render(scene, camera);
  }
  animate();

  function beginWave() {
    if (state.inWave) return;
    if (!state.canStartWave) return;
    enemyManager.spawnWave(state.day);
    state.inWave = true;
    state.canStartWave = false; // prevent retrigger until after sleep
    message.textContent = `Day ${state.day}: Defend your house!`;
  }

  function shoot() {
    // Raycast forward from camera
    const raycaster = new THREE.Raycaster();
    // Offset origin slightly forward to avoid hitting our own body
    // Use world-space transform so shots go where the player looks
    const now = performance.now();
    if (now - lastShotTime < SHOOT_INTERVAL_MS) {
      if (crosshairEl) {
        crosshairEl.classList.add('cooldown');
        setTimeout(() => crosshairEl.classList.remove('cooldown'), 100);
      }
      return;
    }
    lastShotTime = now;
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward).normalize();
    origin.add(forward.clone().multiplyScalar(0.2));
    raycaster.set(origin, forward);
    raycaster.far = 100;
    const hit = enemyManager.raycastHit(raycaster);
    muzzleFlash();
    if (hit) {
      enemyManager.damage(hit.id, 50);
      // Hit marker
      if (crosshairEl) {
        crosshairEl.classList.add('hit');
        setTimeout(() => crosshairEl.classList.remove('hit'), 100);
      }
    }
  }

  let flashMesh;
  const flashAlignQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, Math.PI, 0));
  function muzzleFlash() {
    if (!flashMesh) {
      const geo = new THREE.ConeGeometry(0.06, 0.3, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffd27f });
      flashMesh = new THREE.Mesh(geo, mat);
      scene.add(flashMesh);
    }
    flashMesh.visible = true;
    // Place/rotate in world space to match the view direction
    const camPos = new THREE.Vector3();
    const camQuat = new THREE.Quaternion();
    camera.getWorldPosition(camPos);
    camera.getWorldQuaternion(camQuat);
    const offset = new THREE.Vector3(0, -0.07, -0.3).applyQuaternion(camQuat);
    flashMesh.position.copy(camPos).add(offset);
    // Orient cone with camera so it points forward like the weapon
    flashMesh.quaternion.copy(camQuat).multiply(flashAlignQuat);
    setTimeout(() => { if (flashMesh) flashMesh.visible = false; }, 40);
  }

  function onPlayerHit(amount) {
    if (!player.alive) return;
    player.health = clamp(player.health - amount, 0, 100);
    // Hurt vignette flash
    if (hurt) {
      hurt.classList.add('visible');
      setTimeout(() => hurt.classList.remove('visible'), 180);
    }
    if (player.health <= 0) {
      player.alive = false;
      gameOver('You were defeated. Press R to restart.');
    } else {
      message.textContent = 'You are under attack!';
    }
  }

  function onHouseHit(amount) {
    houseState.health = clamp(houseState.health - amount, 0, 100);
    if (houseState.health <= 0) {
      gameOver('Your house was destroyed. Press R to restart.');
    }
  }

  function sleepAndAdvance() {
    state.sleeping = true;
    message.textContent = 'Sleeping...';
    fade.style.opacity = '1';
    setTimeout(() => {
      // New day
      state.day += 1;
      state.inWave = false;
      state.canStartWave = true;
      player.health = clamp(player.health + 40, 0, 100);
      houseState.health = clamp(houseState.health + 50, 0, 100);
      // Move camera to bed, slight tilt
      const p = getBedPos();
      controls.getObject().position.set(p.x, 1.6, p.z);
      // Temporarily tilt down for sleep; store and restore original orientation to prevent drift
      const prevRotX = camera.rotation.x;
      const prevRotY = camera.rotation.y;
      const prevRotZ = camera.rotation.z;
      camera.rotation.x = -0.1;
      setTimeout(() => {
        camera.rotation.x = prevRotX;
        camera.rotation.y = prevRotY;
        camera.rotation.z = prevRotZ;
        fade.style.opacity = '0';
        state.sleeping = false;
        message.textContent = 'Exit the house to begin the next wave.';
        const banner = document.getElementById('waveBanner');
        banner.textContent = `Day ${state.day}`;
      }, 600);
    }, 700);
  }

  function gameOver(text) {
    state.gameOver = true;
    // Stop any remaining enemy spawns/updates for current wave
    enemyManager.clearAll();
    state.inWave = false;
    message.textContent = text;
    overlayBox.innerHTML = `
      <h1>Game Over</h1>
      <p>You fell on Day ${state.day}. Press <span class="kbd">R</span> to restart.</p>
    `;
    overlay.classList.remove('hidden');
    controls.unlock();
  }

  function restart() {
    // Reset state
    state = { day: 1, inWave: false, sleeping: false, gameOver: false, canStartWave: true };
    player = { velocity: new THREE.Vector3(), onGround: true, health: 100, canShoot: false, alive: true };
    enemyManager.clearAll();
    houseState.health = 100;
    // Move player back to bed
    const p = getBedPos();
    controls.getObject().position.set(p.x, 1.6, p.z);
    // Reset view orientation (yaw on controls object; clear camera pitch/roll)
    controls.getObject().rotation.y = 0;
    camera.rotation.set(0, 0, 0);
    message.textContent = 'Exit the house to begin the first wave.';
    document.getElementById('waveBanner').textContent = 'Day 1';
    overlayBox.innerHTML = defaultOverlayHTML;
    overlay.classList.remove('hidden');
  }
}
