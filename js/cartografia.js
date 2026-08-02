"use strict";

// Rede viva desenhada em canvas: nos que surgem, derivam e reagem ao ponteiro.

const canvas = document.getElementById("field");
const ctx = canvas.getContext("2d");

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
resize();
window.addEventListener("resize", resize);

// ponteiro com inercia
const pointer = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, active: false, moved: false };
function setPointer(x, y) {
  pointer.tx = x; pointer.ty = y; pointer.active = true;
  if (!pointer.moved) { pointer.moved = true; onFirstMove(); }
}
window.addEventListener("pointermove", e => setPointer(e.clientX, e.clientY));
window.addEventListener("pointerdown", e => { setPointer(e.clientX, e.clientY); pulseAt(e.clientX, e.clientY); });
window.addEventListener("pointerleave", () => pointer.active = false);

// comportamentos exibidos na espinha; cada um reconfigura a rede
const CONCEPTS = [
  { id: "entrada",        label: "Entrada",        title: "Todo sistema começa com um sinal que entra.",
    desc: "O mundo empurra eventos para dentro. O sistema observa onde eles nascem — e o que acordam." },
  { id: "transformacao",  label: "Transformação",  title: "Entre a entrada e a saída existe trabalho.",
    desc: "Cada nó reescreve o que recebe. Aqui você vê a informação mudando de estado, não parada num diagrama." },
  { id: "dependencia",    label: "Dependência",    title: "Nada opera sozinho.",
    desc: "Puxe um fio e descubra tudo que ele sustenta. As dependências acendem — o resto recua." },
  { id: "propagacao",     label: "Propagação",     title: "Uma decisão nunca fica onde nasceu.",
    desc: "Ela se propaga. Você literalmente vê a informação atravessar o sistema, nó por nó." },
  { id: "observabilidade",label: "Observabilidade",title: "Você só governa o que consegue ver.",
    desc: "A telemetria aparece. O sistema deixa de ser opaco e passa a se explicar sozinho." },
  { id: "resiliencia",    label: "Resiliência",    title: "Um nó falha. O sistema não pode parar.",
    desc: "Observe: quando um caminho morre, o fluxo encontra outro. Isso é resiliência — não sorte." },
  { id: "colapso",        label: "Colapso",        title: "Toda estrutura tem um limite.",
    desc: "Quando a falha se propaga mais rápido que a recuperação, o sistema colapsa — e depois renasce." },
];

let activeConcept = null;

// campo 2.5D: z (0..1) define a profundidade de cada no
const NODE_TARGET = () => {
  const a = W * H;
  return Math.max(60, Math.min(150, Math.round(a / 12000)));
};

const nodes = [];
const edges = [];

function rand(a, b) { return a + Math.random() * (b - a); }

function makeNode(x, y) {
  return {
    hx: x, hy: y,            // posicao base
    x, y,                    // atual
    z: rand(0, 1),           // profundidade
    ph: rand(0, Math.PI * 2),// fase da deriva
    sp: rand(0.15, 0.5),     // velocidade da deriva
    amp: rand(6, 22),        // amplitude da deriva
    energy: 0,               // excitacao 0..1
    alive: 1,                // 1 vivo, anima ate 0 quando "morto"
    born: 0,                 // progresso de surgimento
    r: rand(1.1, 2.6),
    kind: Math.random() < 0.12 ? "hub" : "node",
  };
}

function buildField() {
  nodes.length = 0;
  edges.length = 0;
  const N = NODE_TARGET();
  // agrupa os nos em torno de alguns centros
  const wells = [];
  const wellCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < wellCount; i++) {
    wells.push({ x: rand(W * 0.15, W * 0.85), y: rand(H * 0.2, H * 0.8), r: rand(120, 320) });
  }
  for (let i = 0; i < N; i++) {
    const w = wells[Math.floor(Math.random() * wells.length)];
    const ang = rand(0, Math.PI * 2);
    const rr = Math.pow(Math.random(), 0.6) * w.r;
    let x = w.x + Math.cos(ang) * rr;
    let y = w.y + Math.sin(ang) * rr;
    x = Math.max(30, Math.min(W - 30, x));
    y = Math.max(30, Math.min(H - 30, y));
    nodes.push(makeNode(x, y));
  }
  // liga cada no a alguns vizinhos proximos
  const maxD = Math.min(W, H) * 0.16;
  for (let i = 0; i < nodes.length; i++) {
    let links = 0;
    for (let j = i + 1; j < nodes.length && links < 4; j++) {
      const a = nodes[i], b = nodes[j];
      const d = Math.hypot(a.hx - b.hx, a.hy - b.hy);
      if (d < maxD) {
        edges.push({ a: i, b: j, base: d, flow: 0 });
        links++;
      }
    }
  }
  buildAdjacency();
}

let adj = [];
function buildAdjacency() {
  adj = nodes.map(() => []);
  edges.forEach((e, ei) => {
    adj[e.a].push({ n: e.b, e: ei });
    adj[e.b].push({ n: e.a, e: ei });
  });
}

// surgimento: revela os nos do centro para fora
let birth = { active: false, order: [], idx: 0, t: 0 };

function beginBirth() {
  buildField();
  const cx = W / 2, cy = H / 2;
  const order = nodes.map((n, i) => i)
    .sort((a, b) => (Math.hypot(nodes[a].hx - cx, nodes[a].hy - cy))
                  - (Math.hypot(nodes[b].hx - cx, nodes[b].hy - cy)));
  nodes.forEach(n => { n.born = 0; });
  birth = { active: true, order, idx: 0, t: 0 };
}

// ondas de propagacao que percorrem as arestas
let waves = [];
let sceneTimer = 0;

function pulseAt(px, py) {
  // dispara a onda a partir do no mais proximo do clique
  let best = -1, bd = 1e9;
  for (let i = 0; i < nodes.length; i++) {
    const d = Math.hypot(nodes[i].x - px, nodes[i].y - py);
    if (d < bd) { bd = d; best = i; }
  }
  if (best >= 0 && bd < 140) igniteWave(best, 1);
}

function igniteWave(start, strength) {
  waves.push({ frontier: [{ n: start, t: 0 }], visited: new Set([start]), strength, age: 0 });
  nodes[start].energy = Math.min(1, nodes[start].energy + strength);
}

function stepWaves(dt) {
  const speed = 5.2 * dt;
  for (const w of waves) {
    w.age += dt;
    const next = [];
    for (const f of w.frontier) {
      f.t += speed;
      if (f.t >= 1) {
        for (const { n, e } of adj[f.n]) {
          if (!w.visited.has(n) && nodes[n].alive > 0.4) {
            w.visited.add(n);
            next.push({ n, t: 0 });
            edges[e].flow = Math.min(1, edges[e].flow + 0.9 * w.strength);
            nodes[n].energy = Math.min(1, nodes[n].energy + 0.85 * w.strength);
          }
        }
      } else {
        next.push(f);
      }
    }
    w.frontier = next;
  }
  waves = waves.filter(w => w.frontier.length > 0 && w.age < 6);
}

// animacao especifica de cada comportamento
function runScene(dt) {
  sceneTimer += dt;
  if (!activeConcept) return;
  const id = activeConcept.id;

  if (id === "entrada") {
    // sinais entram pelas bordas em direcao ao interior
    if (sceneTimer > 0.55) {
      sceneTimer = 0;
      let edge = -1, bd = -1;
      for (let k = 0; k < 8; k++) {
        const i = Math.floor(Math.random() * nodes.length);
        const d = Math.min(nodes[i].hx, W - nodes[i].hx, nodes[i].hy, H - nodes[i].hy);
        if (edge < 0 || d < bd) { edge = i; bd = d; }
      }
      igniteWave(edge, 0.9);
    }
  } else if (id === "propagacao") {
    if (sceneTimer > 1.8) {
      sceneTimer = 0;
      igniteWave(Math.floor(Math.random() * nodes.length), 1);
    }
  } else if (id === "transformacao") {
    // excitacao continua: estado sempre mudando
    if (sceneTimer > 0.32) {
      sceneTimer = 0;
      igniteWave(Math.floor(Math.random() * nodes.length), 0.55);
    }
  } else if (id === "resiliencia") {
    // mata um no e forca o fluxo a achar outro caminho
    if (sceneTimer > 2.2) {
      sceneTimer = 0;
      killRandomNode();
      igniteWave(Math.floor(Math.random() * nodes.length), 1);
    }
  } else if (id === "colapso") {
    if (sceneTimer > 0.14 && collapse.active) {
      sceneTimer = 0;
      collapse.step();
    }
  }
}

function killRandomNode() {
  const candidates = nodes.map((n, i) => i).filter(i => nodes[i].alive > 0.9 && nodes[i].kind === "node");
  if (!candidates.length) return;
  const i = candidates[Math.floor(Math.random() * candidates.length)];
  nodes[i].targetAlive = 0;
  setTimeout(() => { if (nodes[i]) nodes[i].targetAlive = 1; }, 2600); // revive depois
}

// colapso: falha em cascata e depois renascimento
const collapse = {
  active: false,
  queue: [],
  start() {
    this.active = true;
    const hub = nodes.map((n,i)=>i).sort((a,b)=> adj[b].length - adj[a].length)[0] || 0;
    this.queue = [hub];
    nodes.forEach(n => n.targetAlive = 1);
  },
  step() {
    if (!this.queue.length) {
      this.active = false;
      setTimeout(() => { nodes.forEach(n => n.targetAlive = 1); }, 700);
      return;
    }
    const i = this.queue.shift();
    if (nodes[i].targetAlive === 0) { this.step(); return; }
    nodes[i].targetAlive = 0;
    nodes[i].energy = 1;
    for (const { n } of adj[i]) {
      if (nodes[n].targetAlive !== 0) this.queue.push(n);
    }
  },
  stop() { this.active = false; this.queue = []; nodes.forEach(n => n.targetAlive = 1); },
};

function selectConcept(c) {
  const same = activeConcept && activeConcept.id === c.id;
  activeConcept = same ? null : c;
  sceneTimer = 0;
  waves = [];
  collapse.stop();
  nodes.forEach(n => { n.targetAlive = 1; n.energy = Math.min(n.energy, 0.3); });
  edges.forEach(e => e.flow = 0);

  document.querySelectorAll(".spine button").forEach(b => {
    b.classList.toggle("active", activeConcept && b.dataset.id === activeConcept.id);
  });

  const ro = document.getElementById("readout");
  if (!activeConcept) { ro.classList.remove("in"); return; }

  document.getElementById("ro-k").textContent = "// " + c.label.toUpperCase();
  document.getElementById("ro-t").textContent = c.title;
  document.getElementById("ro-d").textContent = c.desc;
  ro.classList.add("in");

  if (c.id === "dependencia") highlightDependency();
  if (c.id === "colapso") collapse.start();
  if (c.id === "propagacao") igniteWave(Math.floor(nodes.length / 2), 1);
}

let dependencyChain = null;
function highlightDependency() {
  // traca uma cadeia de dependencias a partir do hub mais conectado
  const hub = nodes.map((n,i)=>i).sort((a,b)=> adj[b].length - adj[a].length)[0] || 0;
  const chain = new Set([hub]);
  let frontier = [hub];
  for (let depth = 0; depth < 4; depth++) {
    const next = [];
    for (const i of frontier) {
      for (const { n } of adj[i]) {
        if (!chain.has(n) && Math.random() < 0.6) { chain.add(n); next.push(n); }
      }
    }
    frontier = next;
  }
  dependencyChain = chain;
}

let last = performance.now();
let cam = { x: 0, y: 0 };

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  pointer.x += (pointer.tx - pointer.x) * 0.08;
  pointer.y += (pointer.ty - pointer.y) * 0.08;

  // a camera desliza no sentido contrario ao ponteiro, dando profundidade
  const px = (pointer.x / W - 0.5);
  const py = (pointer.y / H - 0.5);
  cam.x += (px * -26 - cam.x) * 0.04;
  cam.y += (py * -26 - cam.y) * 0.04;

  update(dt, now);
  render(now);
  requestAnimationFrame(frame);
}

function update(dt, now) {
  if (birth.active) {
    birth.t += dt;
    const perTick = 2;
    const stepEvery = 0.012;
    while (birth.t > stepEvery && birth.idx < birth.order.length) {
      birth.t -= stepEvery;
      for (let k = 0; k < perTick && birth.idx < birth.order.length; k++) {
        nodes[birth.order[birth.idx]].bornTarget = 1;
        birth.idx++;
      }
    }
    if (birth.idx >= birth.order.length) birth.active = false;
  }

  const t = now / 1000;
  for (const n of nodes) {
    if (n.bornTarget) n.born += (1 - n.born) * 0.06;
    // deriva organica
    const dx = Math.cos(t * n.sp + n.ph) * n.amp * (0.4 + n.z);
    const dy = Math.sin(t * n.sp * 1.1 + n.ph) * n.amp * (0.4 + n.z);
    let tx = n.hx + dx;
    let ty = n.hy + dy;

    // excitacao e leve atracao pelo ponteiro
    const mdx = n.x - pointer.x, mdy = n.y - pointer.y;
    const md = Math.hypot(mdx, mdy);
    const R = 190;
    if (pointer.active && md < R) {
      const f = (1 - md / R);
      n.energy = Math.min(1, n.energy + f * 0.06);
      const dir = (n.z - 0.5) * 2;
      tx += (mdx / (md + 1)) * f * 18 * dir;
      ty += (mdy / (md + 1)) * f * 18 * dir;
    }

    n.x += (tx - n.x) * 0.06;
    n.y += (ty - n.y) * 0.06;

    if (n.targetAlive === undefined) n.targetAlive = 1;
    n.alive += (n.targetAlive - n.alive) * 0.08;

    n.energy *= 0.965;
  }

  for (const e of edges) e.flow *= 0.94;

  stepWaves(dt);
  runScene(dt);

  document.getElementById("nodecount").textContent =
    nodes.filter(n => n.alive > 0.5 && n.born > 0.3).length.toString().padStart(3, "0");
}

function project(n) {
  // a profundidade define escala e deslocamento pela camera
  const depth = 0.5 + n.z;
  const ox = cam.x * (0.4 + n.z * 1.2);
  const oy = cam.y * (0.4 + n.z * 1.2);
  return { x: n.x + ox, y: n.y + oy, scale: depth, alpha: 0.35 + n.z * 0.65 };
}

const observabilityOn = () => activeConcept && activeConcept.id === "observabilidade";

function render(now) {
  ctx.clearRect(0, 0, W, H);

  // brilho de fundo
  const g = ctx.createRadialGradient(W/2, H*0.42, 60, W/2, H*0.5, Math.max(W,H)*0.75);
  g.addColorStop(0, "rgba(20,18,14,0.55)");
  g.addColorStop(1, "rgba(6,6,6,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const depMode = activeConcept && activeConcept.id === "dependencia" && dependencyChain;

  // arestas
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    if (a.born < 0.15 || b.born < 0.15) continue;
    const alive = Math.min(a.alive, b.alive);
    if (alive < 0.06) continue;

    const pa = project(a), pb = project(b);
    const born = Math.min(a.born, b.born);

    let baseAlpha = 0.05 + Math.min(pa.alpha, pb.alpha) * 0.05;
    let stroke = "255,255,255";
    let lw = 0.6;

    const flow = e.flow;
    if (flow > 0.02) {
      baseAlpha += flow * 0.5;
      stroke = "192,138,78";
      lw = 0.6 + flow * 1.4;
    }

    if (depMode) {
      const inChain = dependencyChain.has(e.a) && dependencyChain.has(e.b);
      if (inChain) { stroke = "192,138,78"; baseAlpha = 0.55; lw = 1.2; }
      else { baseAlpha *= 0.25; }
    }

    ctx.strokeStyle = `rgba(${stroke},${(baseAlpha * born * alive).toFixed(3)})`;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();

    // pulso que viaja pela aresta quando ha fluxo
    if (flow > 0.06) {
      const tt = (now / 400 + e.base) % 1;
      const fx = pa.x + (pb.x - pa.x) * tt;
      const fy = pa.y + (pb.y - pa.y) * tt;
      ctx.fillStyle = `rgba(192,138,78,${(flow * 0.9).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(fx, fy, 1.4 + flow, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // nos, do fundo para a frente
  const order = nodes.map((n,i)=>i).sort((a,b)=> nodes[a].z - nodes[b].z);
  for (const i of order) {
    const n = nodes[i];
    if (n.born < 0.05) continue;
    const p = project(n);
    const alive = n.alive;
    if (alive < 0.05 && n.energy < 0.05) continue;

    const baseR = (n.kind === "hub" ? n.r * 1.9 : n.r) * p.scale * n.born;
    const energy = n.energy;

    let inChainDim = 1;
    if (depMode) inChainDim = dependencyChain.has(i) ? 1 : 0.22;

    // halo quando o no esta energizado
    if (energy > 0.03 || n.kind === "hub") {
      const glowR = baseR * (5 + energy * 10);
      const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      const ga = (0.10 + energy * 0.5) * alive * inChainDim;
      gg.addColorStop(0, `rgba(192,138,78,${ga.toFixed(3)})`);
      gg.addColorStop(1, "rgba(192,138,78,0)");
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }

    // nucleo (branco -> cobre conforme a energia)
    const goldMix = Math.min(1, energy * 1.4);
    const cr = Math.round(237 - goldMix * (237 - 201));
    const cg = Math.round(237 - goldMix * (237 - 162));
    const cb = Math.round(237 - goldMix * (237 - 75));
    const coreA = (p.alpha * (0.55 + energy * 0.45)) * alive * inChainDim;
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${coreA.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.4, baseR), 0, Math.PI * 2);
    ctx.fill();

    // observabilidade: anel de telemetria nos hubs / nos ativos
    if (observabilityOn() && (n.kind === "hub" || energy > 0.25)) {
      ctx.strokeStyle = `rgba(192,138,78,${(0.35 * alive).toFixed(3)})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseR + 5 + (now/600 % 6), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function buildSpine() {
  const spine = document.getElementById("spine");
  CONCEPTS.forEach(c => {
    const b = document.createElement("button");
    b.textContent = c.label;
    b.dataset.id = c.id;
    b.addEventListener("click", () => selectConcept(c));
    spine.appendChild(b);
  });
}

let cueShown = false, firstMoved = false;
function onFirstMove() {
  firstMoved = true;
  // "OBSERVE." so aparece depois do primeiro movimento, e some
  if (!cueShown) {
    cueShown = true;
    const cue = document.getElementById("cue");
    setTimeout(() => cue.classList.add("in"), 300);
    setTimeout(() => cue.classList.remove("in"), 3400);
    setTimeout(() => { document.getElementById("spine").classList.add("in"); }, 2600);
  }
}

function boot() {
  buildSpine();
  beginBirth();
  requestAnimationFrame(frame);

  setTimeout(() => {
    document.getElementById("boot").classList.add("done");
    document.querySelectorAll(".hud").forEach(h => h.classList.add("in"));
  }, 3700);

  // se o visitante nao mexer o mouse, revela a espinha mesmo assim
  setTimeout(() => {
    if (!firstMoved) document.getElementById("spine").classList.add("in");
  }, 8000);
}

boot();
