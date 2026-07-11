(function () {
  const canvas = document.getElementById("simCanvas");
  const select = document.getElementById("demoSelect");
  const controlsRoot = document.getElementById("demoControls");
  const statsEl = document.getElementById("stats");
  if (!canvas || !select || !controlsRoot || !statsEl) return;

  const ctx = canvas.getContext("2d");
  const app = {
    ctx,
    canvas,
    width: 0,
    height: 0,
    dpr: Math.max(1, window.devicePixelRatio || 1),
    pointer: { x: 0, y: 0, down: false, id: null }
  };

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    app.width = Math.max(320, Math.floor(rect.width));
    app.height = Math.max(360, Math.floor(window.innerHeight * 0.62));
    canvas.width = Math.floor(app.width * app.dpr);
    canvas.height = Math.floor(app.height * app.dpr);
    canvas.style.width = `${app.width}px`;
    canvas.style.height = `${app.height}px`;
    ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
    if (activeDemo && activeDemo.resize) activeDemo.resize(app);
  }

  function pointerPos(evt) {
    const rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (evt) => {
    const p = pointerPos(evt);
    app.pointer.x = p.x;
    app.pointer.y = p.y;
    app.pointer.down = true;
    app.pointer.id = evt.pointerId;
    canvas.setPointerCapture(evt.pointerId);
    if (activeDemo && activeDemo.onPointerDown) activeDemo.onPointerDown(app, p);
  });

  canvas.addEventListener("pointermove", (evt) => {
    const p = pointerPos(evt);
    app.pointer.x = p.x;
    app.pointer.y = p.y;
    if (activeDemo && activeDemo.onPointerMove) activeDemo.onPointerMove(app, p);
  });

  canvas.addEventListener("pointerup", (evt) => {
    const p = pointerPos(evt);
    app.pointer.x = p.x;
    app.pointer.y = p.y;
    app.pointer.down = false;
    if (app.pointer.id !== null) {
      canvas.releasePointerCapture(app.pointer.id);
      app.pointer.id = null;
    }
    if (activeDemo && activeDemo.onPointerUp) activeDemo.onPointerUp(app, p);
  });

  function clearControls() {
    controlsRoot.innerHTML = "";
  }

  function addRange({ label, min, max, step, value, onInput }) {
    const wrap = document.createElement("label");
    wrap.className = "ctrl";

    const span = document.createElement("span");
    span.textContent = label;

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(value);

    const out = document.createElement("output");
    out.textContent = String(value);

    input.addEventListener("input", () => {
      const v = Number(input.value);
      out.textContent = input.step.includes(".") ? v.toFixed(Math.min(4, (input.step.split(".")[1] || "").length)) : String(v);
      onInput(v);
    });

    wrap.appendChild(span);
    wrap.appendChild(input);
    wrap.appendChild(out);
    controlsRoot.appendChild(wrap);
  }

  function addButton(label, onClick, ghost) {
    const btn = document.createElement("button");
    btn.className = ghost ? "btn btn-ghost" : "btn";
    btn.textContent = label;
    btn.type = "button";
    btn.addEventListener("click", onClick);
    controlsRoot.appendChild(btn);
    return btn;
  }

  function addHelp(text) {
    const p = document.createElement("p");
    p.className = "demo-help";
    p.textContent = text;
    controlsRoot.appendChild(p);
  }

  function paintBackground() {
    ctx.clearRect(0, 0, app.width, app.height);
    const g = ctx.createLinearGradient(0, 0, app.width, app.height);
    g.addColorStop(0, "rgba(53, 199, 255, 0.08)");
    g.addColorStop(1, "rgba(89, 241, 199, 0.03)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, app.width, app.height);
  }

  function createRopeDemo() {
    const sim = {
      points: [],
      constraints: [],
      gravity: 1400,
      iterations: 10,
      compliance: 0.0002,
      damping: 0.995,
      pointCount: 28
    };
    let dragIndex = -1;

    function makePoint(x, y, pinned) {
      return { x, y, px: x, py: y, invMass: pinned ? 0 : 1, radius: 5 };
    }

    function reset() {
      sim.points = [];
      sim.constraints = [];
      const count = Math.max(8, sim.pointCount);
      const spacing = Math.min(28, app.width / (count + 3));
      const startX = app.width * 0.18;
      const startY = 70;

      for (let i = 0; i < count; i += 1) {
        const p = makePoint(startX + i * spacing, startY + i * 0.2, i === 0 || i === 1);
        sim.points.push(p);
        if (i > 0) sim.constraints.push({ a: i - 1, b: i, rest: spacing, lambda: 0 });
      }

      const end = sim.points[sim.points.length - 1];
      end.radius = 9;
      end.invMass = 0.35;
    }

    function update(dt) {
      const dtSq = dt * dt;

      for (let i = 0; i < sim.points.length; i += 1) {
        const p = sim.points[i];
        if (p.invMass === 0) continue;
        const vx = (p.x - p.px) * sim.damping;
        const vy = (p.y - p.py) * sim.damping;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + sim.gravity * dtSq;
      }

      if (dragIndex >= 0 && app.pointer.down) {
        const p = sim.points[dragIndex];
        p.x = app.pointer.x;
        p.y = app.pointer.y;
        p.px = p.x;
        p.py = p.y;
      }

      for (let c = 0; c < sim.constraints.length; c += 1) sim.constraints[c].lambda = 0;

      for (let it = 0; it < sim.iterations; it += 1) {
        for (let c = 0; c < sim.constraints.length; c += 1) {
          const cons = sim.constraints[c];
          const p1 = sim.points[cons.a];
          const p2 = sim.points[cons.b];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 1e-7) continue;

          const C = len - cons.rest;
          const nX = dx / len;
          const nY = dy / len;
          const w1 = p1.invMass;
          const w2 = p2.invMass;
          const w = w1 + w2;
          if (w <= 0) continue;

          const alpha = sim.compliance / dtSq;
          const dlambda = (-C - alpha * cons.lambda) / (w + alpha);
          cons.lambda += dlambda;

          const cx = dlambda * nX;
          const cy = dlambda * nY;
          if (w1 > 0) {
            p1.x -= cx * w1;
            p1.y -= cy * w1;
          }
          if (w2 > 0) {
            p2.x += cx * w2;
            p2.y += cy * w2;
          }
        }

        for (let i = 0; i < sim.points.length; i += 1) {
          const p = sim.points[i];
          if (p.invMass === 0) continue;
          if (p.x < p.radius) p.x = p.radius;
          if (p.x > app.width - p.radius) p.x = app.width - p.radius;
          if (p.y < p.radius) p.y = p.radius;
          if (p.y > app.height - p.radius) p.y = app.height - p.radius;
        }
      }
    }

    function render() {
      paintBackground();

      ctx.strokeStyle = "rgba(83,190,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < sim.constraints.length; i += 1) {
        const c = sim.constraints[i];
        const a = sim.points[c.a];
        const b = sim.points[c.b];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();

      for (let i = 0; i < sim.points.length; i += 1) {
        const p = sim.points[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.invMass === 0 ? "#59f1c7" : "#e9eefc";
        ctx.fill();
      }
    }

    function nearestPoint(x, y, radius) {
      let best = -1;
      let bestD = radius;
      for (let i = 0; i < sim.points.length; i += 1) {
        const p = sim.points[i];
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          best = i;
          bestD = d;
        }
      }
      return best;
    }

    return {
      init() {
        reset();
      },
      resize() {
        reset();
      },
      update,
      render,
      onPointerDown(_, p) {
        dragIndex = nearestPoint(p.x, p.y, 18);
      },
      onPointerUp() {
        dragIndex = -1;
      },
      getStats(fps) {
        return `rope | points=${sim.points.length} constraints=${sim.constraints.length} fps=${fps}`;
      },
      buildControls() {
        addRange({ label: "Points", min: 8, max: 160, step: 1, value: sim.pointCount, onInput: (v) => { sim.pointCount = v; reset(); } });
        addRange({ label: "Gravity", min: 0, max: 3000, step: 10, value: sim.gravity, onInput: (v) => { sim.gravity = v; } });
        addRange({ label: "Iterations", min: 1, max: 40, step: 1, value: sim.iterations, onInput: (v) => { sim.iterations = v; } });
        addRange({ label: "Compliance", min: 0, max: 0.01, step: 0.0001, value: sim.compliance, onInput: (v) => { sim.compliance = v; } });
        addRange({ label: "Damping", min: 0.90, max: 1.00, step: 0.001, value: sim.damping, onInput: (v) => { sim.damping = v; } });
        addButton("Reset", reset, false);
      },
      dispose() {}
    };
  }


  function createGoLDemo() {
    const p = {
      w: 256,
      h: 144,
      cell: 5,
      stepsPerFrame: 2,
      density: 0.23
    };

    let wordsPerRow = 0;
    let board = null;
    let next = null;

    function idx(y, word) {
      return y * wordsPerRow + word;
    }

    function alloc() {
      wordsPerRow = Math.ceil(p.w / 32);
      board = new Uint32Array(wordsPerRow * p.h);
      next = new Uint32Array(wordsPerRow * p.h);
    }

    function getCell(arr, x, y) {
      let xx = x;
      let yy = y;
      if (xx < 0) xx += p.w;
      if (xx >= p.w) xx -= p.w;
      if (yy < 0) yy += p.h;
      if (yy >= p.h) yy -= p.h;
      const word = xx >>> 5;
      const bit = xx & 31;
      return (arr[idx(yy, word)] >>> bit) & 1;
    }

    function setCell(arr, x, y, v) {
      const word = x >>> 5;
      const bit = x & 31;
      const i = idx(y, word);
      if (v) arr[i] |= (1 << bit);
      else arr[i] &= ~(1 << bit);
    }

    function randomize() {
      board.fill(0);
      for (let y = 0; y < p.h; y += 1) {
        for (let x = 0; x < p.w; x += 1) {
          if (Math.random() < p.density) setCell(board, x, y, 1);
        }
      }
    }

    function stepOne() {
      next.fill(0);
      for (let y = 0; y < p.h; y += 1) {
        for (let x = 0; x < p.w; x += 1) {
          let n = 0;
          n += getCell(board, x - 1, y - 1);
          n += getCell(board, x, y - 1);
          n += getCell(board, x + 1, y - 1);
          n += getCell(board, x - 1, y);
          n += getCell(board, x + 1, y);
          n += getCell(board, x - 1, y + 1);
          n += getCell(board, x, y + 1);
          n += getCell(board, x + 1, y + 1);

          const alive = getCell(board, x, y);
          const out = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
          if (out) setCell(next, x, y, 1);
        }
      }
      const temp = board;
      board = next;
      next = temp;
    }

    function update() {
      for (let i = 0; i < p.stepsPerFrame; i += 1) stepOne();
    }

    function render() {
      paintBackground();

      const gridW = p.w * p.cell;
      const gridH = p.h * p.cell;
      const ox = Math.floor((app.width - gridW) * 0.5);
      const oy = Math.floor((app.height - gridH) * 0.5);

      ctx.fillStyle = "rgba(8,12,22,0.9)";
      ctx.fillRect(ox, oy, gridW, gridH);

      ctx.fillStyle = "rgba(90,230,255,0.9)";
      for (let y = 0; y < p.h; y += 1) {
        for (let x = 0; x < p.w; x += 1) {
          if (getCell(board, x, y)) ctx.fillRect(ox + x * p.cell, oy + y * p.cell, p.cell - 1, p.cell - 1);
        }
      }
    }

    return {
      init() {
        alloc();
        randomize();
      },
      resize() {
        const maxCell = Math.max(2, Math.floor(Math.min(app.width / p.w, app.height / p.h)));
        p.cell = Math.min(6, maxCell);
      },
      update,
      render,
      onPointerDown(_, pos) {
        const gridW = p.w * p.cell;
        const gridH = p.h * p.cell;
        const ox = Math.floor((app.width - gridW) * 0.5);
        const oy = Math.floor((app.height - gridH) * 0.5);
        const x = Math.floor((pos.x - ox) / p.cell);
        const y = Math.floor((pos.y - oy) / p.cell);
        if (x >= 0 && x < p.w && y >= 0 && y < p.h) {
          const alive = getCell(board, x, y);
          setCell(board, x, y, alive ? 0 : 1);
        }
      },
      getStats(fps) {
        return `gol bit-packed | ${p.w}x${p.h} steps/frame=${p.stepsPerFrame} fps=${fps}`;
      },
      buildControls() {
        addRange({ label: "Steps / frame", min: 1, max: 12, step: 1, value: p.stepsPerFrame, onInput: (v) => { p.stepsPerFrame = v; } });
        addRange({ label: "Initial density", min: 0.05, max: 0.60, step: 0.01, value: p.density, onInput: (v) => { p.density = v; } });
        addButton("Randomize", randomize, false);
        addHelp("Version bit-packed (stockage compact en bits), pratique pour montrer le principe bitslice-like.");
      },
      dispose() {}
    };
  }

  function createBeamDemo() {
    const p = {
      n: 24,
      iterations: 14,
      damping: 0.996,
      gravity: 900,
      stretchComp: 0.00002,
      bendComp: 0.0009,
      shearComp: 0.0005,
      endLoad: 700
    };

    let nodes = [];
    let stretch = [];
    let drag = -1;

    function makeNode(x, y, pin) {
      return { x, y, px: x, py: y, invMass: pin ? 0 : 1, r: 4 };
    }

    function reset() {
      nodes = [];
      stretch = [];
      const L = Math.min(28, app.width * 0.65 / (p.n - 1));
      const sx = app.width * 0.14;
      const sy = app.height * 0.34;

      for (let i = 0; i < p.n; i += 1) {
        const pin = i === 0 || i === 1;
        nodes.push(makeNode(sx + i * L, sy, pin));
        if (i > 0) stretch.push({ a: i - 1, b: i, rest: L, lambda: 0 });
      }
    }

    function solveStretch(dtSq) {
      for (let i = 0; i < stretch.length; i += 1) stretch[i].lambda = 0;
      for (let i = 0; i < stretch.length; i += 1) {
        const c = stretch[i];
        const a = nodes[c.a];
        const b = nodes[c.b];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len < 1e-7) continue;

        const C = len - c.rest;
        const nX = dx / len;
        const nY = dy / len;
        const w = a.invMass + b.invMass;
        if (w <= 0) continue;

        const alpha = p.stretchComp / dtSq;
        const dl = (-C - alpha * c.lambda) / (w + alpha);
        c.lambda += dl;

        if (a.invMass > 0) {
          a.x -= dl * nX * a.invMass;
          a.y -= dl * nY * a.invMass;
        }
        if (b.invMass > 0) {
          b.x += dl * nX * b.invMass;
          b.y += dl * nY * b.invMass;
        }
      }
    }

    function solveBending(dtSq) {
      for (let i = 1; i < nodes.length - 1; i += 1) {
        const p0 = nodes[i - 1];
        const p1 = nodes[i];
        const p2 = nodes[i + 1];

        const C = (p0.y - 2 * p1.y + p2.y);
        const w0 = p0.invMass;
        const w1 = p1.invMass;
        const w2 = p2.invMass;
        const denom = w0 + 4 * w1 + w2;
        if (denom <= 0) continue;

        const alpha = p.bendComp / dtSq;
        const dl = (-C) / (denom + alpha);

        if (w0 > 0) p0.y += dl * w0;
        if (w1 > 0) p1.y -= 2 * dl * w1;
        if (w2 > 0) p2.y += dl * w2;
      }
    }

    function solveShear(dtSq) {
      // Timoshenko-inspired: penalise local slope jump (shear-like term).
      for (let i = 0; i < nodes.length - 1; i += 1) {
        const a = nodes[i];
        const b = nodes[i + 1];
        const C = (b.y - a.y);
        const w = a.invMass + b.invMass;
        if (w <= 0) continue;

        const alpha = p.shearComp / dtSq;
        const dl = (-C) / (w + alpha);
        if (a.invMass > 0) a.y -= dl * a.invMass;
        if (b.invMass > 0) b.y += dl * b.invMass;
      }
    }

    function update(dt) {
      const dtSq = dt * dt;

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n.invMass === 0) continue;
        const vx = (n.x - n.px) * p.damping;
        const vy = (n.y - n.py) * p.damping;
        n.px = n.x;
        n.py = n.y;
        n.x += vx;
        n.y += vy + p.gravity * dtSq;
      }

      const end = nodes[nodes.length - 1];
      if (end && end.invMass > 0) end.y += p.endLoad * dtSq * 0.002;

      if (drag >= 0 && app.pointer.down) {
        const d = nodes[drag];
        d.x = app.pointer.x;
        d.y = app.pointer.y;
        d.px = d.x;
        d.py = d.y;
      }

      for (let it = 0; it < p.iterations; it += 1) {
        solveStretch(dtSq);
        solveShear(dtSq);
        solveBending(dtSq);

        for (let i = 0; i < nodes.length; i += 1) {
          const n = nodes[i];
          if (n.invMass === 0) continue;
          if (n.x < n.r) n.x = n.r;
          if (n.x > app.width - n.r) n.x = app.width - n.r;
          if (n.y < n.r) n.y = n.r;
          if (n.y > app.height - n.r) n.y = app.height - n.r;
        }
      }
    }

    function render() {
      paintBackground();

      ctx.strokeStyle = "rgba(83,190,255,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < nodes.length - 1; i += 1) {
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[i + 1].x, nodes[i + 1].y);
      }
      ctx.stroke();

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.invMass === 0 ? "#59f1c7" : "#e9eefc";
        ctx.fill();
      }
    }

    return {
      init() { reset(); },
      resize() { reset(); },
      update,
      render,
      onPointerDown(_, pos) {
        let best = -1;
        let d0 = 16;
        for (let i = 0; i < nodes.length; i += 1) {
          const d = Math.hypot(nodes[i].x - pos.x, nodes[i].y - pos.y);
          if (d < d0) {
            d0 = d;
            best = i;
          }
        }
        drag = best;
      },
      onPointerUp() { drag = -1; },
      getStats(fps) {
        return `beam xpbd | nodes=${nodes.length} iterations=${p.iterations} fps=${fps}`;
      },
      buildControls() {
        addRange({ label: "Nodes", min: 8, max: 80, step: 1, value: p.n, onInput: (v) => { p.n = v; reset(); } });
        addRange({ label: "Iterations", min: 2, max: 40, step: 1, value: p.iterations, onInput: (v) => { p.iterations = v; } });
        addRange({ label: "Stretch compliance", min: 0, max: 0.002, step: 0.00001, value: p.stretchComp, onInput: (v) => { p.stretchComp = v; } });
        addRange({ label: "Bend compliance", min: 0, max: 0.01, step: 0.0001, value: p.bendComp, onInput: (v) => { p.bendComp = v; } });
        addRange({ label: "Shear compliance", min: 0, max: 0.01, step: 0.0001, value: p.shearComp, onInput: (v) => { p.shearComp = v; } });
        addRange({ label: "Tip load", min: 0, max: 2000, step: 10, value: p.endLoad, onInput: (v) => { p.endLoad = v; } });
        addButton("Reset beam", reset, false);
        addHelp("Modele Timoshenko-inspire simplifie pour demo web: stretch + shear-like + bending.");
      },
      dispose() {}
    };
  }
function createMurmurationDemo() {
  const p = {
    count: 180,
    viewRadius: 52,
    sepRadius: 20,
    alignWeight: 0.75,
    cohWeight: 0.45,
    sepWeight: 1.35,
    maxSpeed: 145,
    maxForce: 62,
    edgeTurn: 1.15,
    trail: 0.18
  };

  let boids = [];
  let attract = false;

  function reset() {
    boids = [];
    for (let i = 0; i < p.count; i += 1) {
      boids.push({
        x: Math.random() * app.width,
        y: Math.random() * app.height,
        vx: (Math.random() * 2 - 1) * 55,
        vy: (Math.random() * 2 - 1) * 55
      });
    }
  }

  function limitVec(x, y, maxLen) {
    const m = Math.hypot(x, y);
    if (m < 1e-7 || m <= maxLen) return { x, y };
    const s = maxLen / m;
    return { x: x * s, y: y * s };
  }

  function update(dt) {
    const view2 = p.viewRadius * p.viewRadius;
    const sep2 = p.sepRadius * p.sepRadius;

    for (let i = 0; i < boids.length; i += 1) {
      const b = boids[i];

      let ax = 0;
      let ay = 0;
      let cx = 0;
      let cy = 0;
      let sx = 0;
      let sy = 0;
      let n = 0;

      for (let j = 0; j < boids.length; j += 1) {
        if (i === j) continue;
        const o = boids[j];
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > view2) continue;

        n += 1;
        ax += o.vx;
        ay += o.vy;
        cx += o.x;
        cy += o.y;

        if (d2 < sep2) {
          const d = Math.sqrt(d2) + 1e-6;
          sx -= dx / d;
          sy -= dy / d;
        }
      }

      let fx = 0;
      let fy = 0;

      if (n > 0) {
        // Alignement
        ax /= n;
        ay /= n;
        const align = limitVec(ax - b.vx, ay - b.vy, p.maxForce);
        fx += align.x * p.alignWeight;
        fy += align.y * p.alignWeight;

        // Cohesion
        cx /= n;
        cy /= n;
        const coh = limitVec(cx - b.x, cy - b.y, p.maxForce);
        fx += coh.x * p.cohWeight;
        fy += coh.y * p.cohWeight;

        // Separation
        const sep = limitVec(sx, sy, p.maxForce);
        fx += sep.x * p.sepWeight;
        fy += sep.y * p.sepWeight;
      }

      // Attraction souris (maintenir clic)
      if (attract && app.pointer.down) {
        const mx = app.pointer.x - b.x;
        const my = app.pointer.y - b.y;
        const m = limitVec(mx, my, p.maxForce);
        fx += m.x * 0.85;
        fy += m.y * 0.85;
      }

      // Evitement bords
      const margin = 46;
      if (b.x < margin) fx += p.maxForce * p.edgeTurn;
      if (b.x > app.width - margin) fx -= p.maxForce * p.edgeTurn;
      if (b.y < margin) fy += p.maxForce * p.edgeTurn;
      if (b.y > app.height - margin) fy -= p.maxForce * p.edgeTurn;

      const f = limitVec(fx, fy, p.maxForce);
      b.vx += f.x * dt;
      b.vy += f.y * dt;

      const v = limitVec(b.vx, b.vy, p.maxSpeed);
      b.vx = v.x;
      b.vy = v.y;
    }

    for (let i = 0; i < boids.length; i += 1) {
      const b = boids[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Wrap torique discret pour garder le flux
      if (b.x < -10) b.x = app.width + 10;
      if (b.x > app.width + 10) b.x = -10;
      if (b.y < -10) b.y = app.height + 10;
      if (b.y > app.height + 10) b.y = -10;
    }
  }

  function render() {
    // Fond avec trail
    ctx.fillStyle = `rgba(5, 9, 18, ${p.trail})`;
    ctx.fillRect(0, 0, app.width, app.height);

    for (let i = 0; i < boids.length; i += 1) {
      const b = boids[i];
      const a = Math.atan2(b.vy, b.vx);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);

      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, 3.4);
      ctx.lineTo(-3.5, 0);
      ctx.lineTo(-6, -3.4);
      ctx.closePath();
      ctx.fillStyle = "rgba(110, 225, 255, 0.9)";
      ctx.fill();

      ctx.restore();
    }
  }

  return {
    init() {
      // fond initial propre
      paintBackground();
      reset();
    },
    resize() {
      reset();
    },
    update,
    render,
    onPointerDown() {
      attract = true;
    },
    onPointerUp() {
      attract = false;
    },
    getStats(fps) {
      return `murmuration | boids=${boids.length} fps=${fps}`;
    },
    buildControls() {
      addRange({ label: "Boids", min: 40, max: 420, step: 1, value: p.count, onInput: (v) => { p.count = v; reset(); } });
      addRange({ label: "View radius", min: 20, max: 110, step: 1, value: p.viewRadius, onInput: (v) => { p.viewRadius = v; } });
      addRange({ label: "Separation radius", min: 8, max: 60, step: 1, value: p.sepRadius, onInput: (v) => { p.sepRadius = v; } });
      addRange({ label: "Alignment", min: 0.00, max: 2.00, step: 0.01, value: p.alignWeight, onInput: (v) => { p.alignWeight = v; } });
      addRange({ label: "Cohesion", min: 0.00, max: 2.00, step: 0.01, value: p.cohWeight, onInput: (v) => { p.cohWeight = v; } });
      addRange({ label: "Separation", min: 0.00, max: 3.00, step: 0.01, value: p.sepWeight, onInput: (v) => { p.sepWeight = v; } });
      addRange({ label: "Max speed", min: 40, max: 260, step: 1, value: p.maxSpeed, onInput: (v) => { p.maxSpeed = v; } });
      addRange({ label: "Trail", min: 0.05, max: 0.35, step: 0.01, value: p.trail, onInput: (v) => { p.trail = v; } });
      addButton("Reset flock", reset, false);
      addHelp("Maintiens le clic dans le canvas pour attirer la nuée.");
    },
    dispose() {}
  };
}
  const registry = {
    rope: createRopeDemo,
    murmuration: createMurmurationDemo,
    gol: createGoLDemo,
    beam: createBeamDemo
  };

  let activeDemo = null;

  function switchDemo(name) {
    if (activeDemo && activeDemo.dispose) activeDemo.dispose();
    clearControls();
    activeDemo = registry[name]();
    activeDemo.init(app);
    if (activeDemo.buildControls) activeDemo.buildControls();
    if (activeDemo.resize) activeDemo.resize(app);
  }

  select.addEventListener("change", () => switchDemo(select.value));

  let last = performance.now();
  let acc = 0;
  const fixedDt = 1 / 60;
  let fps = 0;
  let fpsTimer = 0;
  let frames = 0;
  let paused = false;

  document.addEventListener("visibilitychange", () => {
    paused = document.hidden;
  });

  function loop(now) {
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (!paused && activeDemo) {
      acc += delta;
      while (acc >= fixedDt) {
        activeDemo.update(fixedDt, app);
        acc -= fixedDt;
      }
      activeDemo.render(app);

      frames += 1;
      fpsTimer += delta;
      if (fpsTimer >= 0.5) {
        fps = Math.round(frames / fpsTimer);
        frames = 0;
        fpsTimer = 0;
        statsEl.textContent = activeDemo.getStats ? activeDemo.getStats(fps) : `fps=${fps}`;
      }
    }

    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  switchDemo(select.value);
  requestAnimationFrame(loop);
})();