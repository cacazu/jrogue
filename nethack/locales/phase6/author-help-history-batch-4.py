"""Exact original Meta-command reference and historical credited prose."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "help-history-batch-4.json"
EXPECTED = "b259775dc575d328f4548650b9250713e228d286ddc18035473c0c50c59e3b53"
FRAMES = """
1 ,     pickup    持てるだけ拾う
2 @               "pickup"（自動拾得）オプションを切り替える
3 :     look      今いる場所のものを調べる
4 ;     farlook   地図上の場所を選び、別の場所のものを調べる
5                 （品の上に怪物がいるなら、その怪物だけを説明する。
6                 品の山なら、一番上の品だけを説明する）
7 Metaキーのあるキーボード（Altを使うものもある。Altを
8 Shiftのように使って'e'を押すと'M-e'になる）では、これらの拡張コマンドを、
9 #の接頭辞の代わりにMeta修飾キーで実行することもできる。制御文字と
10 違い、Meta文字は大文字小文字を区別する。M-aとM-Aは異なる。
11 後者はMeta+Shift+aのように、二つの修飾キーを使って入力する。
12 M-?             対応する環境なら、拡張コマンドの説明を表示する
13 M-2   twoweapon 二刀流を切り替える（number_padが有効でない場合）
14 M-a   adjust    所持品の文字を調整する
15 M-A   annotate  今いる迷宮の階に1行の注記を付ける（M-Oを参照）
16 M-c   chat      誰かと話す
17 M-C   conduct   任意の挑戦を確認する
18 M-d   dip       品を何かに浸す
19 M-e   enhance   武器と魔法の技能を表示し、条件を満たしていれば向上させる
20 M-f   force     錠をこじ開ける
21 M-g   genocided 虐殺した、または絶滅した怪物の種類があれば一覧表示する
22 M-i   invoke    品の特殊な力を発動する
23 M-j   jump      別の場所へ跳ぶ
24 M-l   loot      床の箱から中身を取り出す
25 M-m   monster   変身中なら、その怪物の特殊能力を使う
26 M-n   name      怪物、個々の品、または品の種類に名前を付ける
27 M-N   name      M-nと同じ（どちらもCと同じ）
28 M-o   offer     神々に生贄を捧げる
29 M-O   overview  訪れた階の情報と注記を表示する
30 M-p   pray      神々に助けを祈る
31 M-q   quit      ゲームを保存せずにやめる（保存して終了するにはSを使う）
32 M-r   rub       ランプや石をこする
33 M-R   ride      鞍を付けた乗り物に乗る、または降りる
34 M-s   sit       座る
35 M-t   turn      職業が許すなら、アンデッドを退散させる
36 M-T   tip       容器をひっくり返して、中身を出す
37 M-u   untrap    罠を外す
38 M-V   vanquished 倒した怪物の数と種類を一覧表示する
39 M-v   version   この版のコンパイル時オプションを表示する
40 M-w   wipe      顔をぬぐう
41 M-X   explore   通常のプレイから、得点の付かない探索モードに切り替える
42 'number_pad'オプションが有効なら、普段は移動に使うキーを
43 様々なコマンドに使える：
44 n               続けて、次のコマンドを繰り返す回数を指定する
45 h     help      '?'と同様、情報を提供する文書の一つを表示する
46 j     jump      別の場所へ跳ぶ
47 k     kick      蹴る（主に扉）
48 l     loot      床の箱から中身を取り出す
49 N     name      個々の品や品の種類に名前を付ける
50 u     untrap    罠を外す（主に罠が仕掛けられた品）
51 デバッグモード（ウィザードモードともいう）では、追加のコマンドを使える。
52 リリース5.0のNetHack歴史ファイル
53 見よ、人の子よ。これがNetHackの起源である…
54 Jay Fenlasonが、Kenny Woodland、Mike Thome、
55 Jon Payneの助けを得て、最初のHackを書いた。
56 Andries BrouwerはStichting Mathematisch Centrum
57 （現在のCentrum Wiskunde & Informatica）で大規模な書き直しを行い、Hackを大きく異なる
58 ゲームに変えた。UNIX(tm)システムで使えるHackのソースコードを、
59 Usenetのnet.sourcesニュースグループ（後のcomp.sources）に投稿して公開した。
60 1984年12月にバージョン1.0、その後1.0.1、1.0.2を公開し、
61 1985年7月に1.0.3を公開した。議論のためにUsenetのnet.games.hack
62 （後のrec.games.hack、最終的にはrec.games.roguelike.nethackに置き換えられた）
63 ニュースグループが作られた。
64 Don G. KnellerはHack 1.0.3をMicrosoft(tm) CとMS-DOS(tm)に移植し、
65 PC HACK 1.01eを作った。1.03gではDEC Rainbowのグラフィックスに対応し、
66 さらに少なくとも四つの版（3.0、3.2、3.51、3.6）を作った。
67 これらは古いHackのバージョン番号であり、現在のNetHackの番号ではない。
68 R. BlackはPC HACK 3.51をLattice(tm) CとAtari 520/1040STに移植し、
69 ST Hack 1.03を作った。
70 Mike Stephensonは、追加された多くの機能を取り込みながら、
71 これらの様々な版を再び統合し、1987年にNetHack 1.4を作った。その後、
72 大勢の人々によるNetHack 1.4の拡張とデバッグをまとめ、
73 NetHack 2.2と2.3を公開した。Hackと同様、ソースコードを
74 Usenetに投稿して公開し、ニュースグループから期限切れで消えた後も、
75 ftpとuucpで利用できる様々なアーカイブに残った。
76 その後Mikeは、ゲームの大規模な書き直しをまとめた。チームには
77 Ken Arromdee、Jean-Christophe Collet、Steve Creps、Eric Hendrickson、
78 Izchak Miller、Eric S. Raymond、John Rupley、Mike Threepoint、Janet Walzが参加し、
79 NetHack 3.0cを作った。
80 NetHack 3.0はEric R. SmithがAtariへ、Timo HakulinenがOS/2へ、
81 David GentzelがVMSへ移植した。この三人とKevin Darcyは、
82 その後NetHackの主要開発チームに加わり、3.0の
83 後続の改訂版を作った。
84 Olaf SeibertはNetHack 2.3と3.0をAmigaへ移植した。Norm Meluch、Stephen
85 Spackman、Pierre MartineauはPC NetHack 3.0のオーバーレイコードを設計した。
86 Johnny LeeはNetHack 3.0をMacintoshへ移植した。彼らはほかの様々な
87 迷宮の探検者たちと共に、3.0の後続の改訂を通じて、PC、Macintosh、
88 Amigaへの移植を拡張し続けた。
89 バージョン3.0は、比較的短い間隔で公開された十回の「パッチレベル」
90 改訂を経た。当時の基本版は3.0と呼ばれ、改訂版は、
91 3.0.0と3.0.1から3.0.10ではなく、"3.0a"から"3.0j"、
92 "3.0 patchlevel 1"から"3.0 patchlevel 10"、または"3.0pl1"から"3.0pl10"などと
93 呼ばれた。三つの要素からなる番号体系が使われ始めたのは、
94 3.1.0からである。
95 Mike Stephensonが率い、Izchak MillerとJanet Walzがまとめた
96 NetHack開発チームは、Ken Arromdee、David Cohrs、
97 Jean-Christophe Collet、Kevin Darcy、Matt Day、Timo Hakulinen、Steve Linhart、
98 Dean Luick、Pat Rankin、Eric Raymond、Eric Smithを含むものとなり、3.0の
99 抜本的な改訂に取り組んだ。ゲームの設計を再構成し、
100 コードの主要な部分を書き直した。複数のダンジョン、新しい画面表示、特別な
"""

raw = INPUT.read_bytes()
assert hashlib.sha256(raw).hexdigest() == EXPECTED
source = json.loads(raw)
frames = {int(line.split(" ", 1)[0]): line.split(" ", 1)[1] for line in FRAMES.splitlines() if line}
assert set(frames) == set(range(1, len(source["entries"]) + 1))
entries = []
for number, original in enumerate(source["entries"], 1):
    prefix = re.match(r"[ \t]*", original["english_named_template"]).group()
    notes = ["Translated from the exact pinned official source line; full original source records and typed union retained. Bind only at original selected display_file output, with no new native input, state or RNG action."]
    if number <= 51:
        notes.append("Keep original Meta/Shift key syntax, case-sensitive command names, number_pad options, source indentation and visible-information limits. No new debug or host-shell permission is enabled.")
    else:
        notes.append("Original historical contributor names, organizations, dates, version numbers, Usenet group names, trademark notations, and publication/port relationships are preserved. Japanese is a translation of this historical source, not a revised current history.")
    if number in (4, 5, 6):
        notes.append("Preserve original top-monster/top-object farlook limits; translation reveals no covered object or hidden pile contents.")
    entries.append({**original, "whole_message_ja": prefix + frames[number].lstrip(" \t"), "source_review_status": "faithful-official-source-equivalent", "translation_notes": notes, "runtime_binding_approved": False})
result = {"schema_version": 1, "input_sha256": EXPECTED, "category": source["category"], "authorship": "Direct Japanese original Meta-command help and historical credits.", "entries": entries, "runtime_binding_approved": False}
output = INPUT.with_name(INPUT.stem + ".authored.json")
output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"ids": len(entries), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
