/* おうちの宝さがし — ゲーム本体
 * 構文は ES2019 相当まで（?. ?? は使わない）。文言は i18n.js の t() から引く。
 * 戻るキーは「実際に処理したときだけ」preventDefault する（TV_WEBGAME_DEV_GUIDE 3章）。
 */
(function () {
  'use strict';

  /* ===================== 設定 ===================== */
  // 保存キーの頭。識別名とゲームIDは GML と決めて差し替える（README 参照）
  var SAVE_PREFIX = 'vendor.takara2';
  var KEY_ZUKAN = SAVE_PREFIX + '.zukan.v1';
  var KEY_BEST = SAVE_PREFIX + '.best.v1';

  var ROOMS = [
    { id: 'bathroom', img: 'img/rooms/bathroom.jpg' },
    { id: 'kitchen', img: 'img/rooms/kitchen.jpg' },
    { id: 'bedroom', img: 'img/rooms/bedroom.jpg' },
    { id: 'living', img: 'img/rooms/living.jpg' }
  ];
  var ROOM_ORDER = [2, 0, 1, 3];            // 寝室 → 洗面所 → キッチン → リビング
  var START_ROOM = 3;                        // リビングから始める
  var FIRST = { bathroom: 'mirror', kitchen: 'stove', bedroom: 'pillow', living: 'frame' };

  var COLOR_KEYS = ['red', 'blue', 'green', 'yellow'];
  var COLOR_HEX = { red: '#C8402A', blue: '#2A6FBD', green: '#2C8A4C', yellow: '#E6AA00' };
  // 文字色: 明るい黄色の上の白文字は読みにくいので、黄色だけ紺色の文字にする [LAY-8]
  var COLOR_TEXT = { red: '#FFFFFF', blue: '#FFFFFF', green: '#FFFFFF', yellow: '#1F2A44' };
  var ITEM_KEYS = ['flashlight', 'key', 'stool', 'cloth', 'bulb'];
  var TREASURE_IMG = [
    ['candy', 'stamp', 'seashell'], ['feather', 'chess', 'silver-spoon'], ['ribbon', 'fountain-pen', 'teapot'],
    ['ring', 'pocket-watch', 'pearls'], ['silver-coin', 'trophy', 'medal']
  ];
  var TOTAL_TREASURES = 15;

  /* ===================== 小道具 ===================== */
  function $(id) { return document.getElementById(id); }
  function hasClass(el, c) { return (' ' + el.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addClass(el, c) { if (!hasClass(el, c)) el.className = (el.className + ' ' + c).replace(/^\s+/, ''); }
  function removeClass(el, c) { el.className = (' ' + el.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function toggleClass(el, c, on) { if (on) addClass(el, c); else removeClass(el, c); }
  function isOn(id) { return hasClass($(id), 'on'); }
  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

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

  /* ===================== 保存(検証つき) ===================== */
  function loadZukan() {
    var out = [];
    try {
      var raw = localStorage.getItem(KEY_ZUKAN);
      if (!raw) return out;
      var v = JSON.parse(raw);
      if (!Array.isArray(v)) return out;
      for (var i = 0; i < v.length; i++) {
        if (typeof v[i] === 'string' && /^[0-4]-[0-2]$/.test(v[i]) && out.indexOf(v[i]) < 0) out.push(v[i]);
      }
    } catch (e) { /* 壊れていたら初期状態 */ }
    return out;
  }
  function saveZukan(list) { try { localStorage.setItem(KEY_ZUKAN, JSON.stringify(list)); } catch (e) {} }
  function loadBest() {
    try {
      var v = Number(localStorage.getItem(KEY_BEST));
      if (isFinite(v) && v > 0 && v < 360000000) return v;   // 100時間未満の正の数だけ
    } catch (e) {}
    return 0;
  }
  function saveBest(ms) { try { localStorage.setItem(KEY_BEST, String(Math.round(ms))); } catch (e) {} }
  function hasRecords() {
    try { return localStorage.getItem(KEY_ZUKAN) !== null || localStorage.getItem(KEY_BEST) !== null; } catch (e) { return false; }
  }
  function clearRecords() { try { localStorage.removeItem(KEY_ZUKAN); localStorage.removeItem(KEY_BEST); } catch (e) {} }

  /* ===================== 表示用の部品(辞書と内部定義だけから作る) ===================== */
  function badgeHTML(c) {
    return '<span class="badge" style="background:' + COLOR_HEX[c] + ';color:' + COLOR_TEXT[c] + '">' + t('badge', { color: t('color_' + c), n: S.digits[c] }) + '</span>';
  }
  function itemHTML(k) {
    return '<b>' + t('item_' + k) + '</b> <img class="ico" src="img/items/' + k + '.svg" alt="">';
  }
  function orderHTML() {
    var parts = [];
    for (var i = 0; i < S.order.length; i++) {
      var c = S.order[i];
      parts.push('<span class="badge" style="background:' + COLOR_HEX[c] + ';color:' + COLOR_TEXT[c] + '">' + t('color_' + c) + '</span>');
    }
    return parts.join(' → ');
  }
  var STAR_HTML = '<img class="ico" src="img/ui/sparkle.svg" alt="">';

  /* ===================== 状態 ===================== */
  var S = null;
  function newGame() {
    var order = COLOR_KEYS.slice();
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    var digits = {};
    for (i = 0; i < COLOR_KEYS.length; i++) digits[COLOR_KEYS[i]] = Math.floor(Math.random() * 10);
    S = { room: START_ROOM, inv: [], f: {}, digits: digits, order: order, stars: [], hints: 0, lastHint: -1,
          elapsed: 0, runSince: 0, running: false, won: false, chestMsg: '' };
  }
  function has(k) { return S.inv.indexOf(k) >= 0; }
  function give(k) { if (!has(k)) S.inv.push(k); sfx('get'); renderBar(); }
  function take(k) { var i = S.inv.indexOf(k); if (i >= 0) S.inv.splice(i, 1); renderBar(); }
  function found(c) { S.f[c] = true; sfx('win'); renderBar(); }

  /* ===================== 時間(非表示の間は止める) ===================== */
  var tickId = 0;
  function elapsedNow() { return S.elapsed + (S.running ? Date.now() - S.runSince : 0); }
  function resumeClock() { if (S && !S.won && !S.running && isOn('game')) { S.running = true; S.runSince = Date.now(); } }
  function pauseClock() { if (S && S.running) { S.elapsed += Date.now() - S.runSince; S.running = false; } }
  function startTick() {
    stopTick();
    tickId = setInterval(function () { if (S) $('time').textContent = fmt(elapsedNow()); }, 500);
  }
  function stopTick() { if (tickId) { clearInterval(tickId); tickId = 0; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pauseClock(); audioSuspend(); bgmSync(false); } else { resumeClock(); audioResume(); bgmSync(false); }
  });

  /* ===================== 音 ===================== */
  var ac = null, soundOn = true;
  function ensureAudio() {
    try {
      if (!ac) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) ac = new AC(); }
      if (ac && ac.state === 'suspended' && !document.hidden) ac.resume();
    } catch (e) { ac = null; }
  }
  function audioSuspend() { try { if (ac && ac.state === 'running') ac.suspend(); } catch (e) {} }
  function audioResume() { try { if (ac && ac.state === 'suspended') ac.resume(); } catch (e) {} }
  function tone(f, d, type, when, vol) {
    if (!ac || !soundOn) return;
    try {
      var tt = ac.currentTime + (when || 0);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(vol || 0.1, tt); g.gain.exponentialRampToValueAtTime(0.001, tt + d);
      o.connect(g); g.connect(ac.destination); o.start(tt); o.stop(tt + d + 0.02);
    } catch (e) {}
  }
  function sfx(k) {
    var i;
    if (k === 'tap') tone(660, 0.08, 'triangle');
    else if (k === 'tick') tone(880, 0.05, 'square', 0, 0.04);
    else if (k === 'step') { tone(330, 0.07, 'triangle'); tone(440, 0.07, 'triangle', 0.07); }
    else if (k === 'get') { tone(784, 0.1); tone(1047, 0.16, 'sine', 0.1); }
    else if (k === 'star') { var a = [1047, 1319, 1568, 2093]; for (i = 0; i < a.length; i++) tone(a[i], 0.12, 'sine', i * 0.07, 0.07); }
    else if (k === 'win') { var b = [523, 659, 784]; for (i = 0; i < b.length; i++) tone(b[i], 0.14, 'triangle', i * 0.09); }
    else if (k === 'no') { tone(220, 0.18, 'sawtooth', 0, 0.05); tone(180, 0.22, 'sawtooth', 0.15, 0.05); }
    else if (k === 'fanfare') { var c = [523, 659, 784, 1047, 784, 1047]; for (i = 0; i < c.length; i++) tone(c[i], 0.22, 'triangle', i * 0.13, 0.09); }
  }

  /* ===================== BGM(遊んでいる間とクリア画面で、控えめに後ろで流す) =====================
   * 曲の音量はファイル自体を小さく作ってある(約 -28 LUFS)。端末によっては音量の指定が効かないため。
   * 鳴らすのは: はじめの案内を閉じたあと(OK)、部屋の画面(クリア画面を含む)にいて、音オン、画面が見えているとき。
   * それ以外は止める(続きから再開)。
   * 始まり: 案内を閉じてから 0.5 秒あけて、曲の頭から。端末によっては操作の外では再生を始められないため、
   *         閉じた瞬間に消音で再生を始めておき、0.5 秒後に頭へ戻して音を出す。
   * クリア: 曲をすっと小さくして消音(止めずに流したまま)→ ファンファーレ → 約1秒おいて、少し小さめの音量でゆっくり戻す。 */
  var BGM_VOL = 1.0, BGM_WIN_VOL = 0.6;            // クリア画面では少し小さめ
  var BGM_FADE_MS = 900, BGM_START_DELAY_MS = 500;
  var BGM_WIN_DUCK_MS = 500, BGM_WIN_BACK_MS = 2000, BGM_WIN_RISE_MS = 2500;   // 小さくする / 戻し始める(ファンファーレ約0.9秒+1秒) / 戻す長さ
  var bgm = null, bgmFadeId = 0, bgmDelayId = 0;
  try { bgm = new Audio(); bgm.src = 'audio/bgm.mp3?v=55'; bgm.loop = true; bgm.preload = 'auto'; bgm.volume = BGM_VOL; } catch (e) { bgm = null; }
  function bgmWanted() { return !!(bgm && soundOn && S && S.bgmGo && isOn('game') && !document.hidden); }
  function bgmTarget() { return S && S.won ? BGM_WIN_VOL : BGM_VOL; }
  function bgmClearFade() { if (bgmFadeId) { clearInterval(bgmFadeId); bgmFadeId = 0; } }
  function bgmCancelDelay() { if (bgmDelayId) { clearTimeout(bgmDelayId); bgmDelayId = 0; } }
  function bgmRamp(to, ms, done) {   // 音量を ms かけて to へ(音量の指定が効かない端末では、すぐ終わったのと同じ)
    bgmClearFade();
    var from = 0, step = 0, steps = Math.max(1, Math.round(ms / 60));
    try { from = bgm.volume; } catch (e) {}
    bgmFadeId = setInterval(function () {
      step++;
      try { bgm.volume = Math.max(0, Math.min(1, from + (to - from) * step / steps)); } catch (e) {}
      if (step >= steps) { bgmClearFade(); if (done) done(); }
    }, 60);
  }
  function bgmPlay(fromTop) {
    if (!bgm) return;
    bgmClearFade(); bgmCancelDelay();
    try {
      if (fromTop) bgm.currentTime = 0;
      bgm.volume = bgmTarget(); bgm.muted = false;
      if (bgm.paused) { var p = bgm.play(); if (p && p.catch) p.catch(function () {}); }
    } catch (e) {}
  }
  function bgmStartDelayed() {   // はじめの案内を閉じたとき(操作の中で呼ぶ)
    if (!bgm) return;
    bgmClearFade(); bgmCancelDelay();
    try {
      bgm.currentTime = 0; bgm.volume = BGM_VOL; bgm.muted = true;
      var p = bgm.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
    bgmDelayId = setTimeout(function () {
      bgmDelayId = 0;
      if (!bgmWanted()) { try { bgm.pause(); bgm.muted = false; } catch (e) {} return; }
      try { bgm.currentTime = 0; bgm.muted = false; } catch (e) {}
    }, BGM_START_DELAY_MS);
  }
  function bgmWin() {   // クリアしたとき(ファンファーレの直前に呼ぶ)
    if (!bgm || !bgmWanted() || bgm.paused) return;
    bgmCancelDelay();
    bgmRamp(0, BGM_WIN_DUCK_MS, function () { try { bgm.muted = true; } catch (e) {} });
    bgmDelayId = setTimeout(function () {
      bgmDelayId = 0;
      if (!bgmWanted()) return;
      try { bgm.volume = 0; bgm.muted = false; } catch (e) {}
      if (bgm.paused) { var p = bgm.play(); if (p && p.catch) p.catch(function () {}); }
      bgmRamp(BGM_WIN_VOL, BGM_WIN_RISE_MS);
    }, BGM_WIN_BACK_MS);
  }
  function bgmPause(fade) {
    if (!bgm) return;
    if (bgmDelayId) { bgmCancelDelay(); fade = false; }
    if (bgm.paused || bgm.muted) { bgmClearFade(); try { bgm.pause(); bgm.muted = false; bgm.volume = BGM_VOL; } catch (e) {} return; }
    if (!fade) { bgmClearFade(); try { bgm.pause(); bgm.volume = BGM_VOL; bgm.muted = false; } catch (e) {} return; }
    bgmRamp(0, BGM_FADE_MS, function () { try { bgm.pause(); bgm.volume = BGM_VOL; } catch (e) {} });
  }
  function bgmSync(fade) { if (bgmWanted()) bgmPlay(false); else bgmPause(fade); }

  /* ===================== 部屋の中身 ===================== */
  function starAct(id) { return function () { star(id); }; }
  var OBJ = {
    bathroom: [
      { id: 'mirror', x: 51, y: 27, l: 'hs_mirror', act: function () {
        if (!S.f.steam) return say(t('msg_mirror_plain'));
        if (!S.f.blue) { found('blue'); return say(t('msg_mirror_reveal', { badge: badgeHTML('blue') })); }
        say(t('msg_mirror_again', { badge: badgeHTML('blue') }));
      } },
      { id: 'tap', x: 42, y: 47.5, l: 'hs_tap', act: function () {
        if (!S.f.steam) { S.f.steam = true; sfx('get'); overlays(); say(t('msg_tap_on')); } else say(t('msg_tap_again'));
      } },
      { id: 'brush', x: 50.5, y: 48, l: 'hs_brush', above: true, act: function () { say(t('msg_brush')); } },
      { id: 'tub', x: 13, y: 68, l: 'hs_tub', act: function () { say(t('msg_tub')); } },
      { id: 'cab', x: 37, y: 67, l: 'hs_cab', act: function () {
        if (!S.f.cloth) { S.f.cloth = true; give('cloth'); say(t('msg_cab_get', { item: itemHTML('cloth') })); } else say(t('msg_cab_again'));
      } },
      { id: 'basket', x: 77.5, y: 73, l: 'hs_basket', act: function () {
        if (!S.f.key) { S.f.key = true; give('key'); say(t('msg_basket_get', { item: itemHTML('key') })); } else say(t('msg_basket_again'));
      } },
      { id: 'duck', x: 22.5, y: 39, star: true, act: starAct('duck') },
      { id: 'jar', x: 77, y: 22, star: true, act: starAct('jar') }
    ],
    kitchen: [
      { id: 'fridge', x: 5, y: 32, l: 'hs_fridge', act: function () { say(t('msg_fridge')); } },
      { id: 'chest', x: 18.5, y: 28, l: 'hs_chest', act: function () { chestAct(); } },
      { id: 'shelf', x: 80, y: 13, l: 'hs_shelf', act: function () {
        if (S.f.red) return say(t('msg_shelf_again', { badge: badgeHTML('red') }));
        if (!has('stool')) return say(t('msg_shelf_high'));
        take('stool'); found('red'); say(t('msg_shelf_get', { item: itemHTML('stool'), badge: badgeHTML('red') }));
      } },
      { id: 'drawer', x: 36, y: 49.5, l: 'hs_drawer', act: function () {
        if (S.f.flashlight) return say(t('msg_drawer_again'));
        if (!has('key')) return say(t('msg_drawer_locked'));
        take('key'); S.f.flashlight = true; give('flashlight'); say(t('msg_drawer_open', { item: itemHTML('flashlight') }));
      } },
      { id: 'stove', x: 47, y: 48, l: 'hs_stove', act: function () { say(t('msg_stove')); } },
      { id: 'apple', x: 22.5, y: 54, star: true, act: starAct('apple') },
      { id: 'towel', x: 84, y: 64, star: true, act: starAct('towel') }
    ],
    bedroom: [
      { id: 'pic', x: 46, y: 30, star: true, act: starAct('pic') },
      { id: 'closet', x: 88, y: 46, l: 'hs_closet', act: function () {
        if (!S.f.stool) { S.f.stool = true; give('stool'); say(t('msg_closet_get', { item: itemHTML('stool') })); } else say(t('msg_closet_again'));
      } },
      { id: 'pillow', x: 50, y: 51, l: 'hs_pillow', act: function () { S.f.memo = true; say(t('msg_pillow')); } },
      { id: 'table', x: 30, y: 61, l: 'hs_table', act: function () { S.f.photo = true; renderBar(); say(t('msg_table', { order: orderHTML() })); } },
      { id: 'under', x: 51, y: 84, l: 'hs_under', above: true, act: function () {
        if (S.f.green) return say(t('msg_under_again', { badge: badgeHTML('green') }));
        if (!has('flashlight')) return say(t('msg_under_dark'));
        take('flashlight'); found('green'); say(t('msg_under_reveal', { item: itemHTML('flashlight'), badge: badgeHTML('green') }));
      } },
      { id: 'bear', x: 17, y: 87, star: true, act: starAct('bear') },
      // 寄り道: テーブルランプの電球を借りて、リビングのスタンドライトに入れる(クリアには不要。ヒントでも教えない)
      // 隠し場所: リビングで電球切れに気づくまでは反応しない。気づいた後も、選んだときだけ〇が見える(ラベルなし)
      { id: 'tlamp', x: 73, y: 51, l: 'hs_tlamp', secret: true, act: function () {
        // 押すたびに「借りる」「戻す」を切り替える。リビングで使った後は外れたまま
        if (S.f.bulbIn) return say(t('msg_tlamp_again'));
        if (has('bulb')) { take('bulb'); sfx('tap'); return say(t('msg_tlamp_back')); }
        give('bulb'); say(t('msg_tlamp_get', { item: itemHTML('bulb') }));
      } }
    ],
    living: [
      { id: 'books', x: 6.5, y: 33, l: 'hs_books', act: function () { if (livingDark()) return say(t('msg_too_dark')); say(t('msg_books', { star: STAR_HTML })); } },
      { id: 'frame', x: 47.5, y: 37, l: 'hs_frame', act: function () {
        if (livingDark()) return say(t('msg_too_dark'));
        if (S.f.yellow) return say(t('msg_frame_again', { badge: badgeHTML('yellow') }));
        if (!has('cloth')) return say(t('msg_frame_dirty'));
        take('cloth'); found('yellow'); overlays(); say(t('msg_frame_reveal', { item: itemHTML('cloth'), badge: badgeHTML('yellow') }));
      } },
      { id: 'lamp', x: 75.5, y: 38, l: 'hs_lamp', act: function () {
        // 壁の文字は「電球が点いている」かつ「シェードを下ろして部屋が暗い」ときだけ映る
        // 2回目以降も、ひと言添えてからメッセージを映す
        if (S.f.lit) return S.f.shade ? say(t('msg_wall_words'), openLetter) : sayLampLit();
        // 電球は入っているが消してあるときは、点け直す
        if (S.f.bulbIn) {
          S.f.lit = true; sfx('tap'); overlays();
          return S.f.shade ? say(t('msg_lamp_relit_words'), openLetter) : say(t('msg_lamp_relit'));
        }
        if (!has('bulb')) { if (!S.f.lampSeen) { S.f.lampSeen = true; updateSecretHs(); } return say(t('msg_lamp')); }
        take('bulb'); S.f.bulbIn = true; S.f.lit = true; sfx('get'); overlays();
        if (S.f.shade) say(t('msg_lamp_on'), openLetter); else say(t('msg_lamp_on_bright'));
      } },
      { id: 'window', x: 86.5, y: 59.5, l: 'hs_window', act: function () {
        // 調べるたびにシェードを下ろす・上げる
        S.f.shade = !S.f.shade; sfx('tap'); overlays();
        if (!S.f.shade) return say(t('msg_shade_up'));
        if (S.f.lit) {
          // 一度メッセージを見た後は自動では出さない(スタンドライトを選ぶと見られる)
          if (S.f.msgSeen) return say(t('msg_shade_down_dark'));
          return say(t('msg_shade_down_lit'), openLetter);
        }
        say(t('msg_shade_down'));
      } },
      { id: 'sofa', x: 34, y: 60, star: true, act: starAct('sofa') },
      { id: 'rug', x: 66, y: 89, star: true, act: starAct('rug') }
    ]
  };

  function star(id) {
    if (S.stars.indexOf(id) >= 0) return say(t('star_again'));
    S.stars.push(id); sfx('star'); renderBar(); updateStarMarks();
    say(t('star_found', { n: S.stars.length }));
  }

  function chestAct() {
    var i, ready = !!S.f.photo, anyClue = !!S.f.photo;
    for (i = 0; i < COLOR_KEYS.length; i++) { if (S.f[COLOR_KEYS[i]]) anyClue = true; else ready = false; }
    // 手がかりがひとつもないときは、メッセージだけでダイヤルは開かない
    if (!anyClue) { if (!S.chestMsg) sfx('get'); S.chestMsg = 'none'; return say(t('msg_chest_none')); }
    var state = ready ? 'ready' : 'notready';
    if (S.chestMsg === state) return openPad();
    S.chestMsg = state; sfx('get');
    say(t(ready ? 'msg_chest_ready' : 'msg_chest_none'), openPad);
  }

  /* ===================== 部屋の表示(最初に1回だけ作る) ===================== */
  var views = {}, hsEls = {};
  function buildRooms() {
    var area = $('roomArea');
    for (var r = 0; r < ROOMS.length; r++) {
      var room = ROOMS[r];
      var v = el('div', 'roomView');
      var img = el('img', 'scene'); img.src = room.img; img.alt = ''; img.draggable = false;
      v.appendChild(img);
      if (room.id === 'bathroom') { var fog = el('div', 'ov fog'); fog.style.left = '38.7%'; fog.style.top = '17.2%'; fog.style.width = '25.5%'; fog.style.height = '22.9%'; v.appendChild(fog); }
      if (room.id === 'living') {
        // シェードを下ろした絵(下ろすと、この絵に切り替わる)
        var sh = el('img', 'scene ov shade'); sh.src = 'img/rooms/living-shade.jpg'; sh.alt = ''; sh.draggable = false; v.appendChild(sh);
        v.appendChild(el('div', 'ov dark')); v.appendChild(el('div', 'ov glow'));
      }
      if (room.id === 'living') { var dirt = el('div', 'ov dirt on'); dirt.style.left = '40.9%'; dirt.style.top = '29.4%'; dirt.style.width = '13.8%'; dirt.style.height = '15.3%'; v.appendChild(dirt); }
      var list = OBJ[room.id];
      // 最初に選ばれる場所を先頭に
      list.sort(function (a, b) { return (a.id === FIRST[room.id] ? -1 : 0) - (b.id === FIRST[room.id] ? -1 : 0); });
      hsEls[room.id] = [];
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        var b = el('button', 'hs nav' + (o.star ? ' star' : '') + (o.above ? ' lbl-above' : '') + (o.secret ? ' secret locked' : ''));
        b.type = 'button';
        b.style.left = o.x + '%'; b.style.top = o.y + '%';
        b.setAttribute('data-id', o.id);
        if (o.star) {
          var sp = el('span', 'spark'); var si = el('img'); si.src = 'img/ui/sparkle.svg'; si.alt = ''; sp.appendChild(si); b.appendChild(sp);
          b.setAttribute('aria-label', t('hs_star'));
        } else if (o.secret) {
          b.appendChild(el('span', 'ring'));                    // ラベルは出さない(読み上げ用の名前だけ)
          b.setAttribute('aria-label', t(o.l));
        } else {
          b.appendChild(el('span', 'ring'));
          b.appendChild(el('span', 'lbl', t(o.l)));
        }
        b._obj = o;
        b.addEventListener('click', onHotspot);
        v.appendChild(b); hsEls[room.id].push(b);
      }
      area.appendChild(v); views[room.id] = v;
    }
  }
  function onHotspot(e) { var o = e.currentTarget._obj; if (!o) return; sfx('tap'); o.act(); }

  function showRoom(i) {
    S.room = i;
    for (var r = 0; r < ROOMS.length; r++) toggleClass(views[ROOMS[r].id], 'on', r === i);
    $('roomName').textContent = t('room_' + ROOMS[i].id);
    overlays(); renderRoomBtns();
  }
  function overlays() {
    var f = views.bathroom.querySelector('.fog'), d = views.living.querySelector('.dirt'), g = views.living.querySelector('.glow');
    toggleClass(f, 'on', !!S.f.steam);
    toggleClass(d, 'on', !S.f.yellow);
    toggleClass(g, 'on', !!S.f.lit);
    toggleClass(views.living.querySelector('.shade'), 'on', !!S.f.shade);
    toggleClass(views.living.querySelector('.dark'), 'on', !!S.f.shade);
    // シェードを下ろして明かりも無いときは、リビングの星が見えない(選べない)
    var dark = livingDark(), list = hsEls.living;
    for (var i = 0; i < list.length; i++) if (list[i]._obj.star) toggleClass(list[i], 'dim', dark);
  }
  // リビングが暗い = シェードを下ろしていて、スタンドライトが点いていない
  function livingDark() { return !!S.f.shade && !S.f.lit; }
  function updateSecretHs() {
    var list = hsEls.bedroom;
    for (var i = 0; i < list.length; i++) if (list[i]._obj.secret) toggleClass(list[i], 'locked', !S.f.lampSeen);
  }
  function updateStarMarks() {
    for (var r = 0; r < ROOMS.length; r++) {
      var list = hsEls[ROOMS[r].id];
      for (var i = 0; i < list.length; i++) if (list[i]._obj.star) toggleClass(list[i], 'got', S.stars.indexOf(list[i]._obj.id) >= 0);
    }
  }
  function goRoom(i) {
    sfx('step'); showRoom(i);
    setFocus(hsEls[ROOMS[i].id][0]);
  }
  function stepRoom(d) { var k = ROOM_ORDER.indexOf(S.room); return ROOM_ORDER[(k + d + 4) % 4]; }

  /* ===================== 下のバー ===================== */
  var roomBtnEls = [];
  function buildBar() {
    var box = $('roomBtns');
    for (var k = 0; k < ROOM_ORDER.length; k++) {
      var i = ROOM_ORDER[k];
      var b = el('button', 'roombtn nav', t('room_short_' + ROOMS[i].id));
      b.type = 'button'; b.setAttribute('data-room', String(i)); b.setAttribute('aria-label', t('room_' + ROOMS[i].id));
      b.addEventListener('click', function (e) { var n = Number(e.currentTarget.getAttribute('data-room')); if (n !== S.room) goRoom(n); });
      box.appendChild(b); roomBtnEls.push(b);
    }
  }
  function renderRoomBtns() {
    for (var k = 0; k < roomBtnEls.length; k++) toggleClass(roomBtnEls[k], 'cur', Number(roomBtnEls[k].getAttribute('data-room')) === S.room);
  }
  var lastBarKey = '';
  function renderBar() {
    // 変わったときだけ書き直す
    var key = S.inv.join(',') + '|' + COLOR_KEYS.map(function (c) { return S.f[c] ? 1 : 0; }).join('') + '|' + (S.f.photo ? 1 : 0) + '|' + S.stars.length + '|' + S.order.join(',');
    if (key === lastBarKey) return;
    lastBarKey = key;
    // 持ち物は手に入れた順に詰めて4枠に並べる(同時に持てるのは最大4つ)
    var slots = $('slots'); slots.innerHTML = '';
    for (var i = 0; i < 4; i++) {
      var k = S.inv[i], s = el('div', 'slot');
      if (k) { addClass(s, 'full'); var im = el('img'); im.src = 'img/items/' + k + '.svg'; im.alt = t('item_title_' + k); s.appendChild(im); }
      slots.appendChild(s);
    }
    var nums = $('nums'); nums.innerHTML = '';
    for (i = 0; i < COLOR_KEYS.length; i++) {
      var c = COLOR_KEYS[i], bd = el('span', 'badge' + (S.f[c] ? '' : ' unk'));
      bd.style.background = COLOR_HEX[c]; bd.style.color = COLOR_TEXT[c];
      bd.textContent = S.f[c] ? t('badge', { color: t('color_' + c), n: S.digits[c] }) : t('badge_unknown', { color: t('color_' + c) });
      nums.appendChild(bd);
    }
    toggleClass($('orderBox'), 'hide', !S.f.photo);
    var dots = $('dots'); dots.innerHTML = '';
    for (i = 0; i < S.order.length; i++) { var d = el('span', 'dot'); d.style.background = COLOR_HEX[S.order[i]]; d.setAttribute('aria-label', t('color_' + S.order[i])); dots.appendChild(d); }
    $('stars').textContent = t('stars_count', { n: S.stars.length });
  }

  /* ===================== フォーカス(自前で管理) ===================== */
  var cur = null;
  function setFocus(e) {
    if (!e) return;
    if (cur && cur !== e) removeClass(cur, 'is-focus');
    cur = e; addClass(e, 'is-focus');
    try { e.focus({ preventScroll: true }); } catch (x) { try { e.focus(); } catch (y) {} }
  }
  function visible(e) { return e.offsetParent !== null && !e.disabled; }
  function topOverlay() {
    var ids = ['winDlg', 'letterDlg', 'padDlg', 'quitDlg', 'cfmDlg', 'dlg'];
    // 後から開いたものが上。メッセージはいつも最前面
    if (isOn('dlg')) return $('dlg');
    for (var i = 0; i < ids.length; i++) if (isOn(ids[i])) return $(ids[i]);
    return null;
  }
  function list(sel, root) { var a = (root || document).querySelectorAll(sel), out = []; for (var i = 0; i < a.length; i++) if (visible(a[i])) out.push(a[i]); return out; }
  function zoneOf(e) {
    if (!e) return null;
    var ov = topOverlay();
    if (ov) return { name: 'ov', items: list('.nav', ov) };
    if (isOn('title')) return { name: 'title', items: list('#title .nav') };
    if (isOn('game')) {
      if (e.closest && e.closest('#bar')) return { name: 'bar', items: list('#bar .nav') };
      return { name: 'stage', items: hsEls[ROOMS[S.room].id].filter(visible) };   // 隠れている場所は除く
    }
    return null;
  }
  function center(e) { var r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  function nearest(from, items, dir) {
    var a = center(from), best = null, bs = Infinity;
    for (var i = 0; i < items.length; i++) {
      var e = items[i]; if (e === from) continue;
      var b = center(e), dx = b.x - a.x, dy = b.y - a.y, p, s;
      if (dir === 'right') { p = dx; s = Math.abs(dy); } else if (dir === 'left') { p = -dx; s = Math.abs(dy); }
      else if (dir === 'down') { p = dy; s = Math.abs(dx); } else { p = -dy; s = Math.abs(dx); }
      if (p <= 2) continue;
      var score = p + s * 2.2;
      if (score < bs) { bs = score; best = e; }
    }
    return best;
  }
  function closestTo(from, items) {
    var a = center(from), best = null, bd = Infinity;
    for (var i = 0; i < items.length; i++) { var b = center(items[i]), d = Math.abs(b.x - a.x) + Math.abs(b.y - a.y) * 0.5; if (d < bd) { bd = d; best = items[i]; } }
    return best;
  }
  function ensureFocus() {
    var z = zoneOf(cur || document.body);
    if (!z) return;
    if (!cur || z.items.indexOf(cur) < 0) {
      // 開いている画面の中に今のフォーカスが無ければ、既定の場所へ
      var ov = topOverlay();
      if (ov) return setFocus(defaultIn(ov));
      if (isOn('title')) return setFocus($('startBtn'));
      if (isOn('game')) return setFocus(hsEls[ROOMS[S.room].id][0]);
    }
  }
  function defaultIn(ov) {
    if (ov.id === 'dlg') return $('dlgOk');
    if (ov.id === 'quitDlg') return $('quitNo');
    if (ov.id === 'cfmDlg') return $('cfmNo');
    if (ov.id === 'padDlg') return $('pad').firstChild;
    if (ov.id === 'winDlg') return $('againBtn');
    if (ov.id === 'letterDlg') return $('letterOk');
    return list('.nav', ov)[0];
  }
  // 左右キーでは選べない(上下キーでだけ選べる)場所。画面の上や下の端にあって、見つけにくくしたいもの
  // 個別に決めた移動先(自動で選ばれる先が分かりにくい場所だけ)
  var NAV_OVERRIDE = {
    tap: { down: 'cab' },     // 洗面所: 蛇口で下 → 戸棚(戸棚で上 → 蛇口と対になる)
    stove: { up: 'shelf' }    // キッチン: コンロで上 → 上の棚(右上)
  };
  var VERTICAL_ONLY = ['cab', 'basket', 'shelf', 'pic', 'bear', 'window', 'rug'];
  function move(dir) {
    if (!cur || !visible(cur)) { ensureFocus(); return; }
    var z = zoneOf(cur); if (!z) return;
    if (z.items.indexOf(cur) < 0) { ensureFocus(); return; }
    var cands = z.items;
    if (z.name === 'stage' && (dir === 'left' || dir === 'right')) {
      cands = z.items.filter(function (e) { return VERTICAL_ONLY.indexOf(e.getAttribute('data-id')) < 0; });
    }
    var next = null;
    // 決めておいた移動先があれば、それを優先する
    var ov = z.name === 'stage' && NAV_OVERRIDE[cur.getAttribute('data-id')];
    if (ov && ov[dir]) { next = views[ROOMS[S.room].id].querySelector('.hs[data-id="' + ov[dir] + '"]'); if (next && !visible(next)) next = null; }
    if (!next) next = nearest(cur, cands, dir);
    if (next) { setFocus(next); return; }
    if (z.name === 'stage') {
      if (dir === 'left' || dir === 'right') { goRoom(stepRoom(dir === 'right' ? 1 : -1)); return; }
      if (dir === 'down') { setFocus(closestTo(cur, list('#bar .nav'))); return; }
    }
    if (z.name === 'bar' && dir === 'up') { setFocus(closestTo(cur, hsEls[ROOMS[S.room].id].filter(visible))); }
  }
  function activate() {
    if (!cur || !visible(cur)) { ensureFocus(); return; }
    cur.click();
  }

  /* ===================== メッセージ ===================== */
  var returnFocus = null, afterSay = null;
  function remember() { if (!topOverlay()) returnFocus = cur; }
  function say(html, after) {
    afterSay = after || null;
    if (!isOn('dlg')) { if (!topOverlay()) returnFocus = cur; else returnFocus = cur; }
    $('dlgText').innerHTML = html;          // 辞書と内部定義だけから作った文字列
    addClass($('dlgOff'), 'hide');           // 「電気を消す」は必要なときだけ出す(sayLampLit)
    addClass($('dlg'), 'on'); setFocus($('dlgOk'));
  }
  function closeMsg(runAfter) {
    removeClass($('dlg'), 'on');
    var f = afterSay; afterSay = null;
    restoreFocus();
    if (S && !S.bgmGo && isOn('game')) { S.bgmGo = true; if (bgmWanted()) bgmStartDelayed(); }   // はじめの案内を閉じたら 0.5 秒後に BGM
    if (runAfter && f) f();
  }
  function restoreFocus() {
    if (returnFocus && visible(returnFocus) && zoneOf(returnFocus) && zoneOf(returnFocus).items.indexOf(returnFocus) >= 0) setFocus(returnFocus);
    else { cur = cur && visible(cur) ? cur : null; ensureFocus(); }
  }
  $('dlgOk').addEventListener('click', function () { closeMsg(true); });

  /* ===================== 壁に映るメッセージ(シークレット) ===================== */
  function openLetter() {
    remember();
    S.f.msgSeen = true;
    $('letterBody').innerHTML = t('letter_body');               // 辞書の文だけ
    addClass($('letterDlg'), 'on'); setFocus($('letterOk'));
  }
  function closeLetter() { removeClass($('letterDlg'), 'on'); restoreFocus(); }
  $('letterOk').addEventListener('click', closeLetter);
  // シェードが上がっていてライトが点いているとき。「電気を消す」も出す
  function sayLampLit() {
    say(t('msg_lamp_lit'));
    removeClass($('dlgOff'), 'hide');
  }
  $('dlgOff').addEventListener('click', function () {
    closeMsg(false); S.f.lit = false; sfx('tap'); overlays();
    say(t('msg_lamp_off_bright'));
  });
  // 電気を消す: メッセージを閉じてスタンドライトを消す(電球は入ったまま。ライトを選ぶと点け直せる)
  $('letterOff').addEventListener('click', function () {
    closeLetter(); S.f.lit = false; sfx('tap'); overlays();
    say(t('msg_lamp_off'));
  });

  /* ===================== ヒント(進み具合が変わったときだけ数える) ===================== */
  var HINT_STEPS = [
    function () { return S.f.memo; }, function () { return S.f.key; }, function () { return S.f.flashlight; },
    function () { return S.f.green; }, function () { return S.f.cloth; }, function () { return S.f.yellow; },
    function () { return S.f.stool; }, function () { return S.f.red; }, function () { return S.f.steam; },
    function () { return S.f.blue; }, function () { return S.f.photo; }, function () { return false; }
  ];
  $('hintBtn').addEventListener('click', function () {
    var i = 0; while (i < HINT_STEPS.length - 1 && HINT_STEPS[i]()) i++;
    if (i !== S.lastHint) { S.hints++; S.lastHint = i; }
    say('<img class="ico" src="img/ui/bulb.svg" alt=""> ' + t('hint_' + (i + 1)));
  });

  /* ===================== 宝箱のダイヤル ===================== */
  var entry = [];
  function drawCode() {
    var box = $('code'); box.innerHTML = '';
    for (var i = 0; i < 4; i++) box.appendChild(el('span', '', entry[i] != null ? String(entry[i]) : ''));
  }
  function buildPad() {
    var keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'del', 0, 'clr'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var b = el('button', 'key nav', k === 'del' ? t('pad_del') : k === 'clr' ? t('pad_clear') : String(k));
      b.type = 'button'; b.setAttribute('data-k', String(k));
      b.addEventListener('click', function (e) { press(e.currentTarget.getAttribute('data-k')); });
      $('pad').appendChild(b);
    }
  }
  function press(k) {
    if (k === 'del') entry.pop();
    else if (k === 'clr') entry = [];
    else if (entry.length < 4) { entry.push(Number(k)); sfx('tick'); }
    drawCode();
    if (entry.length === 4 && k !== 'del' && k !== 'clr') setFocus($('padOk'));
  }
  function openPad() {
    remember();
    entry = []; drawCode(); $('padErr').textContent = '';
    addClass($('padDlg'), 'on'); setFocus($('pad').firstChild);
  }
  function closePad() { removeClass($('padDlg'), 'on'); restoreFocus(); }
  $('padClose').addEventListener('click', closePad);
  $('padOk').addEventListener('click', function () {
    var ans = S.order.map(function (c) { return String(S.digits[c]); }).join('');
    if (entry.join('') === ans) { removeClass($('padDlg'), 'on'); win(); return; }
    sfx('no');
    var b = $('padBox'); removeClass(b, 'shake'); void b.offsetWidth; addClass(b, 'shake');
    entry = []; drawCode(); $('padErr').textContent = t('pad_wrong');
    setFocus($('pad').firstChild);
  });

  /* ===================== クリア ===================== */
  function win() {
    pauseClock(); S.won = true; stopTick(); bgmWin(); sfx('fanfare');
    var time = elapsedNow();
    var stars = S.stars.length, rank = Math.floor(stars / 2), got = loadZukan();
    var fresh = [0, 1, 2].filter(function (i) { return got.indexOf(rank + '-' + i) < 0; });
    var pool = fresh.length ? fresh : [0, 1, 2];
    var k = pool[Math.floor(Math.random() * pool.length)], id = rank + '-' + k;
    var isNew = got.indexOf(id) < 0; if (isNew) got.push(id); saveZukan(got);

    var tKey = 'tr_' + rank + '_' + k;
    $('trophyImg').src = 'img/treasures/' + TREASURE_IMG[rank][k] + '.svg';
    $('trophyImg').alt = t(tKey + '_n');
    toggleClass($('trophy'), 'legend', rank === 4);
    var tn = $('tName'); tn.textContent = t('win_got', { name: t(tKey + '_n') });
    if (isNew) tn.appendChild(el('span', 'newtag', t('win_new')));
    $('tDesc').textContent = t(tKey + '_d');

    var res = $('results'); res.innerHTML = '';
    res.appendChild(el('span', '', t('win_time', { t: fmt(time) })));
    res.appendChild(el('span', '', t('win_stars', { n: stars })));
    res.appendChild(el('span', '', t('win_hints', { n: S.hints })));

    var lines = [];
    lines.push(stars === 8 && S.hints === 0 ? t('win_master') : stars === 8 ? t('win_all_stars') : t('win_more'));
    if (got.length === TOTAL_TREASURES) lines.push(t('win_complete'));
    var best = loadBest();
    if (!best || time < best) { saveBest(time); lines.push(t('win_best')); }
    var rk = $('rank'); rk.innerHTML = '';
    for (var i = 0; i < lines.length; i++) { if (i) rk.appendChild(document.createElement('br')); rk.appendChild(document.createTextNode(lines[i])); }

    $('zukanTitle').textContent = t('win_collection', { n: got.length, total: TOTAL_TREASURES });
    var z = $('zukan'); z.innerHTML = '';
    for (var r = 0; r < 5; r++) {
      var col = el('div', 'zcol'), head = el('b');
      var si = el('img'); si.src = 'img/ui/sparkle.svg'; si.alt = ''; head.appendChild(si); head.appendChild(document.createTextNode(t('win_rank_' + r)));
      col.appendChild(head);
      for (var j = 0; j < 3; j++) {
        var sid = r + '-' + j, slot = el('div', 'zslot' + (sid === id ? ' now' : ''));
        if (got.indexOf(sid) >= 0) { var im = el('img'); im.src = 'img/treasures/' + TREASURE_IMG[r][j] + '.svg'; im.alt = t('tr_' + r + '_' + j + '_n'); slot.appendChild(im); }
        else slot.textContent = '?';
        col.appendChild(slot);
      }
      z.appendChild(col);
    }
    // 隠しメッセージにたどり着いたプレイだけ、ご褒美の印を出す(記録には残さない)
    toggleClass($('ownerBadge'), 'hide', !S.f.msgSeen);
    addClass($('winDlg'), 'on'); setFocus($('againBtn'));
  }
  $('againBtn').addEventListener('click', function () { removeClass($('winDlg'), 'on'); startGame(); });
  $('toTitleBtn').addEventListener('click', function () { removeClass($('winDlg'), 'on'); toTitle(); });

  /* ===================== やめる確認 ===================== */
  function openQuit() { remember(); addClass($('quitDlg'), 'on'); setFocus($('quitNo')); }
  $('quitBtn').addEventListener('click', openQuit);
  $('quitNo').addEventListener('click', function () { removeClass($('quitDlg'), 'on'); restoreFocus(); });
  $('quitYes').addEventListener('click', function () { removeClass($('quitDlg'), 'on'); toTitle(); });

  /* ===================== 記録リセット ===================== */
  $('resetBtn').addEventListener('click', function () {
    if (!hasRecords()) return say(t('reset_none'));
    remember(); addClass($('cfmDlg'), 'on'); setFocus($('cfmNo'));
  });
  $('cfmNo').addEventListener('click', function () { removeClass($('cfmDlg'), 'on'); setFocus($('resetBtn')); });
  $('cfmYes').addEventListener('click', function () {
    clearRecords(); removeClass($('cfmDlg'), 'on'); showRecords(); returnFocus = $('resetBtn'); setFocus($('resetBtn'));
    say(t('reset_done'));
  });

  /* ===================== 画面の切り替え ===================== */
  function showScreen(id) {
    var ids = ['loading', 'title', 'game'];
    for (var i = 0; i < ids.length; i++) toggleClass($(ids[i]), 'on', ids[i] === id);
  }
  function showRecords() {
    var b = loadBest(), n = loadZukan().length;
    $('bestTime').textContent = b ? t('best_time', { t: fmt(b) }) : '';
    $('bestCount').textContent = n ? t('collection_count', { n: n, total: TOTAL_TREASURES }) : '';
  }
  function toTitle() {
    pauseClock(); stopTick(); bgmPause(true);
    showScreen('title'); showRecords(); setFocus($('startBtn'));
  }
  function startGame() {
    ensureAudio();
    newGame(); lastBarKey = '';
    showScreen('game');
    updateStarMarks(); updateSecretHs(); renderBar(); showRoom(S.room);
    $('time').textContent = '0:00';
    S.running = false; resumeClock(); startTick();
    bgmPause(false);   // BGM は、はじめの案内を OK で閉じてから(closeMsg)
    setFocus(hsEls[ROOMS[S.room].id][0]);
    returnFocus = cur;
    say(t('intro'));
  }
  $('startBtn').addEventListener('click', startGame);
  $('exitBtn').addEventListener('click', function () { leaveToLauncher(); });
  $('prevRoom').addEventListener('click', function () { goRoom(stepRoom(-1)); });
  $('nextRoom').addEventListener('click', function () { goRoom(stepRoom(1)); });
  $('soundBtn').addEventListener('click', function () {
    soundOn = !soundOn;
    $('soundImg').src = soundOn ? 'img/ui/sound-on.svg' : 'img/ui/sound-off.svg';
    $('soundBtn').setAttribute('aria-label', t(soundOn ? 'sound_on' : 'sound_off'));
    bgmSync(false);
  });

  /* ===================== 戻る ===================== */
  function leaveToLauncher() {
    if (history.length > 1) { history.back(); return true; }   // 処理済み
    return false;                                              // 履歴なし → ラッパーに任せる
  }
  function handleBack() {
    if (isOn('loading')) return leaveToLauncher();
    if (isOn('dlg')) { closeMsg(false); return true; }          // 閉じる＝キャンセル(続きの動作はしない)
    if (isOn('letterDlg')) { closeLetter(); return true; }
    if (isOn('padDlg')) { closePad(); return true; }
    if (isOn('quitDlg')) { removeClass($('quitDlg'), 'on'); restoreFocus(); return true; }
    if (isOn('cfmDlg')) { removeClass($('cfmDlg'), 'on'); setFocus($('resetBtn')); return true; }
    if (isOn('winDlg')) { removeClass($('winDlg'), 'on'); toTitle(); return true; }
    if (isOn('game')) { openQuit(); return true; }
    return leaveToLauncher();                                  // タイトル
  }

  /* ===================== キー入力(6キー＋押しっぱなし対策) ===================== */
  var KEY = { ArrowUp: 'up', Up: 'up', ArrowDown: 'down', Down: 'down', ArrowLeft: 'left', Left: 'left',
    ArrowRight: 'right', Right: 'right', Enter: 'ok', NumpadEnter: 'ok', ' ': 'ok', Spacebar: 'ok',
    Backspace: 'back', Escape: 'back', Esc: 'back', GoBack: 'back', BrowserBack: 'back' };
  var CODE = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', NumpadEnter: 'ok', Space: 'ok', Backspace: 'back', Escape: 'back' };
  var KEYCODE = { 38: 'up', 40: 'down', 37: 'left', 39: 'right', 13: 'ok', 23: 'ok', 32: 'ok', 8: 'back', 27: 'back', 461: 'back', 10009: 'back' };
  function actionOf(e) { return (e.key && KEY[e.key]) || (e.code && CODE[e.code]) || KEYCODE[e.keyCode] || null; }

  var lastAt = {}, held = {}, lastBackHandled = false;
  var dirHeld = null, dirLastSeen = 0, dirTimer = 0;
  function stopDir() { dirHeld = null; if (dirTimer) { clearTimeout(dirTimer); dirTimer = 0; } }
  function dirRepeat(a, delay) {
    dirTimer = setTimeout(function () {
      if (dirHeld !== a) return;
      if (Date.now() - dirLastSeen > 500) { stopDir(); return; }   // 合図が途切れたら止める(keyup取りこぼし対策)
      move(a); dirRepeat(a, 110);
    }, delay);
  }

  document.addEventListener('keydown', function (e) {
    var a = actionOf(e);
    if (!a) {
      // 数字キーはダイヤル画面だけの近道
      if (isOn('padDlg') && !isOn('dlg') && e.key && /^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
      return;
    }
    addClass(document.body, 'kbd'); ensureAudio();
    var now = Date.now();
    if (a === 'ok' || a === 'back') {
      var cont = held[a] && (now - (lastAt[a] || 0)) < 300;
      lastAt[a] = now;
      if (cont) { if (a !== 'back' || lastBackHandled) e.preventDefault(); return; }
      held[a] = true;
      if (a === 'ok') { e.preventDefault(); activate(); return; }
      var handled = handleBack();
      lastBackHandled = handled;
      if (handled) e.preventDefault();
      return;
    }
    // 方向キー: 端末のリピートには任せず、自前のタイマーで送る
    e.preventDefault();
    dirLastSeen = now;
    if (dirHeld === a) return;
    stopDir(); dirHeld = a; dirLastSeen = now;
    move(a); dirRepeat(a, 350);
  });
  document.addEventListener('keyup', function (e) {
    var a = actionOf(e);
    if (!a) return;
    if (a === 'ok') e.preventDefault();      // ボタン標準の「スペースで押す」を止める(決定は keydown で1回だけ)
    held[a] = false;
    if (a === dirHeld) stopDir();
  });
  window.addEventListener('blur', function () { stopDir(); held = {}; });

  // タッチ・マウス: 押した場所にフォーカスを合わせる（続けてキーを押しても正しい場所から動く）
  document.addEventListener('pointerdown', function (e) {
    removeClass(document.body, 'kbd'); ensureAudio();
    var n = e.target && e.target.closest ? e.target.closest('.nav') : null;
    if (n && visible(n)) setFocus(n);
  });
  document.addEventListener('mousedown', function (e) {   // pointer events の無い古い端末向け
    var n = e.target && e.target.closest ? e.target.closest('.nav') : null;
    if (n && visible(n) && n !== cur) setFocus(n);
  });

  /* ===================== 起動 ===================== */
  function preload(done) {
    var srcs = ROOMS.map(function (r) { return r.img; }).concat([
      'img/ui/house.svg', 'img/ui/title-' + LANG + '.svg', 'img/ui/chest.svg', 'img/ui/sparkle.svg', 'img/ui/bulb.svg', 'img/ui/clock.svg',
      'img/ui/sound-on.svg', 'img/ui/sound-off.svg', 'img/items/flashlight.svg', 'img/items/key.svg', 'img/items/stool.svg', 'img/items/cloth.svg', 'img/items/bulb.svg', 'img/rooms/living-shade.jpg', 'img/ui/owner-emblem-ja.svg', 'img/ui/owner-medal.svg'
    ]);
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
        document.fonts.load('700 20px "Zen Maru Gothic"', 'あA').then(function () { one(true); }, function () { one(true); });   // 書体が読めなくても予備の書体で続ける
      }
    } catch (e) {}
    // 素材が返ってこなくても止まらない
    setTimeout(function () { if (!finished) { finished = true; done(1); } }, 15000);
  }

  applyI18n();
  $('titleH').querySelector('.logo').src = 'img/ui/title-' + LANG + '.svg';   // 言語ごとのタイトル画像
  addClass($('titleH'), 'useLogo');
  buildRooms(); buildBar(); buildPad();
  setFocus($('startBtn'));
  preload(function (failed) {
    showScreen('title'); showRecords(); setFocus($('startBtn'));
    if (failed) say(t('load_error'));
  });
})();
