/* =====================================================================
   지도 화면 (map.js)
   scenes.js 의 GAME.map 정보를 읽어 마을을 SVG 그림으로 그리고,
   주인공이 길을 따라 걷는 모습을 보여 줍니다.
   집 모양을 바꾸고 싶으면 아래 drawHouse / drawWell / drawWoodpile 등을 고치세요.
   ===================================================================== */
const MapView = (function () {
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let host, svg, heroEl, heroBody, trailEl, previewEl, onSelect = () => {}, heroNode = null, walking = false;
  const spots = {};
  let status = {};

  /* ---------- 그림 조각들 ---------- */
  function drawHouse(x, y, st) {
    const s = st.s || 1, lit = st.lit;
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <ellipse cx="0" cy="6" rx="66" ry="10" fill="rgba(14,10,40,.35)"/>
      ${lit ? `<rect x="26" y="-104" width="14" height="34" fill="${st.roof}"/>
      <g class="smoke"><circle cx="33" cy="-112" r="7" fill="#fff" opacity=".35"/><circle cx="40" cy="-128" r="9" fill="#fff" opacity=".25"/><circle cx="34" cy="-146" r="11" fill="#fff" opacity=".15"/></g>` : ""}
      <rect x="-46" y="-62" width="92" height="62" rx="3" fill="${st.body}"/>
      <polygon points="-62,-58 0,-116 62,-58" fill="${st.roof}"/>
      <polygon points="-26,-93 0,-116 26,-93 17,-88 0,-103 -17,-88" fill="#f4f1fb" opacity=".95"/>
      <rect x="-60" y="-60" width="120" height="6" rx="3" fill="#f4f1fb" opacity=".85"/>
      <rect x="-30" y="-34" width="20" height="34" rx="2" fill="#2a2446"/>
      ${lit ? `<circle cx="28" cy="-38" r="36" fill="url(#warm)" opacity=".55"/>` : ""}
      <rect x="16" y="-48" width="22" height="20" rx="2" fill="${lit ? "#ffd58a" : "#262240"}"/>
      <path d="M27 -48 V-28 M16 -38 H38" stroke="${st.body}" stroke-width="2"/>
    </g>`;
  }
  function drawEmpty(x, y, st) {
    return `<g transform="translate(${x} ${y}) rotate(-2)">
      <ellipse cx="0" cy="6" rx="66" ry="10" fill="rgba(14,10,40,.35)"/>
      <rect x="-46" y="-60" width="92" height="60" rx="3" fill="${st.body}"/>
      <polygon points="-62,-56 -4,-112 62,-62 40,-56 -4,-96 -40,-56" fill="${st.roof}"/>
      <polygon points="-30,-86 -4,-112 20,-90 10,-86 -4,-98 -18,-84" fill="#f4f1fb" opacity=".9"/>
      <rect x="-30" y="-34" width="20" height="34" rx="2" fill="#1d1a36"/>
      <polygon points="-30,-34 -14,-30 -14,0 -30,0" fill="#14122b"/>
      <rect x="16" y="-46" width="22" height="20" rx="2" fill="#1d1a36"/>
      <path d="M18 -44 L36 -28 M36 -44 L22 -26" stroke="#8a84b0" stroke-width="2"/>
      <path d="M-44 -50 L-20 -20 M-20 -52 L-42 -18" stroke="#4a4770" stroke-width="3"/>
    </g>`;
  }
  function drawWell(x, y) {
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="6" rx="48" ry="9" fill="rgba(14,10,40,.35)"/>
      <rect x="-32" y="-26" width="64" height="26" rx="10" fill="#7f7aa8"/>
      <ellipse cx="0" cy="-26" rx="32" ry="10" fill="#9a94c4"/>
      <ellipse cx="0" cy="-26" rx="24" ry="7" fill="#1c1a3c"/>
      <rect x="-30" y="-76" width="6" height="52" fill="#5b5483"/><rect x="24" y="-76" width="6" height="52" fill="#5b5483"/>
      <polygon points="-42,-72 0,-98 42,-72" fill="#5f548f"/>
      <polygon points="-18,-86 0,-98 18,-86 10,-82 0,-90 -10,-82" fill="#f4f1fb"/>
      <path d="M0 -72 V-44" stroke="#cfc8ea" stroke-width="2"/><rect x="-6" y="-44" width="12" height="10" rx="2" fill="#8d6a52"/>
    </g>`;
  }
  function drawWoodpile(x, y) {
    let logs = "";
    const rows = [[-36, -10, 4], [-26, -28, 3], [-16, -46, 2]];
    rows.forEach(([sx, sy, n], r) => { for (let i = 0; i < n; i++) logs += `<rect x="${sx + i * 24 + (r % 2) * 2}" y="${sy}" width="22" height="16" rx="8" fill="${(i + r) % 2 ? "#7a5f4a" : "#8d6e55"}"/><circle cx="${sx + i * 24 + 11 + (r % 2) * 2}" cy="${sy + 8}" r="4" fill="#b89a7e" opacity=".7"/>`; });
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="6" rx="58" ry="9" fill="rgba(14,10,40,.35)"/>
      ${logs}
      <path d="M-34 -50 Q-10 -62 14 -50 Q22 -46 20 -44 H-34 Z" fill="#f4f1fb" opacity=".95"/>
      <path d="M52 -4 L72 -36 M60 -4 L40 -34" stroke="#8d6e55" stroke-width="5" stroke-linecap="round"/>
    </g>`;
  }
  function drawBurnt(x, y) {
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="4" rx="90" ry="16" fill="#1b1830" opacity=".7"/>
      <rect x="-60" y="-70" width="9" height="70" fill="#15122a" transform="rotate(-6 -56 0)"/>
      <rect x="-24" y="-96" width="10" height="96" fill="#15122a" transform="rotate(4 -19 0)"/>
      <rect x="24" y="-54" width="9" height="54" fill="#15122a" transform="rotate(-10 28 0)"/>
      <rect x="58" y="-30" width="8" height="30" fill="#15122a" transform="rotate(12 62 0)"/>
      <path d="M-70 -4 H70" stroke="#15122a" stroke-width="7"/>
      <g class="embers"><circle cx="-30" cy="-6" r="3" fill="#ff9a55"/><circle cx="10" cy="-3" r="2.4" fill="#ffb06b"/><circle cx="40" cy="-8" r="2" fill="#ff8a45"/></g>
    </g>`;
  }
  function drawTree(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-4" y="-10" width="8" height="14" fill="#2a2145"/>
      <polygon points="0,-88 -26,-40 26,-40" fill="#2a2a5a"/><polygon points="0,-66 -32,-12 32,-12" fill="#2f2f64"/>
      <polygon points="0,-88 -9,-70 9,-70" fill="#f4f1fb" opacity=".9"/><polygon points="0,-66 -12,-46 12,-46" fill="#f4f1fb" opacity=".6"/></g>`;
  }

  function art() {
    const M = GAME.map, N = M.nodes;
    /* 길 */
    const roads = M.edges.map(([a, b, via]) => {
      const pts = [N[a]].concat(via || [], [N[b]]).map((p) => p.join(",")).join(" ");
      return `<polyline points="${pts}" class="road-edge"/>`;
    }).join("");
    const roadsIn = M.edges.map(([a, b, via]) => {
      const pts = [N[a]].concat(via || [], [N[b]]).map((p) => p.join(",")).join(" ");
      return `<polyline points="${pts}" class="road-in"/>`;
    }).join("");
    /* 별, 눈, 나무 */
    let stars = "";
    for (let i = 0; i < 46; i++) stars += `<circle cx="${(i * 197) % 1600}" cy="${20 + (i * 83) % 220}" r="${(i % 3) * 0.6 + 0.8}" fill="#fff" opacity="${0.3 + (i % 5) * 0.12}"/>`;
    let flakes = "";
    for (let i = 0; i < 38; i++) flakes += `<circle class="flake" cx="${(i * 139) % 1600}" cy="-20" r="${1.6 + (i % 4) * 0.7}" style="animation-duration:${9 + (i % 7) * 2}s;animation-delay:-${(i * 1.7) % 14}s"/>`;
    const trees = [[90, 520, 1], [160, 580, 0.8], [520, 330, 0.9], [560, 740, 0.9], [880, 380, 0.8], [960, 340, 1], [1250, 700, 0.9],
      [1320, 640, 0.8], [1510, 520, 1], [1530, 640, 0.9], [1220, 260, 0.8], [1500, 250, 0.9]].map((t) => drawTree(t[0], t[1], t[2])).join("");
    /* 집들 */
    const sp = M.houses.map((h) => {
      const [x, y] = N[h.node || h.id];
      let body;
      if (h.kind === "house") body = drawHouse(x, y, h.style);
      else if (h.kind === "empty") body = drawEmpty(x, y, h.style);
      else if (h.kind === "well") body = drawWell(x, y);
      else body = drawWoodpile(x, y);
      return `<g class="spot locked" data-id="${h.id}" tabindex="0" role="button" aria-label="${h.name}">
        <ellipse class="ring" cx="${x}" cy="${y + 6}" rx="78" ry="16"/>
        <g class="spot-art">${body}</g>
        <text class="spot-name" x="${x}" y="${y + 40}" text-anchor="middle">${h.name}</text>
        <text class="spot-sub" x="${x}" y="${y + 66}" text-anchor="middle"></text>
        <rect x="${x - 80}" y="${y - 150}" width="160" height="230" fill="transparent"/>
      </g>`;
    }).join("");
    const [sx, sy] = N.site, [fx, fy] = N.far;
    return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="마을 지도">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14122b"/><stop offset=".26" stop-color="#26224e"/><stop offset=".38" stop-color="#7a6a9e"/><stop offset="1" stop-color="#3a3668"/></linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a64a0"/><stop offset=".5" stop-color="#4a4680"/><stop offset="1" stop-color="#2f2c58"/></linearGradient>
        <radialGradient id="warm"><stop offset="0" stop-color="#ffd58a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd58a" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)"/>
      ${stars}
      <polygon points="0,330 140,240 260,310 420,220 560,300 720,235 900,310 1060,225 1230,300 1380,230 1600,310 1600,360 0,360" fill="#3d3a6e"/>
      <polygon points="0,350 200,290 380,340 600,285 820,345 1040,290 1260,345 1460,295 1600,340 1600,380 0,380" fill="#4c4880"/>
      <path d="M0 360 Q 400 320 800 350 T 1600 340 V900 H0 Z" fill="url(#ground)"/>
      <g class="far-light" aria-hidden="true"><circle cx="${fx}" cy="${fy}" r="46" fill="url(#warm)" opacity=".5"/><circle cx="${fx}" cy="${fy}" r="3.5" fill="#ffe2a8"/></g>
      ${trees}
      <g class="roads">${roads}${roadsIn}</g>
      <g class="burnt">${drawBurnt(sx, sy)}<text class="spot-name dim" x="${sx}" y="${sy + 40}" text-anchor="middle">불탄 집터</text></g>
      <g class="trail"></g>
      <polyline class="preview" points="" fill="none"/>
      ${sp}
      <g class="hero" aria-hidden="true">
        <ellipse cx="0" cy="2" rx="13" ry="4" fill="rgba(10,8,30,.4)"/>
        <g class="hero-body">
          <path d="M-11 0 Q-13 -24 0 -32 Q13 -24 11 0 Z" fill="#e8d8f7"/>
          <circle cx="0" cy="-38" r="8.5" fill="#f6e6d8"/>
          <path d="M-10 -39 Q0 -53 10 -39 Q5 -43 -10 -39 Z" fill="#6a5a9a"/>
          <circle class="lantern" cx="15" cy="-14" r="18" fill="url(#warm)"/>
          <circle cx="15" cy="-14" r="4" fill="#ffb86b"/>
          <path d="M11 -24 L15 -18" stroke="#cfc2e6" stroke-width="1.6"/>
        </g>
      </g>
      <g class="snow" aria-hidden="true">${flakes}</g>
    </svg>`;
  }

  /* ---------- 준비 ---------- */
  function build(container, selectCb) {
    host = container;
    onSelect = selectCb;
    host.innerHTML = art();
    svg = host.querySelector("svg");
    /* 가로로 넓은 화면은 꽉 채우고, 세로로 좁은 화면(휴대폰)은 지도 전체가 보이게 맞춥니다 */
    const fit = () => svg.setAttribute("preserveAspectRatio", host.clientWidth / (host.clientHeight || 1) < 1.3 ? "xMidYMid meet" : "xMidYMid slice");
    window.addEventListener("resize", fit);
    new ResizeObserver(fit).observe(host);
    heroEl = svg.querySelector(".hero");
    heroBody = svg.querySelector(".hero-body");
    trailEl = svg.querySelector(".trail");
    previewEl = svg.querySelector(".preview");
    svg.querySelectorAll(".spot").forEach((g) => {
      const id = g.dataset.id;
      spots[id] = g;
      g.addEventListener("click", (e) => { e.stopPropagation(); if (!walking) onSelect(id); });
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); if (!walking) onSelect(id); } });
      g.addEventListener("pointerenter", () => preview(id));
      g.addEventListener("focus", () => preview(id));
      g.addEventListener("pointerleave", hidePreview);
      g.addEventListener("blur", hidePreview);
    });
  }

  function nodeOf(id) { const h = GAME.map.houses.find((x) => x.id === id); return h.node || h.id; }

  function preview(id) {
    if (walking || !status[id] || status[id].state !== "available") return;
    const r = routeBetween(heroNode, nodeOf(id));
    if (!r) return;
    previewEl.setAttribute("points", r.points.map((p) => p.join(",")).join(" "));
    previewEl.classList.add("on");
  }
  function hidePreview() { previewEl.classList.remove("on"); }

  /* info: { hero:"노드이름", status:{ 집id:{state:"available|locked|done", cost:0|1|2} } } */
  function update(info) {
    status = info.status;
    Object.keys(spots).forEach((id) => {
      const s = status[id], g = spots[id];
      g.classList.remove("locked", "available", "done");
      g.classList.add(s.state);
      const h = GAME.map.houses.find((x) => x.id === id);
      g.setAttribute("aria-label", h.name + (s.state === "locked" ? " (아직 갈 수 없음)" : s.state === "done" ? " (다녀옴)" : ""));
      g.querySelector(".spot-sub").textContent =
        s.state === "locked" ? "아직 갈 수 없다" : s.state === "done" ? "다녀옴" : s.cost > 0 ? "먼 길 · 기력 −" + s.cost : "";
    });
    placeHero(info.hero);
    hidePreview();
  }

  function placeHero(node) {
    heroNode = node;
    const [x, y] = GAME.map.nodes[node];
    heroEl.setAttribute("transform", `translate(${x} ${y + 16}) scale(1.45)`);
  }

  function clearTrail() { trailEl.innerHTML = ""; }

  /* 길을 따라 걷기 */
  function walk(points, done) {
    walking = true;
    hidePreview();
    const lens = [0];
    for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    const total = lens[lens.length - 1];
    const dur = (reduce || document.body.classList.contains("calm")) ? 1 : Math.min(2800, Math.max(900, total / 0.42));
    const t0 = performance.now();
    let lastDrop = 0, side = 1, seg = 1;
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur), d = t * total;
      while (seg < lens.length - 1 && lens[seg] < d) seg++;
      const a = points[seg - 1], b = points[seg], k = lens[seg] - lens[seg - 1] || 1;
      const f = Math.min(1, Math.max(0, (d - lens[seg - 1]) / k));
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f;
      heroEl.setAttribute("transform", `translate(${x} ${y + 16}) scale(1.45)`);
      heroBody.setAttribute("transform", `translate(0 ${-Math.abs(Math.sin(d / 9)) * 4})`);
      if (d - lastDrop > 24) {                       // 발자국
        lastDrop = d; side = -side;
        const nx = -(b[1] - a[1]) / k * 4 * side, ny = (b[0] - a[0]) / k * 4 * side;
        const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
        e.setAttribute("cx", x + nx); e.setAttribute("cy", y + 18 + ny); e.setAttribute("rx", 3.2); e.setAttribute("ry", 1.7);
        trailEl.appendChild(e);
      }
      if (t < 1) requestAnimationFrame(step);
      else { heroBody.removeAttribute("transform"); walking = false; done(); }
    })(t0);
  }

  return {
    build, update, walk, clearTrail, placeHero,
    show() { host.hidden = false; },
    hide() { host.hidden = true; },
    isWalking() { return walking; }
  };
})();
