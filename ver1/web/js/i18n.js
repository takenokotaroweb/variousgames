/* 宇宙パトロール — 文言辞書（en / ja）
 * 画面に出る文言はすべてここに置く。言語の追加は DICT に1組足すだけでよい。
 * {n} のような差し込み位置は、game.js が値を入れる（文をつなぎ合わせない）。
 * 英語は翻訳案。最終確認は GML が行う。
 * 文言を変えたら tools/make_fonts.py で書体を作り直すこと。
 */
var DICT = {
  en: {
    doc_title: 'Space Patrol',
    loading: 'Loading…',
    load_error: 'Some images could not be loaded. You can still play.',

    /* タイトル */
    title: 'Space Patrol',
    lead: 'Turn the space visitors into stars before they reach the ground!',
    pts: '{n} pts',
    pts_mystery: '? pts',
    start: 'Start',
    exit: 'Exit',
    set_level: 'Speed',
    lv_slow: 'Slow', lv_normal: 'Normal', lv_fast: 'Fast',
    set_auto: 'Auto shoot',
    set_music: 'Music',
    set_sound: 'Sound effects',
    on: 'On', off: 'Off',
    howto_key: 'Left / Right: move  ·  OK or Up: shoot  ·  Down: music on/off  ·  Back: pause',
    howto_auto: 'Left / Right: move (auto shoot, OK for extra)  ·  Down: music on/off  ·  Back: pause',
    best_line: 'High score ({lv}): {n}',

    /* プレイ中 */
    field_aria: 'Game screen',
    score: 'Score',
    best: 'High',
    wave_no: 'Wave {n}',
    lives: 'Ships',
    pause: 'Pause',
    fire: 'Shoot',
    move_left: 'Move left',
    move_right: 'Move right',
    sound_on: 'Sound: on', sound_off: 'Sound: off',
    wave_clear: 'Wave {n} cleared!',
    music_on: 'Music: on', music_off: 'Music: off',

    /* 一時停止 */
    paused: 'Paused',
    resume: 'Keep playing',
    restart: 'Start over',
    to_title: 'Title',

    /* ゲームオーバー */
    game_over: 'Game over',
    why_ships: 'No ships left.',
    why_landed: 'The visitors reached the ground.',
    final_score: 'Score: {n}',
    new_best: 'New high score!',
    again: 'Play again',

    ok: 'OK'
  },

  ja: {
    doc_title: '宇宙パトロール',
    loading: '読み込み中…',
    load_error: '一部の画像を読み込めませんでした。このまま遊べます。',

    title: '宇宙パトロール',
    lead: '宇宙人が地上に着く前に、光線で星に変えよう！',
    pts: '{n}点',
    pts_mystery: '？点',
    start: 'はじめる',
    exit: 'おわる',
    set_level: '速さ',
    lv_slow: 'ゆっくり', lv_normal: 'ふつう', lv_fast: 'はやい',
    set_auto: '自動で撃つ',
    set_music: 'BGM',
    set_sound: '効果音',
    on: 'オン', off: 'オフ',
    howto_key: '左右キー: 移動　　決定か上キー: 撃つ　　下キー: BGMオン・オフ　　戻る: 一時停止',
    howto_auto: '左右キー: 移動(光線は自動で出ます。決定で追加)　　下キー: BGMオン・オフ　　戻る: 一時停止',
    best_line: '最高得点({lv}): {n}',

    field_aria: 'ゲームの画面',
    score: '得点',
    best: '最高',
    wave_no: '第{n}波',
    lives: '残り',
    pause: '一時停止',
    fire: '撃つ',
    move_left: '左へ動く',
    move_right: '右へ動く',
    sound_on: '音: オン', sound_off: '音: オフ',
    wave_clear: '第{n}波 クリア！',
    music_on: 'BGM: オン', music_off: 'BGM: オフ',

    paused: '一時停止中',
    resume: '続ける',
    restart: '最初から',
    to_title: 'タイトルへ',

    game_over: 'ゲームオーバー',
    why_ships: '自分の船がなくなりました。',
    why_landed: '宇宙人が地上に着いてしまいました。',
    final_score: '得点: {n}',
    new_best: '最高得点を更新しました！',
    again: 'もう一度',

    ok: 'OK'
  }
};

/* 表示言語: ?lang=xx（対応言語のみ）→ 端末の言語 → 英語 */
var LANG = (function () {
  var supported = ['en', 'ja'];
  var m = /[?&]lang=([a-zA-Z]{2})(?:[-_][a-zA-Z]+)?(?:&|$)/.exec(location.search || '');
  if (m) { var q = m[1].toLowerCase(); return supported.indexOf(q) >= 0 ? q : 'en'; }
  var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || 'en').slice(0, 2).toLowerCase();
  return supported.indexOf(nav) >= 0 ? nav : 'en';
})();

/* 翻訳が欠けているときは英語を使う */
function t(key, vars) {
  var s = (DICT[LANG] && DICT[LANG][key] != null) ? DICT[LANG][key] : DICT.en[key];
  if (s == null) s = '';
  return s.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ''; });
}

/* 数の表示(1,000 のような区切り) */
function fmtNum(n) {
  try { return Number(n).toLocaleString(LANG === 'ja' ? 'ja-JP' : 'en-US'); } catch (e) { return String(n); }
}

/* HTMLの静的文言: data-i18n（文字）、data-i18n-aria（aria-label）、data-i18n-alt（alt） */
function applyI18n(root) {
  root = root || document;
  document.documentElement.lang = LANG;
  document.title = t('doc_title');
  var list = root.querySelectorAll('[data-i18n]');
  for (var i = 0; i < list.length; i++) list[i].textContent = t(list[i].getAttribute('data-i18n'));
  list = root.querySelectorAll('[data-i18n-aria]');
  for (i = 0; i < list.length; i++) list[i].setAttribute('aria-label', t(list[i].getAttribute('data-i18n-aria')));
  list = root.querySelectorAll('[data-i18n-alt]');
  for (i = 0; i < list.length; i++) list[i].setAttribute('alt', t(list[i].getAttribute('data-i18n-alt')));
}
