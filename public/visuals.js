(function () {
  const canvas = document.getElementById('voidCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W;
  let H;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  resize();
  window.addEventListener('resize', resize);

  const STAR_COUNT = 200;
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 1.1 + 0.15,
    baseOpacity: Math.random() * 0.38 + 0.08,
    phase: Math.random() * Math.PI * 2,
    twinkleAmt: Math.random() * 0.18,
    twinkleSpeed: Math.random() * 0.007 + 0.002,
  }));

  const PARTICLE_COUNT = 35;

  function makeParticle(randomY) {
    return {
      x: Math.random(),
      y: randomY ? Math.random() : 1.05,
      r: Math.random() * 1.6 + 0.3,
      opacity: Math.random() * 0.22 + 0.04,
      speed: Math.random() * 0.00022 + 0.00006,
      drift: (Math.random() - 0.5) * 0.00010,
      hue: Math.random() > 0.55 ? 270 : 288,
    };
  }

  const particles = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(true));
  let shootingStar = null;
  let nextShotAt = Date.now() + 7000 + Math.random() * 9000;
  let frame = 0;

  function spawnShot() {
    shootingStar = {
      x: Math.random() * 0.65,
      y: Math.random() * 0.38,
      vx: 0.007 + Math.random() * 0.006,
      vy: 0.0025 + Math.random() * 0.003,
      trail: 0.09 + Math.random() * 0.06,
      life: 1.0,
      decay: 0.018 + Math.random() * 0.012,
    };
  }

  function draw() {
    frame++;
    ctx.clearRect(0, 0, W, H);

    const now = Date.now();

    for (const s of stars) {
      const t = Math.sin(frame * s.twinkleSpeed + s.phase) * s.twinkleAmt;
      const a = Math.max(0.02, s.baseOpacity + t);
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(215, 205, 255, ${a})`;
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.y -= p.speed;
      p.x += p.drift;
      if (p.y < -0.02) {
        particles[i] = makeParticle(false);
        continue;
      }
      if (p.x < 0 || p.x > 1) p.drift *= -1;

      const px = p.x * W;
      const py = p.y * H;
      const gr = ctx.createRadialGradient(px, py, 0, px, py, p.r * 6);
      gr.addColorStop(0, `hsla(${p.hue}, 70%, 72%, ${p.opacity})`);
      gr.addColorStop(1, `hsla(${p.hue}, 70%, 72%, 0)`);
      ctx.beginPath();
      ctx.arc(px, py, p.r * 6, 0, Math.PI * 2);
      ctx.fillStyle = gr;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 85%, 82%, ${Math.min(1, p.opacity * 2.5)})`;
      ctx.fill();
    }

    if (!shootingStar && now > nextShotAt) {
      spawnShot();
      nextShotAt = now + 8000 + Math.random() * 14000;
    }

    if (shootingStar) {
      const ss = shootingStar;
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life -= ss.decay;

      if (ss.life <= 0 || ss.x > 1.1 || ss.y > 1.1) {
        shootingStar = null;
      } else {
        const x1 = ss.x * W;
        const y1 = ss.y * H;
        const x0 = (ss.x - ss.vx * ss.trail * 10) * W;
        const y0 = (ss.y - ss.vy * ss.trail * 10) * H;

        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(139, 92, 246, 0)');
        g.addColorStop(0.6, `rgba(192, 132, 252, ${ss.life * 0.45})`);
        g.addColorStop(1, `rgba(255, 255, 255, ${ss.life * 0.85})`);

        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const tg = ctx.createRadialGradient(x1, y1, 0, x1, y1, 4);
        tg.addColorStop(0, `rgba(255, 255, 255, ${ss.life * 0.9})`);
        tg.addColorStop(1, 'rgba(192, 132, 252, 0)');
        ctx.beginPath();
        ctx.arc(x1, y1, 4, 0, Math.PI * 2);
        ctx.fillStyle = tg;
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  draw();
})();

(function () {
  const WAVEFORM_HTML =
    '<div class="waveform" aria-hidden="true">' +
    '<div class="waveform-bar"></div>'.repeat(5) +
    '</div>';

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.type !== 'attributes' || m.attributeName !== 'class') return;
      const el = m.target;
      if (!el.classList.contains('feed-item')) return;
      const num = el.querySelector('.feed-item-num');
      if (!num) return;

      if (el.classList.contains('speaking')) {
        if (!num.dataset.orig) num.dataset.orig = num.innerHTML;
        num.innerHTML = WAVEFORM_HTML;
      } else if (num.dataset.orig) {
        num.innerHTML = num.dataset.orig;
        delete num.dataset.orig;
      }
    });
  });

  function attachObserver() {
    const feedList = document.getElementById('feedList');
    if (!feedList) {
      setTimeout(attachObserver, 200);
      return;
    }
    observer.observe(feedList, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  attachObserver();
})();
