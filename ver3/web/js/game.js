/* 宇宙パトロール — ゲーム本体(ver23: インベーダー型のシューティング。BGM あり)
 * 遊び方: 自分の船を左右に動かし、光線で宇宙人を星に変える。宇宙人の群れは左右に動きながら少しずつ下りてくる。
 *         群れを全部星に変えると次の波へ。宇宙人の弾に当たると船が1つ減る。宇宙人が地上に着くか、船が無くなるとゲームオーバー。
 * 操作: 左右キー=移動、決定か上キー=撃つ(押しっぱなしで連射)、下キー=BGM のオン・オフ、戻る=一時停止。タッチ・マウスは画面のタップ・クリックで撃つ(船は動かない)、下の ◀ ▶ ボタンで移動。
 * 構文は ES2019 相当まで（?. ?? は使わない）。文言は i18n.js の t() から引く。
 * 戻るキーは「実際に処理したときだけ」preventDefault する（TV_WEBGAME_DEV_GUIDE 3章）。
 */
(function () {
  'use strict';

  /* ===================== 設定 ===================== */
  // 保存キーの頭。識別名とゲームIDは GML と決めて差し替える（README 参照）
  var SAVE_PREFIX = 'vendor.spacepatrol';
  var KEY_SETTINGS = SAVE_PREFIX + '.settings.v1';
  var KEY_BEST = SAVE_PREFIX + '.best.v1';

  // 速さ(難しさ)。fleet=群れの動く速さ、shot=宇宙人の撃つ回数、eSpeed=宇宙人の弾の速さ、lives=船の数
  var LEVEL_IDS = ['slow', 'normal', 'fast'];
  var LEVELS = {
    slow:   { fleet: 0.7,  shot: 0.55, eSpeed: 0.75, lives: 5 },
    normal: { fleet: 1.0,  shot: 1.0,  eSpeed: 1.0,  lives: 3 },
    fast:   { fleet: 1.3,  shot: 1.25, eSpeed: 1.15, lives: 3 }
  };
  var READY_MS = 1800;        // 「第1波」の札を出す時間
  var CLEAR_MS = 2200;        // 「クリア！」の札を出す時間
  var HIT_MS = 1600;          // 弾に当たったあと、次の船が出るまで
  var OVER_DELAY_MS = 1200;   // ゲームオーバーの画面を出すまで
  var FIRE_EVERY_MS = 330;    // 押しっぱなしで撃つ間隔
  var AUTO_FIRE_MS = 480;     // 「自動で撃つ」のときの間隔
  var HOLD_WATCH_MS = 900;    // 押しっぱなしの合図がこれだけ途切れたら止める [IN-6]
  var HOLD_LIMIT_MS = 20000;  // 押しっぱなしで動き続ける上限 [IN-6]
  // keyup(キーを離した合図)が届かない端末のための値。届く端末では使わない
  var TAP_MOVE_MS = 150;      // 1回押したときに動く時間(それ以上は、押しっぱなしの合図が来たときだけ動く)
  var REPEAT_WAIT_MS = 650;   // 押しっぱなしの合図(続けて届く keydown)が始まるのを待つ時間
  var REPEAT_GAP_MS = 250;    // 押しっぱなしの合図がこれだけ途切れたら、離したとみなして止める

  // 遊ぶ場所(canvas の内部の大きさ)。外周5%(左右64、上下36)の内側で遊ぶ
  var W = 1280, H = 720;
  var EDGE_L = 70, EDGE_R = 1210;
  var PLAYER_Y = 566, GROUND_Y = 598, LAND_Y = 548;
  var PLAYER_SPEED = 400;     // 1秒に動く量
  var SHOT_SPEED = 760;
  // 上を横切るもの(ver21)。円盤は撃つと 200点。彗星は撃ってはいけない: 撃つと割れてかけらが降ってくる(見送っても点は入らない。ver22)
  // ver23: 円盤と彗星は別々の時計で出す。円盤は彗星を入れる前と同じく 20〜30秒ごと、彗星もそれとは別に 20〜30秒ごと
  // (波の最初の彗星は 12〜18秒後)。どちらかが横切っている間は、もう片方は通り過ぎるのを待ってから出る
  var SAUCER_PTS = 200, SAUCER_SPEED = 150, COMET_SPEED = 200, ROCK_SPEED = 230;
  var BGM_VOL = 0.35;          // BGM の音量(0〜1)。効果音より控えめ(ver03 で 0.55 から下げた)

  /* ===================== 小道具 ===================== */
  function $(id) { return document.getElementById(id); }
  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addClass(e, c) { if (!hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, ''); }
  function removeClass(e, c) { e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function toggleClass(e, c, on) { if (on) addClass(e, c); else removeClass(e, c); }
  function isOn(id) { return hasClass($(id), 'on'); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function now() { return Date.now(); }

  /* ===================== 単位(--u)の保険 ===================== */
  // CSS の min() が使えない古い WebView では、入れ物の実寸から --u を計算する（window.innerWidth は使わない）
  var needUnitJs = !(window.CSS && CSS.supports && CSS.supports('width', 'min(1vw, 1vh)'));
  function fitUnit() {
    if (!needUnitJs) return;
    var w = document.documentElement.clientWidth, h = document.documentElement.clientHeight;
    if (!w || !h) { setTimeout(fitUnit, 100); return; }
    document.documentElement.style.setProperty('--u', Math.min(w / 100, h / 56.25) + 'px');
  }
  window.addEventListener('resize', fitUnit);
  window.addEventListener('load', fitUnit);
  fitUnit();

  /* ===================== 保存(設定と最高得点) [SAVE-1〜4] ===================== */
  var settings = { level: 'normal', auto: false, sound: true, music: true };   // sound=効果音、music=BGM
  var best = { slow: 0, normal: 0, fast: 0 };
  function loadSaved() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY_SETTINGS) || 'null');
      if (o && typeof o === 'object' && o.v === 1) {
        if (LEVEL_IDS.indexOf(o.level) >= 0) settings.level = o.level;
        if (typeof o.auto === 'boolean') settings.auto = o.auto;
        if (typeof o.sound === 'boolean') settings.sound = o.sound;
        if (typeof o.music === 'boolean') settings.music = o.music;   // ver02 で追加(無ければオン)
      }
    } catch (e) {}
    try {
      var b = JSON.parse(localStorage.getItem(KEY_BEST) || 'null');
      if (b && typeof b === 'object' && b.v === 1) {
        for (var i = 0; i < LEVEL_IDS.length; i++) {
          var n = b[LEVEL_IDS[i]];
          if (typeof n === 'number' && isFinite(n) && n >= 0 && n <= 9999999) best[LEVEL_IDS[i]] = Math.floor(n);
        }
      }
    } catch (e) {}
  }
  function saveSettings() {
    try { localStorage.setItem(KEY_SETTINGS, JSON.stringify({ v: 1, level: settings.level, auto: settings.auto, sound: settings.sound, music: settings.music })); } catch (e) {}
  }
  function saveBest() {
    try { localStorage.setItem(KEY_BEST, JSON.stringify({ v: 1, slow: best.slow, normal: best.normal, fast: best.fast })); } catch (e) {}
  }

  /* ===================== 音(Web Audio でその場で作る。音声ファイルなし) ===================== */
  var ac = null;
  function ensureAudio() {
    try {
      if (!ac) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
      if (ac && ac.state === 'suspended' && !document.hidden) ac.resume();
    } catch (e) { ac = null; }
  }
  function audioSuspend() { try { if (ac && ac.state === 'running') ac.suspend(); } catch (e) {} }
  function audioResume() { try { if (ac && ac.state === 'suspended') ac.resume(); } catch (e) {} }
  function tone(f, d, type, when, vol, slideTo) {
    if (!ac || !settings.sound) return;
    try {
      var tt = ac.currentTime + (when || 0);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, tt);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, tt + d);
      g.gain.setValueAtTime(vol || 0.06, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + d);
      o.connect(g); g.connect(ac.destination); o.start(tt); o.stop(tt + d + 0.02);
    } catch (e) {}
  }
  var MARCH = [110, 98, 87, 82];
  function sfx(k, arg) {
    var i;
    if (k === 'tap') tone(660, 0.08, 'triangle');
    else if (k === 'shoot') tone(980, 0.09, 'square', 0, 0.025, 520);
    else if (k === 'star') { tone(880, 0.07, 'triangle', 0, 0.06); tone(1320, 0.12, 'triangle', 0.05, 0.05); }
    else if (k === 'march') { if (!bgmPlaying()) tone(MARCH[arg % 4], 0.1, 'triangle', 0, 0.09); }   // BGM が鳴っている間は、群れの足音を鳴らさない
    else if (k === 'ufo') tone(arg ? 620 : 520, 0.06, 'sine', 0, 0.02);
    else if (k === 'comet') tone(arg ? 1568 : 1319, 0.05, 'sine', 0, 0.015);   // 彗星が通る間の、きらきらした高い音
    else if (k === 'crack') { tone(300, 0.3, 'square', 0, 0.04, 70); tone(180, 0.35, 'triangle', 0.05, 0.06, 60); }   // 彗星が割れた
    else if (k === 'bonus') { var b = [784, 988, 1175, 1568]; for (i = 0; i < b.length; i++) tone(b[i], 0.12, 'triangle', i * 0.06, 0.05); }
    else if (k === 'hit') { tone(440, 0.5, 'triangle', 0, 0.08, 150); tone(330, 0.5, 'sine', 0.1, 0.05, 110); }
    else if (k === 'ready') { tone(523, 0.12, 'triangle'); tone(784, 0.18, 'triangle', 0.12); }
    else if (k === 'clear') { var c = [523, 659, 784, 1047]; for (i = 0; i < c.length; i++) tone(c[i], 0.18, 'triangle', i * 0.1, 0.06); }
    else if (k === 'over') { var o2 = [392, 330, 262]; for (i = 0; i < o2.length; i++) tone(o2[i], 0.3, 'triangle', i * 0.22, 0.06); }
  }

  /* ===================== BGM(遊んでいる間だけ。一時停止・非表示・ゲームオーバー・タイトルでは止める) ===================== */
  // 曲は tools/make_bgm.py で作ったもの。替えるときは同じ名前の mp3 で置き換え、?v= を上げる
  var bgm = null, bgmFade = 0;
  try { bgm = new Audio(); bgm.src = 'audio/bgm.mp3?v=1'; bgm.loop = true; bgm.preload = 'auto'; bgm.volume = BGM_VOL; } catch (e) { bgm = null; }
  function bgmWanted() {
    if (!settings.music || G.paused || document.hidden || !isOn('game')) return false;
    return G.mode === 'ready' || G.mode === 'play' || G.mode === 'hit' || G.mode === 'clear';
  }
  function bgmClearFade() { if (bgmFade) { clearInterval(bgmFade); bgmFade = 0; } }
  function bgmPlaying() { return !!(bgm && !bgm.paused && !bgmFade); }
  function bgmStop() {
    bgmClearFade();
    if (bgm) { try { bgm.pause(); bgm.volume = BGM_VOL; } catch (e) {} }
  }
  // 約0.5秒で小さくして止める。音量を変えられない端末でも、決まった回数で必ず止める
  function bgmFadeOut() {
    if (!bgm || bgm.paused || bgmFade) return;
    var step = 0;
    bgmFade = setInterval(function () {
      step++;
      try { bgm.volume = Math.max(0, BGM_VOL * (1 - step / 6)); } catch (e) {}
      if (step >= 6) bgmStop();
    }, 80);
  }
  // 今の状態に合わせて鳴らす・止める。鳴らし始めは利用者の操作(決定・タップ)の中で呼ぶ
  function bgmSync(fromTop) {
    if (!bgm) return;
    if (bgmWanted()) {
      bgmClearFade();
      try {
        if (fromTop) bgm.currentTime = 0;
        bgm.volume = BGM_VOL;
        if (bgm.paused) { var p = bgm.play(); if (p && p.catch) p.catch(function () {}); }
      } catch (e) {}
    } else if (!bgm.paused && !bgmFade) bgmStop();
  }

  /* ===================== ゲームオーバーのジングル(2秒の曲。tools/make_jingle.py で作ったもの) ===================== */
  // 効果音か BGM のどちらかがオンなら鳴らす(両方オフのときだけ鳴らさない)。BGM と同じ Audio の仕組みで鳴らす
  var JINGLE_VOL = BGM_VOL;   // BGM と同じ音量(曲そのものの大きさも BGM と同じ約 -20 LUFS にしてある)
  var JINGLE_DELAY_MS = 300;  // BGM が小さくなり始めてから鳴らす
  var jingle = null, jinglePrimed = false, jingleTimer = 0;
  try { jingle = new Audio(); jingle.src = 'audio/gameover.mp3?v=4'; jingle.preload = 'auto'; jingle.volume = JINGLE_VOL; } catch (e) { jingle = null; }
  // ボタン操作の中で一度だけ、消音のまま鳴らしてすぐ止めておく
  // (操作の直後でないと音を出せない端末でも、ゲームオーバーのときに鳴らせるように)
  function jinglePrime() {
    if (!jingle || jinglePrimed) return;
    try {
      jingle.muted = true;
      var p = jingle.play();
      var done = function () { try { jingle.pause(); jingle.currentTime = 0; } catch (e) {} jingle.muted = false; jinglePrimed = true; };
      if (p && p.then) p.then(done, function () { jingle.muted = false; }); else done();
    } catch (e) {}
  }
  function jingleStop() {
    if (jingleTimer) { clearTimeout(jingleTimer); jingleTimer = 0; }
    if (jingle) { try { jingle.pause(); jingle.currentTime = 0; } catch (e) {} }
  }
  function playGameOverJingle() {
    jingleStop();
    if (!(settings.sound || settings.music)) return;
    jingleTimer = setTimeout(function () {
      jingleTimer = 0;
      if (document.hidden || G.mode !== 'over') return;
      if (!jingle) { sfx('over'); return; }
      try {
        jingle.muted = false; jingle.currentTime = 0; jingle.volume = JINGLE_VOL;
        var p = jingle.play(); if (p && p.catch) p.catch(function () { sfx('over'); });   // 鳴らせなかったら短い効果音
      } catch (e) { sfx('over'); }
    }, JINGLE_DELAY_MS);
  }

  /* ===================== 絵(ドット絵を canvas に描いておく) ===================== */
  // キャラクターの形は本ゲーム用に描いたもの(既存のゲームのキャラクターに似せない [CNT-8])
  // ver13 で全部描き直した(以前の絵は、既存のインベーダーゲームのキャラクターに似ていると指摘を受けたため)
  // ver16・ver17: 制作者が Adobe Illustrator で手直しした原画(art/characters/*.svg)に差し替えた。
  //   gem   (30点・黄) 輪のある星の子。2コマ目で輪が下がり、目の形が変わる
  //   eye   (20点・水色) 目のある結晶。まわりに光の粒がまたたく
  //   jelly (10点・桃) 人工衛星ロボ。左右に太陽電池の板、アンテナの灯りが点滅
  //   player       自分の船 = 窓のあるロケット
  //   ufo          ボーナスの円盤型の宇宙船。窓の数(3つ/4つ)と下の噴射が2コマで入れ替わる
  //   comet        ときどき横切る彗星(ver21、Claude 作図。art/characters/comet.svg)。撃ってはいけない
  //   star         宇宙人が変わる星(ver18: 4方向に光がのびるきらめき)。斜めの形があるので、マス目ではなく下の STAR_SHAPE で描く
  // 1文字 = 半マス('.' 透明 / 'X' キャラクターの色 / 'W' 白。ver17 の原画では白は使っていない)。原画に半マスずれた四角があるため。
  // この並びは tools/svg_to_rows.py で SVG から作る。手で直さず、SVG を直してから作り直すこと
  // キー名(gem / eye / jelly / ufo)はプログラムの中の呼び名で、絵の形とは関係ない
  var SPR = {
    gem: [[
      '......XXXXXXXXXX......',
      '......XXXXXXXXXX......',
      '....XXXXXXXXXXXXXX....',
      '....XXXXXXXXXXXXXX....',
      'XX..XXXX..XX..XXXX..XX',
      'XX..XXXX..XX..XXXX..XX',
      '..XXXXXXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXXXXXX..',
      '....XXXXXXXXXXXXXX....',
      '....XXXXXXXXXXXXXX....',
      '......XXXXXXXXXX......',
      '......XXXXXXXXXX......'
    ], [
      '......XXXXXXXXXX......',
      '......XXXXXXXXXX......',
      '....XXXXXXXXXXXXXX....',
      '....XXXXXXXXXXXXXX....',
      '....XXX..XXXX..XXX....',
      '....XXX..XXXX..XXX....',
      '..XXXXXXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXXXXXX..',
      'XX..XXXXXXXXXXXXXX..XX',
      'XX..XXXXXXXXXXXXXX..XX',
      '......XXXXXXXXXX......',
      '......XXXXXXXXXX......'
    ]],
    eye: [[
      '........XX........',
      '........XX........',
      '......XXXXXX......',
      '......XXXXXX......',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      '..XXXX..XX..XXXX..',
      '..XXXX..XX..XXXX..',
      'XXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXX',
      '..XXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXX..',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      '......XXXXXX......',
      '......XXXXXX......'
    ], [
      'XX......XX......XX',
      'XX......XX......XX',
      '......XXXXXX......',
      '......XXXXXX......',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      '..XXXX..XX..XXXX..',
      '..XXXX..XX..XXXX..',
      'XXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXX',
      '..XXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXX..',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      'XX....XXXXXX....XX',
      'XX....XXXXXX....XX'
    ]],
    jelly: [[
      '..........XX..........',
      '..........XX..........',
      '......XXXXXXXXXX......',
      '......XXXXXXXXXX......',
      '......XX..XX..XX......',
      '......XX..XX..XX......',
      'XXXX..XXXXXXXXXX..XXXX',
      'XXXX..XXXXXXXXXX..XXXX',
      'XXXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXX',
      'XXXX..XXXXXXXXXX..XXXX',
      'XXXX..XXXXXXXXXX..XXXX',
      '........XX..XX........',
      '........XX..XX........'
    ], [
      '......................',
      '......................',
      '......XXXXXXXXXX......',
      '......XXXXXXXXXX......',
      '......XX..XX..XX......',
      '......XX..XX..XX......',
      'XXXX..XXXXXXXXXX..XXXX',
      'XXXX..XXXXXXXXXX..XXXX',
      'XXXXXXXXXXXXXXXXXXXXXX',
      'XXXXXXXXXXXXXXXXXXXXXX',
      'XXXX..XXXXXXXXXX..XXXX',
      'XXXX..XXXXXXXXXX..XXXX',
      '......XX......XX......',
      '......XX......XX......'
    ]],
    player: [[
      '........XX........',
      '........XX........',
      '......XXXXXX......',
      '......XXXXXX......',
      '......XX..XX......',
      '......XX..XX......',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      '....XXXXXXXXXX....',
      '..XXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXX..',
      'XXXX..XXXXXX..XXXX',
      'XXXX..XXXXXX..XXXX',
      'XX....XX..XX....XX',
      'XX....XX..XX....XX'
    ]],
    ufo: [[
      '............XXXXXXXX............',
      '............XXXXXXXX............',
      '........XXXXXXXXXXXXXXXX........',
      '........XXXXXXXXXXXXXXXX........',
      '......XXXXXXXXXXXXXXXXXXXX......',
      '......XXXXXXXXXXXXXXXXXXXX......',
      '......XXXXX..XX..XX..XXXXX......',
      '......XXXXX..XX..XX..XXXXX......',
      '....XXXXXXXXXXXXXXXXXXXXXXXX....',
      '....XXXXXXXXXXXXXXXXXXXXXXXX....',
      '..XXXXXXXXXXXXXXXXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXXXXXXXXXXXXXXXX..',
      '.....XX..XX..XX..XX..XX..XX.....',
      '.....XX..XX..XX..XX..XX..XX.....',
      '.......XX......XX......XX.......',
      '.......XX......XX......XX.......'
    ], [
      '............XXXXXXXX............',
      '............XXXXXXXX............',
      '........XXXXXXXXXXXXXXXX........',
      '........XXXXXXXXXXXXXXXX........',
      '......XXXXXXXXXXXXXXXXXXXX......',
      '......XXXXXXXXXXXXXXXXXXXX......',
      '......XXX..XX..XX..XX..XXX......',
      '......XXX..XX..XX..XX..XXX......',
      '....XXXXXXXXXXXXXXXXXXXXXXXX....',
      '....XXXXXXXXXXXXXXXXXXXXXXXX....',
      '..XXXXXXXXXXXXXXXXXXXXXXXXXXXX..',
      '..XXXXXXXXXXXXXXXXXXXXXXXXXXXX..',
      '.......XX..XX......XX..XX.......',
      '.......XX..XX......XX..XX.......',
      '.........XX..........XX.........',
      '.........XX..........XX.........'
    ]],
    comet: [[
      '..................XX..XXXXXX....',
      '..................XX..XXXXXX....',
      '..........XX..XXXXXXXXXXXXXXXX..',
      '..........XX..XXXXXXXXXXXXXXXX..',
      'XX....XXXXXXXXXXXXXXXXXXWWWWXXXX',
      'XX....XXXXXXXXXXXXXXXXXXWWWWXXXX',
      '..XXXX..XXXXXXXXXXXXXXXXWWWWXXXX',
      '..XXXX..XXXXXXXXXXXXXXXXWWWWXXXX',
      '..........XX..XXXXXXXXXXXXXXXX..',
      '..........XX..XXXXXXXXXXXXXXXX..',
      '..................XX..XXXXXX....',
      '..................XX..XXXXXX....'
    ]]
  };
  // 星の形(ver18)。art/characters/star.svg の四角を多角形の頂点(SVG の単位。10 = 1マス、全体 50x50)にしたもの。
  // tools/svg_to_rows.py が出す並びを貼っている。手で直さず、SVG を直してから作り直すこと
  var STAR_SHAPE = [
    [20.0, 0.0, 30.0, 0.0, 30.0, 50.0, 20.0, 50.0],
    [0.0, 20.0, 50.0, 20.0, 50.0, 30.0, 0.0, 30.0],
    [20.43, 25.0, 31.47, 13.96, 42.51, 25.0, 31.47, 36.04],
    [13.96, 31.46, 25.0, 20.42, 36.04, 31.46, 25.0, 42.5],
    [13.97, 18.54, 25.01, 7.5, 36.05, 18.54, 25.01, 29.57],
    [7.5, 25.0, 18.54, 13.97, 29.58, 25.0, 18.54, 36.04]
  ];
  var COL = {
    bg: '#0E1430', starDim: '#3A4580', starBright: '#C9D2FF', ground: '#2E3A78',
    gem: '#FFD66B', eye: '#7EE0FF', jelly: '#FF8EC2', player: '#6FF2C4', playerHit: '#FF7A6B',
    brick: '#C8643C', brickHi: '#E8986A', brickLo: '#8E3F22', brickCrack: '#8A4128', brickCrackLine: '#4A1E10', ufo: '#FF8A5B', comet: '#C9B8FF', rock: '#A99BD6', white: '#FFFFFF', shot: '#FFFFFF', eshot: '#FFB36B', starFx: '#FFE27A'
  };
  var PX = 4;
  // px は1マスの大きさ。1文字 = 半マスなので、半マスの境目を整数に丸めて隙間やにじみが出ないようにする
  function makeSprite(rows, color, px) {
    var c = document.createElement('canvas');
    function at(k) { return Math.round(k * px / 2); }
    c.width = at(rows[0].length); c.height = at(rows.length);
    var g = c.getContext('2d');
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) {
      var ch = rows[y].charAt(x);
      if (ch === '.') continue;
      g.fillStyle = ch === 'W' ? COL.white : color;
      g.fillRect(at(x), at(y), at(x + 1) - at(x), at(y + 1) - at(y));
    }
    return c;
  }
  var TYPES = [
    { key: 'gem', pts: 30 },
    { key: 'eye', pts: 20 },
    { key: 'jelly', pts: 10 }
  ];
  var IMG = {};
  for (var ti = 0; ti < TYPES.length; ti++) {
    var tk = TYPES[ti].key;
    IMG[tk] = [makeSprite(SPR[tk][0], COL[tk], PX), makeSprite(SPR[tk][1], COL[tk], PX)];
  }
  IMG.player = makeSprite(SPR.player[0], COL.player, PX);
  IMG.playerHit = makeSprite(SPR.player[0], COL.playerHit, PX);
  // 円盤は宇宙人より少し小さい点(3px)で描く。上の表示と一番上の宇宙人の間(y 96〜120)に収まるように
  IMG.ufo = makeSprite(SPR.ufo[0], COL.ufo, 3);      // タイトルの得点表と当たり判定の大きさにも使う
  IMG.ufo2 = makeSprite(SPR.ufo[1], COL.ufo, 3);     // またたく2コマ目
  IMG.comet = makeSprite(SPR.comet[0], COL.comet, 3);   // 右へ進む彗星
  IMG.cometL = makeSprite(SPR.comet[0].map(function (r) { return r.split('').reverse().join(''); }), COL.comet, 3);   // 左へ進む彗星(左右反転)
  // 多角形で描く絵(斜めのふちはなめらかに塗る)。px は1マスの大きさ、size はマス数
  function makeShape(polys, color, px, size) {
    var c = document.createElement('canvas');
    c.width = c.height = size * px;
    var g = c.getContext('2d'), k = px / 10;
    g.fillStyle = color;
    for (var i = 0; i < polys.length; i++) {
      var q = polys[i];
      g.beginPath(); g.moveTo(q[0] * k, q[1] * k);
      for (var j = 2; j < q.length; j += 2) g.lineTo(q[j] * k, q[j + 1] * k);
      g.closePath(); g.fill();
    }
    return c;
  }
  IMG.star = makeShape(STAR_SHAPE, COL.starFx, PX, 5);

  /* ===================== 遊ぶ場所 ===================== */
  var cv = $('field'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  var sky = [];
  for (var si = 0; si < 70; si++) sky.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.25 ? 3 : 2, v: 6 + Math.random() * 14, ph: Math.random() * 6.28 });

  // G.mode: 'title' / 'ready'(札) / 'play' / 'hit'(当たった直後) / 'clear'(全部星にした) / 'over'
  var G = {
    mode: 'title', t: 0, paused: false, score: 0, lives: 3, wave: 1, level: LEVELS.normal, levelId: 'normal',
    player: { x: W / 2, w: IMG.player.width, h: IMG.player.height },
    shots: [], eshots: [], rocks: [], aliens: [], shields: [], parts: [], floats: [], pops: [],
    ufo: null, ufoTimer: 20, cometTimer: 15, dir: 1, stepTimer: 0, frame: 0, march: 0, eTimer: 1.5,
    lastShotAt: 0, lastManualAt: 0, autoAt: 0, why: '', newBest: false
  };
  var TOTAL = 5 * 9;

  function makeFleet() {
    G.aliens = [];
    var rowTypes = [0, 1, 1, 2, 2];
    var y0 = 132 + Math.min(G.wave - 1, 4) * 14, x0 = W / 2 - 4 * 76;
    for (var r = 0; r < 5; r++) for (var c = 0; c < 9; c++) {
      var ty = TYPES[rowTypes[r]];
      G.aliens.push({ x: x0 + c * 76, y: y0 + r * 46, t: ty, col: c, alive: true, w: IMG[ty.key][0].width, h: IMG[ty.key][0].height });
    }
    G.dir = 1; G.stepTimer = 0; G.frame = 0;
  }
  // バリア = レンガの壁(ver20)。レンガは横 24 × 縦 12。1段おきに半分ずらして積む(本物のレンガ積みと同じ)。
  // 一番上の段は1つおきに置いて、城壁のような凸凹にする。
  // 1回当たるとひびが入り、2回目で崩れる(宇宙人の弾は1回で崩す)
  var BRICK_W = 24, BRICK_H = 12, WALL_COLS = 5, WALL_ROWS = 6, SHIELD_Y = 446;
  var WALL_W = BRICK_W * WALL_COLS, WALL_H = BRICK_H * WALL_ROWS;
  function makeShields() {
    G.shields = [];
    var gap = (EDGE_R - EDGE_L - 4 * WALL_W) / 5;
    for (var i = 0; i < 4; i++) {
      var x0 = EDGE_L + gap + i * (WALL_W + gap), bricks = [];
      for (var r = 0; r < WALL_ROWS; r++) {
        var y = SHIELD_Y + r * BRICK_H;
        if (r === 0) {   // 城壁の凸凹
          for (var c = 0; c < WALL_COLS; c += 2) bricks.push({ x: x0 + c * BRICK_W, y: y, w: BRICK_W, h: BRICK_H, hp: 2 });
          continue;
        }
        var off = r % 2 ? 0 : BRICK_W / 2, bx = x0;
        if (off) { bricks.push({ x: bx, y: y, w: off, h: BRICK_H, hp: 2 }); bx += off; }   // 端の半分のレンガ
        while (bx < x0 + WALL_W - 0.5) {
          var w = Math.min(BRICK_W, x0 + WALL_W - bx);
          bricks.push({ x: bx, y: y, w: w, h: BRICK_H, hp: 2 }); bx += w;
        }
      }
      G.shields.push({ x: x0, y: SHIELD_Y, bricks: bricks });
    }
  }
  // レンガを1つ傷める。崩れたらかけらを飛ばす
  function damageBrick(b, n) {
    b.hp -= n;
    if (b.hp <= 0) { b.hp = 0; sparkle(b.x + b.w / 2, b.y + b.h / 2, COL.brick, 6); }
  }
  // レンガ1つを描く。まわり 1 は目地(すき間)。上のふちは明るく、下のふちは暗くして立体感を出す。ひびの入ったレンガは暗くして割れ目を描く
  function drawBrick(b) {
    var x = Math.round(b.x) + 1, y = Math.round(b.y) + 1, w = Math.round(b.w) - 2, h = Math.round(b.h) - 2;
    var cracked = b.hp === 1;
    ctx.fillStyle = cracked ? COL.brickCrack : COL.brick; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = COL.brickHi; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = COL.brickLo; ctx.fillRect(x, y + h - 2, w, 2);
    if (cracked) {   // 割れ目(ジグザグ)
      ctx.fillStyle = COL.brickCrackLine;
      var cx = x + Math.floor(w / 2);
      ctx.fillRect(cx - 1, y + 2, 2, 3); ctx.fillRect(cx + 1, y + 4, 2, 2); ctx.fillRect(cx - 2, y + 6, 2, h - 6);
    }
  }

  function startGame() {
    G.levelId = settings.level; G.level = LEVELS[G.levelId];
    G.score = 0; G.lives = G.level.lives; G.wave = 1; G.newBest = false;
    G.player.x = W / 2;
    startWave();
  }
  function startWave() {
    // 波の始めは、自分の船を必ずまん中に置く(ver22)。押しっぱなしの移動も止めて、まん中から動き出さないようにする
    G.player.x = W / 2; stopHolds();
    G.shots = []; G.eshots = []; G.rocks = []; G.parts = []; G.floats = []; G.pops = [];
    G.ufo = null; G.ufoTimer = 18 + Math.random() * 10; G.cometTimer = 12 + Math.random() * 6; G.eTimer = 1.5;
    makeFleet(); makeShields();
    setMode('ready');
    showBanner(t('wave_no', { n: G.wave }));
    sfx('ready');
  }
  function setMode(m) { G.mode = m; G.t = 0; }

  /* ===================== 当たり判定 ===================== */
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh; }
  // 弾がレンガに当たったら、そのレンガを傷める(dmg=1 ひび、2 で一度に崩す)。当たったら true
  // 上向きの弾は一番下の、下向きの弾は一番上のレンガに当たる(弾の進む先で最初にぶつかるもの)
  function hitShield(x, y, w, h, dmg, up) {
    for (var i = 0; i < G.shields.length; i++) {
      var s = G.shields[i];
      if (x + w / 2 < s.x || x - w / 2 > s.x + WALL_W || y + h / 2 < s.y || y - h / 2 > s.y + WALL_H) continue;
      var hit = null;
      for (var k = 0; k < s.bricks.length; k++) {
        var b = s.bricks[k];
        if (b.hp <= 0 || !overlap(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, x, y, w, h)) continue;
        if (!hit || (up ? b.y > hit.y : b.y < hit.y)) hit = b;
      }
      if (hit) { damageBrick(hit, dmg); return true; }
    }
    return false;
  }
  // 下りてきた宇宙人が重なったレンガは崩す
  function eraseShieldUnder(a) {
    for (var i = 0; i < G.shields.length; i++) {
      var s = G.shields[i];
      if (a.y + a.h / 2 < s.y || a.y - a.h / 2 > s.y + WALL_H) continue;
      for (var k = 0; k < s.bricks.length; k++) {
        var b = s.bricks[k];
        if (b.hp > 0 && overlap(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, a.x, a.y, a.w, a.h)) damageBrick(b, 2);
      }
    }
  }

  /* ===================== 動き ===================== */
  function sparkle(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = 60 + Math.random() * 180;
      G.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.4 + Math.random() * 0.35, color: color });
    }
  }
  // manual=true は自分で押した光線(決定・上キー・タップ・撃つボタン)。
  // 画面に出せる光線はふだん2本まで。「自動で撃つ」がオンのときは、自分で押した分は4本まで出せる
  // (自動の2本が飛んでいても、押せば必ず出る)
  function tryFire(manual) {
    if (G.mode !== 'play' || G.paused) return;
    var n = now();
    var limit = (manual && settings.auto) ? 4 : 2;
    var last = manual ? G.lastManualAt : G.lastShotAt;
    if (G.shots.length >= limit || n - last < 220) return;
    if (manual) G.lastManualAt = n;
    G.lastShotAt = n;
    G.shots.push({ x: G.player.x, y: PLAYER_Y - G.player.h / 2 - 8 });
    sfx('shoot');
  }
  // 彗星を撃ってしまった: 割れて、かけらが3つ降ってくる
  function breakComet() {
    var u = G.ufo, v = ROCK_SPEED * G.level.eSpeed;
    sparkle(u.x, u.y, COL.comet, 20); sfx('crack');
    for (var k = -1; k <= 1; k++) G.rocks.push({ x: u.x + k * 14, y: u.y + 10, vx: k * 70, vy: v * (1 - Math.abs(k) * 0.12), t: 0 });
    showToast(t('comet_broke'));
  }
  function playerHit() {
    if (G.mode !== 'play') return;
    sparkle(G.player.x, PLAYER_Y, COL.playerHit, 18);
    sfx('hit');
    G.lives = Math.max(0, G.lives - 1);
    G.eshots = []; G.rocks = [];
    setMode('hit');
  }
  function gameOver(why) {
    G.why = why;
    if (G.score > best[G.levelId]) { best[G.levelId] = G.score; G.newBest = true; saveBest(); }
    stopHolds();
    setMode('over');
    bgmFadeOut();
    playGameOverJingle();
  }
  function stepFleet() {
    var alive = [], i;
    for (i = 0; i < G.aliens.length; i++) if (G.aliens[i].alive) alive.push(G.aliens[i]);
    if (!alive.length) return;
    var dx = 10 * G.dir, edge = false;
    for (i = 0; i < alive.length; i++) if (alive[i].x + dx - alive[i].w / 2 < EDGE_L || alive[i].x + dx + alive[i].w / 2 > EDGE_R) { edge = true; break; }
    for (i = 0; i < alive.length; i++) { if (edge) alive[i].y += 20; else alive[i].x += dx; }
    if (edge) G.dir = -G.dir;
    G.frame = 1 - G.frame;
    sfx('march', G.march); G.march = (G.march + 1) % 4;
    for (i = 0; i < alive.length; i++) {
      if (alive[i].y + alive[i].h / 2 >= SHIELD_Y) eraseShieldUnder(alive[i]);
      if (alive[i].y + alive[i].h / 2 >= LAND_Y) { gameOver('landed'); return; }
    }
  }

  // 押しっぱなし(キー): 移動と連射。合図が途切れたら止める・上限時間で止める [IN-6]
  // reps = 押してから届いた「押しっぱなしの合図」の数
  var mv = { dir: null, start: 0, last: 0, reps: 0 };
  var fireHold = { on: false, start: 0, last: 0, reps: 0 };
  var sawKeyup = false;       // この端末から keyup が届いたことがあるか
  // 押しっぱなしの状態: 'on'(動く)/ 'wait'(押しっぱなしかどうか待っている間。動かない)/ 'off'(終わり)
  // keyup が届く端末: keyup で止まる。届かなくなったときの見張りは HOLD_WATCH_MS [IN-6]
  // keyup が届かない端末: 1回押すと TAP_MOVE_MS だけ動き、押しっぱなしの合図が続く間だけ動き続ける
  //   (以前は1回押すだけで 0.9秒 動き続け、勝手に進んだり戻ったりして見えた)
  function holdState(h, n) {
    if (n - h.start > HOLD_LIMIT_MS) return 'off';
    if (sawKeyup) return (n - h.last > HOLD_WATCH_MS) ? 'off' : 'on';
    if (h.reps > 0) return (n - h.last > REPEAT_GAP_MS) ? 'off' : 'on';
    if (n - h.start <= TAP_MOVE_MS) return 'on';
    return (n - h.start > REPEAT_WAIT_MS) ? 'off' : 'wait';
  }
  // タッチ: 押している ◀ ▶、撃つボタン、◀ ▶ を1回押したときの行き先(tgt)
  var ptr = { dir: 0, fire: false, fireStart: 0, tgt: null };
  function stopHolds() {
    mv.dir = null; fireHold.on = false; ptr.dir = 0; ptr.fire = false; ptr.tgt = null;
    removeClass($('tLeft'), 'on'); removeClass($('tRight'), 'on'); removeClass($('tFire'), 'on');
  }

  function update(dt) {
    var n = now(), i;
    G.t += dt * 1000;
    for (i = 0; i < sky.length; i++) { var s = sky[i]; s.y += s.v * dt; s.ph += dt * 2; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } }
    for (i = G.parts.length - 1; i >= 0; i--) { var p = G.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; if (p.life <= 0) G.parts.splice(i, 1); }
    for (i = G.floats.length - 1; i >= 0; i--) { var f = G.floats[i]; f.y -= 70 * dt; f.life -= dt; if (f.life <= 0) G.floats.splice(i, 1); }
    for (i = G.pops.length - 1; i >= 0; i--) { var q = G.pops[i]; q.y -= 30 * dt; q.life -= dt; if (q.life <= 0) G.pops.splice(i, 1); }
    if (G.mode === 'title') return;

    // 押しっぱなしの見張り
    var mvState = mv.dir ? holdState(mv, n) : 'off';
    if (mvState === 'off') mv.dir = null;
    var fireState = fireHold.on ? holdState(fireHold, n) : 'off';
    if (fireState === 'off') fireHold.on = false;
    if (ptr.fire && n - ptr.fireStart > HOLD_LIMIT_MS) { ptr.fire = false; removeClass($('tFire'), 'on'); }

    // 自分の船(札の間も動ける)
    if (G.mode === 'play' || G.mode === 'ready') {
      var d = 0;
      if (mvState === 'on') { if (mv.dir === 'left') d = -1; else if (mv.dir === 'right') d = 1; }
      if (!d && ptr.dir) d = ptr.dir;
      if (d) { ptr.tgt = null; G.player.x += d * PLAYER_SPEED * dt; }
      else if (ptr.tgt !== null) {
        var diff = ptr.tgt - G.player.x, stepX = PLAYER_SPEED * dt;
        if (Math.abs(diff) <= stepX) { G.player.x = ptr.tgt; ptr.tgt = null; } else G.player.x += (diff > 0 ? 1 : -1) * stepX;
      }
      G.player.x = clamp(G.player.x, EDGE_L, EDGE_R);
    }

    if (G.mode === 'ready') { if (G.t >= READY_MS) { hideBanner(); setMode('play'); } return; }
    if (G.mode === 'hit') { if (G.t >= HIT_MS) { if (G.lives > 0) { stopHolds(); setMode('play'); } else gameOver('ships'); } return; }
    if (G.mode === 'clear') { if (G.t >= CLEAR_MS) { hideBanner(); G.wave++; startWave(); } return; }
    if (G.mode === 'over') { if (G.t >= OVER_DELAY_MS && !isOn('overDlg')) showOver(); return; }
    if (G.mode !== 'play') return;

    // 撃つ(押しっぱなし・タッチの撃つボタン・自動)
    if ((fireState === 'on' || ptr.fire) && n - G.lastManualAt >= FIRE_EVERY_MS) tryFire(true);
    if (settings.auto && n - G.autoAt >= AUTO_FIRE_MS) { G.autoAt = n; tryFire(); }

    // 自分の光線
    for (i = G.shots.length - 1; i >= 0; i--) {
      var sh = G.shots[i], gone = false;
      sh.y -= SHOT_SPEED * dt;
      if (sh.y < 90) gone = true;
      else if (hitShield(sh.x, sh.y, 4, 16, 1, true)) gone = true;
      else {
        for (var a = 0; a < G.aliens.length; a++) {
          var al = G.aliens[a];
          if (al.alive && overlap(sh.x, sh.y, 4, 16, al.x, al.y, al.w, al.h)) {
            al.alive = false; gone = true;
            G.score = Math.min(9999999, G.score + al.t.pts);
            G.floats.push({ x: al.x, y: al.y, life: 0.7 });
            sparkle(al.x, al.y, COL[al.t.key], 10);
            sfx('star');
            break;
          }
        }
        if (!gone && G.ufo && overlap(sh.x, sh.y, 4, 16, G.ufo.x, G.ufo.y, IMG.ufo.width, IMG.ufo.height)) {
          if (G.ufo.kind === 'comet') breakComet();
          else {
            G.score = Math.min(9999999, G.score + SAUCER_PTS);
            G.pops.push({ x: G.ufo.x, y: G.ufo.y, text: fmtNum(SAUCER_PTS), life: 1.3, color: COL.ufo });
            sparkle(G.ufo.x, G.ufo.y, COL.ufo, 18); sfx('bonus');
          }
          G.ufo = null; gone = true;
        }
        if (!gone) {
          for (var e = 0; e < G.eshots.length; e++) {
            if (overlap(sh.x, sh.y, 4, 16, G.eshots[e].x, G.eshots[e].y, 8, 18)) { G.eshots.splice(e, 1); sparkle(sh.x, sh.y, COL.shot, 5); gone = true; break; }
          }
        }
      }
      if (gone) G.shots.splice(i, 1);
    }

    // 群れ
    var alive = 0;
    for (i = 0; i < G.aliens.length; i++) if (G.aliens[i].alive) alive++;
    if (!alive) { setMode('clear'); showBanner(t('wave_clear', { n: G.wave })); sfx('clear'); return; }
    var interval = Math.max(0.05, 0.75 * (alive / TOTAL)) / (1 + (G.wave - 1) * 0.1) / G.level.fleet;
    G.stepTimer += dt;
    if (G.stepTimer >= interval) { G.stepTimer = 0; stepFleet(); if (G.mode !== 'play') return; }

    // 宇宙人の弾(各列の一番下の宇宙人が撃つ。3回に1回くらいは船の近くの列から)
    G.eTimer -= dt;
    if (G.eTimer <= 0 && G.eshots.length < 1 + Math.min(G.wave, 3)) {
      G.eTimer = Math.max(0.55, 1.45 - G.wave * 0.08) / G.level.shot * (0.6 + Math.random() * 0.8);
      var cols = {}, list = [], k;
      for (i = 0; i < G.aliens.length; i++) { var x = G.aliens[i]; if (x.alive && (!cols[x.col] || x.y > cols[x.col].y)) cols[x.col] = x; }
      for (k in cols) if (cols.hasOwnProperty(k)) list.push(cols[k]);
      var who = list[Math.floor(Math.random() * list.length)];
      if (Math.random() < 0.35) for (i = 0; i < list.length; i++) if (Math.abs(list[i].x - G.player.x) < Math.abs(who.x - G.player.x)) who = list[i];
      G.eshots.push({ x: who.x, y: who.y + who.h / 2 + 8, v: (230 + G.wave * 14) * G.level.eSpeed, t: 0 });
    }
    for (i = G.eshots.length - 1; i >= 0; i--) {
      var es = G.eshots[i], drop = false;
      es.y += es.v * dt; es.t += dt;
      if (es.y > GROUND_Y - 6) { sparkle(es.x, GROUND_Y - 4, COL.eshot, 4); drop = true; }
      else if (hitShield(es.x, es.y, 8, 18, 2, false)) drop = true;
      else if (overlap(es.x, es.y, 8, 18, G.player.x, PLAYER_Y, G.player.w - 8, G.player.h)) { G.eshots.splice(i, 1); playerHit(); return; }
      if (drop) G.eshots.splice(i, 1);
    }

    // ときどき上を横切るもの: 円盤(撃つと 200点)と彗星(撃ってはいけない)。それぞれ別の時計で出す(ver23)
    // 円盤の時計は彗星を入れる前と同じ進み方。横切る通り道は1本なので、時間が来てもどちらかが通っている間は待つ
    G.ufoTimer -= dt; G.cometTimer -= dt;
    if (!G.ufo && (G.ufoTimer <= 0 || G.cometTimer <= 0)) {
      var dir = Math.random() < 0.5 ? 1 : -1, isComet = G.cometTimer <= G.ufoTimer;   // 先に時間が来た方を出す
      G.ufo = { kind: isComet ? 'comet' : 'saucer', x: dir > 0 ? -40 : W + 40, y: 108, dir: dir, beep: 0 };
      if (isComet) G.cometTimer = 20 + Math.random() * 10; else G.ufoTimer = 22 + Math.random() * 10;
    }
    if (G.ufo) {
      var comet = G.ufo.kind === 'comet';
      G.ufo.x += G.ufo.dir * (comet ? COMET_SPEED : SAUCER_SPEED) * dt;
      G.ufo.beep += dt;
      if (G.ufo.beep > (comet ? 0.18 : 0.25)) { G.ufo.beep = 0; G.ufo.hi = !G.ufo.hi; sfx(comet ? 'comet' : 'ufo', G.ufo.hi); }
      if (G.ufo.x < -80 || G.ufo.x > W + 80) G.ufo = null;   // 彗星は見送っても点は入らない(ver22)
    }
    // 割れた彗星のかけら(当たると船が1つ減る。レンガの壁で止まる)
    for (i = G.rocks.length - 1; i >= 0; i--) {
      var rk = G.rocks[i], rgone = false;
      rk.x += rk.vx * dt; rk.y += rk.vy * dt; rk.t += dt;
      if (rk.y > GROUND_Y - 6) { sparkle(rk.x, GROUND_Y - 4, COL.rock, 4); rgone = true; }
      else if (hitShield(rk.x, rk.y, 12, 12, 2, false)) rgone = true;
      else if (overlap(rk.x, rk.y, 12, 12, G.player.x, PLAYER_Y, G.player.w - 8, G.player.h)) { G.rocks.splice(i, 1); playerHit(); return; }
      if (rgone) G.rocks.splice(i, 1);
    }
  }

  /* ===================== 描画 ===================== */
  function spr(img, x, y) { ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2)); }
  function draw() {
    var i;
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, W, H);
    for (i = 0; i < sky.length; i++) {
      var s = sky[i];
      ctx.fillStyle = Math.sin(s.ph) > 0.6 ? COL.starBright : COL.starDim;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    }
    if (G.mode === 'title') return;

    ctx.fillStyle = COL.ground; ctx.fillRect(EDGE_L - 30, GROUND_Y, EDGE_R - EDGE_L + 60, 3);

    for (i = 0; i < G.shields.length; i++) {
      var bs = G.shields[i].bricks;
      for (var k = 0; k < bs.length; k++) if (bs[k].hp > 0) drawBrick(bs[k]);
    }
    for (i = 0; i < G.aliens.length; i++) { var a = G.aliens[i]; if (a.alive) spr(IMG[a.t.key][G.frame], a.x, a.y); }
    if (G.ufo) {
      if (G.ufo.kind === 'comet') {
        spr(G.ufo.dir > 0 ? IMG.comet : IMG.cometL, G.ufo.x, G.ufo.y);   // 彗星は進む向きに頭を向ける
      } else spr(Math.floor(G.t / 200) % 2 ? IMG.ufo2 : IMG.ufo, G.ufo.x, G.ufo.y);   // 0.2秒ごとに窓と噴射が入れ替わる
    }
    for (i = 0; i < G.rocks.length; i++) {   // 彗星のかけら(くるくる回る小さな石)
      var rk = G.rocks[i], sz = Math.floor(rk.t * 8) % 2 ? 10 : 12;
      ctx.fillStyle = COL.rock; ctx.fillRect(Math.round(rk.x - sz / 2), Math.round(rk.y - sz / 2), sz, sz);
      ctx.fillStyle = COL.comet; ctx.fillRect(Math.round(rk.x - sz / 2), Math.round(rk.y - sz / 2), sz, 3);
    }

    ctx.fillStyle = COL.shot;
    for (i = 0; i < G.shots.length; i++) ctx.fillRect(Math.round(G.shots[i].x - 2), Math.round(G.shots[i].y - 8), 4, 16);
    ctx.fillStyle = COL.eshot;
    for (i = 0; i < G.eshots.length; i++) {
      var e = G.eshots[i], z = Math.floor(e.t * 10) % 2 ? 3 : -3;
      ctx.fillRect(Math.round(e.x - 2 + z), Math.round(e.y - 9), 4, 6);
      ctx.fillRect(Math.round(e.x - 2 - z), Math.round(e.y - 3), 4, 6);
      ctx.fillRect(Math.round(e.x - 2 + z), Math.round(e.y + 3), 4, 6);
    }

    // 自分の船(当たった直後は点滅。小さな絵だけの点滅で、画面全体は明滅させない [CNT-9])
    if (G.mode === 'hit') { if (Math.floor(G.t / 160) % 2 === 0) spr(IMG.playerHit, G.player.x, PLAYER_Y); }
    else if (!(G.mode === 'over' && G.why === 'ships')) spr(IMG.player, G.player.x, PLAYER_Y);

    for (i = 0; i < G.parts.length; i++) {
      var p = G.parts[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - 2), 4, 4);
    }
    for (i = 0; i < G.floats.length; i++) { ctx.globalAlpha = Math.max(0, Math.min(1, G.floats[i].life * 1.6)); spr(IMG.star, G.floats[i].x, G.floats[i].y); }
    ctx.globalAlpha = 1;
    if (G.pops.length) {
      ctx.font = '700 26px "Zen Maru Gothic", "Noto Sans JP", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (i = 0; i < G.pops.length; i++) { ctx.fillStyle = G.pops[i].color || COL.ufo; ctx.fillText(G.pops[i].text, G.pops[i].x, G.pops[i].y); }
    }
  }

  /* ===================== 上の表示(変わったところだけ書き直す [PERF-2]) ===================== */
  var hudLast = {};
  function setText(id, s) { if (hudLast[id] !== s) { hudLast[id] = s; $(id).textContent = s; } }
  function drawHud() {
    if (!isOn('game')) return;
    setText('scoreV', fmtNum(G.score));
    // 彗星が出ている間は、上の表示に「撃たないで!」を出す(点滅はさせない [CNT-9])
    setText('cometWarn', G.ufo && G.ufo.kind === 'comet' && G.mode === 'play' ? t('comet_warn') : '');
    setText('bestV', fmtNum(Math.max(best[G.levelId], G.score)));
    setText('waveV', t('wave_no', { n: G.wave }));
    setText('livesV', fmtNum(G.lives));
  }
  function showBanner(text) {
    $('bannerText').textContent = text;
    var b = $('banner'); removeClass(b, 'on'); void b.offsetWidth; addClass(b, 'on');
  }
  function hideBanner() { removeClass($('banner'), 'on'); }
  // 短いお知らせ(「BGM: オフ」など)。1.5秒で消える
  var toastTimer = 0;
  function showToast(text) {
    $('toastText').textContent = text;
    var el = $('toast'); removeClass(el, 'on'); void el.offsetWidth; addClass(el, 'on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { removeClass($('toast'), 'on'); toastTimer = 0; }, 1500);
  }
  // 遊んでいる途中に下キーで音楽(BGM)をオン・オフ。設定は保存し、タイトル・一時停止のメニューの「音楽」と同じもの
  function toggleMusic() {
    settings.music = !settings.music;
    saveSettings(); drawChoices(); bgmSync();
    showToast(t(settings.music ? 'music_on' : 'music_off'));
  }

  /* ===================== 時間の進め方(経過時間で。rAF が止まっても進む [PERF-4, 5]) ===================== */
  var lastT = now(), lastFrameAt = 0;
  function step() {
    var n = now(), dt = Math.min(0.05, Math.max(0, (n - lastT) / 1000));
    lastT = n; lastFrameAt = n;
    if (document.hidden) return;
    if (!G.paused) update(dt);
    draw(); drawHud();
  }
  function frame() { step(); requestAnimationFrame(frame); }
  setInterval(function () { if (now() - lastFrameAt > 250) step(); }, 250);

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopHolds(); stopDir(); held = {};
      if (isOn('game') && !topOverlay() && G.mode !== 'over') openPause(true);
      bgmStop(); jingleStop(); audioSuspend();
    } else { lastT = now(); audioResume(); }
  });

  /* ===================== フォーカス(自前で管理) ===================== */
  var cur = null;
  function setFocus(e) {
    if (!e) return;
    if (cur && cur !== e) removeClass(cur, 'is-focus');
    cur = e; addClass(e, 'is-focus');
    try { e.focus({ preventScroll: true }); } catch (x) { try { e.focus(); } catch (y) {} }
  }
  function clearFocus() {
    if (cur) removeClass(cur, 'is-focus');
    cur = null;
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
  }
  function visible(e) { return e.offsetParent !== null && !e.disabled; }
  function topOverlay() {
    if (isOn('dlg')) return $('dlg');
    if (isOn('overDlg')) return $('overDlg');
    if (isOn('pauseDlg')) return $('pauseDlg');
    return null;
  }
  function list(sel, root) { var a = (root || document).querySelectorAll(sel), out = []; for (var i = 0; i < a.length; i++) if (visible(a[i])) out.push(a[i]); return out; }
  function zoneItems() {
    var ov = topOverlay();
    if (ov) return list('.nav', ov);
    if (isOn('title')) return list('#title .nav');
    return [];
  }
  function defaultFocus() {
    var ov = topOverlay();
    if (ov) return ov.id === 'pauseDlg' ? $('resumeBtn') : (ov.id === 'overDlg' ? $('againBtn') : $('dlgOk'));
    if (isOn('title')) return $('startBtn');
    return null;
  }
  function ensureFocus() { var items = zoneItems(); if (!cur || items.indexOf(cur) < 0) setFocus(defaultFocus()); }
  function center(e) { var r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function nearest(from, items, dir) {
    var a = center(from), bestE = null, bs = Infinity;
    for (var i = 0; i < items.length; i++) {
      var e = items[i]; if (e === from) continue;
      var b = center(e), dx = b.x - a.x, dy = b.y - a.y, p, s;
      if (dir === 'right') { p = dx; s = Math.abs(dy); } else if (dir === 'left') { p = -dx; s = Math.abs(dy); }
      else if (dir === 'down') { p = dy; s = Math.abs(dx); } else { p = -dy; s = Math.abs(dx); }
      if (p <= 2) continue;
      var score = p + s * 2.2;
      if (score < bs) { bs = score; bestE = e; }
    }
    return bestE;
  }
  function move(dir) {
    var items = zoneItems();
    if (!cur || items.indexOf(cur) < 0) { ensureFocus(); return; }
    if (hasClass(cur, 'choice') && (dir === 'left' || dir === 'right')) { stepChoice(cur, dir === 'left' ? -1 : 1); return; }
    var next = nearest(cur, items, dir);
    if (next) setFocus(next);
  }
  var lockUntil = 0;   // 画面が出た直後の決定の連打で、すぐ押されないように
  function activate() {
    if (now() < lockUntil) return;
    if (!cur || !visible(cur)) { ensureFocus(); return; }
    cur.click();
  }

  /* ===================== 「◀ 値 ▶」の設定 [UI-2] ===================== */
  var CHOICE_DEF = {
    setLevel: { key: 'level', values: LEVEL_IDS },
    setAuto: { key: 'auto', values: [false, true] },
    setMusic: { key: 'music', values: [true, false] },
    setSound: { key: 'sound', values: [true, false] },
    pMusic: { key: 'music', values: [true, false] },
    pSound: { key: 'sound', values: [true, false] }
  };
  function choiceLabel(key, v) { return key === 'level' ? t('lv_' + v) : t(v ? 'on' : 'off'); }
  function drawChoices() {
    for (var id in CHOICE_DEF) if (CHOICE_DEF.hasOwnProperty(id)) {
      var d = CHOICE_DEF[id];
      $(id).querySelector('.cVal').textContent = choiceLabel(d.key, settings[d.key]);
    }
    var anySound = settings.sound || settings.music;   // 右上のボタンは、効果音と BGM をまとめて切り替える
    $('soundImg').src = anySound ? 'img/ui/sound-on.svg' : 'img/ui/sound-off.svg';
    $('soundBtn').setAttribute('aria-label', t(anySound ? 'sound_on' : 'sound_off'));
    $('howto').textContent = t(settings.auto ? 'howto_auto' : 'howto_key');
    var b = best[settings.level];
    $('bestLine').textContent = b > 0 ? t('best_line', { lv: t('lv_' + settings.level), n: fmtNum(b) }) : '';
  }
  function stepChoice(el, d) {
    var def = CHOICE_DEF[el.id]; if (!def) return;
    var vals = def.values, i = vals.indexOf(settings[def.key]);
    i = ((i < 0 ? 0 : i) + d + vals.length) % vals.length;
    settings[def.key] = vals[i];
    saveSettings(); drawChoices(); bgmSync();
    sfx('tap');
  }
  function bindChoice(id) {
    $(id).addEventListener('click', function (e) {
      var l = e.target && e.target.closest ? e.target.closest('.cArrow.l') : null;
      stepChoice($(id), l ? -1 : 1);
    });
  }
  for (var cid in CHOICE_DEF) if (CHOICE_DEF.hasOwnProperty(cid)) bindChoice(cid);

  /* ===================== 画面の切り替え ===================== */
  function showScreen(id) {
    var ids = ['loading', 'title', 'game'];
    for (var i = 0; i < ids.length; i++) toggleClass($(ids[i]), 'on', ids[i] === id);
  }
  function closeOverlays() { removeClass($('pauseDlg'), 'on'); removeClass($('overDlg'), 'on'); removeClass($('dlg'), 'on'); }
  function beginPlay() {
    ensureAudio(); jinglePrime(); jingleStop();   // もう一度・最初から のときは、鳴っているジングルを止める
    closeOverlays(); stopHolds();
    G.paused = false; hudLast = {};
    showScreen('game'); clearFocus();
    startGame();
    bgmSync(true);                         // 新しいゲームは曲の頭から(はじめる・もう一度・最初からの操作の中で鳴らし始める)
  }
  function toTitle() {
    closeOverlays(); stopHolds(); hideBanner(); bgmStop(); removeClass($('toast'), 'on');
    G.paused = false; setMode('title'); G.mode = 'title';
    showScreen('title'); drawChoices(); setFocus($('startBtn'));
    lockUntil = now() + 300;
  }
  $('startBtn').addEventListener('click', function () { sfx('tap'); beginPlay(); });
  $('exitBtn').addEventListener('click', function () { leaveToLauncher(); });

  /* ===================== 一時停止 ===================== */
  function openPause(quiet) {
    if (!isOn('game') || topOverlay() || G.mode === 'over') return false;
    G.paused = true; stopHolds(); bgmStop();
    drawChoices();
    addClass($('pauseDlg'), 'on'); setFocus($('resumeBtn'));
    lockUntil = now() + 250;
    if (!quiet) sfx('tap');
    return true;
  }
  function closePause() {
    removeClass($('pauseDlg'), 'on'); clearFocus();
    G.paused = false; lastT = now();
    bgmSync();                             // 一時停止の前の続きから
  }
  $('pauseBtn').addEventListener('click', function () { openPause(); });
  $('resumeBtn').addEventListener('click', function () { sfx('tap'); closePause(); });
  $('restartBtn').addEventListener('click', function () { sfx('tap'); beginPlay(); });
  $('pTitleBtn').addEventListener('click', function () { toTitle(); });
  $('soundBtn').addEventListener('click', function () {
    var on = !(settings.sound || settings.music);
    settings.sound = on; settings.music = on;
    saveSettings(); drawChoices(); bgmSync(); sfx('tap');
  });

  /* ===================== ゲームオーバー ===================== */
  function showOver() {
    $('overWhy').textContent = t(G.why === 'landed' ? 'why_landed' : 'why_ships');
    $('overScore').textContent = t('final_score', { n: fmtNum(G.score) });
    toggleClass($('newBest'), 'hide', !G.newBest);
    addClass($('overDlg'), 'on'); setFocus($('againBtn'));
    lockUntil = now() + 500;
  }
  $('againBtn').addEventListener('click', function () { sfx('tap'); beginPlay(); });
  $('oTitleBtn').addEventListener('click', function () { toTitle(); });

  /* ===================== メッセージ ===================== */
  var returnFocus = null;
  function say(text) {
    returnFocus = cur;
    $('dlgText').textContent = text;
    addClass($('dlg'), 'on'); setFocus($('dlgOk'));
  }
  function closeMsg() {
    removeClass($('dlg'), 'on');
    if (returnFocus && visible(returnFocus) && zoneItems().indexOf(returnFocus) >= 0) setFocus(returnFocus);
    else { cur = null; ensureFocus(); }
  }
  $('dlgOk').addEventListener('click', closeMsg);

  /* ===================== 戻る ===================== */
  function leaveToLauncher() {
    if (history.length > 1) { history.back(); return true; }   // 処理済み
    return false;                                              // 履歴なし → ラッパーに任せる
  }
  function handleBack() {
    if (isOn('loading')) return leaveToLauncher();
    if (isOn('dlg')) { closeMsg(); return true; }
    if (isOn('overDlg')) { toTitle(); return true; }
    if (isOn('pauseDlg')) { closePause(); return true; }
    if (isOn('game')) {
      if (G.mode === 'over') { toTitle(); return true; }     // ゲームオーバーの画面が出る前
      return openPause();                                    // 遊んでいる途中は一時停止(すぐには終わらない)
    }
    return leaveToLauncher();                                // タイトル
  }

  /* ===================== キー入力(6キー＋押しっぱなし対策) ===================== */
  var KEY = { ArrowUp: 'up', Up: 'up', ArrowDown: 'down', Down: 'down', ArrowLeft: 'left', Left: 'left',
    ArrowRight: 'right', Right: 'right', Enter: 'ok', NumpadEnter: 'ok', ' ': 'ok', Spacebar: 'ok',
    Backspace: 'back', Escape: 'back', Esc: 'back', GoBack: 'back', BrowserBack: 'back' };
  var CODE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', NumpadEnter: 'ok', Space: 'ok', Backspace: 'back', Escape: 'back' };
  var KEYCODE = { 38: 'up', 40: 'down', 37: 'left', 39: 'right', 13: 'ok', 23: 'ok', 32: 'ok', 8: 'back', 27: 'back', 461: 'back', 10009: 'back' };
  function actionOf(e) { return (e.key && KEY[e.key]) || (e.code && CODE[e.code]) || KEYCODE[e.keyCode] || null; }

  var lastAt = {}, held = {}, lastBackHandled = false;
  // メニューでの方向キー: 端末のリピートには任せず、自前のタイマーで送る [IN-5]
  var dirHeld = null, dirLastSeen = 0, dirTimer = 0;
  function stopDir() { dirHeld = null; if (dirTimer) { clearTimeout(dirTimer); dirTimer = 0; } }
  function dirRepeat(a, delay) {
    dirTimer = setTimeout(function () {
      if (dirHeld !== a) return;
      if (now() - dirLastSeen > 500) { stopDir(); return; }   // 合図が途切れたら止める(keyup取りこぼし対策)
      move(a); dirRepeat(a, 110);
    }, delay);
  }
  function playing() { return isOn('game') && !topOverlay(); }
  // 撃つ: 押した瞬間に1発。押しっぱなしの間は update() が一定の間隔で撃つ
  function fireDown(n) {
    if (fireHold.on && n - fireHold.last < 300) { fireHold.last = n; fireHold.reps++; return; }   // 押しっぱなしの合図
    fireHold.on = true; fireHold.start = n; fireHold.last = n; fireHold.reps = 0;
    tryFire(true);
  }

  document.addEventListener('keydown', function (e) {
    var a = actionOf(e);
    if (!a) return;
    addClass(document.body, 'kbd'); ensureAudio();
    var n = now();
    // keyup が届く端末では、ほかのキーを押している合図も「まだ押している」に数える
    // (PC で右を押したまま決定を押すと、右の連続の合図が止まるため)
    if (sawKeyup && a !== 'back' && playing()) { if (mv.dir) mv.last = n; if (fireHold.on) fireHold.last = n; }
    if (a === 'ok' || a === 'back') {
      var cont = held[a] && (n - (lastAt[a] || 0)) < 300;
      lastAt[a] = n;
      if (cont) {
        if (a !== 'back' || lastBackHandled) e.preventDefault();
        if (a === 'ok' && playing()) { fireHold.last = n; fireHold.reps++; }
        return;
      }
      held[a] = true;
      if (a === 'back') {
        var handled = handleBack();
        lastBackHandled = handled;
        if (handled) e.preventDefault();
        return;
      }
      e.preventDefault();
      if (playing()) fireDown(n); else activate();
      return;
    }
    e.preventDefault();
    if (playing()) {
      if (a === 'up') fireDown(n);
      else if (a === 'down') {
        var contD = held.down && (n - (lastAt.down || 0)) < 300;   // 押しっぱなしは1回とみなす [IN-5]
        lastAt.down = n;
        if (!contD) { held.down = true; toggleMusic(); }
      }
      else if (a === 'left' || a === 'right') {
        if (mv.dir === a) { mv.last = n; mv.reps++; } else { mv.dir = a; mv.start = n; mv.last = n; mv.reps = 0; }
      }
      return;
    }
    dirLastSeen = n;
    if (dirHeld === a) return;
    stopDir(); dirHeld = a;
    move(a); dirRepeat(a, 350);
  });
  document.addEventListener('keyup', function (e) {
    var a = actionOf(e);
    if (!a) return;
    sawKeyup = true;
    if (a === 'ok') e.preventDefault();      // ボタン標準の「スペースで押す」を止める(決定は keydown で1回だけ)
    held[a] = false;
    if (a === 'ok' || a === 'up') fireHold.on = false;
    if (a === mv.dir) mv.dir = null;
    if (a === dirHeld) stopDir();
  });
  window.addEventListener('blur', function () { stopDir(); stopHolds(); held = {}; });

  /* ===================== タッチ・マウス ===================== */
  var hasPointer = !!window.PointerEvent;
  function onPress(el, down, up) {
    if (hasPointer) {
      el.addEventListener('pointerdown', down);
      if (up) { el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); }
    } else {
      el.addEventListener('touchstart', function (e) { down(e.touches && e.touches[0] ? e.touches[0] : e); });
      el.addEventListener('mousedown', down);
      if (up) { el.addEventListener('touchend', up); el.addEventListener('touchcancel', up); el.addEventListener('mouseup', up); el.addEventListener('mouseleave', up); }
    }
  }
  // 遊ぶ場所をタップ・クリック → 1発撃つだけ(船は動かさない)
  // ver06 までは、タップした所へ船が動いた。PC で画面をクリックしたときや、iPad で ◀ ▶ 撃つ を
  // 少し外して押したときに、船が勝手に動いたように見えたのでやめた。船を動かすのは左右キーと ◀ ▶ ボタンだけ
  onPress($('game'), function (e) {
    if (!playing()) return;
    var tg = e.target;
    if (tg && tg.closest && tg.closest('button')) return;
    tryFire(true);
  });
  function padDir(id, d) {
    onPress($(id), function () {
      if (!playing()) return;
      ptr.dir = d; ptr.tgt = clamp(G.player.x + d * 90, EDGE_L, EDGE_R);   // 1回のタップでも少し動く
      addClass($(id), 'on');
    }, function () { if (ptr.dir === d) ptr.dir = 0; removeClass($(id), 'on'); });
  }
  padDir('tLeft', -1); padDir('tRight', 1);
  onPress($('tFire'), function () {
    if (!playing()) return;
    ptr.fire = true; ptr.fireStart = now(); addClass($('tFire'), 'on');
    tryFire(true);
  }, function () { ptr.fire = false; removeClass($('tFire'), 'on'); });

  // 押した場所にフォーカスを合わせる（続けてキーを押しても正しい場所から動く）[TOUCH-7]
  document.addEventListener(hasPointer ? 'pointerdown' : 'mousedown', function (e) {
    removeClass(document.body, 'kbd'); ensureAudio();
    var nv = e.target && e.target.closest ? e.target.closest('.nav') : null;
    if (nv && visible(nv)) setFocus(nv);
  });
  if (!hasPointer) document.addEventListener('touchstart', function () { removeClass(document.body, 'kbd'); ensureAudio(); });

  /* ===================== 起動 ===================== */
  // タイトルの得点表(宇宙人の絵は上で描いたドット絵を使う)
  function buildPoints() {
    var box = $('points'), items = [[IMG.gem[0], t('pts', { n: 30 })], [IMG.eye[0], t('pts', { n: 20 })], [IMG.jelly[0], t('pts', { n: 10 })], [IMG.ufo, t('pts', { n: SAUCER_PTS })], [IMG.comet, t('pts_comet'), 'small']];
    for (var i = 0; i < items.length; i++) {
      var d = document.createElement('div'); d.className = 'pt';
      var im = document.createElement('img'); im.alt = '';
      if (items[i][2]) im.className = items[i][2];   // 彗星は横に長いので一回り小さく出す(ver22)
      try { im.src = items[i][0].toDataURL('image/png'); } catch (e) {}
      var s = document.createElement('span'); s.textContent = items[i][1];
      d.appendChild(im); d.appendChild(s); box.appendChild(d);
    }
  }
  function preload(done) {
    var srcs = ['img/ui/title-' + LANG + '.svg', 'img/ui/sound-on.svg', 'img/ui/sound-off.svg'];
    var left = srcs.length, total = srcs.length, failed = 0, finished = false;
    function one(ok) {
      if (!ok) failed++;
      left--;
      $('loadFill').style.width = Math.round((total - left) / total * 100) + '%';
      if (left <= 0 && !finished) { finished = true; done(failed); }
    }
    for (var i = 0; i < srcs.length; i++) {
      var im = new Image();
      im.onload = function () { one(true); };
      im.onerror = function () { one(false); };
      im.src = srcs[i];
    }
    // 同梱の書体も読み終えてからタイトルを出す(使えない端末では待たない)
    try {
      if (document.fonts && document.fonts.load) {
        left += 2; total += 2;
        document.fonts.load('500 20px "Zen Maru Gothic"', 'あA').then(function () { one(true); }, function () { one(true); });
        document.fonts.load('700 20px "Zen Maru Gothic"', 'あA').then(function () { one(true); }, function () { one(true); });
      }
    } catch (e) {}
    // 素材が返ってこなくても止まらない
    setTimeout(function () { if (!finished) { finished = true; done(1); } }, 15000);
  }

  loadSaved();
  applyI18n();
  buildPoints();
  drawChoices();
  $('titleH').querySelector('.logo').src = 'img/ui/title-' + LANG + '.svg';   // 言語ごとのタイトル画像
  addClass($('titleH'), 'useLogo');
  requestAnimationFrame(frame);
  preload(function (failed) {
    showScreen('title'); setFocus($('startBtn'));
    if (failed) say(t('load_error'));
  });
})();
