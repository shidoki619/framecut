/**
 * Scroll-driven 3D robot background (Three.js).
 * Full-body robot centered; cinematic camera shots blend with scroll.
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
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0f, 0.028);

  const camera = new THREE.PerspectiveCamera(isMobile ? 42 : 40, 1, 0.1, 80);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const hemi = new THREE.HemisphereLight(0xb8a4ff, 0x0a0a12, 0.8);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(3.5, 6, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x22d3ee, 0.6);
  fill.position.set(-4, 2, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(0x8b5cf6, 18, 18, 2);
  rim.position.set(0, 2.5, -3);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5, 64),
    new THREE.MeshStandardMaterial({
      color: 0x12121a,
      metalness: 0.65,
      roughness: 0.35,
      transparent: true,
      opacity: 0.5,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 1.7, 64),
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

  // Always centered in the scene
  const robotRoot = new THREE.Group();
  robotRoot.position.set(0, 0, 0);
  scene.add(robotRoot);

  // Look-at target ~ mid torso so full body stays framed
  const LOOK_Y = 1.15;

  let mixer = null;
  let actions = {};
  let robot = null;
  let ready = false;
  let robotHeight = 2.4;

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
    // Slightly larger so full body reads well in frame
    const scale = 2.55 / maxDim;
    object.scale.setScalar(scale);
    object.position.sub(center.multiplyScalar(scale));
    object.position.y += (size.y * scale) / 2;
    robotHeight = size.y * scale;
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
            if (obj.material) obj.material.envMapIntensity = 0.9;
          }
        });
        fitRobot(robot);
        robotRoot.add(robot);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(robot);
          gltf.animations.forEach(clip => {
            actions[clip.name] = mixer.clipAction(clip);
          });
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
    robotHeight = 2.5;
    ready = true;
    host.classList.add('is-ready');
  }

  /**
   * Cinematic camera shots (scroll 0 → 1).
   * pos: camera position, look: lookAt point, fov optional.
   * Robot stays centered; shots keep full body in frame with margin.
   */
  function getShots() {
    const d = isMobile ? 5.4 : 5.8; // distance for full body
    const yMid = LOOK_Y;
    return [
      // 0 Hero — front full body
      {
        at: 0,
        pos: new THREE.Vector3(0, yMid + 0.15, d),
        look: new THREE.Vector3(0, yMid, 0),
        fov: isMobile ? 42 : 40,
        robotYaw: 0,
      },
      // 1 3/4 front-left
      {
        at: 0.14,
        pos: new THREE.Vector3(-d * 0.72, yMid + 0.35, d * 0.78),
        look: new THREE.Vector3(0, yMid + 0.05, 0),
        fov: 38,
        robotYaw: 0.25,
      },
      // 2 Low hero angle (looking up)
      {
        at: 0.28,
        pos: new THREE.Vector3(d * 0.15, 0.35, d * 0.95),
        look: new THREE.Vector3(0, yMid + 0.35, 0),
        fov: 44,
        robotYaw: -0.15,
      },
      // 3 Side profile
      {
        at: 0.42,
        pos: new THREE.Vector3(d * 0.98, yMid, d * 0.12),
        look: new THREE.Vector3(0, yMid, 0),
        fov: 38,
        robotYaw: 0,
      },
      // 4 High crane / top-down-ish
      {
        at: 0.56,
        pos: new THREE.Vector3(d * 0.35, d * 0.85, d * 0.55),
        look: new THREE.Vector3(0, yMid * 0.55, 0),
        fov: 36,
        robotYaw: 0.4,
      },
      // 5 Back 3/4
      {
        at: 0.7,
        pos: new THREE.Vector3(-d * 0.55, yMid + 0.25, -d * 0.85),
        look: new THREE.Vector3(0, yMid, 0),
        fov: 40,
        robotYaw: Math.PI * 0.15,
      },
      // 6 Dramatic orbit opposite
      {
        at: 0.84,
        pos: new THREE.Vector3(d * 0.8, yMid + 0.5, -d * 0.55),
        look: new THREE.Vector3(0, yMid + 0.1, 0),
        fov: 37,
        robotYaw: -0.35,
      },
      // 7 Final front slightly closer
      {
        at: 1,
        pos: new THREE.Vector3(0.1, yMid + 0.2, d * 0.92),
        look: new THREE.Vector3(0, yMid, 0),
        fov: 39,
        robotYaw: 0,
      },
    ];
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function sampleCamera(t) {
    const shots = getShots();
    const clamped = Math.min(1, Math.max(0, t));
    let i = 0;
    while (i < shots.length - 1 && clamped > shots[i + 1].at) i += 1;
    const a = shots[i];
    const b = shots[Math.min(i + 1, shots.length - 1)];
    const span = Math.max(1e-6, b.at - a.at);
    const u = smoothstep((clamped - a.at) / span);

    const pos = a.pos.clone().lerp(b.pos, u);
    const look = a.look.clone().lerp(b.look, u);
    const fov = THREE.MathUtils.lerp(a.fov, b.fov, u);
    const robotYaw = THREE.MathUtils.lerp(a.robotYaw, b.robotYaw, u);
    return { pos, look, fov, robotYaw };
  }

  let scrollTarget = 0;
  let scrollSmooth = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerSmoothX = 0;
  let pointerSmoothY = 0;

  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();

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

    scrollSmooth += (scrollTarget - scrollSmooth) * (reduceMotion ? 1 : 0.055);
    pointerSmoothX += (pointerX - pointerSmoothX) * 0.045;
    pointerSmoothY += (pointerY - pointerSmoothY) * 0.045;

    const shot = sampleCamera(scrollSmooth);

    // Subtle pointer parallax — keep robot fully visible (small offsets)
    const parallax = isMobile ? 0.12 : 0.22;
    camPos.copy(shot.pos);
    camPos.x += pointerSmoothX * parallax;
    camPos.y += -pointerSmoothY * parallax * 0.35;

    camLook.copy(shot.look);
    camLook.x += pointerSmoothX * 0.06;
    camLook.y += -pointerSmoothY * 0.04;

    camera.position.copy(camPos);
    camera.lookAt(camLook);
    if (Math.abs(camera.fov - shot.fov) > 0.05) {
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
    }

    if (robotRoot) {
      const floatY = Math.sin(clock.elapsedTime * 0.75) * 0.035;
      robotRoot.position.set(0, floatY, 0);
      robotRoot.rotation.y = shot.robotYaw + pointerSmoothX * 0.12;
      robotRoot.rotation.z = pointerSmoothX * 0.03;
      robotRoot.rotation.x = -pointerSmoothY * 0.025;
    }

    if (ring) {
      ring.rotation.z = clock.elapsedTime * 0.22;
      ring.material.opacity = 0.22 + Math.sin(clock.elapsedTime) * 0.08;
    }

    if (mixer && !reduceMotion) mixer.update(dt);

    rim.intensity = 14 + scrollSmooth * 12;
    fill.intensity = 0.45 + scrollSmooth * 0.4;
    key.position.set(
      3.5 + Math.sin(scrollSmooth * Math.PI * 2) * 1.2,
      6,
      4 + Math.cos(scrollSmooth * Math.PI * 2) * 0.8
    );

    renderer.render(scene, camera);
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });

  resize();
  readScroll();
  loadRobot().then(() => {
    if (reduceMotion) {
      scrollSmooth = scrollTarget;
      const shot = sampleCamera(scrollSmooth);
      camera.position.copy(shot.pos);
      camera.lookAt(shot.look);
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      return;
    }
    frame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduceMotion && ready) {
      clock.getDelta();
      frame();
    }
  });
})();
