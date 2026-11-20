/* =====================================================================
   게임 엔진 (game.js)
   scenes.js 의 장면 데이터를 읽어 한 줄씩 보여 주고, 선택을 처리합니다.
   - 지도 화면(map): js/map.js 가 그리고, 여기서는 "어느 집을 눌렀는지"만 처리합니다.
   - 5초 놀이(minigame): 장작 줍기
   이야기를 고치고 싶으면 이 파일이 아니라 scenes.js 를 고치세요.
   ===================================================================== */
(function () {
  const $ = (id) => document.getElementById(id);
  const el = {
    bgA: $("bgA"), bgB: $("bgB"), chapter: $("chapterTitle"), status: $("status"),
    narration: $("narration"), choices: $("choices"), next: $("btnNext"),
    help: $("help"), screen: $("screen"), map: $("mapLayer"), mini: $("miniLayer")
  };

  const STATS = ["죄책감", "신뢰", "기력"];
  let state, tags, scene, beats, beatIdx, mode, pendingNext, pendingAction, currentChoices, heroNode, bgFront = "A", miniTimer = null;

  MapView.build(el.map, onHouseClick);

  /* ---------- 저장 (이어하기) / 설정 : 브라우저 localStorage 사용 ---------- */
  const SAVE_KEY = "embers-save-v1", SET_KEY = "embers-settings-v1";
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  function loadSave() {
    const d = store.get(SAVE_KEY);
    return d && GAME.scenes[d.id] && d.state && Array.isArray(d.tags) ? d : null;
  }
  let settings = Object.assign({ status: true, calm: false }, store.get(SET_KEY) || {});

  /* ---------- 시작 / 다시 시작 ---------- */
  function startGame() {
    stopMinigame();
    state = Object.assign({}, GAME.start);
    tags = [];
    heroNode = GAME.map.startNode;
    MapView.clearTrail();
    MapView.placeHero(heroNode);
    renderStatus();
    enterScene(GAME.meta.firstScene);
  }

  function continueGame() {
    const d = loadSave();
    if (!d) return startGame();
    stopMinigame();
    state = Object.assign({}, GAME.start, d.state);
    tags = d.tags.slice();
    heroNode = GAME.map.nodes[d.hero] ? d.hero : GAME.map.startNode;
    MapView.clearTrail();
    MapView.placeHero(heroNode);
    renderStatus();
    enterScene(d.id, d.opts || {});
  }

  /* ---------- 타이틀 화면 ---------- */
  const titleEl = $("title");
  function showTitle() {
    $("menuContinue").disabled = !loadSave();
    titleEl.hidden = false;
    requestAnimationFrame(() => titleEl.classList.remove("hide"));
  }
  function hideTitle() {
    titleEl.classList.add("hide");
    if (document.activeElement) document.activeElement.blur();
    setTimeout(() => { if (titleEl.classList.contains("hide")) titleEl.hidden = true; }, 750);
  }

  /* ---------- 설정 ---------- */
  function applySettings() {
    document.body.classList.toggle("hide-status", !settings.status);
    document.body.classList.toggle("calm", settings.calm);
    const a = $("optStatus"), b = $("optCalm");
    a.textContent = "수치 표시 · " + (settings.status ? "켬" : "끔");
    a.setAttribute("aria-pressed", settings.status);
    b.textContent = "움직임 줄이기 · " + (settings.calm ? "켬" : "끔");
    b.setAttribute("aria-pressed", settings.calm);
  }

  /* ---------- 장면 들어가기 ---------- */
  function enterScene(id, opts) {
    opts = opts || {};
    scene = GAME.scenes[id];
    if (!scene) { console.error("없는 장면:", id); return; }

    /* 장면에 들어가기 직전 상태를 저장 (이어하기용) */
    store.set(SAVE_KEY, { id: id, opts: opts, state: state, tags: tags, hero: heroNode });

    (scene.onEnter || []).forEach((o) => {
      if (checkCondition(o.when, state, tags)) {
        applyEffects(o.effects, state);
        (o.add || []).forEach((t) => tags.push(t));
      }
    });

    if (scene.type === "branch") {
      const b = scene.branch.find((x) => checkCondition(x.when, state, tags));
      return enterScene(b.next);
    }

    renderStatus();
    el.chapter.textContent = scene.chapter || "";
    pendingNext = null;
    pendingAction = null;
    el.choices.innerHTML = "";
    el.choices.className = "choice-list";
    el.next.hidden = true;
    el.next.textContent = "계속";

    if (scene.type === "map") return showMap();

    MapView.hide();
    setBackground(scene.image);

    /* 문장 목록: 기본 문장 + 조건 문장 + 인식 상태 문장 */
    beats = (scene.text || []).slice();
    (scene.textExtra || []).forEach((x) => {
      if (checkCondition(x.when, state, tags)) beats = beats.concat(x.text);
    });
    const v = scene.variants && scene.variants[getPerception(state)];
    if (v) beats.push(v);
    if (scene.type === "reflect") {
      beats.push(scene.question[getPerception(state)] || scene.question["흔들림"]);
    }
    if (opts.prefix) beats.unshift(opts.prefix);
    beatIdx = 0;
    mode = "beat";
    showBeat();
  }

  /* ---------- 문장 보여 주기 ---------- */
  function showBeat() {
    say(beats[beatIdx]);
    el.next.hidden = true;
    el.next.textContent = "계속";
    el.choices.innerHTML = "";
    el.choices.className = "choice-list";
    if (beatIdx < beats.length - 1) return (el.next.hidden = false);

    /* 마지막 문장 */
    if (scene.choices) return showChoices();
    if (scene.type === "reflect") return showReflectEnd();
    if (scene.type === "minigame") {
      el.next.textContent = "시작";
      el.next.hidden = false;
      pendingAction = () => runMinigame(scene);
      return;
    }
    pendingNext = scene.next;
    el.next.hidden = false;
  }

  function say(text, extra) {
    el.narration.classList.remove("fade");
    void el.narration.offsetWidth;
    el.narration.innerHTML = "";
    const p = document.createElement("span");
    p.textContent = text;
    el.narration.appendChild(p);
    if (extra) el.narration.appendChild(extra);
    el.narration.classList.add("fade");
  }

  /* ---------- 선택지 ---------- */
  function showChoices() {
    currentChoices = [];
    if (scene.prompt) say(beats[beatIdx] + "\n" + scene.prompt);
    scene.choices.forEach((c) => {
      const ok = !c.require || checkCondition(c.require, state, tags);
      if (!ok && !c.locked) return;               // 조건이 안 맞고 이유도 없으면 숨김
      const b = document.createElement("button");
      b.type = "button";
      b.className = "choice-button";
      const no = document.createElement("span");
      no.className = "no";
      no.textContent = currentChoices.length + 1 + ".";
      b.appendChild(no);
      b.appendChild(document.createTextNode(c.label));
      if (!ok) {
        b.disabled = true;
        const why = document.createElement("span");
        why.className = "why";
        const l = c.locked.find((x) => checkCondition(x.when, state, tags));
        why.textContent = l ? l.text : "";
        b.appendChild(why);
      } else {
        b.addEventListener("click", () => choose(c));
      }
      el.choices.appendChild(b);
      currentChoices.push(ok ? c : null);
    });
    mode = "choice";
  }

  function choose(c) {
    if (mode !== "choice") return;
    const o = c.outcomes ? (c.outcomes.find((x) => checkCondition(x.when, state, tags)) || c.outcomes[c.outcomes.length - 1]) : c;
    applyOutcome(o);
  }

  /* 선택/놀이의 결과 적용: 숫자 변화 -> 기록 -> 결과 문장 */
  function applyOutcome(o) {
    const before = Object.assign({}, state);
    applyEffects(o.effects, state);
    (o.add || []).forEach((t) => { if (!tags.includes(t)) tags.push(t); });

    el.choices.innerHTML = "";
    mode = "result";
    pendingNext = o.next;

    const deltas = STATS.filter((k) => state[k] !== before[k])
      .map((k) => k + " " + (state[k] > before[k] ? "▲" : "▼"));
    let d = null;
    if (deltas.length) {
      d = document.createElement("span");
      d.className = "delta";
      d.textContent = deltas.join("   ");
    }
    say(o.result || "", d);
    renderStatus(before);
    el.next.textContent = "계속";
    el.next.hidden = false;
  }

  /* ---------- 되돌아보기 끝 ---------- */
  function showReflectEnd() {
    store.del(SAVE_KEY);                       // 끝까지 했으면 이어하기 기록을 지웁니다
    const wrap = el.choices;
    wrap.className = "choice-list reflect-actions";
    const note = document.createElement("span");
    note.className = "mood";
    note.textContent = scene.note || "";
    wrap.appendChild(note);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "choice-button";
    b.textContent = "처음부터 다시";
    b.addEventListener("click", startGame);
    wrap.appendChild(b);
    mode = "end";
  }

  /* ---------- 마을 지도 ---------- */
  function showMap() {
    mode = "map";
    el.bgA.classList.remove("show");
    el.bgB.classList.remove("show");
    delete el.bgA.dataset.key; delete el.bgB.dataset.key;
    const v = scene.variants && scene.variants[getPerception(state)];
    say((scene.text || []).join(" ") + (v ? "\n" + v : ""));
    refreshMap();
    MapView.show();
  }

  function houseState(h) {
    if (tags.includes("방문:" + h.id)) return { state: "done", cost: 0 };
    if (!checkCondition(h.unlock, state, tags)) return { state: "locked", cost: 0 };
    const r = routeBetween(heroNode, h.node || h.id);
    return { state: "available", cost: r ? walkCost(r.length) : 0 };
  }

  function refreshMap() {
    const status = {};
    GAME.map.houses.forEach((h) => { status[h.id] = houseState(h); });
    MapView.update({ hero: heroNode, status });
  }

  function onHouseClick(id) {
    if (mode !== "map") return;
    const h = GAME.map.houses.find((x) => x.id === id);
    const s = houseState(h);
    if (s.state === "locked") return say(h.hint || "아직 갈 수 없다.");
    if (s.state === "done") return say("이미 다녀온 곳이다.");

    mode = "walking";
    const r = routeBetween(heroNode, h.node || h.id);
    say("걷는다…");
    MapView.walk(r.points, () => {
      heroNode = h.node || h.id;
      tags.push("방문:" + h.id);
      const before = Object.assign({}, state);
      if (s.cost > 0) applyEffects({ 기력: -s.cost }, state);
      renderStatus(before);
      enterScene(h.scene, { prefix: s.cost > 0 ? "먼 길을 걸어 숨이 차다." : null });
    });
  }

  /* ---------- 5초 놀이: 장작 줍기 ---------- */
  function runMinigame(sc) {
    mode = "minigame";
    const field = el.mini;
    field.hidden = false;
    field.innerHTML = '<div class="mini-hud"><span id="miniTime"></span><span id="miniCount"></span></div><div class="mini-field" id="miniField"></div>';
    const area = $("miniField"), tEl = $("miniTime"), cEl = $("miniCount");
    let count = 0, ended = false;
    const total = sc.seconds * 1000, t0 = performance.now();
    cEl.textContent = "모은 가지 0 / " + sc.goal;
    say("눌러서 줍는다!");

    function spawn() {
      if (ended) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "stick";
      b.setAttribute("aria-label", "마른 가지 줍기");
      b.style.left = 6 + Math.random() * 84 + "%";
      b.style.top = 6 + Math.random() * 80 + "%";
      b.style.setProperty("--rot", Math.floor(Math.random() * 120 - 60) + "deg");
      b.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (b.dataset.got) return;
        b.dataset.got = 1; count++;
        cEl.textContent = "모은 가지 " + count + " / " + sc.goal;
        b.classList.add("got");
        setTimeout(() => b.remove(), 200);
      });
      area.appendChild(b);
      setTimeout(() => b.remove(), 1300);
    }
    function tick() {
      const left = Math.max(0, total - (performance.now() - t0));
      tEl.textContent = "남은 시간 " + (left / 1000).toFixed(1) + "초";
      if (left <= 0) return finish();
      miniTimer = requestAnimationFrame(tick);
    }
    const spawner = setInterval(spawn, 420);
    spawn();
    function finish() {
      ended = true;
      clearInterval(spawner);
      stopMinigame();
      applyOutcome(count >= sc.goal ? sc.success : sc.fail);
    }
    el.mini._stop = () => { ended = true; clearInterval(spawner); };
    tick();
  }
  function stopMinigame() {
    if (miniTimer) cancelAnimationFrame(miniTimer);
    miniTimer = null;
    if (el.mini._stop) el.mini._stop();
    el.mini.hidden = true;
    el.mini.innerHTML = "";
  }

  /* ---------- 계속 ---------- */
  function advance() {
    if (!el.help.hidden || !$("settings").hidden || !titleEl.hidden) return;
    if (mode === "beat" && beatIdx < beats.length - 1) {
      beatIdx++;
      return showBeat();
    }
    if (pendingAction) {
      const a = pendingAction;
      pendingAction = null;
      el.next.hidden = true;
      return a();
    }
    if ((mode === "beat" || mode === "result") && pendingNext) {
      el.next.hidden = true;
      const n = pendingNext;
      pendingNext = null;
      enterScene(n);
    }
  }

  /* ---------- 배경 ---------- */
  function setBackground(key) {
    if (!key) return;
    const next = bgFront === "A" ? el.bgB : el.bgA;
    const prev = bgFront === "A" ? el.bgA : el.bgB;
    if (prev.dataset.key === key) return;
    next.className = "bg img-" + key + " show";
    next.dataset.key = key;
    prev.classList.remove("show");
    bgFront = bgFront === "A" ? "B" : "A";
  }

  /* ---------- 상태 표시 ---------- */
  function renderStatus(before) {
    el.status.innerHTML = "";
    STATS.forEach((k) => {
      const s = document.createElement("span");
      s.className = "stat" + (before && before[k] !== state[k] ? " flash" : "");
      s.appendChild(document.createTextNode(k));
      const dots = document.createElement("span");
      dots.className = "dots";
      for (let i = 1; i <= GAME.statMax; i++) {
        const d = document.createElement("i");
        d.className = "dot" + (i <= state[k] ? " on" : "");
        dots.appendChild(d);
      }
      s.appendChild(dots);
      el.status.appendChild(s);
    });
    const m = document.createElement("span");
    m.className = "mood";
    m.textContent = "마음 · " + getPerception(state);
    el.status.appendChild(m);
  }

  /* ---------- 입력 ---------- */
  el.next.addEventListener("click", (e) => { e.stopPropagation(); advance(); });
  el.screen.addEventListener("click", (e) => {
    if (e.target.closest("button") || e.target.closest(".overlay") || e.target.closest(".spot")) return;
    if (mode === "beat" || mode === "result") advance();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { el.help.hidden = true; $("settings").hidden = true; return; }
    if (!el.help.hidden || !$("settings").hidden || !titleEl.hidden) return;
    if (e.key === " " || e.key === "Enter") {
      if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".spot")) return;
      if (document.activeElement && document.activeElement.tagName === "BUTTON" && mode !== "beat" && mode !== "result") return;
      if (mode === "beat" || mode === "result") { e.preventDefault(); advance(); }
    } else if (mode === "choice" && /^[1-9]$/.test(e.key)) {
      const c = currentChoices[Number(e.key) - 1];
      if (c) choose(c);
    }
  });
  $("btnHelp").addEventListener("click", () => { el.help.hidden = false; });
  $("btnHelpClose").addEventListener("click", () => { el.help.hidden = true; });
  $("btnRestart").addEventListener("click", startGame);

  /* 타이틀 메뉴 */
  $("menuStart").addEventListener("click", () => { hideTitle(); startGame(); });
  $("menuContinue").addEventListener("click", () => { if (loadSave()) { hideTitle(); continueGame(); } });
  $("menuHelp").addEventListener("click", () => { el.help.hidden = false; });
  $("menuSettings").addEventListener("click", () => { $("settingsNote").textContent = ""; $("settings").hidden = false; });
  $("btnTitle").addEventListener("click", () => { if (!MapView.isWalking()) { stopMinigame(); showTitle(); } });

  /* 설정 */
  $("optStatus").addEventListener("click", () => { settings.status = !settings.status; store.set(SET_KEY, settings); applySettings(); });
  $("optCalm").addEventListener("click", () => { settings.calm = !settings.calm; store.set(SET_KEY, settings); applySettings(); });
  $("optClear").addEventListener("click", () => { store.del(SAVE_KEY); $("menuContinue").disabled = true; $("settingsNote").textContent = "저장된 진행을 지웠습니다."; });
  $("btnSettingsClose").addEventListener("click", () => { $("settings").hidden = true; });

  applySettings();
  showTitle();
})();
