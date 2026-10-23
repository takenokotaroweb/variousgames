/* まちがいさがしゲーム — 文言辞書（en / ja）
 * 画面に出る文言はすべてここに置く。言語の追加は DICT に1組足すだけでよい。
 * {name} のような差し込み位置は、game.js が値を入れる（文をつなぎ合わせない）。
 * 英語は翻訳案。最終確認は GML が行う。
 */
var DICT = {
  en: {
    doc_title: 'Find the Differences',
    loading: 'Loading…',
    load_error: 'Some images could not be loaded. You can still play.',

    /* タイトル */
    title: 'Find the Differences',
    lead: 'Look at the two pictures for {s} seconds and find the 5 differences.',
    start: 'Start',
    exit: 'Exit',
    howto: 'Just watch the screen. When time is up, the answer appears with red circles.',

    /* 問題 */
    stage_no: 'Puzzle {n}',

    /* プレイ中 */
    secs_left: '{s}',
    secs_aria: '{s} seconds left',
    time_up: 'TIME UP!',
    check_title: "Let's check!",
    check_sub: 'Here are the answers…',
    answer_note: 'The answers are circled in red.',
    next: 'Next puzzle',
    last: 'Back to start',
    to_title: 'Title',
    quit: 'Quit',
    pause: 'Pause', resume: 'Resume', paused: 'Paused',
    sound_on: 'Sound: on', sound_off: 'Sound: off',

    ok: 'OK',

    /* やめる */
    quit_question: 'Stop and go back to the title?',
    quit_continue: 'Keep playing',
    quit_to_title: 'Title'
  },

  ja: {
    doc_title: 'まちがいさがしゲーム',
    loading: '読み込み中…',
    load_error: '一部の画像を読み込めませんでした。このまま遊べます。',

    title: 'まちがいさがしゲーム',
    lead: '{s}秒のあいだ左右の絵をよく見て、違うところを5つ探そう。',
    start: 'はじめる',
    exit: 'おわる',
    howto: '画面を見ているだけで遊べます。時間になると、赤い丸で答えが出ます。',

    stage_no: '第{n}問',

    secs_left: '{s}',
    secs_aria: '残り{s}秒',
    time_up: 'TIME UP!',
    check_title: '答え合わせ',
    check_sub: '正解は…',
    answer_note: '正解は赤い丸で囲んである部分です。',
    next: '次の問題へ',
    last: '第1問へ',
    to_title: 'タイトルへ',
    quit: 'やめる',
    pause: '一時停止', resume: '再開', paused: '一時停止中',
    sound_on: '音: オン', sound_off: '音: オフ',

    ok: 'OK',

    quit_question: 'やめてタイトルにもどりますか？',
    quit_continue: '続ける',
    quit_to_title: 'タイトルへ'
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
