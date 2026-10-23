# AGENTS.md — このリポジトリで作業するAIへの指示

- GML「テレビ向けWebゲーム 開発指示書」(第1.2版以降)を必ず守ること。規則番号は指示書のもの。
- 配信されるのは `web/` の中身だけ。`web/` に説明書き・メモ・控え(.md / .bak など)・`.htaccess` を置かない [GIT-3]。
- スクリプトは外部ファイルのみ。インライン `<script>`・`onclick="…"`・`eval`・外部CDN・外部通信は禁止 [SEC-1〜4]。
- 構文は ES2019 相当まで。`?.` と `??` は使わない。CSS の `inset` プロパティ / `aspect-ratio` / `dvh` / `:focus-visible` / flex の `gap` も使わない [SEC-8]。
- 寸法は `--u`(ステージ幅の1%)で指定する。`px` は 1px の罫線だけ [LAY-2, 3]。操作部品と文字は外周5%の内側に置く [LAY-7]。
- 文言は `web/js/i18n.js` の辞書に置き、`t('キー', {値})` で引く。文をつなぎ合わせない [I18N-2, 3]。文言を変えたら `tools/make_fonts.py` で書体を作り直す。
- 戻るキーは「処理したときだけ」`preventDefault()`。タイトルでは `history.back()`(履歴が無ければ未処理で返す)[BACK-1〜3]。
- キーイベントで `stopPropagation()` を使わない [PWR-3]。`localStorage.clear()` や `gml.` で始まるキーに触らない [PWR-1]。
- CSS・JS を変えたら、`index.html` の `?v=` を上げる [DLV-4]。
- 変更後は README の「確認の手順」を実際に操作して確かめ、結果を `docs/` に残す。

## このゲーム固有の注意

- 遊ぶ場所は1枚の `<canvas id="field">`(内部 1280x720。指示書の上限 1920x1080 以内 [LAY-6])。文字(得点・札・ボタン)は canvas ではなく DOM に置く。canvas に描く文字は円盤のボーナス点(数字だけ、`fmtNum`)のみ。
- 進行は経過時間(`Date.now()`)で計算する [PERF-4]。`requestAnimationFrame` が止まっても 0.25秒ごとの見張り(`setInterval`)で進む [PERF-5]。画面が隠れたら一時停止のメニューを出し、音も止める [PERF-6]。
- `G.mode` は 'title' / 'ready'(第◯波の札)/ 'play' / 'hit'(当たった直後)/ 'clear' / 'over'。一時停止は `G.paused`(メニューを出している間)。
- 押しっぱなしで動き続ける操作(左右の移動・決定/上キーの連射・タッチの撃つボタン)は、`holdState()` で決める。keyup が届く端末(`sawKeyup`)は keyup で止め、合図が 0.9秒途切れたら止める(`HOLD_WATCH_MS`)。keyup が届かない端末は、1回押すと `TAP_MOVE_MS` だけ動き、押しっぱなしの合図が続く間だけ動く(`REPEAT_GAP_MS` 途切れたら止める)。どちらも20秒で必ず止める(`HOLD_LIMIT_MS`)[IN-6]。決定・戻るの300ms以内の連続は押しっぱなしとみなす [IN-5]。
- 船を左右に動かすのは、左右キーとタッチ用の ◀ ▶ ボタンだけ。画面のタップ・クリックは撃つだけで、船を動かさない(ver07 で決めた。タップした所へ動く作りに戻さないこと)。
- 遊んでいる間は、方向キーと決定は船の操作に使う(フォーカスは移らない)。下キーは BGM のオン・オフ(`toggleMusic()`。押しっぱなしは1回とみなす)。光線は `tryFire(manual)`: 自分で押した分は `manual=true`(「自動で撃つ」オンのときは4本まで出せる)、自動は `false`(2本まで)。上の「音」「一時停止」ボタンはタッチ用で、リモコンでは「戻る」→ 一時停止のメニューで同じことができる。
- 画面全体を明滅させない。点滅は当たった船の小さな絵だけ(約3回/秒) [CNT-9]。
- 題材は「宇宙人を光線で星に変える」(倒す・爆発の表現にしない)[CNT-2]。宇宙人の絵は本ゲーム用に描いたもの。既存のゲームの絵・名前・音に似せない [CNT-8, TXT-5]。
- BGM(`web/audio/bgm.mp3`)は遊んでいる間だけ鳴らす。鳴らす・止めるは `bgmSync()` / `bgmStop()` / `bgmFadeOut()` に集め、一時停止・非表示・タイトル・音楽オフでは必ず止まること。鳴らし始め(`bgm.play()`)は利用者の操作の中で呼ぶ。曲を替えたら `audio/bgm.mp3?v=` を上げる。
- ゲームオーバーのジングル(`web/audio/gameover.mp3`)は `playGameOverJingle()` で鳴らし、`jingleStop()` で止める。効果音か BGM のどちらかがオンなら鳴らす。「はじめる」などの操作の中で `jinglePrime()` を呼んで、操作の後でないと音を出せない端末でも鳴るようにしている。曲を替えたら `audio/gameover.mp3?v=` を上げる。
- 保存キーは `vendor.spacepatrol.settings.v1`(速さ・自動で撃つ・効果音・音楽)と `vendor.spacepatrol.best.v1`(速さごとの最高得点)。頭の `vendor.spacepatrol` は GML と決めた識別名・ゲームIDに差し替える(`game.js` 冒頭の `SAVE_PREFIX`)。
