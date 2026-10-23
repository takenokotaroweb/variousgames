/* まちがいさがしゲーム — ゲーム本体(ver13: 見て探す型)
 * 流れ: 「第1問」の表示 → 決めた秒数だけ絵を見る(残り時間のバーが減る。BGM、最後の5秒はチクタク)
 *       → TIME UP! → 答え合わせのページ → 答えの絵と問題の絵を交互に表示
 * 見ている間はリモコン操作は要らない。「一時停止」で時間と BGM を止めて、絵をゆっくり見られる。
 * 構文は ES2019 相当まで（?. ?? は使わない）。文言は i18n.js の t() から引く。
 * 戻るキーは「実際に処理したときだけ」preventDefault する（TV_WEBGAME_DEV_GUIDE 3章）。
 */
(function () {
  'use strict';

  /* ===================== 設定 ===================== */
  var LOOK_MS = 45000;        // 絵を見る時間(45秒)
  var BANNER_MS = 1800;       // 最初に「第1問 ピクニック」を出す時間
  var TIMEUP_MS = 2400;       // 「TIME UP!」を出してから答え合わせのページまで
  var CHECK_MS = 2600;        // 答え合わせのページを出しておく時間
  var WARN_MS = 10000;        // 残りこの時間でバーの色を変える
  var TICK_SOUND_MS = 5000;   // 残りこの時間から BGM を止めて「チクタク」
  var BGM_VOL = 0.5;          // BGM の音量(0〜1)。効果音より控えめ
  // BGM は「第1問」の表示が消えて絵が見えたとき(見る時間の始まり)に、曲の頭から鳴らす
  var BGM_FADEIN_MS = 150;    // 鳴らし始めのプチッという音を防ぐための、ごく短い立ち上がり

  // 問題(出題順: 積み木 → ピクニック → 公園 → 釣り → 花かんむり)。画像は img/stages/<id>-q.jpg(問題)と <id>-a.jpg(答えの〇付き)
  var STAGES = ['blocks', 'picnic', 'park', 'fishing', 'crown'];

  /* ===================== 小道具 ===================== */
  function $(id) { return document.getElementById(id); }
  function hasClass(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addClass(e, c) { if (!hasClass(e, c)) e.className = (e.className + ' ' + c).replace(/^\s+/, ''); }
  function removeClass(e, c) { e.className = (' ' + e.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function toggleClass(e, c, on) { if (on) addClass(e, c); else removeClass(e, c); }
  function isOn(id) { return hasClass($(id), 'on'); }
  function show(id, on) { toggleClass($(id), 'hide', !on); }

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
    else if (k === 'start') { tone(523, 0.12, 'triangle'); tone(784, 0.18, 'triangle', 0.12); }
    else if (k === 'tick') { tone(1500, 0.035, 'square', 0, 0.05); tone(3000, 0.02, 'sine', 0, 0.03); }   // チク
    else if (k === 'tock') { tone(1000, 0.045, 'square', 0, 0.05); tone(2000, 0.02, 'sine', 0, 0.025); }  // タク
    else if (k === 'roll') { for (i = 0; i < 16; i++) tone(180 + i * 6, 0.05, 'triangle', i * 0.07, 0.04 + i * 0.003); }
    else if (k === 'timeup') { tone(392, 0.3, 'square', 0, 0.06); tone(330, 0.45, 'square', 0.28, 0.06); }
    else if (k === 'answer') { var a = [784, 1047, 1319, 1568]; for (i = 0; i < a.length; i++) tone(a[i], 0.16, 'triangle', i * 0.09); }
  }

  /* ===================== BGM(見ている間だけ。最後の5秒・確認中・非表示・音オフでは止める) ===================== */
  // BGM は2曲。第1・3・5問は A、第2・4問は B(問題の番号で交互に替える)
  // 曲を替えたら ?v= も上げる(端末に古い曲が残らないように)
  var BGM_FILES = ['audio/bgm_a.mp3?v=13', 'audio/bgm_b.mp3?v=13'];
  var bgmList = [], bgm = null, bgmFade = 0, bgmFadeIn = 0, bgmPrimed = false, bgmFromTop = false;
  for (var bi = 0; bi < BGM_FILES.length; bi++) {
    try { var au = new Audio(); au.src = BGM_FILES[bi]; au.loop = true; au.preload = 'auto'; au.volume = BGM_VOL; bgmList.push(au); } catch (e) {}
  }
  bgm = bgmList[0] || null;
  // 問題の番号(0から)に合わせて、使う曲を選ぶ
  function bgmPick(stage) { if (bgmList.length) bgm = bgmList[stage % bgmList.length]; }
  // 鳴らすのは「見る」の間だけ(残り5秒より前)。問題番号の表示中は鳴らさない
  function bgmWanted() {
    if (!S || S.paused || !soundOn || document.hidden || !isOn('game') || isOn('quitDlg')) return false;
    return S.phase === 'look' && LOOK_MS - phaseMs() > TICK_SOUND_MS;
  }
  function clearFades() {
    if (bgmFade) { clearInterval(bgmFade); bgmFade = 0; }
    if (bgmFadeIn) { clearInterval(bgmFadeIn); bgmFadeIn = 0; }
  }
  function bgmStop() {
    clearFades();
    bgmPrimed = false;
    for (var k = 0; k < bgmList.length; k++) { try { bgmList[k].pause(); bgmList[k].muted = false; bgmList[k].volume = BGM_VOL; } catch (e) {} }
  }
  // 0.5秒で小さくして止める。音量を変えられない端末でも、決まった回数で必ず止める
  function bgmFadeOut() {
    if (!bgm || bgm.paused || bgmFade) return;
    if (bgmFadeIn) { clearInterval(bgmFadeIn); bgmFadeIn = 0; }
    var step = 0;
    bgmFade = setInterval(function () {
      step++;
      try { bgm.volume = Math.max(0, BGM_VOL * (1 - step / 5)); } catch (e) {}
      if (step >= 5) bgmStop();
    }, 100);
  }
  // 今の状態に合わせて鳴らす・止める
  function bgmSync() {
    if (!bgm) return;
    if (bgmWanted()) {
      if ((bgm.paused || bgmPrimed) && !bgmFade) {
        var fromTop = bgmFromTop; bgmPrimed = false; bgmFromTop = false;   // 問題の始めは曲の頭から、途中で止めたあとは続きから
        try {
          if (fromTop) bgm.currentTime = 0;
          bgm.volume = 0; bgm.muted = false;
          if (bgm.paused) { var p = bgm.play(); if (p && p.catch) p.catch(function () {}); }
        } catch (e) {}
        // ごく短く立ち上げる(決まった回数で必ず通常の音量になる)
        clearInterval(bgmFadeIn); var step = 0, steps = Math.max(1, Math.round(BGM_FADEIN_MS / 50));
        bgmFadeIn = setInterval(function () {
          step++;
          try { bgm.volume = BGM_VOL * Math.min(1, step / steps); } catch (e) {}
          if (step >= steps) { clearInterval(bgmFadeIn); bgmFadeIn = 0; }
        }, 50);
      }
    } else if (!bgm.paused && !bgmFade && !bgmPrimed) bgmStop();
  }
  // 問題の始め(ボタンを押した直後)に、消音(ミュート)のまま再生を始めておく。
  // ボタン操作の直後でないと再生できない端末でも、あとで消音を外すだけで鳴らせるように。
  // 消音は音量の変更より多くの端末で確実に効く
  function bgmRestart() {
    if (!bgm) return;
    bgmStop();
    bgmFromTop = true;                     // この問題で最初に鳴らすときは、必ず曲の頭から
    if (!soundOn) return;
    try { bgm.muted = true; bgm.currentTime = 0; var p = bgm.play(); if (p && p.catch) p.catch(function () {}); bgmPrimed = true; } catch (e) {}
  }


  /* ===================== 状態と時計(非表示・確認中は止める) ===================== */
  // phase: 'banner'(問題名)→ 'look'(見る)→ 'timeup' → 'check'(答え合わせ)→ 'answer'
  var S = null, tickId = 0;
  function phaseMs() { return S.ms + (S.running ? Date.now() - S.since : 0); }
  function setPhase(p) { S.phase = p; S.ms = 0; S.since = Date.now(); S.lastSec = -1; S.lastHalf = -1; }
  function pauseClock() { if (S && S.running) { S.ms += Date.now() - S.since; S.running = false; } }
  function resumeClock() {
    if (S && !S.running && !S.paused && isOn('game') && !document.hidden && !isOn('quitDlg')) { S.running = true; S.since = Date.now(); }
  }
  function startTick() { stopTick(); tickId = setInterval(tick, 100); }
  function stopTick() { if (tickId) { clearInterval(tickId); tickId = 0; } }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { pauseClock(); audioSuspend(); bgmStop(); } else { resumeClock(); audioResume(); bgmSync(); }
  });

  // 0.1秒ごとに経過時間を見て進める(フレーム数には頼らない)
  function tick() {
    if (!S || !S.running) return;
    var ms = phaseMs();
    if (S.phase === 'banner') { if (ms >= BANNER_MS) startLook(); return; }
    if (S.phase === 'look') {
      var left = Math.max(0, LOOK_MS - ms);
      drawTimer(left);
      if (left <= 0) timeUp();
      return;
    }
    if (S.phase === 'timeup') { if (ms >= TIMEUP_MS) showCheck(); return; }
    if (S.phase === 'check') { if (ms >= CHECK_MS) showAnswer(); }
  }

  /* ===================== 残り時間の表示 ===================== */
  function drawTimer(left) {
    var r = left / LOOK_MS;
    var f = $('fill');
    f.style.webkitTransform = 'scaleX(' + r + ')'; f.style.transform = 'scaleX(' + r + ')';
    var sec = Math.ceil(left / 1000);
    if (sec !== S.lastSec) {
      S.lastSec = sec;
      $('secs').textContent = t('secs_left', { s: sec });
      $('timer').setAttribute('aria-label', t('secs_aria', { s: sec }));
      toggleClass($('timer'), 'warn', left <= WARN_MS);
    }
    // 最後の5秒: BGM を止めて、0.5秒ごとに「チク」「タク」
    if (left > 0 && left <= TICK_SOUND_MS) {
      bgmFadeOut();
      var half = Math.ceil(left / 500);
      if (half !== S.lastHalf) { S.lastHalf = half; sfx(half % 2 ? 'tock' : 'tick'); }
    }
  }

  /* ===================== 問題の流れ ===================== */
  function startStage(i) {
    ensureAudio();
    S = { stage: i, phase: '', ms: 0, since: 0, running: false, paused: false, lastSec: -1 };
    var id = STAGES[i];
    $('imgQ').src = 'img/stages/' + id + '-q.jpg';
    $('imgA').src = 'img/stages/' + id + '-a.jpg';
    $('stageName').textContent = t('stage_no', { n: i + 1 });
    $('bannerNo').textContent = t('stage_no', { n: i + 1 });
    removeClass($('pic'), 'blink'); removeClass($('timeup'), 'on'); removeClass($('shade'), 'on'); removeClass($('checkPage'), 'on');
    // 問題名の間は、絵を少し暗くして名前を出す
    addClass($('banner'), 'on'); addClass($('shade'), 'on');
    drawTimerFull();
    setButtons('look'); drawPause();
    showScreen('game');
    setFocus($('pauseBtn'));
    setPhase('banner'); S.running = false; resumeClock(); startTick();
    sfx('start'); bgmPick(i); bgmRestart();
  }
  function drawTimerFull() {
    var f = $('fill'); f.style.webkitTransform = 'scaleX(1)'; f.style.transform = 'scaleX(1)';
    $('secs').textContent = t('secs_left', { s: Math.ceil(LOOK_MS / 1000) });
    removeClass($('timer'), 'warn');
  }
  function startLook() {
    removeClass($('banner'), 'on'); removeClass($('shade'), 'on');
    var running = S.running; setPhase('look'); S.running = running;
    bgmSync();                             // 絵が見えたところで、曲の頭から鳴らす
  }
  function timeUp() {
    drawTimer(0);
    show('pauseBtn', false);                                   // 時間が来たら一時停止は出さない
    if (cur === $('pauseBtn')) setFocus($('quitBtn'));
    var running = S.running; setPhase('timeup'); S.running = running;
    addClass($('shade'), 'on');
    var tu = $('timeup'); removeClass(tu, 'on'); void tu.offsetWidth; addClass(tu, 'on');
    sfx('timeup');
  }
  function showCheck() {
    var running = S.running; setPhase('check'); S.running = running;
    removeClass($('timeup'), 'on');
    var cp = $('checkPage'); removeClass(cp, 'on'); void cp.offsetWidth; addClass(cp, 'on');
    sfx('roll');
  }
  function showAnswer() {
    var running = S.running; setPhase('answer'); S.running = running;
    removeClass($('timeup'), 'on'); removeClass($('shade'), 'on'); removeClass($('checkPage'), 'on');
    addClass($('pic'), 'blink');           // 答えの絵と問題の絵を交互に出す(赤い〇が点いたり消えたりして見える)
    setButtons('answer');
    setFocus($('nextBtn'));
    sfx('answer');
  }
  // 見ている間: 音・やめる / 答え: 音・次の問題へ・タイトルへ
  function setButtons(mode) {
    var ans = mode === 'answer';
    show('timer', !ans); show('ansNote', ans);
    show('pauseBtn', !ans); show('quitBtn', !ans); show('nextBtn', ans); show('toTitleBtn', ans);
    var last = S.stage >= STAGES.length - 1;
    $('nextBtn').textContent = t(last ? 'last' : 'next');
  }
  /* ===================== 一時停止(時間と BGM を止める。絵はそのまま見られる) ===================== */
  function drawPause() {
    var p = !!(S && S.paused);
    $('pauseBtn').textContent = t(p ? 'resume' : 'pause');
    toggleClass($('pausedTag'), 'on', p);
    toggleClass($('timer'), 'paused', p);
  }
  function togglePause() {
    if (!S || (S.phase !== 'banner' && S.phase !== 'look')) return;
    sfx('tap');
    if (!S.paused) { pauseClock(); S.paused = true; bgmStop(); }
    else { S.paused = false; resumeClock(); bgmSync(); }
    drawPause();
  }
  $('pauseBtn').addEventListener('click', togglePause);

  $('nextBtn').addEventListener('click', function () {
    sfx('tap');
    startStage(S.stage >= STAGES.length - 1 ? 0 : S.stage + 1);
  });
  $('toTitleBtn').addEventListener('click', function () { toTitle(); });

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
    if (isOn('dlg')) return $('dlg');
    if (isOn('quitDlg')) return $('quitDlg');
    return null;
  }
  function list(sel, root) { var a = (root || document).querySelectorAll(sel), out = []; for (var i = 0; i < a.length; i++) if (visible(a[i])) out.push(a[i]); return out; }
  function zoneItems() {
    var ov = topOverlay();
    if (ov) return list('.nav', ov);
    if (isOn('title')) return list('#title .nav');
    if (isOn('game')) return list('#bar .nav');
    return [];
  }
  function defaultFocus() {
    var ov = topOverlay();
    if (ov) return ov.id === 'quitDlg' ? $('quitNo') : $('dlgOk');
    if (isOn('title')) return $('startBtn');
    if (isOn('game')) {
      if (S && S.phase === 'answer') return $('nextBtn');
      return S && (S.phase === 'banner' || S.phase === 'look') ? $('pauseBtn') : $('quitBtn');
    }
    return null;
  }
  function ensureFocus() { var items = zoneItems(); if (!cur || items.indexOf(cur) < 0) setFocus(defaultFocus()); }
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
  function move(dir) {
    var items = zoneItems();
    if (!cur || items.indexOf(cur) < 0) { ensureFocus(); return; }
    var next = nearest(cur, items, dir);
    if (next) setFocus(next);
  }
  function activate() {
    if (!cur || !visible(cur)) { ensureFocus(); return; }
    cur.click();
  }

  /* ===================== メッセージ ===================== */
  var returnFocus = null;
  function say(text) {
    returnFocus = cur;
    $('dlgText').textContent = text;
    addClass($('dlg'), 'on'); setFocus($('dlgOk'));
  }
  function closeMsg() { removeClass($('dlg'), 'on'); restoreFocus(); }
  function restoreFocus() {
    if (returnFocus && visible(returnFocus) && zoneItems().indexOf(returnFocus) >= 0) setFocus(returnFocus);
    else { cur = null; ensureFocus(); }
  }
  $('dlgOk').addEventListener('click', closeMsg);

  /* ===================== やめる確認(出している間は時間を止める) ===================== */
  function openQuit() { returnFocus = cur; pauseClock(); addClass($('quitDlg'), 'on'); setFocus($('quitNo')); bgmStop(); }
  function closeQuit() { removeClass($('quitDlg'), 'on'); restoreFocus(); resumeClock(); bgmSync(); }
  $('quitBtn').addEventListener('click', openQuit);
  $('quitNo').addEventListener('click', closeQuit);
  $('quitYes').addEventListener('click', function () { removeClass($('quitDlg'), 'on'); toTitle(); });

  /* ===================== 画面の切り替え ===================== */
  function showScreen(id) {
    var ids = ['loading', 'title', 'game'];
    for (var i = 0; i < ids.length; i++) toggleClass($(ids[i]), 'on', ids[i] === id);
  }
  function toTitle() {
    pauseClock(); stopTick();
    if (S) S.running = false;
    bgmStop();
    removeClass($('pic'), 'blink'); removeClass($('checkPage'), 'on');
    showScreen('title'); setFocus($('startBtn'));
  }
  $('startBtn').addEventListener('click', function () { startStage(0); });
  $('exitBtn').addEventListener('click', function () { leaveToLauncher(); });
  $('soundBtn').addEventListener('click', function () {
    soundOn = !soundOn;
    $('soundImg').src = soundOn ? 'img/ui/sound-on.svg' : 'img/ui/sound-off.svg';
    $('soundBtn').setAttribute('aria-label', t(soundOn ? 'sound_on' : 'sound_off'));
    if (soundOn) bgmSync(); else bgmStop();
  });

  /* ===================== 戻る ===================== */
  function leaveToLauncher() {
    if (history.length > 1) { history.back(); return true; }   // 処理済み
    return false;                                              // 履歴なし → ラッパーに任せる
  }
  function handleBack() {
    if (isOn('loading')) return leaveToLauncher();
    if (isOn('dlg')) { closeMsg(); return true; }
    if (isOn('quitDlg')) { closeQuit(); return true; }
    if (isOn('game')) {
      if (S && S.phase === 'answer') { toTitle(); return true; }   // 答えを見ているときは、そのままタイトルへ
      openQuit(); return true;                                     // 見ている途中は確認を出す
    }
    return leaveToLauncher();                                      // タイトル
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
    if (!a) return;
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
    var srcs = ['img/ui/title-' + LANG + '.svg', 'img/ui/sound-on.svg', 'img/ui/sound-off.svg', 'img/stages/title-a.jpg', 'img/stages/title-b.jpg'];
    for (var i = 0; i < STAGES.length; i++) srcs.push('img/stages/' + STAGES[i] + '-q.jpg', 'img/stages/' + STAGES[i] + '-a.jpg');
    var left = srcs.length, total = srcs.length, failed = 0, finished = false;
    function one(ok) {
      if (!ok) failed++;
      left--;
      $('loadFill').style.width = Math.round((total - left) / total * 100) + '%';
      if (left <= 0 && !finished) { finished = true; done(failed); }
    }
    for (i = 0; i < srcs.length; i++) {
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

  applyI18n();
  $('lead').textContent = t('lead', { s: Math.round(LOOK_MS / 1000) });
  $('howto').textContent = t('howto');
  $('titleH').querySelector('.logo').src = 'img/ui/title-' + LANG + '.svg';   // 言語ごとのタイトル画像
  addClass($('titleH'), 'useLogo');
  setFocus($('startBtn'));
  preload(function (failed) {
    showScreen('title'); setFocus($('startBtn'));
    if (failed) say(t('load_error'));
  });
})();
