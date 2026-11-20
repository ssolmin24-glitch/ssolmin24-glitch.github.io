/* =====================================================================
   「불씨」 장면 데이터 파일  (scenes.js)
   ---------------------------------------------------------------------
   이 파일에는 게임의 모든 이야기, 선택지, 숫자 변화, 엔딩이 들어 있습니다.
   게임 화면(엔진)은 이 파일을 읽어서 장면을 하나씩 보여 주기만 하면 됩니다.
   이야기를 고치고 싶을 때는 이 파일의 글과 숫자만 바꾸세요.

   ■ 숫자(수치) 3개 : 죄책감 / 신뢰 / 기력   (0~10, 넘치면 그 선에서 멈춤)
   ■ 기록(tags)     : 도끼, 담요, 거짓말, 호의, 믿음표현, 먼저다가감
   ■ 인식 상태      : 자책 / 경계 / 열림 / 흔들림 (아래 getPerception 규칙)

   ■ 장면 한 개의 구조
     type      : "scene"(기본) | "branch"(자동 분기) | "ending"(엔딩) | "reflect"(되돌아보기)
                 | "map"(마을 지도 화면) | "minigame"(5초 놀이: success / fail 결과를 가짐)
     chapter   : 화면 위쪽에 표시할 장 이름
     image     : 그림 이름 (맨 아래 IMAGES 표 참고)
     text      : 한 번에 한 줄씩 보여 줄 문장들
     variants  : 인식 상태에 따라 text 뒤에 붙는 문장 (자책/경계/열림/흔들림)
     textExtra : 조건이 맞을 때만 붙는 문장 [{ when, text }]
     onEnter   : 장면에 들어오면 자동으로 적용되는 변화 [{ when, effects, add }]
     prompt    : 선택지 위에 보여 줄 질문
     choices   : 선택지 목록
     next      : 선택지가 없는 장면에서 [계속] 눌렀을 때 이동할 장면

   ■ 선택지 한 개의 구조
     label     : 버튼 글자
     require   : 이 조건이 맞아야 누를 수 있음 (조건 형식은 아래)
     locked    : require가 안 맞을 때 잠긴 버튼으로 보여 줄 이유 [{ when, text }]
                 (locked가 없으면 조건이 안 맞는 선택지는 아예 숨김)
     effects   : 숫자 변화  예) { 신뢰: +1, 기력: -1 }
     add       : 추가할 기록  예) ["거짓말"]
     result    : 선택 직후 보여 줄 결과 문장 (사건 카드)
     next      : 다음 장면
     outcomes  : 같은 선택이라도 조건에 따라 결과가 달라질 때 [{ when, effects, add, result, next }]
                 위에서부터 처음으로 맞는 것 하나만 적용. when이 없는 마지막 항목이 "그 외".

   ■ 조건 형식(when / require)
     { stat: { 죄책감: [최소, 최대], 신뢰: [최소, 최대] },   // 숫자 범위
       has:   ["도끼"],            // 모두 가지고 있어야 함
       lacks: ["거짓말"],          // 하나도 없어야 함
       any:   ["호의","믿음표현"] } // 이 중 하나라도 있어야 함
   ===================================================================== */

const GAME = {

  /* ---------- 기본 설정 ---------- */
  meta: { title: "불씨", playMinutes: "약 10분", firstScene: "p0_site" },
  start: { 죄책감: 5, 신뢰: 5, 기력: 10 },
  statMin: 0,
  statMax: 10,

  /* ---------- 화면에 쓸 그림 이름 (미드저니 장면 번호와 연결) ---------- */
  IMAGES: {
    burnt_house: "불탄 집터 (프롤로그)",
    village_door: "윗마을 첫 집의 닫힌 문 (1장)",
    cottage_dusk: "해 질 무렵 노부부의 집 (2장)",
    han_house: "한 씨 집 앞 (3장)",
    snow_night: "눈길의 밤 (4장)",
    far_light: "먼 불빛 한 채 (5장)",
    ending_a: "엔딩 A: 함께 앉는 불",
    ending_b: "엔딩 B: 문 앞의 불",
    ending_c: "엔딩 C: 혼자 지키는 불",
    path_view: "지나온 길 (되돌아보기)",
    rescued: "쓰러진 주인공과 다가오는 등불 (5장)",
    well: "마을 우물 (선택 방문)",
    woodpile: "길가의 장작더미 (선택 방문)",
    empty_house: "비어 있는 집 (선택 방문)",
    village_map: "마을 지도 (코드로 그리는 화면)"
  },

  /* ---------- 마을 지도 ----------
     nodes  : 길의 지점 이름과 좌표 [x, y]  (지도 크기 1600 x 900)
     edges  : 두 지점을 잇는 길 [시작, 끝, [중간 꺾임 좌표들]]
     walk   : 걷는 거리가 freeUnder 보다 짧으면 기력 0, farOver 보다 길면 -2, 그 사이는 -1
     houses : 지도 위의 눌러 볼 곳
              scene  = 눌렀을 때 열리는 장면
              unlock = 갈 수 있게 되는 조건 (방문한 곳은 "방문:집이름" 기록이 생김)
              hint   = 아직 잠겨 있을 때 보여 줄 말 */
  map: {
    startNode: "site",
    walk: { freeUnder: 600, farOver: 1100 },
    nodes: {
      site: [190, 640], j1: [420, 590], j2: [700, 540], j3: [1120, 500],
      wood: [330, 655], empty: [330, 380], h1: [640, 320], well: [770, 650],
      h2: [1100, 650], han: [1400, 310], far: [140, 230]
    },
    edges: [
      ["site", "j1", [[300, 630]]],
      ["j1", "wood", []],
      ["j1", "j2", [[560, 560]]],
      ["j1", "empty", [[390, 480]]],
      ["j2", "h1", [[690, 440]]],
      ["j2", "well", [[735, 600]]],
      ["j2", "j3", [[900, 520], [1010, 490]]],
      ["j3", "h2", [[1110, 580]]],
      ["j3", "han", [[1240, 430], [1320, 350]]]
    ],
    houses: [
      { id: "h1", name: "윗마을 첫 집", kind: "house", scene: "ch1_house",
        style: { body: "#8b81c2", roof: "#5f548f", lit: true } },
      { id: "h2", name: "아랫마을 노부부 집", kind: "house", scene: "ch2_house",
        unlock: { has: ["방문:h1"] },
        hint: "아랫마을 불빛은 멀다. 먼저 가까운 집부터 두드려 보자.",
        style: { body: "#9a7fa8", roof: "#6d5278", lit: true, s: 0.9 } },
      { id: "han", name: "한 씨 집", kind: "house", scene: "ch3_han",
        unlock: { has: ["방문:h1", "방문:h2"] },
        hint: "마을 끝의 한 씨 집. 다른 집들을 돌아보기 전에는 발이 떨어지지 않는다.",
        style: { body: "#7388b8", roof: "#465a8e", lit: true } },
      { id: "well", name: "마을 우물", kind: "well", scene: "opt_well" },
      { id: "wood", name: "장작더미", kind: "woodpile", scene: "opt_wood" },
      { id: "empty", name: "빈 집", kind: "empty", scene: "opt_empty",
        style: { body: "#6b6890", roof: "#4a4770", lit: false } }
    ]
  },

  /* ---------- 장면 ---------- */
  scenes: {

    /* ===== 프롤로그 ===== */
    p0_site: {
      chapter: "프롤로그",
      image: "burnt_house",
      text: [
        "불은 꺼졌다.",
        "남은 것은 검게 탄 기둥과, 내가 끄지 않고 나간 난로 자리뿐이다.",
        "눈이 재 위에 소리 없이 내려앉는다."
      ],
      prompt: "이 자리에서, 나는 이렇게 생각한다.",
      choices: [
        { label: "내가 불을 냈다. 전부 내 탓이다.",
          effects: { 죄책감: +3, 기력: -1 },
          result: "숨이 막힌다. 모든 일이 내 손에서 시작된 것만 같다.",
          next: "p0_item" },
        { label: "어쩔 수 없었다. 누구라도 그랬을 거다.",
          effects: { 죄책감: -1, 신뢰: -1 },
          result: "그렇게 말하고 나니, 마음 한구석이 차갑게 닫힌다.",
          next: "p0_item" },
        { label: "내 잘못이 있다. 하지만 그날의 전부는 아니다.",
          effects: { 죄책감: +1, 신뢰: +1 },
          result: "무겁지만, 숨은 쉴 수 있다.",
          next: "p0_item" }
      ]
    },

    p0_item: {
      chapter: "프롤로그",
      image: "burnt_house",
      text: [
        "떠나기 전에, 하나만 챙길 수 있다.",
        "그을리지 않은 것은 두 가지뿐이다."
      ],
      prompt: "무엇을 챙길까?",
      choices: [
        { label: "담요  (밤의 추위를 덜 탄다)",
          add: ["담요"],
          result: "아직 온기가 남은 담요를 어깨에 두른다.",
          next: "village_map" },
        { label: "도끼  (일을 해 주고 호의를 구할 수 있다)",
          add: ["도끼"],
          result: "손잡이가 그을린 도끼를 허리에 찬다.",
          next: "village_map" }
      ]
    },

    /* ===== 1장: 윗마을 첫 집 (모든 선택이 거절로 끝남) ===== */
    ch1_house: {
      chapter: "1장 · 윗마을",
      image: "village_door",
      text: [
        "윗마을 첫 집. 굴뚝에서 연기가 오른다.",
        "창문 틈으로 부인이 내다본다.",
        "\"한 씨네가 그러더라. 불씨를 안 끄고 나갔다고.\""
      ],
      variants: {
        자책: "그 말이 가슴에 박힌다. 내가 문을 두드릴 자격이 있을까.",
        경계: "이 사람도 나를 보고 있다. 무슨 말이 나올지 알 수 없다.",
        열림: "겁먹은 얼굴이다. 나쁜 사람 같지는 않다."
      },
      prompt: "어떻게 부탁할까?",
      choices: [
        { label: "솔직하게  \"불을 낸 사람입니다. 하룻밤만 부탁드립니다.\"",
          effects: { 죄책감: +1, 기력: -1 },
          result: "말이 끝나기도 전에 문이 닫힌다.",
          next: "village_map" },
        { label: "낮추어  \"죄송합니다, 너무 추워서요.\"",
          effects: { 신뢰: -1, 기력: -1 },
          result: "대답 없이 문이 닫힌다.",
          next: "village_map" },
        { label: "대가를 내밀며  \"일이라도 하겠습니다.\"",
          effects: { 신뢰: -1, 기력: -2 },
          result: "창문의 커튼이 소리 없이 내려온다.",
          next: "village_map" },
        { label: "숨기고  \"길을 잃은 나그네입니다.\"",
          effects: { 죄책감: +2, 기력: -1 },
          add: ["거짓말"],
          result: "부인이 얼굴을 살핀다. \"그을음이 묻었구나. 불난 집 사람이로구나.\" 문이 닫힌다.",
          next: "village_map" },
        { label: "문을 두드리지 않고 지나친다",
          effects: { 죄책감: +1 },
          result: "손을 들었다가 내린다. 두드리지 못하고 지나친다.",
          next: "village_map" }
      ]
    },

    /* ===== 2장: 아랫마을 노부부 (부분 호의가 가능) ===== */
    ch2_house: {
      chapter: "2장 · 아랫마을",
      image: "cottage_dusk",
      text: [
        "아랫마을 끝, 낮은 지붕의 집.",
        "창가에 노부부의 그림자가 어른거린다.",
        "\"…누구요?\""
      ],
      variants: {
        자책: "내 얼굴이 그 소문의 얼굴일까 봐, 고개가 숙여진다.",
        경계: "아까처럼 문이 닫힐 것 같다. 몸이 먼저 움츠러든다.",
        열림: "한 번쯤은 열릴지도 모른다."
      },
      prompt: "어떻게 부탁할까?",
      choices: [
        { label: "솔직하게  \"불을 낸 사람입니다. 하룻밤만 부탁드립니다.\"",
          outcomes: [
            { when: { stat: { 죄책감: [0, 6] } },
              effects: { 죄책감: -1, 기력: +1 },
              add: ["호의"],
              result: "노인이 문을 조금 연다. \"사정은 알겠소. 방은 없지만, 물은 드리리다.\" 물 한 바가지가 손에 쥐어진다.",
              next: "village_map" },
            { effects: { 죄책감: +1, 기력: -1 },
              result: "\"저는, 제가…\" 말이 목에 걸려 끝맺지 못한다. 문이 조용히 닫힌다.",
              next: "village_map" }
          ] },
        { label: "낮추어  \"죄송합니다, 너무 추워서요.\"",
          effects: { 기력: -1 },
          result: "\"미안하우, 방이 없구려.\" 거절이지만 목소리가 거칠지는 않다.",
          next: "village_map" },
        { label: "대가를 내밀며  \"일이라도 하겠습니다.\"",
          outcomes: [
            { when: { has: ["도끼"] },
              effects: { 신뢰: +1, 죄책감: -1, 기력: +2 },
              add: ["호의"],
              result: "도끼로 장작을 한 단 패 놓는다. 노부인이 누룽지 한 그릇을 문틈으로 내민다. \"먹고 가게.\"",
              next: "village_map" },
            { effects: { 신뢰: -1, 기력: -1 },
              result: "내밀 것이 없다. \"그냥은 곤란하오.\" 문이 닫힌다.",
              next: "village_map" }
          ] },
        { label: "숨기고  \"길을 잃은 나그네입니다.\"",
          outcomes: [
            { when: { has: ["거짓말"] },
              effects: { 죄책감: +2, 신뢰: -1, 기력: -1 },
              add: ["거짓말"],
              result: "\"윗마을에서 거짓말하는 나그네가 온다더니.\" 소문이 먼저 도착해 있었다.",
              next: "village_map" },
            { effects: { 죄책감: +2, 기력: -1 },
              add: ["거짓말"],
              result: "\"나그네라고? 눈빛이 그렇지 않구려.\" 문이 닫힌다.",
              next: "village_map" }
          ] },
        { label: "문을 두드리지 않고 지나친다",
          effects: { 죄책감: +1 },
          result: "손을 들었다가 내린다. 두드리지 못하고 지나친다.",
          next: "village_map" }
      ]
    },

    /* ===== 마을 지도: 갈 곳을 고르는 화면 ===== */
    village_map: {
      type: "map",
      chapter: "마을",
      image: "village_map",
      text: [ "어디로 갈까." ],
      variants: {
        자책: "어느 문도 내게 열릴 것 같지 않다.",
        경계: "어느 문이 또 닫힐까.",
        열림: "불이 켜진 창이 몇 개 보인다."
      }
    },

    /* ===== 선택 방문 1: 우물 ===== */
    opt_well: {
      chapter: "마을 우물",
      image: "well",
      text: [
        "마을 한가운데 우물.",
        "두레박 끝에 얼음이 얼어 있다."
      ],
      variants: {
        자책: "물에 비칠 내 얼굴이 두렵다.",
        경계: "누가 보고 있을까 봐 주위를 살핀다.",
        열림: "물동이 자국이 눈 위에 선명하다. 사람이 오가는 길이다."
      },
      prompt: "우물가에서",
      choices: [
        { label: "물을 길어 마신다",
          effects: { 기력: +1 },
          result: "찬물이 목을 지나자 정신이 든다.",
          next: "village_map" },
        { label: "물에 비친 얼굴을 한참 들여다본다",
          effects: { 죄책감: +1 },
          result: "그을음이 남은 얼굴. 그날의 얼굴이다.",
          next: "village_map" },
        { label: "그냥 지나친다",
          result: "발길을 돌린다.",
          next: "village_map" }
      ]
    },

    /* ===== 선택 방문 2: 장작더미 (5초 놀이) ===== */
    opt_wood: {
      chapter: "장작더미",
      image: "woodpile",
      text: [
        "길가의 장작더미. 주인 없는 마른 가지가 눈에 묻혀 있다.",
        "불이 필요한 밤이 올 것이다."
      ],
      prompt: "어떻게 할까?",
      choices: [
        { label: "마른 가지를 주워 모은다  (5초 놀이)",
          result: "소매를 걷고 몸을 숙인다.",
          next: "opt_wood_game" },
        { label: "지나친다",
          result: "손을 대지 않고 지나친다.",
          next: "village_map" }
      ]
    },

    opt_wood_game: {
      type: "minigame",
      game: "firewood",
      seconds: 5,
      goal: 4,
      chapter: "장작더미",
      image: "woodpile",
      text: [
        "5초 동안, 눈 사이로 드러나는 마른 가지를 눌러 주워 모은다.",
        "4개 이상이면 밤을 날 만큼이다."
      ],
      success: {
        effects: { 기력: -1 },
        add: ["장작"],
        result: "팔이 뻐근하지만, 밤을 버틸 만큼은 모았다.",
        next: "village_map"
      },
      fail: {
        effects: { 기력: -1 },
        result: "손이 얼어 몇 개밖에 쥐지 못했다. 이걸로는 부족하다.",
        next: "village_map"
      }
    },

    /* ===== 선택 방문 3: 빈 집 ===== */
    opt_empty: {
      chapter: "빈 집",
      image: "empty_house",
      text: [
        "길에서 비켜선 빈 집. 창은 깨져 있고, 문이 바람에 흔들린다.",
        "누가 떠난 걸까. 아니면, 누가 쫓겨난 걸까."
      ],
      variants: {
        자책: "나도 이렇게 비워 두고 떠나온 자리가 있다.",
        경계: "사람이 없어서 오히려 안심이 된다.",
        열림: "누군가 살았던 온기가 벽에 아직 남아 있는 것 같다."
      },
      prompt: "어떻게 할까?",
      choices: [
        { label: "들어가 본다",
          outcomes: [
            { when: { lacks: ["담요"] },
              effects: { 죄책감: +1 },
              add: ["담요"],
              result: "장롱에서 낡은 담요 한 장을 찾는다. 남의 것을 가져가는 것 같아 마음이 무겁다.",
              next: "village_map" },
            { effects: { 기력: +1 },
              result: "식은 난로 곁에 앉아 잠시 숨을 돌린다. 이 집의 불도 꺼진 지 오래다.",
              next: "village_map" }
          ] },
        { label: "열린 문을 닫아 주고 지나간다",
          effects: { 죄책감: -1 },
          result: "아무도 모를 작은 일이다. 그래도 마음 한쪽이 가벼워진다.",
          next: "village_map" }
      ]
    },

    /* ===== 3장: 믿었던 이웃 한 씨 (불신) ===== */
    ch3_han: {
      chapter: "3장 · 한 씨 집",
      image: "han_house",
      onEnter: [
        { when: { has: ["거짓말"] }, effects: { 죄책감: +1 } }
      ],
      text: [
        "마을 끝, 한 씨 집.",
        "불이 난 날 밤, \"내일 우리 집으로 오게\" 하던 사람이다.",
        "문이 열린다. 한 씨는 내 눈을 보지 못한다.",
        "\"미안하네. 마을에 말한 게 나야. 겁이 났어. 자네를 들일 수는 없네.\""
      ],
      textExtra: [
        { when: { has: ["거짓말"] },
          text: ["\"그리고… 다른 집에서 거짓말을 했다는 얘기도 들었네.\""] }
      ],
      variants: {
        자책: "그의 말이 맞다는 생각이 먼저 든다.",
        경계: "믿었던 만큼, 이 문이 가장 차갑다.",
        열림: "원망보다 먼저, 그의 떨리는 손이 눈에 들어온다."
      },
      prompt: "나는 어떻게 반응할까?",
      choices: [
        { label: "따져 묻는다  \"어떻게 그럴 수 있어요.\"",
          effects: { 신뢰: -3, 죄책감: -1, 기력: -1 },
          result: "한 씨는 고개를 숙인 채 말이 없다. 문이 닫힌다.",
          next: "ch4_night" },
        { label: "말없이 받아들인다",
          effects: { 신뢰: -2, 죄책감: +2, 기력: -1 },
          result: "\"…알겠습니다.\" 그의 말이 맞다는 생각만 남는다.",
          next: "ch4_night" },
        { label: "\"그래도 저는 당신을 믿었습니다.\"",
          effects: { 신뢰: -1 },
          add: ["믿음표현"],
          result: "한 씨의 어깨가 흔들린다. 문이 닫히기 전, 그가 작게 말한다. \"…미안하네.\"",
          next: "ch4_night" },
        { label: "대답 없이 돌아선다",
          effects: { 신뢰: -2 },
          result: "등 뒤에서 문 닫히는 소리가 오래 들린다.",
          next: "ch4_night" }
      ]
    },

    /* ===== 4장: 눈길의 밤 (가장 낮은 지점) ===== */
    ch4_night: {
      chapter: "4장 · 눈길의 밤",
      image: "snow_night",
      onEnter: [
        { when: { has: ["담요"] },   effects: { 기력: -1 } },
        { when: { lacks: ["담요"] }, effects: { 기력: -2 } }
      ],
      text: [
        "밤이 깊어진다. 눈이 그치지 않는다.",
        "손끝이 감각을 잃어 간다.",
        "불이 필요하다. 그런데, 불이 가장 무섭다."
      ],
      variants: {
        자책: "내가 또 불을 다루면 무엇이 타 버릴까.",
        경계: "어디에서도 문이 열리지 않을 것 같다.",
        열림: "멀리 어딘가에는 아직 불이 있을 것이다."
      },
      prompt: "이 밤을 어떻게 견딜까?",
      choices: [
        { label: "불을 피운다",
          outcomes: [
            { when: { has: ["장작"], stat: { 죄책감: [0, 8] } },
              effects: { 기력: +3, 죄책감: -1 },
              result: "낮에 모아 둔 장작이 있다. 불꽃이 서자 오래 타오른다. 그날 이후 처음 피운 불이다. 손이 떨리지만, 꺼지지 않는다.",
              next: "ch4_end" },
            { when: { stat: { 죄책감: [0, 7] } },
              effects: { 기력: +2, 죄책감: -1 },
              result: "부싯돌을 몇 번 긋자 작은 불꽃이 선다. 그날 이후 처음 피운 불이다. 손이 떨리지만, 꺼지지 않는다.",
              next: "ch4_end" },
            { effects: { 죄책감: +1 },
              result: "부싯돌을 쥔 손이 떨려 불꽃이 서지 않는다. 불이 나를 용서하지 않을 것만 같다.",
              next: "ch4_end" }
          ] },
        { label: "불 없이 웅크린다",
          effects: { 기력: -2, 죄책감: +1, 신뢰: -1 },
          result: "몸을 말고 눈을 감는다. 추위가 벌처럼 느껴진다.",
          next: "ch4_end" },
        { label: "거절한 사람들을 원망한다",
          effects: { 신뢰: -2, 죄책감: -1 },
          result: "그 집들, 그 사람. 하나하나 떠올린다. 분노가 잠깐 몸을 데우다가, 곧 식는다.",
          next: "ch4_end" },
        { label: "오늘 받은 작은 호의를 떠올린다",
          require: { any: ["호의", "믿음표현"] },
          locked: [ { when: {}, text: "떠올릴 만한 호의가 아직 없다." } ],
          effects: { 신뢰: +2, 죄책감: -1 },
          result: "손에 쥐었던 것, 닫히기 전 들렸던 \"미안하네\". 작은 것들이 가슴 안쪽에서 희미하게 켜진다.",
          next: "ch4_end" }
      ]
    },

    /* 4장 이후 자동 분기: 기력이 1 이하이면 쓰러진 채 발견됨 */
    ch4_end: {
      type: "branch",
      branch: [
        { when: { stat: { 기력: [0, 1] } }, next: "ch5_rescued" },
        { next: "ch5_light" }
      ]
    },

    /* ===== 5장: 먼 불빛 (다시 믿을지 결심) ===== */
    ch5_light: {
      chapter: "5장 · 먼 불빛",
      image: "far_light",
      text: [
        "눈보라 너머, 가느다란 연기가 오르는 작은 집이 보인다.",
        "창에 희미한 불빛. 누군가 있다.",
        "한 번 더, 문을 두드릴 수 있을까."
      ],
      variants: {
        자책: "내가 가면 저 불도 꺼질 것 같다.",
        경계: "저 문도 닫힐 것이다. 그래도 불빛은 따뜻해 보인다.",
        열림: "발이 저절로 그쪽을 향한다."
      },
      prompt: "저 불빛에 어떻게 다가갈까?",
      choices: [
        { label: "다가가 먼저 말을 건넨다",
          effects: { 신뢰: +1, 기력: -1 },
          add: ["먼저다가감"],
          result: "문 앞에 서서 먼저 말을 건넨다. \"저기, 계세요?\" 안에서 의자를 끄는 소리가 난다.",
          next: "ch5_decide" },
        { label: "문 앞에 땔감만 두고 물러선다",
          require: { has: ["장작"] },
          locked: [ { when: {}, text: "두고 갈 땔감이 없다." } ],
          effects: { 죄책감: -1, 기력: -1 },
          result: "모아 둔 장작을 문 앞에 쌓아 두고 물러선다. 잠시 뒤 문이 열리고, 누군가 땔감을 들이고는 나를 바라본다.",
          next: "ch5_decide" },
        { label: "불빛을 보고도 지나친다",
          effects: { 죄책감: +1, 신뢰: -1 },
          result: "불빛에서 고개를 돌린다. 발소리를 눈이 삼킨다.",
          next: "ch5_return" }
      ]
    },

    ch5_return: {
      chapter: "5장 · 먼 불빛",
      image: "far_light",
      text: [
        "몇 걸음 뒤, 등 뒤에서 기침 소리가 들린다.",
        "누군가 불을 지키다 지친 소리다."
      ],
      prompt: "어떻게 할까?",
      choices: [
        { label: "돌아간다",
          result: "발을 돌린다. 눈길에 내 발자국이 두 줄로 남는다.",
          next: "ch5_decide_return" },
        { label: "계속 걷는다",
          result: "걸음을 멈추지 않는다. 불빛이 점점 작아진다.",
          next: "end_C" }
      ]
    },

    ch5_rescued: {
      chapter: "5장 · 먼 불빛",
      image: "rescued",
      onEnter: [ { effects: { 신뢰: +1 } } ],
      text: [
        "다리가 풀려 눈 위에 주저앉는다.",
        "멀리서 등불이 흔들리며 다가온다.",
        "\"이봐요, 괜찮아요?\" 누군가 어깨를 감싼다."
      ],
      next: "ch5_decide"
    },

    /* ----- 최종 결심: 사람을 믿을 것인가 ----- */
    ch5_decide: {
      chapter: "5장 · 먼 불빛",
      image: "far_light",
      text: [
        "문이 열려 있고, 불가에 자리가 하나 비어 있다.",
        "손을 내밀기만 하면 된다. 그런데 손이 쉽게 움직이지 않는다."
      ],
      variants: {
        자책: "나는 이 자리에 앉아도 되는 사람일까.",
        경계: "또 문이 닫히면 어쩌나. 그래도 불은 따뜻하다.",
        열림: "이번에는 내가 먼저 손을 내밀어 본다."
      },
      prompt: "나는 어떻게 할까?",
      choices: [
        { label: "손을 잡고 불가에 앉는다",
          require: { stat: { 신뢰: [4, 10], 죄책감: [0, 8] } },
          locked: [
            { when: { stat: { 죄책감: [9, 10] } }, text: "함께 앉을 자격이 없다는 생각이 손을 붙든다." },
            { when: { stat: { 신뢰: [0, 3] } },   text: "손이 아직 떨린다." }
          ],
          result: "내민 손을 마주 잡는다. 따뜻하다.",
          next: "end_A" },
        { label: "문 앞까지만 들어가 조건을 말한다  \"하룻밤만, 문 가까이에서요.\"",
          require: { stat: { 신뢰: [2, 10] } },
          locked: [ { when: {}, text: "아직 문 안으로는 들어갈 수 없다." } ],
          result: "문턱에 서서 작게 말한다. \"하룻밤만, 문 가까이에서요.\" 상대는 고개를 끄덕이고 문을 반쯤 열어 둔다.",
          next: "end_B" },
        { label: "고맙다고만 하고 혼자 불을 지킨다",
          result: "\"고맙습니다.\" 그 말만 남기고, 조금 떨어진 곳에서 불을 지킨다.",
          next: "end_C" }
      ]
    },

    /* 지나쳤다가 돌아온 경우: 함께 앉는 선택은 나오지 않음 */
    ch5_decide_return: {
      chapter: "5장 · 먼 불빛",
      image: "far_light",
      text: [
        "문이 반쯤 열리고, 낯선 얼굴이 내다본다.",
        "\"…오셨군요.\""
      ],
      prompt: "나는 어떻게 할까?",
      choices: [
        { label: "문 앞까지만 들어가 조건을 말한다  \"하룻밤만, 문 가까이에서요.\"",
          require: { stat: { 신뢰: [2, 10] } },
          locked: [ { when: {}, text: "아직 문 안으로는 들어갈 수 없다." } ],
          result: "문턱에 서서 작게 말한다. \"하룻밤만, 문 가까이에서요.\" 상대는 고개를 끄덕인다.",
          next: "end_B" },
        { label: "고맙다고만 하고 혼자 불을 지킨다",
          result: "\"고맙습니다.\" 그 말만 남기고, 조금 떨어진 곳에서 불을 지킨다.",
          next: "end_C" }
      ]
    },

    /* ===== 엔딩 3개 ===== */
    end_A: {
      type: "ending", ending: "A",
      chapter: "엔딩 A · 함께 앉는 불",
      image: "ending_a",
      text: [ "불가에 손이 하나 더 늘었다." ],
      textExtra: [
        { when: { stat: { 죄책감: [6, 10] } },
          text: [ "무게가 사라진 건 아니다. 다만 혼자 들고 있지 않을 뿐이다." ] }
      ],
      next: "reflect"
    },
    end_B: {
      type: "ending", ending: "B",
      chapter: "엔딩 B · 문 앞의 불",
      image: "ending_b",
      text: [
        "문은 반쯤 열려 있고, 불빛은 내 쪽까지 닿는다.",
        "오늘은 여기까지면 충분하다."
      ],
      next: "reflect"
    },
    end_C: {
      type: "ending", ending: "C",
      chapter: "엔딩 C · 혼자 지키는 불",
      image: "ending_c",
      text: [
        "불은 꺼지지 않았다. 문도 닫히지 않았다.",
        "언젠가 이 문을 내가 먼저 열지도 모른다."
      ],
      next: "reflect"
    },

    /* ===== 되돌아보기: 질문 하나 (답은 저장하지 않음) ===== */
    reflect: {
      type: "reflect",
      chapter: "되돌아보기",
      image: "path_view",
      text: [ "지나온 길을 천천히 돌아본다." ],
      question: {
        자책: "마음속에서 100%로 안고 있는 일이 있다면, 그 일의 다른 원인에는 무엇이 있었을까?",
        경계: "한 번 실망시킨 사람이 있어도, 모든 사람이 같을까?",
        열림: "오늘 받은 작은 호의는 무엇이었나?",
        흔들림: "오늘 받은 작은 호의는 무엇이었나?"
      },
      note: "답은 저장되지 않아요. 적지 않아도 괜찮아요.",
      next: null
    }
  }
};

/* =====================================================================
   도우미 함수 (엔진에서 가져다 쓰는 규칙)
   ===================================================================== */

/* 인식 상태: 위에서부터 먼저 맞는 것 하나 */
function getPerception(state) {
  if (state.죄책감 >= 8) return "자책";
  if (state.신뢰 <= 3) return "경계";
  if (state.신뢰 >= 6 && state.죄책감 <= 5) return "열림";
  return "흔들림";
}

/* 조건 확인: state = { 죄책감, 신뢰, 기력 }, tags = ["도끼", ...] */
function checkCondition(cond, state, tags) {
  if (!cond) return true;
  if (cond.stat) {
    for (const k in cond.stat) {
      if (state[k] < cond.stat[k][0] || state[k] > cond.stat[k][1]) return false;
    }
  }
  if (cond.has   && !cond.has.every(t => tags.includes(t))) return false;
  if (cond.lacks &&  cond.lacks.some(t => tags.includes(t))) return false;
  if (cond.any   && !cond.any.some(t => tags.includes(t))) return false;
  return true;
}

/* 숫자 변화 적용 (0~10 범위 유지) */
function applyEffects(effects, state) {
  if (!effects) return;
  for (const k in effects) {
    state[k] = Math.max(GAME.statMin, Math.min(GAME.statMax, state[k] + effects[k]));
  }
}


/* ---------- 지도 도우미: 두 지점 사이의 가장 짧은 길 찾기 ---------- */
function routeBetween(from, to) {
  const M = GAME.map, adj = {};
  M.edges.forEach(([a, b, via]) => {
    const v = via || [];
    (adj[a] = adj[a] || []).push({ to: b, pts: v.concat([M.nodes[b]]) });
    (adj[b] = adj[b] || []).push({ to: a, pts: v.slice().reverse().concat([M.nodes[a]]) });
  });
  const dist = { [from]: 0 }, prev = {}, todo = new Set(Object.keys(M.nodes));
  const seg = (p) => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i-1][0], q[1] - p[i-1][1]) : 0, 0);
  while (todo.size) {
    let u = null;
    todo.forEach((n) => { if (dist[n] !== undefined && (u === null || dist[n] < dist[u])) u = n; });
    if (u === null || u === to) break;
    todo.delete(u);
    (adj[u] || []).forEach((e) => {
      const d = dist[u] + seg([M.nodes[u]].concat(e.pts));
      if (dist[e.to] === undefined || d < dist[e.to]) { dist[e.to] = d; prev[e.to] = { from: u, pts: e.pts }; }
    });
  }
  if (dist[to] === undefined) return null;
  let pts = [], n = to;
  while (n !== from) { pts = prev[n].pts.concat(pts); n = prev[n].from; }
  return { points: [M.nodes[from]].concat(pts), length: dist[to] };
}

/* 걷는 거리 -> 기력 소모 (0, 1, 2) */
function walkCost(length) {
  const w = GAME.map.walk;
  return length < w.freeUnder ? 0 : length < w.farOver ? 1 : 2;
}

/* 브라우저와 Node 양쪽에서 쓸 수 있게 내보내기 */
if (typeof module !== "undefined") {
  module.exports = { GAME, getPerception, checkCondition, applyEffects, routeBetween, walkCost };
}
