(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const spotlight = document.createElement('div');
  spotlight.className = 'cursor-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  document.body.prepend(canvas);
  document.body.prepend(spotlight);

  const ctx = canvas.getContext('2d');
  const orb1 = document.querySelector('.orb-1');
  const orb2 = document.querySelector('.orb-2');

  let w = 0;
  let h = 0;
  let mx = innerWidth * 0.5;
  let my = innerHeight * 0.5;
  let cx = mx;
  let cy = my;

  const particles = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: 1 + Math.random() * 1.8,
    alpha: 0.15 + Math.random() * 0.35,
    drift: 0.02 + Math.random() * 0.04,
  }));

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    mx = w * 0.5;
    my = h * 0.5;
    if (cx === 0 && cy === 0) {
      cx = mx;
      cy = my;
    }
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    document.documentElement.style.setProperty('--cursor-x', `${mx}px`);
    document.documentElement.style.setProperty('--cursor-y', `${my}px`);
  });

  document.addEventListener('mouseleave', () => {
    mx = w * 0.5;
    my = h * 0.5;
  });

  function drawGlow(x, y, radius, colorStops) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    colorStops.forEach(([stop, color]) => g.addColorStop(stop, color));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function animate() {
    cx += (mx - cx) * 0.09;
    cy += (my - cy) * 0.09;

    ctx.clearRect(0, 0, w, h);

    drawGlow(cx, cy, Math.min(w, h) * 0.35, [
      [0, 'rgba(139, 92, 246, 0.2)'],
      [0.45, 'rgba(139, 92, 246, 0.06)'],
      [1, 'transparent'],
    ]);

    drawGlow(cx - 90, cy - 70, Math.min(w, h) * 0.22, [
      [0, 'rgba(34, 211, 238, 0.14)'],
      [0.55, 'rgba(34, 211, 238, 0.04)'],
      [1, 'transparent'],
    ]);

    drawGlow(cx + 120, cy + 90, Math.min(w, h) * 0.18, [
      [0, 'rgba(244, 114, 182, 0.1)'],
      [1, 'transparent'],
    ]);

    particles.forEach(p => {
      const baseX = p.x * w;
      const baseY = p.y * h;
      const px = baseX + (cx - baseX) * p.drift;
      const py = baseY + (cy - baseY) * p.drift;

      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${p.alpha})`;
      ctx.fill();
    });

    const gridStep = 48;
    const offsetX = ((cx - w * 0.5) * 0.04) % gridStep;
    const offsetY = ((cy - h * 0.5) * 0.04) % gridStep;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = offsetX; x < w; x += gridStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = offsetY; y < h; y += gridStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    const orbShiftX = (cx / w - 0.5) * 80;
    const orbShiftY = (cy / h - 0.5) * 60;

    if (orb1) {
      orb1.style.transform = `translate(${orbShiftX}px, ${orbShiftY}px)`;
    }
    if (orb2) {
      orb2.style.transform = `translate(${-orbShiftX * 0.6}px, ${-orbShiftY * 0.5}px)`;
    }

    requestAnimationFrame(animate);
  }

  resize();
  window.addEventListener('resize', resize);
  document.documentElement.style.setProperty('--cursor-x', '50%');
  document.documentElement.style.setProperty('--cursor-y', '50%');
  animate();
})();