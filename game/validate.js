/* 사용법: node validate.js   (scenes.js 를 고친 뒤 실행하면 문제를 찾아 줍니다) */
const { GAME, getPerception, checkCondition, applyEffects, routeBetween, walkCost } = require("./js/scenes.js");
const S = GAME.scenes, M = GAME.map;
const problems = [], reach = new Set(), endings = {}, lockedSeen = new Set(), rescuedStates = [];
const seen = new Set();
let nStates = 0;

function key(id, st, tags, hero) { return id + "|" + STAT.map(k => st[k]).join(",") + "|" + tags.slice().sort().join(",") + "|" + hero; }
const STAT = ["죄책감", "신뢰", "기력"];
const pick = (list, st, tags) => list.find(o => checkCondition(o.when, st, tags)) || null;

function apply(o, st, tags) { applyEffects(o.effects, st); (o.add || []).forEach(t => { if (!tags.includes(t)) tags.push(t); }); }

function options(id, st, tags, hero) {         // 이 장면에서 갈 수 있는 다음 상태들
  const sc = S[id], out = [];
  if (!sc) { problems.push("없는 장면: " + id); return out; }
  const st1 = { ...st }, tags1 = [...tags];
  (sc.onEnter || []).forEach(o => { if (checkCondition(o.when, st1, tags1)) apply(o, st1, tags1); });
  if (sc.type === "branch") { const b = pick(sc.branch, st1, tags1); out.push({ next: b.next, st: st1, tags: tags1, hero }); return out; }
  if (sc.type === "map") {
    M.houses.forEach(h => {
      if (tags1.includes("방문:" + h.id)) return;
      if (!checkCondition(h.unlock, st1, tags1)) return;
      const r = routeBetween(hero, h.node || h.id); if (!r) { problems.push("길이 없음: " + h.id); return; }
      const s2 = { ...st1 }, t2 = [...tags1]; applyEffects({ 기력: -walkCost(r.length) }, s2); t2.push("방문:" + h.id);
      out.push({ next: h.scene, st: s2, tags: t2, hero: h.node || h.id });
    });
    if (!out.length) problems.push("지도에서 갈 곳이 없음: " + JSON.stringify(st1));
    return out;
  }
  if (sc.type === "minigame") {
    [sc.success, sc.fail].forEach(o => { const s2 = { ...st1 }, t2 = [...tags1]; apply(o, s2, t2); out.push({ next: o.next, st: s2, tags: t2, hero }); });
    return out;
  }
  if (sc.type === "reflect") return out;
  if (!sc.choices) { if (sc.next) out.push({ next: sc.next, st: st1, tags: tags1, hero }); return out; }
  sc.choices.forEach((c, i) => {
    if (c.require && !checkCondition(c.require, st1, tags1)) { if (c.locked) lockedSeen.add(id + "#" + i); return; }
    const s2 = { ...st1 }, t2 = [...tags1];
    const o = c.outcomes ? pick(c.outcomes, s2, t2) : c;
    if (!o) { problems.push("outcome 없음 " + id + "#" + i); return; }
    apply(o, s2, t2);
    if (!o.next) { problems.push("next 없음 " + id + "#" + i); return; }
    out.push({ next: o.next, st: s2, tags: t2, hero });
  });
  if (!out.length) problems.push("선택 가능한 선택지 없음: " + id);
  return out;
}

/* 전체 상태 탐색 (같은 상태는 한 번만) */
const stack = [{ id: S[GAME.meta.firstScene] && GAME.meta.firstScene, st: { ...GAME.start }, tags: [], hero: M.startNode }];
while (stack.length) {
  const { id, st, tags, hero } = stack.pop();
  const k = key(id, st, tags, hero); if (seen.has(k)) continue; seen.add(k); nStates++;
  reach.add(id);
  const sc = S[id];
  if (sc && sc.type === "ending") endings[sc.ending] = (endings[sc.ending] || 0) + 1;
  if (sc && sc.type === "reflect") { if (!sc.question[getPerception(st)]) problems.push("질문 없음 " + getPerception(st)); continue; }
  if (id === "ch5_rescued") rescuedStates.push(1);
  options(id, st, tags, hero).forEach(o => stack.push({ id: o.next, st: o.st, tags: o.tags, hero: o.hero }));
}

/* 정적 검사 */
Object.keys(S).forEach(id => {
  const sc = S[id], nx = [];
  if (sc.next) nx.push(sc.next);
  (sc.branch || []).forEach(b => nx.push(b.next));
  (sc.choices || []).forEach(c => { if (c.next) nx.push(c.next); (c.outcomes || []).forEach(o => o.next && nx.push(o.next)); });
  [sc.success, sc.fail].forEach(o => o && nx.push(o.next));
  nx.forEach(n => { if (!S[n]) problems.push(id + " -> 없는 장면 " + n); });
  if (!reach.has(id)) problems.push("도달할 수 없는 장면: " + id);
});
M.houses.forEach(h => { if (!S[h.scene]) problems.push("집의 장면 없음 " + h.id); if (!routeBetween(M.startNode, h.node || h.id)) problems.push("길이 이어지지 않음 " + h.id); });

console.log("서로 다른 게임 상태 수:", nStates);
console.log("도달 가능한 엔딩:", endings);
console.log("쓰러짐(구조) 장면 도달 가능:", rescuedStates.length > 0);
console.log("잠금 선택지가 보인 곳:", [...lockedSeen]);

/* 무작위 플레이 (지도 방문 순서도 무작위) */
function play(policy) {
  let id = GAME.meta.firstScene, st = { ...GAME.start }, tags = [], hero = M.startNode, walked = 0, picks = 0, res = false;
  for (let g = 0; g < 80; g++) {
    const sc = S[id]; if (sc.type === "reflect") break; if (id === "ch5_rescued") res = true;
    if (sc.type === "ending") { var end = sc.ending; }
    const ops = options(id, st, tags, hero); if (!ops.length) break;
    const o = policy(ops, id); if (sc.type === "map") picks++;
    id = o.next; st = o.st; tags = o.tags; hero = o.hero;
  }
  return { end, res, st, tags, picks };
}
const rnd = (ops) => ops[Math.floor(Math.random() * ops.length)];
const N = 60000, dist = { A: 0, B: 0, C: 0 }; let resc = 0, lowSt = 0, woodGot = 0;
for (let i = 0; i < N; i++) { const r = play(rnd); dist[r.end]++; if (r.res) resc++; if (r.tags.includes("장작")) woodGot++; }
console.log("무작위 플레이 엔딩 비율 %:", Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, +(v / N * 100).toFixed(1)])), "| 쓰러짐 %:", +(resc / N * 100).toFixed(1));

/* 신뢰를 조금 더 선호하는 무작위 플레이 (보통 사람이 고르는 경향에 가깝게) */
const lean = (ops) => { const w = ops.map(o => Math.exp(0.5 * ((o.st.신뢰 - o.st.죄책감) + 0.3 * o.st.기력))); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < ops.length; i++) { r -= w[i]; if (r <= 0) return ops[i]; } return ops[0]; };
const d2 = { A: 0, B: 0, C: 0 }; let resc2 = 0; for (let i = 0; i < N; i++) { const r = play(lean); d2[r.end]++; if (r.res) resc2++; }
console.log("신뢰 쪽으로 기운 플레이 엔딩 비율 %:", Object.fromEntries(Object.entries(d2).map(([k, v]) => [k, +(v / N * 100).toFixed(1)])), "| 쓰러짐 %:", +(resc2 / N * 100).toFixed(1));

/* 신뢰 우선 플레이: 효과가 신뢰를 가장 올리고(동률이면 죄책감을 낮추고 기력 소모가 적은) 선택을 고름 */
const trust = (ops) => ops.slice().sort((a, b) => (b.st.신뢰 - a.st.신뢰) || (a.st.죄책감 - b.st.죄책감) || (b.st.기력 - a.st.기력))[0];
const t = {}; for (let i = 0; i < 1; i++) { const r = play(trust); t[r.end] = 1; }
console.log("신뢰 우선 한 번 플레이 결과:", t);
console.log("문제:", problems.length ? [...new Set(problems)] : "없음");
let chars = 0, beats = 0;
Object.values(S).forEach(sc => { (sc.text || []).forEach(x => { chars += x.length; beats++; }); Object.values(sc.variants || {}).forEach(x => chars += x.length); (sc.choices || []).forEach(c => { chars += (c.result || "").length; (c.outcomes || []).forEach(o => chars += (o.result || "").length); }); });
console.log("장면 수:", Object.keys(S).length, "· 문장 수:", beats, "· 글자 수(대략):", chars);
