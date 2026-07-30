/**
 * Scroll-driven 3D robot background (Three.js).
 * Camera orbit + robot pose react to page scroll.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

(() => {
  const host = document.getElementById('robotBg');
  const canvas = document.getElementById('robotCanvas');
  if (!host || !canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches
    || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.035);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 1.2, 5.2);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // Lights — purple / cyan brand palette
  const hemi = new THREE.HemisphereLight(0xb8a4ff, 0x0a0a12, 0.75);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(3.5, 6, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x22d3ee, 0.55);
  fill.position.set(-4, 2, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(0x8b5cf6, 18, 18, 2);
  rim.position.set(0, 2.5, -3);
  scene.add(rim);

  // Soft ground disc
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 64),
    new THREE.MeshStandardMaterial({
      color: 0x12121a,
      metalness: 0.65,
      roughness: 0.35,
      transparent: true,
      opacity: 0.55,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.6, 1.72, 64),
    new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  scene.add(ring);

  const robotRoot = new THREE.Group();
  robotRoot.position.set(isMobile ? 0 : 1.15, 0, 0);
  scene.add(robotRoot);

  let mixer = null;
  let actions = {};
  let robot = null;
  let ready = false;

  function buildFallbackRobot() {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: 0x2a2a35,
      metalness: 0.85,
      roughness: 0.28,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      metalness: 0.6,
      roughness: 0.25,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.35,
    });
    const cyan = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      metalness: 0.5,
      roughness: 0.2,
      emissive: 0x0e7490,
      emissiveIntensity: 0.4,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.15, 0.55), metal);
    body.position.y = 1.15;
    g.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.12), accent);
    chest.position.set(0, 1.25, 0.28);
    g.add(chest);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), metal);
    head.position.y = 1.95;
    g.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.08), cyan);
    visor.position.set(0, 1.98, 0.26);
    g.add(visor);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), accent);
    antenna.position.set(0.18, 2.35, 0);
    g.add(antenna);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), cyan);
    bulb.position.set(0.18, 2.55, 0);
    g.add(bulb);

    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), metal);
      arm.position.set(side * 0.65, 1.15, 0);
      g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), accent);
      hand.position.set(side * 0.65, 0.68, 0);
      g.add(hand);

      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.28), metal);
      leg.position.set(side * 0.28, 0.45, 0);
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.42), accent);
      foot.position.set(side * 0.28, 0.06, 0.05);
      g.add(foot);
    });

    g.scale.setScalar(1.05);
    return g;
  }

  function fitRobot(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.35 / maxDim;
    object.scale.setScalar(scale);
    object.position.sub(center.multiplyScalar(scale));
    object.position.y += (size.y * scale) / 2;
  }

  const MODEL_URLS = [
    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/models/gltf/RobotExpressive/RobotExpressive.glb',
  ];

  async function loadRobot() {
    const loader = new GLTFLoader();
    let lastError = null;

    for (const url of MODEL_URLS) {
      try {
        const gltf = await loader.loadAsync(url);
        robot = gltf.scene;
        robot.traverse(obj => {
          if (obj.isMesh) {
            obj.castShadow = false;
            obj.receiveShadow = false;
            if (obj.material) {
              obj.material.envMapIntensity = 0.9;
            }
          }
        });
        fitRobot(robot);
        robotRoot.add(robot);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(robot);
          gltf.animations.forEach(clip => {
            actions[clip.name] = mixer.clipAction(clip);
          });
          // Idle / Wave / ThumbsUp if present
          const idle = actions.Idle || actions.Walking || Object.values(actions)[0];
          if (idle && !reduceMotion) {
            idle.reset().fadeIn(0.4).play();
            idle.setEffectiveTimeScale(0.55);
          }
        }

        ready = true;
        host.classList.add('is-ready');
        return;
      } catch (err) {
        lastError = err;
      }
    }

    console.warn('Robot model failed, using fallback:', lastError);
    robot = buildFallbackRobot();
    robotRoot.add(robot);
    ready = true;
    host.classList.add('is-ready');
  }

  // Scroll / pointer state
  let scrollTarget = 0;
  let scrollSmooth = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerSmoothX = 0;
  let pointerSmoothY = 0;

  function readScroll() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / max));
  }

  function onPointer(e) {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    pointerX = (x / window.innerWidth) * 2 - 1;
    pointerY = (y / window.innerHeight) * 2 - 1;
  }

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());

    scrollSmooth += (scrollTarget - scrollSmooth) * (reduceMotion ? 1 : 0.06);
    pointerSmoothX += (pointerX - pointerSmoothX) * 0.04;
    pointerSmoothY += (pointerY - pointerSmoothY) * 0.04;

    const t = scrollSmooth;
    // Orbit camera around robot as user scrolls
    const az = -0.55 + t * Math.PI * 1.35 + pointerSmoothX * 0.35;
    const el = 0.22 + Math.sin(t * Math.PI) * 0.28 - pointerSmoothY * 0.12;
    const radius = isMobile ? 4.6 : 5.1;

    const cx = Math.sin(az) * Math.cos(el) * radius + (isMobile ? 0 : 0.7);
    const cy = 1.05 + Math.sin(el) * radius * 0.55 + t * 0.35;
    const cz = Math.cos(az) * Math.cos(el) * radius;

    camera.position.set(cx, cy, cz);
    camera.lookAt(isMobile ? 0 : 0.9, 1.1 + t * 0.15, 0);

    if (robotRoot) {
      robotRoot.rotation.y = t * Math.PI * 0.85 + pointerSmoothX * 0.2;
      robotRoot.position.y = Math.sin(clock.elapsedTime * 0.8) * 0.04;
      robotRoot.rotation.z = pointerSmoothX * 0.04;
    }

    if (ring) {
      ring.rotation.z = clock.elapsedTime * 0.25;
      ring.material.opacity = 0.22 + Math.sin(clock.elapsedTime) * 0.08;
    }

    if (mixer && !reduceMotion) mixer.update(dt);

    // Subtle light drift with scroll
    rim.intensity = 14 + t * 10;
    fill.intensity = 0.4 + t * 0.35;

    renderer.render(scene, camera);
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });

  resize();
  readScroll();
  loadRobot().then(() => {
    if (reduceMotion) {
      // One static frame
      scrollSmooth = scrollTarget;
      renderer.render(scene, camera);
      return;
    }
    frame();
  });

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduceMotion && ready) {
      clock.getDelta();
      frame();
    }
  });
})();
