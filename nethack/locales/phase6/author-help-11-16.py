"""Original-source Japanese help lines; no fork reuse or runtime binding."""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]

# Literal Japanese display text before Catalog brace escaping. Every list follows
# its frozen queue order; parser names/defaults/command examples stay literal.
TEMPLATES = {
11: r'''price_quotes   未識別の品物について記憶している価格の見積もりを表示する      [False]
pushweapon     新しい武器を構えたとき、それまで構えていた武器を               [False]
               予備の武器のスロットに入れる
quick_farsight ランダムに千里眼が発動した際、マップを見渡す機会を              [False]
               通常は省略する
rawio          raw I/O の使用を許可する                                      [False]
reroll         初期所持品の引き直しを許可する                                [False]
rest_on_space  スペースキーを休息のキーとして扱う                            [False]
safe_pet       ペットと分かっている相手への攻撃を防ぐ                        [True]
safe_wait      '.' または 's' によって、敵対的なモンスターに隣接した状態で    [True]
               待機や探索をするには 'm' 接頭辞を必要とする
sanity_check   データの整合性を検査する                                      [False]
showexp        累積経験値を表示する                                          [False]
showrace       自分の表示を職業ではなく種族に基づくものにする                [False]
showvers       ステータス行にバージョン番号を表示する                        [False]
silent         端末のベルを鳴らさない                                        [True]
sortpack       所持品で同じ種類の品物をまとめる                              [True]
sparkle        魔法の攻撃に耐えたときにきらめきを表示する                    [True]
               （例：炎への耐性を持つモンスターに炎の攻撃をしたとき）
standout       メッセージの --More-- を強調表示する                           [False]
status_updates ステータス行を更新する                                        [True]
terrainstatus  現在位置を説明する追加のステータス欄を表示する                [False]
time           ゲーム内の経過時間を行動数で表示する                          [False]
tips           ゲーム中に役立つヒントを表示する                              [True]
tombstone      死んだときに墓石を表示する                                    [True]
toptenwin      topten を標準出力ではなくウィンドウに表示する                 [False]
travel         対応していればマウスクリックによる移動を有効にする            [True]
               無効にすると、マップ上のクリックによって主人公が
               移動しようとするのを防げる。'_' による移動には影響しない
use_darkgray   黒い記号に青の代わりに太字の黒を使う。                        [True]
use_inverse    発見されたモンスターを強調表示する                            [False]
verbose        ゲーム中の説明を増やす                                        [True]
weaponstatus   構えている武器を一覧する追加のステータス欄を表示する          [False]
whatis_menu    マップ位置を選ぶ際にメニューを表示する                        [False]
whatis_moveskip マップ位置を選ぶ際に同じ記号を飛ばす                         [False]
コンパイル時のフラグによって決まる真偽値オプションもある。
コンパイル時に INSURANCE が設定されていれば使える真偽値オプション：
checkpoint     階層を移るたびにゲーム状態を保存する                          [True]
               プログラムが異常終了した際の復旧に備えるため
コンパイル時に NEWS が設定されていれば使える真偽値オプション：
news           起動時にゲーム管理者からのお知らせがあれば表示する            [True]
コンパイル時に SCORE_ON_BOTL が設定されていれば使える真偽値オプション：
showscore      累積得点の概算を表示する                                      [False]
コンパイル時に TIMED_DELAY が設定されていれば使える真偽値オプション（tty または curses のみ）：
timed_delay    unix と VMS では、表示効果のために一時停止しようとするとき、    [True]
               余分な画面出力を送る代わりにタイマーを使う。
               MSDOS で termcap ライブラリを使わない場合は、
               表示効果のための一時停止をするかどうかを指定する。
コンパイル時に ALTMETA が設定されていれば使える真偽値オプション：
altmeta        unix と VMS では、プレイヤーのキーボードからコマンドを
               受け取る際、2文字の "ESC c" を M-c（Meta+c、第8ビット有効） [False]
               として扱う。
コンパイル時に TILES_IN_GLYPHMAP が設定されていれば使える真偽値オプション（MSDOS）：
preload_tiles  ゲーム開始時にタイルを RAM にあらかじめ読み込むか指定する    [True]
               タイル表示が速くなるが、
               より多くのメモリを使う。
コンパイル時に TTY_TILES_ESCCODES が設定されていれば使える真偽値オプション（tty のみ）：
vt_tiledata    出力に追加のタイルデータ用エスケープコードを挿入する          [False]
コンパイル時に TTY_SOUND_ESCCODES が設定されていれば使える真偽値オプション（tty のみ）：
vt_sounddata   出力にサウンドデータ用エスケープコードを挿入する              [False]
以下の真偽値オプションは、プログラムが対応するように
構築されたインターフェースによって使える場合がある。複数に対応していると、
設定できるように見えても、現在使用しているものが
そのオプションの対象外であれば、何もしない場合がある：
ascii_map      マップを文字で表示し、tiles_map を Off にする。Qt、X11
guicolor       curses
hitpointbar    curses、tty、statushilites が有効な Windows GUI；
               statushilites が無効な Qt；'fancy_status' が無効で
               （X のアプリケーション既定値による）、statushilities が有効な X11
popup_dialog   curses、Qt、Windows GUI
selectsaved    tty（Qt と Windows GUI は常にこの動作を行う）
splash_screen  curses、Qt、Windows GUI
tiled_map      マップをタイルで表示し、ascii_map を Off にする。Qt、X11
デバッグモード（ウィザードモード）で使える真偽値オプション：
menu_tab_sep   メニューの書式設定用。変更しないこと
monpolycontrol モンスターが変身する際の新しい姿をプレイヤーが選ぶ
montelecontrol テレポートするモンスターの移動先をプレイヤーが選ぶ
travel_debug   移動経路を探すアルゴリズムの状態をマップに表示する
wizweight      所持品の表示に品物の重量を含める
真偽値オプションは、設定するオプションに名前を含めると True になり、
名前の前に '!' または 'no' を付けると否定されて False になる。
代わりに、複合オプションの書式 'optname:true' と
'optname:false' を使うこともできる。
 - - - - -
複合オプションは option_name:option_value と記述する。
ゲーム中に設定できる複合オプションは次のとおり：
autounlock    鍵のかかった扉を開けたり、鍵のかかった容器を                  [Apply-Key]
              探ったりするときに取る動作を指定する。
              None、または Untrap + Apply-Key + Kick + Force の組み合わせ。
              Untrap を含めると、最初に処理される。
              ほかの動作は "check for traps?" に "no" と答えた場合に適用される。
              "yes" と答えても、罠が存在する場合に必ず発見できるとは限らず、
              発見の有無にかかわらず、その行動の残りを
              消費する。
              Kick は扉だけに、Force は容器だけに有効で、
              いずれも Untrap が指定されていないか省略され、
              Apply-Key が指定されていない、解錠の道具を持っていない、
              または道具の使用を断った場合にだけ試みられる
boulder       巨石の既定の記号を変更する                                     [`]
crash_email   異常終了の報告に使用するメールアドレス                          []'''.splitlines(),
12: r'''crash_name    異常終了の報告に使用する名前                                    []
crash_urlmax  異常終了の報告用に生成できる URL の最大長                       []
disclose      ゲーム終了時に提示してほしい情報の種類        [ni na nv ng nc no]
              を指定する
              （2文字の値を空白で区切った一覧。
              接頭辞：'+' は常に開示、'-' は開示しない、
              'n' は既定が "no" の確認、'y' は既定が "yes" の確認、
              'a' は並べ替え順序を選ぶ確認（接尾辞 'v' のみ）。
              接尾辞：'i' は所持品、'a' は能力、'v' は倒した
              モンスター、'g' は虐殺されたモンスターと絶滅したモンスター、'c' は制約の遵守
              と実績、'o' はダンジョンの概要）
fruit         好んで食べる果物の名前                              [slime mold]
              （基本的には、NetHack が時々使う遊びの要素）。
hilite_status ステータス欄を強調する規則を指定する                             []
              （複数の指定が可能）
menustyle     複数の品物を選択する際の操作方式                            [Full]
              Traditional -- 対象の分類を尋ね、その後
                             その分類の品物について一つずつ尋ねる。
              Combination -- 対象の分類を尋ね、その後
                             メニューで品物を選ぶ。
              Full        -- 分類をメニューで選び、その後で品物をメニューで選ぶ。
              Partial     -- 分類による絞り込みを省き、全品物のメニューを使う。
              先頭の文字（'T','C','F','P'）だけが使われる
              （Traditional でも、多くの操作で擬似分類 'm' を選ぶと
              品物の選択にメニューを使える。その一回だけ Combination になる）。
menu_objsyms  メニューにオブジェクトの分類記号を含めるか                       [4]
              0 - none    -- メニューにオブジェクト記号を追加しない。
              1 - headers -- メニューの見出し行に分類記号を添える。
              2 - entries -- 各品物の行にオブジェクトの記号を表示する
                             （ASCII 表示では分類記号と同じ）。
              3 - both    -- 1 と 2 の両方。
              4 - conditional -- 2 と同じだが、見出しがない場合だけ。
              5 - one-or-other -- 1 と 4 の組み合わせ。
              0 と 1 はどのインターフェースでも使えるはずだが、2 から 5 は
              tty と curses が対応している
msg_window    tty で ^P によってメッセージを振り返る際の動作                  [s]
              single      -- 一度に一つのメッセージ
              full        -- 保存された最上行のメッセージをすべてウィンドウに表示
              reverse     -- full と同じだが、最新のメッセージを先に表示
              combination -- 連続する ^P の最初の2回は
                             一つずつ表示し、3回目には全体を表示
msg_window    curses で ^P によってメッセージを振り返る際の動作               [r]
              reverse     -- ウィンドウに全体を、最新のものから表示
              full        -- ウィンドウに全体を、古いものから表示し、
                             初めは最後のページを開いて
                             最新のメッセージが見えるようにする
number_pad    文字キーと数字キーのどちらで移動するか                          [0]
               0 -- 従来の hjkl + yubn による移動（既定）。
               1 -- 数字キーによる移動。テンキー向け。
               2 -- 1 と同じだが、'5' が 'G' ではなく 'g' 接頭辞として働く。
               3 -- 電話のキー配列（上が1,2,3、下が7,8,9）による数字での移動。
               4 -- 電話の配列（3）と '5' の選択（2）の組み合わせ。
              -1 -- "qwertz"。文字での移動だが 'z' と 'y' を入れ替える。
              number_pad を正の値に設定すると、テンキーだけでなく
              すべての数字キーの扱いに影響する。
packorder     分類の既定の記号を並べた一覧。                   [")[%?+!=/(*`0_]
              'sortpack' が有効なとき、所持品（および
              一部のほかの表示）を並べる順番を指定する
              （一部の分類だけを指定した場合、指定していないものは
              既定の順番で末尾に追加される）。
paranoid_confirmation  追加の確認をしたい状況を [paranoid_confirm:pray swim]
              空白で区切って指定する
              Confirm -- "yes" を要求する場合、拒否にも "no" を要求する。
                      pray、trap、Autoall でも y ではなく yes を要求する
              quit    -- 終了や探索モードへの切り替えの確認に y ではなく yes
              die     -- 死亡の確認に y ではなく yes（探索・デバッグモード）
              bones   -- bones データの保存の確認に y ではなく yes（デバッグモード）
              attack  -- おとなしいモンスターを攻撃する確認に y ではなく yes
              wand-break -- 杖を折る確認に y ではなく yes
              eating  -- 食べ続けるかの確認に y ではなく yes
              Were-change -- 主人公に変身制御がある場合、獣化による
                      姿の変化の確認に y ではなく yes。
              pray    -- 祈ろうとする際に y で確認する。既定で有効
              trap    -- 無害でなければ、既知の罠に入る際に y で確認する。
              swim    -- 主人公が水や溶岩を見ており、能力が妨げられていないとき、
                      そこへ入るには m 接頭辞を必要とする。既定で有効。
              AutoAll -- menustyle:Full で分類を絞り込むメニューの 'A' を
                      選んだ場合に y で確認する。
              Remove  -- 'R' と 'T' で外す対象の品物を一つしか身に着けていなくても、
                      必ず所持品から選ぶようにする
perminv_mode  固定の所持品ウィンドウに対応するインターフェースで、             [a]
              perm_invent が true のとき、何を
              表示するかを指定する：
              none/off -- perm_invent が false の場合と同じ
              all/on   -- 金貨以外の所持品を表示（既定）
              full     -- 金貨を含む所持品を表示
              in-use   -- 身に着けているか、構えている品物だけを表示
              （tty の任意の perm_invent 対応には、
              all と full の変形となる追加の選択肢がある）
pickup_burden この重さの負担段階を超える品物を拾う場合、                      [S]
              Unencumbered、Burdened、streSsed、straiNed、overTaxed、
              overLoaded のいずれかを指定すると、続けたいか確認される。
pickup_types  自動で拾う品物の分類の既定記号を並べた一覧                       []
              自動収集が有効な場合に使われる。空の一覧は「すべて」を意味する
pile_limit    床の品物の上を歩く際の表示について、                             [5]
              品物を列挙せず「ここに品物がある」と表示するようになる個数のしきい値
              （0 は「常に品物を列挙する」）。
runmode       複数歩の移動（さまざまな走行や移動コマンド）で、                [run]
              マップウィンドウを更新する頻度を指定する：
              teleport -- 移動が止まるまでマップを更新しない。'''.splitlines(),
13: r'''              run      -- 定期的にマップを更新する（7歩ごと）。
              walk     -- 一歩ごとにマップを更新する。
              crawl    -- walk と同じだが、一歩ごとに表示を待つ。
              （画面の表示だけに影響し、実際の移動には影響しない）。
scores        ゲーム終了時に見たい得点一覧の範囲を指定する [!own/3 top/2 around]
              上位の得点、その付近の得点、
              自分自身のすべての得点を
              組み合わせて選ぶ。
sortdiscoveries 発見したオブジェクト一覧を表示する際の並び順                   [o]
              o -- 分類ごとに発見した順
              s -- sortloot の "loot" の順
              c -- 分類ごとにアルファベット順
              a -- 分類をまたいだアルファベット順
sortloot      品物の集まりを調べる際の並び順                                   [n]
              none -- 並べ替えない
              loot -- 床や容器の中にある品物の山を並べ替える
              full -- 'loot' に加え、所持品も並べ替える
sortvanquished 倒したモンスター一覧を表示する際の並び順                        [t]
              t -- 従来のモンスターのレベル順
              d -- モンスターの難易度評価順
              a -- アルファベット順。まず唯一の個体、次にそれ以外
              c -- 分類順。分類内では低いレベルから高いレベルへ
              n -- 数の多い順
              z -- 数の少ない順
statushilites ゼロ以外ならステータスの強調を表示し、                           [0]
              一時的な強調を表示するターン数も指定する
              （hilite_status の 'up'、'down'、'changed' 規則）。
statuslines   ステータスを拡張した3行か、凝縮した2行で表示するか                [2]
              （tty と curses では2行が従来の表示で、3行を推奨。
              Qt にも適用され、こちらは3行が従来の表示で、2行を推奨）。
suppress_alert バージョンごとの変更の警告を無効にする                           []
              ゲーム内容や操作方式の変更に関する通知、たとえば
              'Q' に対する「終了は #quit で行う」という通知が対象
              （例：suppress_alert:3.3.1 を使うと、その通知を含め、
              そのバージョン以前に追加された通知を止める）。
versinfo      showvers が true の場合に表示する情報を選ぶ                 [1 or 4]
              （既定値はプログラムの開発状況による）。
whatis_coord  '/' と ';' コマンドで autodescribe が有効な場合に、               [n]
              マップ座標を含めるかどうかを指定する。
              次のいずれかの先頭の文字を指定する
              compass      -- 自分からの相対位置。'east'、'3s'、'2n,4w' など
              full compass -- 'east'、'3south'、'2north,4west' など
              map          -- <x,y>（マップの x=0 列は使われない）
              screen       -- [row,column]（行は tty 表示に合うように補正）
              none         -- 座標を表示しない。
whatis_filter 移動コマンドなどのためにマップ位置を選ぶ際、                     [n]
              対象となる座標をどう絞り込むかを指定する。
              値は次のいずれか
              n - 絞り込まない
              v - 見えている場所だけ
              a - 同じ領域の場所（部屋、通路など）
起動時だけに設定できる複合オプションは次のとおり：
align      開始時の属性。lawful、neutral、chaotic、または random。          [random]
           多くの職業で選択できる属性は一部に制限されている。
           先頭の文字だけを指定してもよい。
catname    最初のペットが子猫だった場合の名前                                 [none]
dogname    最初のペットが小犬だった場合の名前                                 [none]
           小犬を連れて始まる職業の一部には、あらかじめペットの名前が
           決まっているものがある（例：侍の "Hachi"）。しかし、その名前は
           dogname を指定すると置き換えられる。
gender     開始時の性別（male、female、random）。                           [random]
           先頭の文字だけを指定してもよい。従来の真偽値オプション
           "male" と "female" によって性別を示すことも
           できるが、"gender" オプションの方が優先される。
horsename  最初のペットが子馬だった場合の名前                                 [none]
menu_*     メニューの操作に使う1文字のショートカットを指定する。
           以下に各操作、既定のキー、
           その操作を実装しているウィンドウ方式を示す：
           （t は tty、c は curses、w は Windows GUI、x は X11、q は Qt）。
           menu_first_page    メニューの最初のページへ移る                  [^](tcwxq)
           menu_last_page     メニューの最後のページへ移る                  [|](tcwxq)
           menu_next_page     メニューの次のページへ進む                    [>](tcwxq)
           menu_previous_page メニューの前のページへ戻る                    [<](tcwxq)
           menu_shift_left    表示を左へずらす（perm_invent のみ）            [{](cx)
           menu_shift_right   表示を右へずらす（perm_invent のみ）            [}](cx)
           menu_select_all    メニュー内のすべての品物を選ぶ                [.](tcwxq)
           menu_select_page   このページのすべての品物を選ぶ                [,](tcwq)
           menu_deselect_all  メニュー内のすべての品物の選択を解除する        [-](tcwxq)
           menu_deselect_page このページのすべての品物の選択を解除する       [\](tcwq)
           menu_invert_all    メニュー内のすべての品物の選択を反転する       [@](tcwxq)
           menu_invert_page   このページのすべての品物の選択を反転する       [~](tcwq)
           menu_search        検索する文字列を尋ね、一致する                 [:](tcwxq)
                              品物の選択を反転する
msghistory 保存する最上行のメッセージ数                                         [20]
name       キャラクターの名前                           [複数利用者のシステムでは
           利用者名を既定値とし、単独利用者のシステムや、利用者名が
           "games" のような汎用の名前と判断された場合には "who are you?" と尋ねる]
           MS Windows は利用者名に対応していても単独利用者のシステムとして
           扱われる。キャラクター名をコマンド行で指定した場合
           （通常は 'nethack -u myname'。システムの種類や
           アクセス方法による）、そちらが
           オプションの 'name' より優先される。
pettype    希望するペットの種類（cat、dog、horse、random、                  [random]
           none）。職業が複数の種類を許可する場合、または
           最初のペットを連れたくない場合に使う。多くの職業は dog と cat を許可するが、
           horse は許可しない。特定の種類のペットに固定されている職業では、
           'none' を指定しない限り pettype は無視される。
playmode   通常のプレイ、得点を記録しない探索モード、またはデバッグモード    [normal]
race       開始時の種族（例：race:Human、race:Elf）。                       [random]
           多くの職業で選べる種族は一部に制限されている。'''.splitlines(),
14: r'''role       開始時の職業（例：role:Barbarian、role:Valk）。                  [random]
           先頭の文字だけを指定することもできるが、
           一致する職業のうち最初に見つかったものが選ばれる。
           そのため、職業名はできるだけ長く
           書くことを推奨する。"name" オプションの後ろに
           職業を付ける従来の書式（例：name:Vic-V）も使えるが、
           "role" オプションの方が優先される。
windowtype 使用するウィンドウ方式                  [OS と
           コンパイル時の設定による]。複数の選択肢がある場合に指定する。
           一つのウィンドウ方式にしか対応していないプログラムもあり、
           その場合は何も指定する必要がない。
           対応している方式の一覧は、プログラム実行中なら
           #version コマンドで確認できる。外部からなら、構築時に
           生成される 'options' というテキストファイルを
           調べることで確認できる。
オプション一覧の指定例：
!autopickup,!tombstone,name:Gandalf,scores:own/3 top/2 around
female,nonews,dogname:Rover,rest_on_space,!verbose,menustyle:traditional
 オプションを動的に設定する仕組み：
 簡易オプションメニューには比較的少数のオプションが表示され、
 選択は一つずつすぐに適用される。その後で再びメニューを表示し、
 続けて変更できる。
 完全なオプションメニューにはすべてのオプションの現在値が表示され、
 変更したいものを選べる。選んだだけでは
 変更されず、メニューを閉じてから
 適用される。NetHack の多くのインターフェースでは、
 <enter> または <return> キーでメニューを閉じる。
 [ok] のクリックが必要なものもある。<escape> を押すか [cancel] を
 クリックすると、保留中の変更を破棄してメニューを閉じる。
 オプションメニューは一画面に収まらないほど長い。一部のインターフェースは
 ページに分けており、'>' で次のページ、'<' で前のページへ
 移る。通常はページごとに選択文字（a-z）を再使用する。
 一つの長いページとスクロールバーを使うものもある。a-z と
 A-Z の後は選択文字のない項目となり、
 クリックして選べる。
 真偽値（True/False または On/Off）のオプションは、選択するだけで
 切り替わる。複合オプションは数値、特定の候補からの選択、
 またはさらに複雑な値を取り、
 真偽値の次の区画に一覧される。それらを選ぶと、
 新しい値を指定するよう求められる。
 両方の区画の先頭には、ゲーム開始前だけに設定できる
 選択不可のオプションの値も表示される。
 複合オプションの区画の後には、複数の値をまとめて扱う
 やや複雑な「その他」のオプションがある。
 一部の変更は、現在のゲームを保存するか終了するまでしか
 続かない。通常は、能力の異なる別のコンピューターで
 保存したゲームを再開した場合に
 適切でなくなるかもしれない設定が対象である。ほかのオプションは
 このゲームの保存ファイルに含まれ、再開後も設定を維持する。
 オプションメニューでの設定は、保存済みの別のゲームにも
 新しいゲームにも影響しない。そのためには、実行時の設定ファイルを
 更新し、希望するオプションをそこで指定する必要がある。それでも、
 オプションの値を含む既存のゲームを再開した場合は、
 そちらに保存された値が使われる。
これは nethack のコマンド行引数を簡潔に説明したもの。
UNIX（linux や macOS などの派生系を含む）を対象にしているため、
ほかの環境では正確でない場合がある。
プレイ開始時、選んだキャラクター名の保存ファイルがあれば再開し、
なければ、その名前で新しいゲームを始める。
nethack
  引数なし。実行時の設定ファイルの
  OPTIONS=name:character-name による名前を使い、指定がなければ利用者名を使う。
nethack -u character-name [-X or -D]
  '-u character-name' は、このゲームのキャラクター名を指定する。
       -u は小文字でなければならない。名前との間の空白は
       省略できる。
  '-X' は得点を記録しない探索モード（発見モードとも呼ぶ）でプレイする。
       -X は大文字でなければならない。キャラクターは願いの杖を持って始まり、
       死亡しても、プレイヤーが命を救って続けることを選べる。
  '-D' はデバッグモード（ウィザードモードとも呼ぶ）で実行する。-D は大文字。
       許可されていないプレイヤーの場合、nethack は -X に切り替える。
       許可されている場合、キャラクター名は "wizard" になる。
  キャラクター名には、職業、種族、性別、属性のいずれか、または
  すべてを示す接尾辞を付けられる。例：-u Conan-Bar-Hum-Mal-Neu、-u Tim-Wiz。
  指定する各部分は3文字以上でなければならず、より長くてもよい。
  大文字・小文字は区別しない。次の -p と -r も参照。
nethack -p Ppp -r Rrr [-@]
  '-p Ppp' は職業を指定する。-r が使われているため profession の p を使う。
       'Ppp' は職業名の3文字以上。例：Valkyrie を指定する
       Val。-p 自体と違い、Ppp の大文字・小文字は区別しない。
  '-r Rrr' は種族を指定する：Hum[an]、Elf、Orc、Dwa[rf]、Gno[me]。
  '-@' は対話なしの開始を指定する。職業、種族、性別、属性のうち、
       コマンド行にも実行時の設定ファイルにも
       指定されていないものは、確認せずにランダムに選ばれる。
       シェルによっては @ の前にバックスラッシュを付ける必要がある。
  職業の古い指定方法も使える：-A または -Arc[heologist]、
  -B または -Bar[barian]、-C または -Cav[eman]、-Cavew[oman]、-H または -Hea[ler]、
  -K または -Kni[ght]、-M または -Mon[k]、-P または -Pri[est]、-Prieste[ss]、
  -Ran[ger]、-R または -Rog[ue]、-S または -Sam[urai]、-T または -Tou[rist]、
  -V または -Val[kyrie]、-W または -Wiz[ard]。1文字の指定は
  大文字でなければならない。3文字以上なら大文字・小文字はどちらでもよい。
  Ranger の職業には1文字の指定はない。
nethack -DEC[graphics]
nethack -IBM[graphics]
  文字マップの罫線に使う DEC または IBM の記号を
  選ぶ。インターフェースによっては無視され、表示能力によっては
  効果がなかったり、表示が乱れたりする。-DECgraphics と
  -IBMgraphics は同時には使えない。大文字・小文字は問わないが、
  少なくとも3文字必要。
nethack -wIii'''.splitlines(),
15: r'''nethack --windowtype:Iii
  'Iii' は tty、curses、X11、Qt などのインターフェースを
  表す。複数のインターフェースに対応するように構築されている場合だけ
  有効（ゲームの '#version' コマンドで確認できる）。実行時の設定ファイルの
  OPTIONS=windowtype:Iii と、構築時の
  既定値より優先される。'-w' と '--windowtype' は小文字でなければならないが、
  方式の名前は大文字・小文字を問わない。'--windowtype Iii' や
  '-w Iii' という書式も使える。
  Windows では、nethack.exe はソースから構築した際の設定に応じて
  tty、curses、または両方に対応する。nethackW.exe は
  mswin（Win GUI とも呼ぶ）と、任意で curses に対応する。
  MS-DOS では、tty、curses、または両方に対応する。
nethack -n
  nethack のディレクトリに 'news' ファイルがあっても表示しない。
nethack --nethackrc:RC-file
  既定の実行時の設定ファイル（通常は '~/.nethackrc'）の代わりに
  RC-file を使う。ファイルが nethack のディレクトリにない場合は、
  完全なパスを指定する必要がある。
nethack --no-nethackrc
  実行時の設定ファイルを使わない。
  空のファイルとして動作する --nethackrc:/dev/null と同じ。
nethack -dDir
nethack --directory:Dir
  構築時に決まった NETHACKDIR の値を
  場所 Dir に変更できる。使う場合は、ほかのコマンド行引数より前に置く。
上記のさまざまなオプションは、一つのコマンド行で組み合わせて使える。
ここでは読みやすいように個別に示している。
*******
ゲームをプレイせず、何らかの処理を行って終了する
その他のオプション：
nethack -s
nethack --scores
  既定のキャラクターの得点を表示する。次の追加引数を指定できる：
nethack -s -v
  最高得点ファイル（record）に以前のバージョンの得点がある場合は、
  そこに含まれるすべてのバージョンの得点を表示する。既定では
  現在のバージョンの得点だけを表示する。'-v' を使う場合は、
  -s または --scores の直後、名前や -p、-r より前に置く。
nethack -s character-name [character-name2 [character-name3 [...]]]
  一つ以上の指定したキャラクター名の得点を表示する
  （sysconf で PERS_IS_UID=1 が指定されていると機能しない場合がある）。
  キャラクター名の前には '-u' を付けてもよいが、必須ではない。
  特別なキャラクター名 "all" は、ほかの条件を満たす
  すべての得点を表示するために使う。
nethack -s -p Ppp -r Rrr
  特定の職業や種族の得点を表示する。複数回指定できる。
  '-p' と '-r' を両方使った場合は、両方を満たす得点ではなく、
  どちらかを満たす得点が表示される。
nethack -dDir -s
nethack --directory:Dir -s
  上記と同じ。別のディレクトリを指定するなら、最初に置く。
nethack --version or --version:copy or --version:dump or --version:show
  '--version' はプログラムのバージョン番号、ソースから構築された
  日付と時刻を表示して終了する。
  '--version:copy' はバージョン番号を表示し、システムの
  クリップボードにもコピーする（macOS と Windows で動作するはずだが、
  ほかの環境では動作しない場合がある）。その後のメールや
  ウェブの問い合わせフォームに貼り付けられるようにして、終了する。
  '--version:dump' はいくつかの内部値を表示して終了する。
  '--version:show' は '--version' と同じ。
nethack --showpaths
  各種ファイルとディレクトリの想定される場所を一覧して終了する。
  実行時の設定ファイルの名前と場所も含み、
  それらは環境によって異なる場合がある。
nethack --usage
nethack --help
  この説明を表示する。'nethack -?' と 'nethack ?' も使えるが、
  シェルに解釈されないように ? を引用する必要がある場合がある。
この説明は、ゲーム中の '?' コマンドのメニューから見られる。
シェルから 'nethack --usage | more' として見ることもできる。
デバッグモードの早見表：
^E  ==  近くの隠し扉と罠を探知する
^F  ==  階層の地図を得る。罠と隠れた通路は分かるが、隠し扉は分からない
^G  ==  名前または分類によってモンスターを作る
^I  ==  持ち物を識別する
^T  ==  同じ階層内でテレポートする
^V  ==  階層をまたいでテレポートする。'?' で特別な行き先のメニュー
^W  ==  品物、罠、または限られた一部の地形について願う
^X  ==  状態、属性、特性を表示する（詳しい自己認識）
#debugfuzzer    == ゲームを自動操縦し、失敗するまで動き続ける
                   impossible の警告を panic に引き上げる
#levelchange    == 主人公の経験レベルを設定する
#lightsources   == 移動する光源を表示する
#migratemons    == 移動中のモンスターを表示する。[Opt] 作成も可能
#panic          == panic のテスト（警告：現在のゲームは終了する）
#polyself       == 自分を変身させる
#stats          == メモリの統計を表示する
#terrain        == 現在の階層を表示する（通常のプレイより多くの選択肢）
#timeout        == timeout キューと主人公の時間制限付きの内在的特性を見る
#vision         == 視界の配列を表示する
#wizborn        == モンスターの誕生・死亡・虐殺・絶滅の統計を表示する
#wizcast        == 任意の呪文を唱える
#wizdispmacros  == [Opt] 内部の表示分類を検査する
#wizfliplevel   == 現在のダンジョンの階層を転置する
#wizintrinsic   == 選んだ内在的特性の時間制限を設定する
#wizkill        == モンスターをゲームから取り除く
#wizloaddes     == 特殊階層の説明用 Lua スクリプトを読み込んで実行する
#wizloadlua     == Lua スクリプトを読み込んで実行する
#wizmakemap     == 現在のダンジョンの階層を作り直す
#wizmondiff     == [Opt] モンスターの難易度評価の不一致を調べる'''.splitlines(),
16: r'''#wizobjprobs    == [Opt] 品物の生成の実際の確率を一覧する
#wizrumorcheck  == 噂の索引を検証し、最初、2番目、最後の
                   ランダムな床の落書き、墓碑銘、幻覚のモンスターも表示する
#wizseenv       == マップの場所の seen ベクトルを表示する
#wizsmell       == モンスターのにおいを嗅ぐ
#wiztelekinesis == 魔法でモンスターを押す
#wizwhere       == すべての特殊階層のダンジョン内での配置を表示する
#wmode          == 壁のモードを表示する
オプション：
debug_hunger    == 主人公の空腹を無効にする
debug_mongen    == モンスターのランダムな生成を無効にする
debug_overwrite_stairs
                == 階段をほかの地形で置き換えられるようにする
monpolycontrol  == モンスターが変身するたびに新しい姿を尋ねる
sanity_check    == 毎ターンの前にモンスター、オブジェクト、マップを検査する
wizweight       == オブジェクトの説明にその重量を追加する
[Opt] = 構築時の設定によって使用できるか決まる'''.splitlines(),
}

def load_catalog():
    spec = importlib.util.spec_from_file_location("help1116_catalog", ROOT / "locales/build-gameplay-catalog.py")
    value = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = value
    spec.loader.exec_module(value)
    return value

def main():
    catalog = load_catalog()
    results = []
    for number, templates in TEMPLATES.items():
        path = HERE / f"help-history-batch-{number}.json"
        raw = path.read_bytes()
        batch = json.loads(raw)
        assert len(templates) == len(batch["entries"]), (number, len(templates), len(batch["entries"]))
        entries = []
        for original, authored in zip(batch["entries"], templates):
            source_text = original["source_records"][0]["english_source_literal"]
            # Preserve original leading whitespace. Indented help continuations
            # remain at their exact native source column; no state changes.
            leading = re.match(r"\s*", source_text).group()
            authored = leading + authored.lstrip()
            notes = ["Authored from the actual official source line and its adjacent source paragraph; no Japanese fork text or new gameplay fact is imported.",
                     "Command/option/input tokens, default values, platform names, ASCII glyphs and structural indentation remain literal data selected by the original resource consumer. Japanese line contents do not change native parsing, options or command behavior.",
                     "Original DLB line/source-index binding and paragraph/layout presentation remain pending. No completed-English lookup, renderer-triggered engine call or extra RNG/state/name query is permitted."]
            if source_text == authored:
                disposition = "preserved-original-command-example-or-structural-marker"
                notes.append("This source line is a literal command/configuration example, platform token or visual separator; preserving its exact spelling is the source consumer contract, not a missing prose translation exemption.")
            else:
                disposition = "translated-official-help-line"
            if "statushilities" in source_text:
                notes.append("Retain the original help asset's literal statushilities spelling. No source correction or additional option identity is inferred.")
            entries.append({"id": original["id"], "whole_message_ja": catalog.escape(authored),
                "argument_schemas": original["argument_schemas"], "source_records": original["source_records"],
                "source_review_status": "faithful-official-source-equivalent",
                "source_translation_approved": True, "localization_disposition": disposition,
                "translation_notes": notes, "runtime_binding_approved": False})
        output = {"schema_version": 1, "category": batch["category"], "batch": number,
                  "input_sha256": hashlib.sha256(raw).hexdigest(), "source_commit": batch["source_commit"],
                  "authorship": {"kind": "authored-official-English-equivalent-Japanese", "date": "2026-10-02", "Japanese_fork_text_imported": False},
                  "entries": entries, "runtime_binding_approved": False}
        target = path.with_name(path.stem + ".authored.json")
        target.write_bytes((json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        results.append({"batch": number, "ids": len(entries), "original_data_lines": sum(entry["localization_disposition"].startswith("preserved-") for entry in entries),
                        "runtime_approved": 0, "sha256": hashlib.sha256(target.read_bytes()).hexdigest()})
    print(json.dumps(results))

if __name__ == "__main__":
    main()
