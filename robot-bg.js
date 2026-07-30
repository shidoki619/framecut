/**
 * Cartoon 3D robot — right side of screen, face always visible,
 * dark smooth body, head tracks cursor. Content lives on the left.
 */
import * as THREE from 'three';

(() => {
  const host = document.getElementById('robotBg');
  const canvas = document.getElementById('robotCanvas');
  if (!host || !canvas) return;

  document.body.classList.add('has-robot-bg');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => window.matchMedia('(max-width: 768px)').matches
    || window.matchMedia('(pointer: coarse)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.75 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);

  // Soft cartoon lighting
  scene.add(new THREE.HemisphereLight(0xc4b5fd, 0x1a1a24, 0.95));

  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(2.5, 5, 4);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x67e8f9, 0.45);
  fill.position.set(-3, 2, 2);
  scene.add(fill);

  const rim = new THREE.PointLight(0xa78bfa, 12, 14, 2);
  rim.position.set(1.5, 2.2, -2.5);
  scene.add(rim);

  // Materials — dark, smooth, toon
  const bodyMat = new THREE.MeshToonMaterial({ color: 0x1a1a22 });
  const bodyDarkMat = new THREE.MeshToonMaterial({ color: 0x121218 });
  const jointMat = new THREE.MeshToonMaterial({ color: 0x2a2a36 });
  const accentMat = new THREE.MeshToonMaterial({
    color: 0x6d28d9,
    emissive: 0x4c1d95,
    emissiveIntensity: 0.25,
  });
  const faceMat = new THREE.MeshToonMaterial({ color: 0x252530 });
  const eyeMat = new THREE.MeshToonMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 0.85,
  });
  const cheekMat = new THREE.MeshToonMaterial({
    color: 0xf472b6,
    emissive: 0xbe185d,
    emissiveIntensity: 0.2,
  });
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x0a0a0f,
    side: THREE.BackSide,
  });

  function toonMesh(geo, mat, outlineScale = 1.055) {
    const mesh = new THREE.Mesh(geo, mat);
    const outline = new THREE.Mesh(geo, outlineMat);
    outline.scale.setScalar(outlineScale);
    outline.renderOrder = -1;
    mesh.add(outline);
    return mesh;
  }

  /** Build a smooth cartoon robot with separate head for look-at */
  function buildCartoonRobot() {
    const root = new THREE.Group();

    // Legs
    const legGeo = new THREE.CapsuleGeometry(0.18, 0.55, 6, 12);
    const footGeo = new THREE.CapsuleGeometry(0.16, 0.12, 4, 10);
    [-1, 1].forEach(side => {
      const leg = toonMesh(legGeo, bodyDarkMat, 1.06);
      leg.position.set(side * 0.28, 0.48, 0);
      root.add(leg);
      const foot = toonMesh(footGeo, jointMat, 1.07);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(side * 0.28, 0.1, 0.12);
      root.add(foot);
    });

    // Torso — rounded dark body
    const torso = toonMesh(new THREE.CapsuleGeometry(0.52, 0.55, 8, 16), bodyMat, 1.05);
    torso.position.y = 1.25;
    root.add(torso);

    // Belly panel
    const panel = toonMesh(new THREE.SphereGeometry(0.28, 20, 16), jointMat, 1.04);
    panel.scale.set(1, 0.85, 0.35);
    panel.position.set(0, 1.15, 0.38);
    root.add(panel);

    // Chest accent
    const chest = toonMesh(new THREE.SphereGeometry(0.16, 16, 12), accentMat, 1.08);
    chest.scale.set(1.4, 0.7, 0.4);
    chest.position.set(0, 1.42, 0.42);
    root.add(chest);

    // Arms
    const armGeo = new THREE.CapsuleGeometry(0.13, 0.5, 6, 12);
    const handGeo = new THREE.SphereGeometry(0.15, 14, 12);
    [-1, 1].forEach(side => {
      const shoulder = toonMesh(new THREE.SphereGeometry(0.16, 12, 10), jointMat, 1.08);
      shoulder.position.set(side * 0.62, 1.55, 0);
      root.add(shoulder);

      const arm = toonMesh(armGeo, bodyDarkMat, 1.06);
      arm.position.set(side * 0.72, 1.15, 0.05);
      arm.rotation.z = side * 0.18;
      root.add(arm);

      const hand = toonMesh(handGeo, jointMat, 1.07);
      hand.position.set(side * 0.78, 0.78, 0.08);
      root.add(hand);
    });

    // Neck
    const neck = toonMesh(new THREE.CapsuleGeometry(0.12, 0.12, 4, 10), jointMat, 1.08);
    neck.position.y = 1.82;
    root.add(neck);

    // —— Head (tracks cursor) ——
    const head = new THREE.Group();
    head.position.set(0, 2.12, 0);
    root.add(head);

    const skull = toonMesh(new THREE.SphereGeometry(0.42, 28, 22), bodyMat, 1.05);
    skull.scale.set(1.05, 1, 0.95);
    head.add(skull);

    // Face plate — always the “front”
    const face = toonMesh(new THREE.SphereGeometry(0.34, 24, 18), faceMat, 1.03);
    face.scale.set(0.95, 0.9, 0.45);
    face.position.set(0, -0.02, 0.28);
    head.add(face);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.09, 16, 12);
    const leftEye = toonMesh(eyeGeo, eyeMat, 1.12);
    leftEye.position.set(-0.14, 0.04, 0.4);
    leftEye.scale.set(1, 1.15, 0.6);
    head.add(leftEye);

    const rightEye = toonMesh(eyeGeo, eyeMat, 1.12);
    rightEye.position.set(0.14, 0.04, 0.4);
    rightEye.scale.set(1, 1.15, 0.6);
    head.add(rightEye);

    // Pupils (small dark)
    const pupilMat = new THREE.MeshToonMaterial({ color: 0x0a0a12 });
    [-0.14, 0.14].forEach(x => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), pupilMat);
      p.position.set(x, 0.04, 0.46);
      head.add(p);
    });

    // Smile
    const smile = toonMesh(
      new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI),
      accentMat,
      1.15
    );
    smile.position.set(0, -0.14, 0.4);
    smile.rotation.x = Math.PI;
    smile.rotation.z = Math.PI;
    head.add(smile);

    // Cheeks
    [-1, 1].forEach(side => {
      const cheek = toonMesh(new THREE.SphereGeometry(0.055, 10, 8), cheekMat, 1.1);
      cheek.position.set(side * 0.28, -0.06, 0.36);
      head.add(cheek);
    });

    // Antenna
    const ant = toonMesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 8), jointMat, 1.15);
    ant.position.set(0.12, 0.48, 0);
    head.add(ant);
    const bulb = toonMesh(new THREE.SphereGeometry(0.08, 12, 10), eyeMat, 1.15);
    bulb.position.set(0.12, 0.64, 0);
    head.add(bulb);

    // Ears / headphones
    [-1, 1].forEach(side => {
      const ear = toonMesh(new THREE.SphereGeometry(0.14, 12, 10), accentMat, 1.1);
      ear.scale.set(0.55, 0.9, 0.7);
      ear.position.set(side * 0.44, 0.05, 0);
      head.add(ear);
    });

    root.userData.head = head;
    root.userData.leftEye = leftEye;
    root.userData.rightEye = rightEye;
    return root;
  }

  const robotRoot = new THREE.Group();
  scene.add(robotRoot);

  const robot = buildCartoonRobot();
  robotRoot.add(robot);
  const head = robot.userData.head;

  // Soft ground under robot
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.2, 48),
    new THREE.MeshToonMaterial({
      color: 0x14141c,
      transparent: true,
      opacity: 0.55,
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  robotRoot.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.35, 1.48, 48),
    new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  robotRoot.add(ring);

  // Pointer + scroll
  let scrollTarget = 0;
  let scrollSmooth = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerSmoothX = 0;
  let pointerSmoothY = 0;

  const lookTarget = new THREE.Vector3();
  const headWorld = new THREE.Vector3();
  const desiredHeadQuat = new THREE.Quaternion();
  const baseHeadQuat = new THREE.Quaternion();
  head.getWorldQuaternion(baseHeadQuat);

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

  function placeRobotAndCamera() {
    const mobile = isMobile();
    // Robot on the RIGHT (desktop), centered on mobile
    robotRoot.position.set(mobile ? 0 : 1.55, 0, 0);
    robotRoot.scale.setScalar(mobile ? 0.95 : 1.08);
    // Face camera (user) — slight turn toward center/content
    robotRoot.rotation.set(0, mobile ? 0 : -0.22, 0);

    // Camera: full body + face always in view, looking from front-left of robot
    if (mobile) {
      camera.position.set(0, 1.35, 5.6);
      camera.lookAt(0, 1.2, 0);
      camera.fov = 40;
    } else {
      camera.position.set(-0.15, 1.4, 5.5);
      camera.lookAt(1.55, 1.25, 0);
      camera.fov = 36;
    }
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    renderer.setSize(w, h, false);
    placeRobotAndCamera();
  }

  function updateHeadLook() {
    if (!head) return;

    head.getWorldPosition(headWorld);

    // Point in front of head toward cursor (screen → world-ish)
    const reach = 2.8;
    lookTarget.set(
      headWorld.x + pointerSmoothX * reach * 1.1,
      headWorld.y - pointerSmoothY * reach * 0.75 + 0.1,
      headWorld.z + reach * 0.95
    );

    // Build look orientation without rolling
    const tmp = new THREE.Object3D();
    tmp.position.copy(headWorld);
    tmp.lookAt(lookTarget);

    desiredHeadQuat.copy(tmp.quaternion);

    // Limit how far head turns (keeps face mostly toward camera)
    const e = new THREE.Euler().setFromQuaternion(desiredHeadQuat, 'YXZ');
    e.x = THREE.MathUtils.clamp(e.x, -0.45, 0.4);
    e.y = THREE.MathUtils.clamp(e.y, -0.75, 0.75);
    e.z = 0;
    desiredHeadQuat.setFromEuler(e);

    // Smooth blend into local head rotation (parent already rotated)
    // Convert world desired to local relative to robotRoot
    const parentQ = new THREE.Quaternion();
    robotRoot.getWorldQuaternion(parentQ);
    const localQ = parentQ.clone().invert().multiply(desiredHeadQuat);

    const le = new THREE.Euler().setFromQuaternion(localQ, 'YXZ');
    le.x = THREE.MathUtils.clamp(le.x, -0.4, 0.35);
    le.y = THREE.MathUtils.clamp(le.y, -0.65, 0.65);
    le.z = THREE.MathUtils.clamp(le.z * 0.15, -0.08, 0.08);

    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, le.x, 0.12);
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, le.y, 0.12);
    head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, le.z, 0.1);
  }

  const clock = new THREE.Clock();
  let raf = 0;

  function frame() {
    raf = requestAnimationFrame(frame);
    const t = clock.elapsedTime;

    scrollSmooth += (scrollTarget - scrollSmooth) * (reduceMotion ? 1 : 0.05);
    pointerSmoothX += (pointerX - pointerSmoothX) * 0.1;
    pointerSmoothY += (pointerY - pointerSmoothY) * 0.1;

    // Idle float + gentle bob (face still forward)
    const bob = Math.sin(t * 1.1) * 0.04;
    robot.position.y = bob;
    robot.rotation.z = Math.sin(t * 0.7) * 0.02;
    // Slight body lean with scroll — never turns back
    robot.rotation.y = THREE.MathUtils.lerp(
      robot.rotation.y,
      Math.sin(scrollSmooth * Math.PI) * 0.12,
      0.04
    );

    if (!reduceMotion) updateHeadLook();

    ring.rotation.z = t * 0.2;
    ring.material.opacity = 0.28 + Math.sin(t) * 0.08;

    // Subtle camera parallax with scroll (stay in front)
    const mobile = isMobile();
    if (mobile) {
      camera.position.x = pointerSmoothX * 0.15;
      camera.position.y = 1.35 + scrollSmooth * 0.12 - pointerSmoothY * 0.08;
      camera.lookAt(0, 1.2 + bob * 0.3, 0);
    } else {
      camera.position.x = -0.15 + pointerSmoothX * 0.12;
      camera.position.y = 1.4 + scrollSmooth * 0.15 - pointerSmoothY * 0.1;
      camera.position.z = 5.5 - scrollSmooth * 0.25;
      camera.lookAt(1.55 + pointerSmoothX * 0.05, 1.25 + bob * 0.2, 0);
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('touchmove', onPointer, { passive: true });

  resize();
  readScroll();
  host.classList.add('is-ready');

  if (reduceMotion) {
    renderer.render(scene, camera);
  } else {
    frame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else if (!reduceMotion) {
      clock.getDelta();
      frame();
    }
  });
})();
