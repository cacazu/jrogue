"""Current original command-reference help; immutable command/control syntax."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "help-history-batch-3.json"
EXPECTED = "78473975eada6a7e8d2ed6d270ed737357bb7e93cf9fa0f3a0a452686d233e87"
FRAMES = """
1 y k u   7 8 9   移動コマンド：
2  \\|/     \\|/            yuhjklbn: 指定した方向へ1歩進む
3 h-.-l   4-.-6           YUHJKLBN: 指定した方向へ進み、壁に
4  /|\\     /|\\                        当たるか、何かに出くわすまで続ける
5 b j n   1 2 3           g<dir>:   <dir>の方向へ走り、興味深いものが
6      テンキー                       見えるまで続ける
7 G<dir>,   同じだが、通路の分岐は興味深いものとは
8 <  上                  ^<dir>:     見なさない（ここでの^は、キャレット
9                                    記号ではなくControlキーを表す）
10 >  下                  m<dir>:   品を拾わず、戦わずに移動する
11 F<dir>:   怪物を感知していなくても戦う
12 number_padオプションが設定されていれば、代わりに数字キーで移動する。
13 環境に応じて、Shiftとテンキーの数字、
14 Metaと数字、またはAltと数字でYUHJKLBNコマンドを実行できる。
15 number_padが有効な場合、Control <dir>が使えるかどうかは、
16 その環境の機能による。
17 数字'5'は'G'の接頭辞として働く。ただしnumber_padが2なら、
18 代わりに'g'として働く。
19 number_padが3なら、1,2,3と7,8,9の役割が
20 入れ替わる。4なら、3と2を組み合わせた動作になる。
21 number_padが-1なら、英字の移動コマンドを使うが、
22 'y'と'z'が入れ替わる。
23 一般コマンド：
24 ?     help      情報を提供する文書の一つを表示する
25 #quit quit      今のゲームを保存せずに終了する
26 S     save      後で続けられるようゲームを保存して終了する
27                 [再開するには、同じキャラクター名でもう一度プレイする。
28                 保存せずに終了するには#quitを使う]
29 !     sh        許可されていればシェルを起動する（'exit'でプレイに戻る）
30 ^Z    suspend   ゲームを中断する（現在の中断文字とは独立）
31                 [UNIX(tm)系のシステムでは、'fg'コマンドで再開する]
32 O     options   オプションを設定する
33 /     what-is   地図の記号が何を表すか調べる
34 \\     known     発見済みのものの一覧を表示する
35 |     perminv   主人公と地図ではなく、常設所持品ウィンドウを操作する
36 v     chronicle 重要な出来事の一覧を表示する
37 V     version   バージョン番号を表示する
38 ^A    again     前のコマンドを繰り返す
39 ^R    redraw    画面を描き直す
40 ^P    prevmsg   前のメッセージを繰り返す（続けて^Pで、さらに以前のものを表示する）
41 #               拡張コマンドを開始する（#?で一覧を表示）
42 &     what-does 押したキーが実行するコマンドを説明する
43 制御文字は'^'の後に文字を付けて示す。Ctrlまたは
44 ControlをShiftキーのように押しながら、その文字を入力する。制御文字は
45 大文字小文字を区別しない。^Dは^dと同じで、Ctrl+dはCtrl+Shift+dと同じ。
46 英字以外の制御文字もいくつかある。nethackは^[を
47 Escapeと同じものとして（またはその逆に）使い、^_を#retravelに使うが、ほかは使わない。
48 ゲーム内のコマンド：
49 ^D    kick      蹴る（扉など）
50 ^T    Tport     可能なら瞬間移動する
51 ^X    show      自分の能力を表示する
52 a     apply     道具を使う（つるはし、鍵、カメラなど）
53 A     takeoffall  複数の防具、装身具、武器を選び、
54                 脱ぐ、外す、手から離す（個別にT,R,w-で
55                 外す場合と同じだけゲーム内の時間がかかる）
56 c     close     扉を閉める
57 C     call      怪物、個々の品、または品の種類に名前を付ける
58 d     drop      品を落とす。d7aなら、所持枠'a'の品を7個落とす
59 D     Drop      選んだ種類の品を落とす
60 e     eat       食べる
61 E     engrave   床の埃に文字を書く（E-で指を使う）
62 f     fire      矢筒から弾を放つ
63 F     fight     続けて方向を指定し、怪物と戦う
64 i     invent    所持品（持っている品すべて）を一覧表示する
65 I     Invent    所持品の一部を一覧表示する。例えば、
66                   I(で道具すべて、I"で護符すべてを表示する
67                   IBで祝福されていると分かっている品すべてを表示する
68                   IUで呪われていない品、ICで呪われた品、IXで祝呪不明の品を表示する
69                   Iuは、店内なら所持している未払いの品を表示する
70                   Ixは、店内なら料金と使い切った店の品を表示する
71 o     open      扉を開ける
72 p     pay       店で請求を支払う
73 P     puton     装身具を身につける（指輪、護符など。防具を着ることも
74                 できるが、防具は主な候補として一覧には表示されない）
75 q     quaff     薬や水などを飲む
76 Q     quiver    矢筒に入れる弾を選ぶ（終了には'#quit'を使う）
77 r     read      巻物や魔法書を読む
78 R     remove    装身具を外す（指輪、護符など。防具を脱ぐことも
79                 できる）
80 s     search    隠し扉、隠れた罠、怪物を探す
81 t     throw     武器を投げる、または撃つ
82 T     takeoff   防具を脱ぐ。装身具も外せるが、
83                 装身具は主な候補として一覧には表示されない）
84 w     wield     武器を手にする（w-で何も持たず、今の武器を手から離す）
85 W     wear      防具を着る。装身具を身につけることにも使える
86 x     xchange   手にした武器と予備の武器を交換する
87 X     twoweapon 職業が許すなら、二刀流を切り替える
88 z     zap       杖を振る（number_padが-1なら、zではなくyを使う）
89 Z     Zap       魔法を唱える（number_padが-1なら、ZではなくYを使う）
90 <     up        階段を上る
91 >     down      階段を下りる
92 ^     trap_id   以前見つけた罠を識別する
93 ),[,=,",(       指定した記号の、現在使用中の品を表示する
94 *               ),[,=,",(をすべてまとめて表示する
95 $     gold      金を数える
96 +     spells    覚えた魔法を一覧表示し、必要なら並べ替える
97 `     classkn   一つの品のクラスについて、既知の品を表示する
98 _     travel    最短経路の算法で地図上の地点へ移動する
99 ^_    retravel  以前指定した目的地へ向かう移動を再開する
100 .     rest      少し待つ
"""

raw = INPUT.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECTED
source = json.loads(raw)
frames = {int(line.split(" ", 1)[0]): line.split(" ", 1)[1] for line in FRAMES.splitlines() if line}
assert set(frames) == set(range(1, len(source["entries"]) + 1))
entries = []
for number, original in enumerate(source["entries"], 1):
    prefix = re.match(r"[ \t]*", original["english_named_template"]).group()
    japanese = prefix + frames[number].lstrip(" \t")
    notes = ["Exact original command-reference source line translated, with source indentation, direction diagrams, command letters/names, Control notation, parser options and literal resource percent signs preserved.", "Bind only at original display_file output. No help-driven input, platform capability, time advance, naming query or state/RNG change."]
    if number in (25, 26, 27, 28):
        notes.append("Preserve native S save-and-exit and #quit-without-save semantics. This text neither creates an in-game checkpoint command nor changes restore policy.")
    if number in (29, 30, 31):
        notes.append("Original platform-dependent shell/suspend text remains conditional information; browser host permissions and capabilities are unchanged.")
    if number == 10:
        notes.append("Unlike the older long help line, this exact original m<dir> reference explicitly says both no pickup and no fighting; retain both facts.")
    entries.append({**original, "whole_message_ja": japanese, "source_review_status": "faithful-official-source-equivalent", "translation_notes": notes, "runtime_binding_approved": False})
result = {"schema_version": 1, "input_sha256": EXPECTED, "category": source["category"], "authorship": "Direct official command-reference Japanese with unchanged native ASCII syntax.", "entries": entries, "runtime_binding_approved": False}
output = INPUT.with_name(INPUT.stem + ".authored.json")
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ids": len(entries), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
