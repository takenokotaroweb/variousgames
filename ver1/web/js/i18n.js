/* おうちの宝さがし — 文言辞書（en / ja）
 * 画面に出る文言はすべてここに置く。言語の追加は DICT に1組足すだけでよい。
 * {name} のような差し込み位置は、game.js が値を入れる（文をつなぎ合わせない）。
 * 英語は翻訳案。最終確認は GML が行う。
 */
var DICT = {
  en: {
    doc_title: 'Treasure Hunt at Home',
    loading: 'Loading…',
    load_error: 'Some images could not be loaded. You can still play.',

    /* タイトル */
    title: 'Treasure Hunt at Home',
    lead: 'Explore the house and find the treasure.',
    start: 'Start',
    exit: 'Exit',
    howto: 'Use the arrow buttons to choose and OK to check. Press left or right at the edge of a room to go to the next room.',
    best_time: 'Best time {t}',
    collection_count: 'Collection {n}/{total}',
    reset_records: 'Reset records',

    /* 部屋 */
    room_bedroom: 'Bedroom', room_bathroom: 'Bathroom', room_kitchen: 'Kitchen', room_living: 'Living room',
    room_short_bedroom: 'Bedroom', room_short_bathroom: 'Bathroom', room_short_kitchen: 'Kitchen', room_short_living: 'Living',
    prev_room: 'Previous room', next_room: 'Next room',

    /* 色 */
    color_red: 'Red', color_blue: 'Blue', color_green: 'Green', color_yellow: 'Yellow',
    badge: '{color} {n}',
    badge_unknown: '{color} ?',

    /* 道具 */
    item_flashlight: 'flashlight', item_key: 'small key', item_stool: 'step stool', item_cloth: 'cloth', item_bulb: 'light bulb',
    item_title_flashlight: 'Flashlight', item_title_key: 'Small key', item_title_stool: 'Step stool', item_title_cloth: 'Cloth', item_title_bulb: 'Light bulb',

    /* 下のバー */
    bar_items: 'Items', bar_numbers: 'Numbers', bar_order: 'Order', bar_time: 'Time', bar_stars: 'Stars',
    hint: 'Hint', quit: 'Quit', sound_on: 'Sound: on', sound_off: 'Sound: off',
    stars_count: '{n}/8',

    /* 調べる場所のラベル */
    hs_mirror: 'Mirror', hs_tap: 'Faucet', hs_brush: 'Toothbrush', hs_tub: 'Bathtub', hs_cab: 'Cabinet', hs_basket: 'Laundry basket',
    hs_fridge: 'Fridge', hs_chest: 'Pantry', hs_shelf: 'Top shelf', hs_drawer: 'Drawer', hs_stove: 'Stove',
    hs_closet: 'Closet', hs_pillow: 'Pillow', hs_table: 'Nightstand', hs_under: 'Under the bed', hs_tlamp: 'Table lamp',
    hs_books: 'Bookshelf', hs_frame: 'Picture frame', hs_lamp: 'Floor lamp', hs_window: 'Window seat',
    hs_star: 'Something sparkly',

    /* メッセージ */
    ok: 'OK',
    intro: 'There seems to be a treasure chest somewhere in the house. Collect clues and find it!',
    star_found: 'You found a hidden star! ({n}/8)',
    star_again: 'You already found the star here.',

    msg_mirror_plain: 'A big mirror. Look closely… are those faint finger marks?',
    msg_mirror_reveal: 'Words appeared on the steamy mirror!<br>{badge}',
    msg_mirror_again: 'The mirror says {badge}.',
    msg_tap_on: 'You turned on the hot water. Steam fills the room… the mirror is fogging up!',
    msg_tap_again: 'The hot water is already running.',
    msg_brush: 'Toothbrushes and soap. Every morning starts here.',
    msg_tub: 'My favorite clawfoot bathtub. Maybe a long, relaxing bath with bath salts today.',
    msg_cab_get: 'There was a {item} in the cabinet. It could be used to wipe something.',
    msg_cab_again: 'Detergent and towels are neatly lined up.',
    msg_basket_get: 'A {item} was hidden among the towels!',
    msg_basket_again: 'It is full of fluffy towels.',

    msg_fridge: 'A note is held by a magnet: "Hot water reveals something."',
    msg_shelf_high: 'The shelf is too high to reach… If only there were something to stand on.',
    msg_shelf_get: 'You stood on the {item} and reached it!<br>There is a sticker on the bottom of the jug. {badge}',
    msg_shelf_again: 'The sticker on the jug says {badge}.',
    msg_drawer_locked: 'It is locked. There is a small keyhole.',
    msg_drawer_open: 'The small key opened it!<br>There was a {item} inside.',
    msg_drawer_again: 'Spoons and forks are lined up.',
    msg_stove: 'The kettle is whistling. Better turn off the heat.',
    msg_chest_none: 'Behind the basket, you found a locked treasure chest!<br>It has a 4-digit dial.<br>Maybe there are clues somewhere?',
    msg_chest_ready: 'Behind the basket, you found a locked treasure chest!<br>It has a 4-digit dial.<br>The clues you found might help!',

    msg_pillow: 'There was a note under the pillow!<br>"The treasure chest opens with a 4-digit code. One colored number is hidden in each of the four rooms. The order is written somewhere in this room."',
    msg_closet_get: 'Inside the closet you found a {item}. It could help you reach high places.',
    msg_closet_again: 'Clothes are hanging neatly.',
    msg_table: 'There is a note in the drawer with the color order!<br>{order}',
    msg_under_dark: 'It is pitch dark under the bed. You cannot see anything…',
    msg_under_reveal: 'You lit it up with the {item}!<br>A number is written under the bed. {badge}',
    msg_under_again: 'Under the bed it says {badge}.',

    msg_frame_dirty: 'A frame on the wall. The glass is too dirty to see…<br>Is there something to wipe it with?',
    msg_frame_reveal: 'You wiped the glass with the {item}!<br>Now you can read the code that was under the dirt. {badge}',
    msg_frame_again: 'The clean glass says {badge}.',
    msg_books: 'You picked up a book called "Master of Hide-and-Seek."<br>It says a small {star} is hidden in every room.<br>The more stars you collect, the better the treasure…',
    msg_lamp: 'It will not turn on. The bulb seems to be dead.',
    msg_tlamp_get: 'You removed the {item} from the table lamp.',
    msg_tlamp_again: 'The lamp has no bulb now.',
    msg_tlamp_back: 'You put the light bulb back.',
    msg_lamp_on: 'You replaced the bulb!<br>In the dim room, the light spread and words appeared on the wall…',
    msg_lamp_on_bright: 'You replaced the bulb!<br>The floor lamp is on.',
    msg_lamp_lit: 'The floor lamp glows warmly.',
    msg_shade_down: 'You lowered the window shade. The room got darker.',
    msg_too_dark: 'It is too dark to see well.',
    msg_shade_down_lit: 'You lowered the window shade.<br>As the room got darker, words appeared on the wall…',
    msg_shade_down_dark: 'You lowered the window shade.<br>The room got darker.',
    msg_shade_up: 'You raised the window shade. The room is bright again.',
    letter_body: 'Welcome, explorer of my home.<br>Whatever you find is yours to keep.<br>Enjoy the treasure hunt.  — The owner',
    letter_close: 'Close',
    letter_off: 'Turn off the light',
    msg_lamp_off: 'You turned off the floor lamp.<br>The room got darker.',
    msg_lamp_relit: 'You turned on the floor lamp.',
    msg_wall_words: 'Words are glowing on the wall…',
    msg_lamp_relit_words: 'You turned on the floor lamp.<br>Words are glowing on the wall…',
    msg_lamp_off_bright: 'You turned off the floor lamp.',

    /* ヒント */
    hint_1: 'Check the bed in the bedroom. Something may be under the pillow.',
    hint_2: 'Look inside the laundry basket in the bathroom.',
    hint_3: 'There is a drawer in the kitchen that the small key can open.',
    hint_4: 'It is dark under the bed in the bedroom. Try the flashlight.',
    hint_5: 'The bathroom cabinet may have something for wiping.',
    hint_6: 'Take the cloth and wipe the picture frame in the living room.',
    hint_7: 'The bedroom closet may have something for reaching high places.',
    hint_8: 'The top shelf in the kitchen is high. Use the step stool.',
    hint_9: 'Try turning on the hot water in the bathroom.',
    hint_10: 'Look at the mirror after the steam rises.',
    hint_11: 'The bedroom nightstand drawer has a clue about the order.',
    hint_12: 'Put the four numbers in the color order from the note into the treasure chest in the kitchen.',

    /* 宝箱のダイヤル */
    pad_title: 'Treasure chest dial',
    pad_del: 'Del', pad_clear: 'Clear', pad_close: 'Close', pad_open: 'Open',
    pad_wrong: 'It will not open… The numbers or the order might be wrong.',

    /* やめる確認 */
    quit_question: 'Quit the game?',
    quit_note: 'Your progress in this game will be lost.',
    quit_continue: 'Continue', quit_to_title: 'To title',

    /* 記録リセット */
    reset_question: 'Delete your treasure collection and best time?',
    reset_note: 'This cannot be undone.',
    reset_cancel: 'Cancel', reset_delete: 'Delete',
    reset_done: 'Your records have been deleted. Your collection starts from zero.',
    reset_none: 'There are no records to delete yet.',

    /* クリア */
    win_got: 'You got: {name}!',
    win_new: 'NEW',
    win_time: 'Time {t}',
    win_stars: 'Stars {n}/8',
    win_hints: 'Hints {n}',
    win_master: 'All stars and no hints! You are a treasure-hunting master!',
    win_all_stars: 'You collected every star!',
    win_more: 'Collect more stars for an even better treasure…?',
    win_complete: 'Collection complete! You found every treasure!',
    win_best: 'New best time!',
    win_collection: 'Treasure collection {n}/{total}',
    win_rank_0: '0–1', win_rank_1: '2–3', win_rank_2: '4–5', win_rank_3: '6–7', win_rank_4: '8',
    win_again: 'Play again', win_title: 'To title',
    win_owner_msg: 'You found the owner\'s hidden message!',

    /* 宝物 */
    tr_0_0_n: 'Candy', tr_0_0_d: 'A single candy in the corner of the chest. It looks sweet.',
    tr_0_1_n: 'Old stamp', tr_0_1_d: 'An old stamp from a country you have never seen.',
    tr_0_2_n: 'Pretty seashell', tr_0_2_d: 'A pale purple seashell, like one found on the beach.',
    tr_1_0_n: 'Bird feather', tr_1_0_d: 'A lovely feather that changes color in the light.',
    tr_1_1_n: 'Chess pieces', tr_1_1_d: 'Two old chess pieces: a knight and a king.',
    tr_1_2_n: 'Silver spoon', tr_1_2_d: 'A shiny silver spoon with fine engravings.',
    tr_2_0_n: 'Silk ribbon', tr_2_0_d: 'A soft, shiny silk ribbon.',
    tr_2_1_n: 'Fountain pen', tr_2_1_d: 'A fine fountain pen in deep blue.',
    tr_2_2_n: 'Antique teapot', tr_2_2_d: 'An old, round ceramic teapot.',
    tr_3_0_n: 'Blue stone ring', tr_3_0_d: 'A lovely ring with a sparkling blue stone.',
    tr_3_1_n: 'Antique pocket watch', tr_3_1_d: 'An old pocket watch that still keeps perfect time.',
    tr_3_2_n: 'Pearl necklace', tr_3_2_d: 'A necklace of round, shiny pearls.',
    tr_4_0_n: 'Antique silver coin', tr_4_0_d: 'A heavy old silver coin, led to you by eight stars!',
    tr_4_1_n: 'Gold trophy', tr_4_1_d: 'A shiny trophy for those who gathered all eight stars!',
    tr_4_2_n: 'Gold medal', tr_4_2_d: 'A gleaming gold medal for those who gathered all eight stars!'
  },

  ja: {
    doc_title: 'おうちの宝さがし',
    loading: '読み込み中…',
    load_error: '一部の画像を読み込めませんでした。このまま遊べます。',

    title: 'おうちの宝さがし',
    lead: '家の中を巡って、宝物を見つけよう。',
    start: 'はじめる',
    exit: 'おわる',
    howto: 'リモコンの上下左右で選び、決定で調べます。部屋の端で左右を押すと、隣の部屋へ移動します。',
    best_time: 'ベストタイム {t}',
    collection_count: '宝物図鑑 {n}/{total}',
    reset_records: '記録をリセット',

    room_bedroom: '寝室', room_bathroom: '洗面所', room_kitchen: 'キッチン', room_living: 'リビング',
    room_short_bedroom: '寝室', room_short_bathroom: '洗面所', room_short_kitchen: 'キッチン', room_short_living: 'リビング',
    prev_room: '前の部屋', next_room: '次の部屋',

    color_red: '赤', color_blue: '青', color_green: '緑', color_yellow: '黄',
    badge: '{color} {n}',
    badge_unknown: '{color} ?',

    item_flashlight: '懐中電灯', item_key: '小さな鍵', item_stool: '踏み台', item_cloth: '雑巾', item_bulb: '電球',
    item_title_flashlight: '懐中電灯', item_title_key: '小さな鍵', item_title_stool: '踏み台', item_title_cloth: '雑巾', item_title_bulb: '電球',

    bar_items: '持ち物', bar_numbers: '見つけた数字', bar_order: '色の順番', bar_time: '時間', bar_stars: '隠れ星',
    hint: 'ヒント', quit: 'やめる', sound_on: '音：オン', sound_off: '音：オフ',
    stars_count: '{n}/8',

    hs_mirror: '鏡', hs_tap: '蛇口', hs_brush: '歯ブラシ', hs_tub: 'お風呂', hs_cab: '戸棚', hs_basket: '洗濯かご',
    hs_fridge: '冷蔵庫', hs_chest: 'パントリー', hs_shelf: '上の棚', hs_drawer: '引き出し', hs_stove: 'コンロ',
    hs_closet: 'クローゼット', hs_pillow: '枕', hs_table: 'サイドテーブル', hs_under: 'ベッドの下', hs_tlamp: 'テーブルランプ',
    hs_books: '本棚', hs_frame: '額縁', hs_lamp: 'スタンドライト', hs_window: '窓辺',
    hs_star: 'きらきら光るもの',

    ok: 'OK',
    intro: '家のどこかに宝箱があるらしい。<br>ヒントを集めて探し当てよう！',
    star_found: '隠れ星を見つけた！（{n}/8）',
    star_again: 'ここの星はもう見つけたよ。',

    msg_mirror_plain: '大きな鏡。…よく見ると、うっすら指の跡がある？',
    msg_mirror_reveal: '湯気で曇った鏡に、文字が浮かび上がった！<br>{badge}',
    msg_mirror_again: '鏡には {badge} と書いてある。',
    msg_tap_on: 'お湯を出した。湯気がもくもく…鏡が曇ってきた！',
    msg_tap_again: 'お湯はもう十分出ている。',
    msg_brush: '歯ブラシと石けん。朝の支度はここから。',
    msg_tub: 'お気に入りの猫足のバスタブ。今日は入浴剤を入れてゆっくり入ろうかな。',
    msg_cab_get: '戸棚の中に {item} が入っていた。何かを拭くのに使えそうだ。',
    msg_cab_again: '洗剤とタオルがきれいに並んでいる。',
    msg_basket_get: 'タオルの間に {item} が紛れていた！',
    msg_basket_again: 'ふかふかのタオルが入っている。',

    msg_fridge: 'マグネットでメモが留めてある。<br>「お湯を出すと 見えてくるものがある」',
    msg_shelf_high: '棚が高すぎて届かない…。何か台があれば。',
    msg_shelf_get: '{item} に乗って届いた！<br>水差しの底にシールが貼ってある。{badge}',
    msg_shelf_again: '水差しの底に {badge} のシール。',
    msg_drawer_locked: '鍵がかかっている。小さな鍵穴がある。',
    msg_drawer_open: '小さな鍵で開いた！<br>中に {item} が入っていた。',
    msg_drawer_again: 'スプーンとフォークが並んでいる。',
    msg_stove: 'やかんがシュンシュンいっている。火を消しておこう。',
    msg_chest_none: 'カゴの奥に、鍵のかかった宝箱が隠れていた！<br>４けたのダイヤルがついている。<br>どこかに手がかりはないかな？',
    msg_chest_ready: 'カゴの奥に、鍵のかかった宝箱が隠れていた！<br>４けたのダイヤルがついている。<br>先ほど集めた手がかりが役立つかも！',

    msg_pillow: '枕の下にメモがあった！<br>「宝箱は4けたの数字で開く。数字は4つの部屋に1つずつ、色付きで隠れている。順番はこの部屋のどこかに書いてある。」',
    msg_closet_get: 'クローゼットを開けたら、{item} が入っていた。高い場所の物を取るのに使えそうだ。',
    msg_closet_again: '洋服がきれいに掛かっている。',
    msg_table: '引き出しの中にメモがあって、色の順番が書いてある！<br>{order}',
    msg_under_dark: 'ベッドの下は真っ暗で何も見えない…。',
    msg_under_reveal: '{item} で照らした！<br>ベッドの裏に数字が書いてある。{badge}',
    msg_under_again: 'ベッドの裏には {badge} と書いてある。',

    msg_frame_dirty: '壁にかかった額縁。表面が汚れていてよく見えない…。<br>どこかに拭くものはないかな。',
    msg_frame_reveal: '{item} でガラスを拭いた！<br>汚れの下に隠れていた暗号が読めるようになった。{badge}',
    msg_frame_again: 'ピカピカになったガラスに {badge} と書いてある。',
    msg_books: '「かくれんぼ名人」という本を手に取った。<br>どの部屋にも、小さな {star} が隠れているらしい。<br>星を集めるほど、宝箱の中身がすごくなるとか…。',
    msg_lamp: 'スイッチを入れても点かない。電球が切れているみたいだ。',
    msg_tlamp_get: 'テーブルランプの {item} を取り外した。',
    msg_tlamp_again: '電球を外したランプ。',
    msg_tlamp_back: '電球を戻した。',
    msg_lamp_on: '電球を取り替えた！<br>薄暗い部屋に光が広がって、壁に文字が映し出された…',
    msg_lamp_on_bright: '電球を取り替えた！<br>スタンドライトが点いた。',
    msg_lamp_lit: 'スタンドライトに、あたたかい光がともっている。',
    msg_shade_down: '窓辺のシェードを下ろした。部屋が暗くなった。',
    msg_too_dark: '暗くてよく見えない。',
    msg_shade_down_lit: '窓辺のシェードを下ろした。<br>部屋が暗くなると、壁に文字が浮かび上がった…',
    msg_shade_down_dark: '窓辺のシェードを下ろした。<br>部屋が暗くなった。',
    msg_shade_up: 'シェードを上げた。部屋が明るくなった。',
    letter_body: 'ようこそ、わが家の探検家さん。<br>見つけたものはあなたのものだよ。<br>宝探しを楽しんで。　　家主より',
    letter_close: '閉じる',
    letter_off: '電気を消す',
    msg_lamp_off: 'スタンドライトを消した。<br>部屋が暗くなった。',
    msg_lamp_relit: 'スタンドライトを点けた。',
    msg_wall_words: '壁に、文字が映っている…。',
    msg_lamp_relit_words: 'スタンドライトを点けた。<br>壁に、文字が映っている…。',
    msg_lamp_off_bright: 'スタンドライトを消した。',

    hint_1: '寝室のベッド。枕の下に何かありそう。',
    hint_2: '洗面所の洗濯かごの中をのぞいてみよう。',
    hint_3: '小さな鍵で開けられる引き出しが、キッチンにあるよ。',
    hint_4: '寝室のベッドの下は真っ暗。懐中電灯で照らしてみよう。',
    hint_5: '洗面所の戸棚に、何かを拭く道具が入っているかも。',
    hint_6: '雑巾を持って、リビングの額縁を拭いてみよう。',
    hint_7: '寝室のクローゼットに、高いところへ届く道具が入っているかも。',
    hint_8: 'キッチンの上の棚は高い。踏み台を使おう。',
    hint_9: '洗面所でお湯を出してみよう。',
    hint_10: '湯気が出たあとの鏡を見てみよう。',
    hint_11: '数字の順番は、寝室のサイドテーブルの引き出しにヒントがあるよ。',
    hint_12: '4つの数字を、メモの色の順に並べて、キッチンの宝箱に入れよう。',

    pad_title: '宝箱のダイヤル',
    pad_del: '消す', pad_clear: '全部消す', pad_close: '閉じる', pad_open: '開ける',
    pad_wrong: '開かない…数字か順番が違うみたい。',

    quit_question: 'ゲームをやめますか？',
    quit_note: '今の進み具合は消えます。',
    quit_continue: '続ける', quit_to_title: 'タイトルへ',

    reset_question: '宝物図鑑とベストタイムの記録を消してもいいですか？',
    reset_note: '消した記録は元に戻せません。',
    reset_cancel: 'やめる', reset_delete: '消す',
    reset_done: '記録を消しました。宝物図鑑は0から始まります。',
    reset_none: '消す記録はまだありません。',

    win_got: '{name}を手に入れた！',
    win_new: 'NEW',
    win_time: '時間 {t}',
    win_stars: '星 {n}/8',
    win_hints: 'ヒント {n}回',
    win_master: '星を全部見つけて、ヒントなし！ 宝さがし名人！',
    win_all_stars: '星を全部集めた！',
    win_more: '星を集めるほど、もっとすごい宝物になるかも…？',
    win_complete: '図鑑コンプリート！ すべての宝物を集めた！',
    win_best: 'ベストタイム更新！',
    win_collection: '宝物図鑑 {n}/{total}',
    win_rank_0: '0〜1', win_rank_1: '2〜3', win_rank_2: '4〜5', win_rank_3: '6〜7', win_rank_4: '8',
    win_again: 'もう一度遊ぶ', win_title: 'タイトルへ',
    win_owner_msg: '家主の隠しメッセージを見つけた！',

    tr_0_0_n: '飴玉', tr_0_0_d: '宝箱の隅っこに、飴玉がひとつ。甘くておいしそう。',
    tr_0_1_n: '古い切手', tr_0_1_d: '見たことのない国の、古い切手が1枚。',
    tr_0_2_n: 'きれいな巻き貝', tr_0_2_d: '海で拾ったような、薄紫色の巻き貝。',
    tr_1_0_n: 'きれいな鳥の羽', tr_1_0_d: '光の当たり方で色が変わる、きれいな羽。',
    tr_1_1_n: 'チェスの駒', tr_1_1_d: 'ナイトとキング、2つそろった古いチェスの駒。',
    tr_1_2_n: '銀のスプーン', tr_1_2_d: '細かい模様が彫られた、ピカピカの銀のスプーン。',
    tr_2_0_n: 'シルクのリボン', tr_2_0_d: 'つやつやした、柔らかいシルクのリボン。',
    tr_2_1_n: '万年筆', tr_2_1_d: '深い青色をした、立派な万年筆。',
    tr_2_2_n: 'アンティークのティーポット', tr_2_2_d: 'ころんとした形の、古い陶器のポット。',
    tr_3_0_n: '青い石の付いたリング', tr_3_0_d: '青い石がキラキラ光る、すてきなリング。',
    tr_3_1_n: 'アンティークの懐中時計', tr_3_1_d: '今もきちんと時を刻む、古い懐中時計。',
    tr_3_2_n: '真珠のネックレス', tr_3_2_d: '丸くてつやつやした、真珠のネックレス。',
    tr_4_0_n: 'アンティークの銀貨', tr_4_0_d: '8つの星が導いた、ずっしり重い古い銀貨！',
    tr_4_1_n: '金のトロフィー', tr_4_1_d: '8つの星を集めた人だけの、ピカピカのトロフィー！',
    tr_4_2_n: '金のメダル', tr_4_2_d: '8つの星を集めた人だけの、輝く金のメダル！'
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

/* 翻訳が欠けているときは英語、それも無いときはキー名ではなく空にしない（英語の既定文言を使う） */
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
