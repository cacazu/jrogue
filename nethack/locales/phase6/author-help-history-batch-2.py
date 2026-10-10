"""Original help continuation, unchanged controls and native capabilities."""
import hashlib
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Reuse the exact source-evidence preserving writer without executing batch 1.
base = (ROOT / "author-help-history-batch-1.py").read_text(encoding="utf-8")
writer = base[base.index("raw = INPUT.read_bytes()") :]
import json
import re
INPUT = ROOT / "help-history-batch-2.json"
EXPECTED = "26ca5965e03c7f58edff177a270383e2350ed002e67212583fd27289c6204084"
FRAMES = """
1 Du - 未払いの品だけ落とす（店にいる場合）。
2 D%u - 未払いの食べ物だけ落とす。
3 ^D      蹴る（主に扉）。
4 e       食べる。
5 E       床に文字を刻む。
6 E- - 指で埃に書く。
7 f       矢筒から弾を放つ。
8 F       続けて方向を指定し、怪物と戦う（怪物を
9         感知していなくても）。
10 i       所持品を表示する。
11 I       所持品の一部だけ表示する。例えば、
12         I* - 所持している宝石をすべて表示する。
13         Iu - 未払いの品をすべて表示する。
14         Ix - 買い物の請求書に載っている、使い切った品をすべて表示する。
15         I$ - 所持金を数える。
16 o       扉を開ける。
17 O       現在のオプションを確認し、変更する。
18         オプションの設定を示すメニューが表示され、
19         大半はその項目を選ぶだけで変更できる。
20         通常、オプションはゲームの前に、NETHACKOPTIONS
21         環境変数や設定ファイル（defaults.nh、
22         NetHack Defaults、nethack.cnf、~/.nethackrcなど）で設定し、
23         'O'コマンドでは設定しない。
24 p       買い物の請求を支払う。
25 P       装身具を身につける（指輪、護符など）。
26 ^P      最後のメッセージを繰り返す（さらに^Pで、それ以前のメッセージを繰り返す）。
27         この動作はmsg_windowオプションで変えられる。
28 q       薬や水などを飲む。
29 Q       矢筒に入れる弾を選ぶ。
30 #quit   今のゲームを保存せず、プログラムを終了する。
31 r       巻物や魔法書を読む。
32 R       装身具を外す（指輪、護符など）。
33 ^R      画面を描き直す。
34 s       周囲の隠し扉や罠を探す。
35 S       ゲームを保存する。プログラムも終了する。
36         [再開するには、同じキャラクター名でもう一度プレイする。]
37         [「現在のデータを保存して、そのままプレイを続ける」機能はない。]
38 t       品を投げる、または飛び道具を撃つ。
39 T       防具を脱ぐ。
40 ^T      可能なら瞬間移動する。
41 v       バージョン番号を表示する。
42 V       ゲームの歴史を含む、より詳しい
43         バージョンの説明を表示する。
44 w       武器を手にする。w-は何も手にせず、素手を使う。
45 W       防具を着る。
46 x       手にした武器と予備の武器を交換する。
47 X       二刀流の切り替え。
48 ^X      自分の能力を表示する。
49 #explore  探索モード（発見モードともいう）に切り替える。このモードでは、死亡と、
50         再開時の保存ファイルの削除を、どちらも取りやめられる。
51 z       杖を振る（number_padが-1なら、zではなくyを使う）。
52 Z       魔法を唱える（number_padが-1なら、ZではなくYを使う）。
53 ^Z      ゲームを中断する（number_padが-1なら、^Zではなく^Y）。
54         [再開するには、シェルの'fg'コマンドを使う。]
55 :       今いる場所のものを調べる。
56 ;       別の場所のものを調べる。
57 ,       品を拾う。
58 @       pickupオプションを切り替える。
59 ^       以前見つけた罠の種類を調べる。
60 )       手にした武器を調べる。
61 [       着用中の防具を調べる。
62 =       身につけた指輪を調べる。
63 "       身につけた護符を調べる。
64 (       使用中の道具を調べる。
65 *       使用中の装備を調べる。前の五つをまとめたもの。
66 $       金貨を数える。
67 +       覚えた魔法の一覧を表示し、必要なら並べ替える。
68 \\       発見済みの品の種類を表示する。
69 `       一つの品のクラスについて、発見済みの種類を表示する。
70 !       バージョンとOSが対応していれば、シェルを起動する。
71         [プレイを再開するには、シェルの子プロセスを'exit'で終了する。]
72 #       「拡張」コマンドを開始する。"#"で使える
73         コマンドの一覧を見るには、"#?"を入力する。使える拡張
74         コマンドは、ゲームのコンパイル時のオプションや、
75         自分の職業、そしてその時点で最も近い姿をしている
76         怪物の種類による。キーボードにMetaキーがあれば、
77         （ほかのキーと同時に押すと、そのキーの
78         'meta'ビット、つまり8番目の上位ビットを立てるキー）、
79         コマンドの最初の文字にMetaを付けて、
80         これらの拡張コマンドを実行できる。Altキーでも同様のことができる場合がある。
81 "number_pad"オプションが有効なら、いくつかの追加の英字コマンドを
82 使える：
83 h       '?'と同じヘルプメニューを表示する。
84 j       別の場所へ跳ぶ。
85 k       蹴る（主に扉）。
86 l       床の箱から中身を取り出す。
87 n       続けて、次のコマンドを繰り返す回数を指定する。
88 N       怪物、個々の品、または品の種類に名前を付ける。
89 u       品や扉に仕掛けられた罠を外す。
90 コマンドの前に数を付けると、その回数だけ繰り返せる。
91 例えば"40."や"20s"。number_padオプションを設定しているなら、
92 "n40."や"n20s"のように、回数の前に'n'を付ける必要がある。
93 使用する環境に応じて、情報の一部が最下行、または
94 枠の中に表示される。自分の能力、
95 属性、今いる迷宮の階、現在の
96 体力（完全に回復したときの体力も）、
97 防御力（低いほどよい）、経験レベル、
98 腹具合が分かる。オプションに応じて、魔力や
99 所持金など、ほかの情報が表示されることも、されないこともある。
100 楽しんで、よい冒険を！
"""
exec(compile(writer, str(ROOT / "author-help-history-batch-1.py"), "exec"))

# Override batch-1-only commentary inserted by the generic writer.
path = INPUT.with_name(INPUT.stem + ".authored.json")
result = json.loads(path.read_text(encoding="utf-8"))
for number, entry in enumerate(result["entries"], 1):
    entry["translation_notes"] = [note for note in entry["translation_notes"] if "version 3.6" not in note and "direction diagram" not in note]
    if number in (30, 35, 36, 37, 49, 50):
        entry["translation_notes"].append("Original save-and-exit and Explore Mode semantics are retained exactly. The local platform adapter does not change original S/#quit behavior or native file removal policy.")
    if number in (53, 54, 70, 71):
        entry["translation_notes"].append("This original help describes platform-dependent shell/suspend facilities. It does not enable host shell access, execute commands or change browser platform capabilities.")
path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"final_ids": len(result["entries"]), "final_sha256": hashlib.sha256(path.read_bytes()).hexdigest()}))
