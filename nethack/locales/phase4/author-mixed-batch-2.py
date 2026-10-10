"""Source-only whole Japanese frames and public producer contracts (mixed 2)."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INPUT = ROOT / "english-primary-text-or-mixed-batch-2.json"
EXPECTED = "b110dfa9c052906b0efaf46a20499bd4579b04e38138db79feec4d92514d1bd8"
FRAMES = """
1 「おい、その{arg_1:%s}を壊すのはやめろ！」
2 {arg_1:%s}から石を外した。
3 それがあなたの{arg_1:%s}に落ちた！
4 {arg_1:%s}が開いたが、{arg_2:%s}は飲み込まれなかった！
5 {arg_1:%s}が開き、{arg_2:%s}を飲み込んだ！
6 足元の{arg_1:%s}が開き、その中へ落ちた！
7 {arg_1:%s}の上の品々が穴に落ちた！
8 {arg_1:%d}個の品を埋めた。
9 {arg_1:%s}。
10 set_wall_state: {arg_1:%s} @ ({arg_2:%d},{arg_3:%d}) {arg_4:%s}{arg_5:%s}{arg_6:%s}{arg_7:%s}
11 {arg_1:%s} {arg_2:%d};
12 {arg_1:%s}水しぶきの音が聞こえる。
13 岩が{arg_1:%s}音が聞こえる。
14 {arg_1:%s}が下へ転がり落ちる音が聞こえる。
15 {arg_1:%s}が祭壇に{arg_2:%s}。
16 流し台が{arg_1:%s}に変わった！
17 流し台が{arg_1:%s}消えた！
18 身に着けている{arg_2:%s}を{arg_1:%s}ことはできない。
19 腰掛けている{arg_2:%s}を{arg_1:%s}ことはできない。
20 {arg_1:%s}を落とした。
21 {arg_1:%s}即座に消化された！
22 {arg_1:%s}を放した。
23 {arg_1:%s}の中を浮いている。
24 {arg_1:%s}に降りた。
25 {arg_1:%s}を収めることができなかった。
26 {arg_1:%s}を転げ落ちた。
27 {arg_1:%s}
28 {arg_1:%s}が身をよじり、手から抜け出した！
29 {arg_1:%s}が{arg_2:%s}消えた！
30 {arg_1:%s}が身をよじり、{arg_2:%s}から抜け出した！
31 {arg_1:%s}が{arg_2:%s}から逃れた！
32 {arg_1:%s}が消えた。
33 悩みが{arg_1:%s}減ったように感じた。
34 {arg_1:%s}{arg_2:%s}
35 今は{arg_1:%s}のはよい考えに思えない。
36 あなたの{arg_1:%s}がきれいになったように感じる。
37 あなたの{arg_1:%s}はすでにきれいだ。
38 {arg_1:%s}は{arg_2:%s}できる状態ではない。
39 {arg_1:%s}は{arg_2:%s}の今の{arg_3:%s}を使い続けたいようだ。
40 {arg_1:%s}はすでにその名前で呼ばれている。
41 {arg_1:%s}は{arg_2:%s}と呼ばれるのを好まない。
42 この{arg_1:%s}生き物は{arg_2:%s}と呼ばれており、名前を変えられない。
43 {arg_1:%s}は悪口を言われるのを好まない！
44 「私は{arg_1:%s}であって、{arg_2:%s}ではない。」
45 {arg_1:%s}は{arg_2:%s}という名前を受け入れない。
46 {arg_1:%s}にはすでに公表された名前がある。
47 刻んでいるときに、あなたの{arg_1:%s}が滑った。
48 「{arg_1:%s}」と刻んだ。
49 {arg_1:%s}を身に着けていた。
50 今は{arg_1:%s}{arg_2:%s}を身に着けている。
51 動きが{arg_1:%s}遅くなるのを感じた。
52 {arg_1:%s}、とてもきつい。
53 一瞬、{arg_1:%s}。
54 動きが{arg_1:%s}速くなった。
55 輝くことを{arg_1:%s}。
56 輝くことを{arg_1:%s}。
57 あなたの{arg_1:%s}はもう締め付けられていない！
58 {arg_1:%s}。
59 それを脱ぐことはできない{arg_1:%s}。
60 できない。{arg_1:%s}呪われている。
61 すでに{arg_1:%s}を身に着けている{arg_2:%c}
62 そこにはすでに{arg_2:%s}を身に着けているため、{arg_1:%s}を身に着けられない。
63 {arg_1:%s}は体に合わない。
64 自分の{arg_1:%s}を持っている間は、それをできない。
65 あなたの{arg_1:%s}が罠にかかっている！
66 自分の{arg_1:%s}の上から手袋をはめられない。
67 自分の{arg_1:%s}の上からそれを身に着けられない。
68 {arg_1:%s}の上から鎧を着られない。
69 指輪をはめるために自分の{arg_1:%s}を外すことができない。
70 指輪をはめるために、武器を持つ{arg_1:%s}を自由にできない。
71 {arg_1:%s}をかぶるための頭がない。
72 指輪を外すために{arg_1:%s}ことができない。
73 熊の罠のせいで、自分の{arg_1:%s}を引き抜けない。
74 {arg_1:%s}に捕まっており、自分の{arg_2:%s}を引き抜けない。
75 {arg_2:%s}を外すために{arg_1:%s}ことができない。
76 {arg_1:%s}。
77 {arg_1:%s}作業を終えた。
78 {arg_1:%s}作業を続ける。
79 {arg_1:%s}は一瞬ひどく方向感覚を失ったようだ。
80 {arg_1:%s}の引き綱がたるんだ。
81 {arg_1:%s}は{arg_2:%s}ようだ。
82 {arg_1:%s}。
83 {arg_1:%s}はかなり{arg_2:%s}ようだ。
84 {arg_1:%s}は、あなたの{arg_3:%s}をまっすぐ見ることについて{arg_2:%s}。
85 {arg_1:%s}はがつがつ食べ始めた。
86 {arg_1:%s}は餓死した。
87 {arg_1:%s}は空腹で混乱している。
88 {arg_1:%s}のことが心配になった。
89 {arg_1:%s}が少し{arg_2:%s}らしく感じているのを察した。
90 {arg_1:%s}。
91 {arg_1:%s}は打撃によろめいた。
92 あなたの{arg_1:%s}が{arg_2:%s}。
93 {arg_1:%s}を蹴った。
94 「心付けをありがとう、{arg_1:%s}。」
95 くぐもった{arg_1:%s}が聞こえる。
96 {arg_1:%ld}{arg_2:%s}相当の損害を与えた！
97 {arg_1:%s}を蹴った。
98 {arg_1:%s}！
99 {arg_1:%s}を蹴って外した！
100 {arg_1:%s}を蹴った。
101 いくつかの{arg_1:%s}が木から落ちた！
102 {arg_1:%s}が木から落ちた！
103 {arg_1:%s}粘液が排水口から噴き出した！
104 {arg_1:%s}が戻ってきた！
105 {arg_1:%s}を蹴った。
106 自分の{arg_1:%s}を動かせない！
107 {arg_1:%s}が大きなげっぷをした。
108 {arg_1:%ld}{arg_2:%s}相当の商品を持ち去った！
109 {arg_1:%s}が激怒した！
110 「{arg_1:%s}、お前は泥棒だ！」
111 くぐもった{arg_1:%s}が聞こえる。
112 {arg_1:%s}{arg_2:%s}
113 {arg_1:%s}が{arg_3:%s}へ{arg_2:%s}。
114 {arg_1:%s}を投げるには、先に手に構えなければならない。
115 {arg_1:%s}にぶつかった。痛い！
116 {arg_1:%s}にぶつかった。
117 {arg_1:%s}を越えて移動した。
118 {arg_1:%s}が{arg_2:%s}にぶつかった。
119 {arg_1:%s}があなたにぶつかった。
120 {arg_1:%s}はびくともしない！
121 {arg_1:%s}が{arg_2:%s}に当たった。
122 あなたの{arg_1:%s}は身を守れなかった。
123 自分の{arg_1:%s}一面に付いてしまった！
124 あなたの{arg_1:%s}は身を守らない。
125 {arg_1:%s}！
126 投げたときに{arg_1:%s}！
127 体力があまりに乏しく、{arg_1:%s}が手から落ちた。
128 手元に{arg_1:%s}！
129 戻ってくるのに{arg_1:%s}！
130 {arg_1:%s}が{arg_2:%s}をひったくった。
131 {arg_1:%s}が{arg_2:%s}。
132 {arg_1:%s}が{arg_2:%s}を受け止め、落とした。
133 {arg_1:%s}が{arg_2:%s}を受け止めた。
134 「この件での{arg_1:%s}の役目は終わった。」
135 「再び必要になることなど{arg_1:%s}が許すまいが、その場合に備えて我々が守ろう。」
136 {arg_1:%s}が砕ける音が聞こえる！
137 金貨が{arg_1:%s}の中へ消えた。
138 幸い、{arg_1:%s}を身に着けている！
139 金貨が{arg_1:%s}に当たった。
140 自分の{arg_1:%s}の下に何かを感じる。
141 この階層を{arg_1:%s}として覚えている。
142 -{arg_1:%s}versionの追加指定には、-{arg_2:%s}version:copy、:dump、:showだけを使える。
143 enum {arg_1:%s} = {{
144     {arg_1:%s}{arg_3:%*[arg_2]s} = {arg_4:%3d},{arg_5:%s}
145 {arg_1:%s}の脳を食べた！
146 {arg_1:%s}の脳が食べられた！
147 {arg_1:%s}と感じた。
148 {arg_1:%s}でいっぱいだ。
149 {arg_1:%s}の匂いがする。
150 {arg_1:%s}を使って缶を開けようとした。
151 かなり{arg_1:%s}と感じた。
152 世界が回り、{arg_1:%s}が{arg_2:%s}。
153 {arg_1:%s}気分が悪くなった。
154 これで{arg_1:%s}が満たされた！
155 {arg_1:%s}
156 {arg_1:%s} -- コアダンプを出力。
157 身に着けている{arg_1:%s}は食べられない。
158 うげっ、その{arg_1:%s}は錆止めされていた！
159 {arg_1:%s}を吐き出した。
160 {arg_1:%s}には食べ物が必要だ。ひどく必要だ！
161 {arg_1:%s}が、食べることは{arg_2:%s}。
162 それを{arg_1:%s}ことはできない！
163 次のエラーを「{arg_1:%s}」宛て、または「{arg_2:%s}」で報告してください。
164 {arg_1:%s}
165 {arg_1:%s}を放した。
166 {arg_1:%s}があなたを放した。
167 あなたのメダルが{arg_1:%s}！
168 よし、では{arg_1:%s}ことはない。
169 「GO」を通過するな。200{arg_1:%s}を受け取るな。
170 {arg_1:%s}は空だ。
171 {arg_1:%s}には書けない！
172 {arg_1:%s}に刻まれた文字が消えた！
173 この{arg_1:%s}は掘削の杖だ！
174 この{arg_1:%s}は炎の杖だ！
175 この{arg_1:%s}は稲妻の杖だ！
176 書くのに使える自由な{arg_1:%s}がない！
177 {arg_2:%s}で{arg_1:%s}をくすぐった。
178 {arg_1:%s}を使い、祭壇に向かって身振りをした。
179 {arg_1:%s}に小さな汚れを付けるだけだろう。
180 刻まれた文字は今、「{arg_1:%s}」と読める。
181 {arg_1:%s}
182 {arg_1:%s}の一つが鈍くなった。
183 {arg_1:%s}が鈍くなった。
184 「{arg_1:%s}」までしか書けなかった。
185 {arg_1:%s}作業を終えた。
186 {arg_1:%s}レベル{arg_2:%d}。
187 {arg_1:%s}が{arg_2:%s}になった！
188 {arg_1:%s}が少し{arg_2:%s}になった！
189 {arg_1:%s}が{arg_2:%s}に巻き込まれた！
190 {arg_1:%s}は{arg_2:%s}に耐えた！
191 {arg_1:%s}に巻き込まれた！
192 {arg_1:%s}は致命的だ。
193 ばらばらに{arg_1:%s}。
194 {arg_1:%s}。
195 {arg_1:%s}を{arg_2:%s}に名前変更できなかった。
196 {arg_2:%s}を圧縮{arg_1:%s}するためのforkに失敗した。
197 {arg_2:%s}の圧縮{arg_1:%s}処理中の待機に失敗した。{arg_3:%s}。
198 {arg_1:%s}を展開できない
199 zlibのdocompress_fileでエラー：{arg_1:%s}
200 {arg_1:%s}を圧縮できない。
201 zlibのdocompress file uncompressでエラー：{arg_1:%s}
202 {arg_1:%s}を展開できない。
203 {arg_1:%s}は{arg_3:%s}である
204 ファイル{arg_1:%s}を開けない。NetHackは正しくインストールされているか？
205 {arg_1:%s}のfcntlロック解除を待っている。（残り{arg_2:%d}回の再試行。）
206 別のプロセスが{arg_1:%s}を異常な強さでつかんでいる。
207 {arg_1:%s}へのアクセスを待っている。（残り{arg_2:%d}回の再試行。）
208 もしかすると、古い{arg_1:%s}が残っているのでは？
209 ロックするファイル{arg_1:%s}が見つからない！
210 {arg_1:%s}をロックするための書き込み権限がない！
211 ディレクトリの保護により、{arg_1:%s}をロックできない。
212 {arg_1:%s}をロックできない。
213 理由不明で{arg_1:%s}をロックできない（{arg_2:%d}）。
214 {arg_1:%s}のfcntlロックを削除できない。
215 {arg_1:%s}をunlinkできない。
216 {arg_1:%s}へのアクセスが拒否された（{arg_2:%d}）。
217 指定されたwizkitファイル{arg_1:%s}を開けなかった（{arg_2:%d}）。
218 既定のgw.wizkitファイル{arg_1:%s}を開けなかった（{arg_2:%d}）。
219 警告：スコア記録ファイル「{arg_1:%s}」はstream_lf形式ではない
220 警告：スコア記録ファイル「{arg_1:%s}」に書き込めない
"""

# Source-token translations are proposals for the identified original producer;
# they never change an input passed to Tobjnam/otense/an, or replay a predicate.
LITERALS = {
    "": "", "1": "1", "2": "2", "3": "3", "4": "4",
    " sizzling": "じゅうじゅうという", "land": "着地した",
    "momentarily ": "一瞬", "are": "が", "ladder": "梯子", "stairs": "階段",
    "much ": "大いに", "its": "それ", "name": "名前", "title": "肩書き",
    " a bit": "少し", "fit": "ぴったり合った", "vibrate": "震えた",
    " a bit more": "もう少し", "stop": "やめた", "stop flying": "飛ぶのをやめた",
    "They are": "それらは", "It is": "それは", "really chill": "実に落ち着いている",
    "more amiable": "以前より愛想がよい", "approachable": "近付きやすい", "friendly": "友好的な",
    "seems unable": "できないようだ", "refuses": "拒んでいる", "lady": "お嬢さん", "buddy": "相棒",
    "the altar": "祭壇", "the fountain": "泉", "The dish washer": "皿洗い係",
    "fall": "落ちた", "moat": "堀", "pool": "水たまり", "misfire": "不発になった",
    "slip": "滑った", "return": "戻ってきた", "fail": "失敗した", "miss": "外れた",
    "secure from flashbacks": "フラッシュバックの心配がない",
    "less concerned about being harmed by acid": "酸による害を以前ほど心配しなくなった",
    "unusually limber": "いつになく体が柔らかい",
    "less concerned about becoming petrified": "石化を以前ほど心配しなくなった",
    "air elemental souffle": "風の精霊のスフレ", "dehydrated water": "乾燥した水", "very ": "とても",
    "!#?&* elf kibble!": "!#?&* エルフのドライフード！", "Segmentation fault": "セグメンテーション違反",
    "Bus error": "バスエラー", "Yo' mama": "お前の母ちゃん", "Elf": "エルフ",
    "cannot": "できない", "are too full to": "満腹すぎてできない",
    "begins to glow": "光り始めた", "feels warm": "温かく感じる", "choke": "喉を詰まらせる",
    "die": "死ぬ", "break": "壊れた", "crumble": "崩れ去った", "un": "解除", "an": "", "a": "",
}

def token_role(expression, offset):
    """Conservative original helper-input classification; no native binding."""
    stack = []
    quoted = None
    escaped = False
    for position, char in enumerate(expression[:offset]):
        if quoted:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quoted:
                quoted = None
            continue
        if char in "\"'":
            quoted = char
        elif char == "(":
            found = re.search(r"([A-Za-z_]\w*)\s*$", expression[:position])
            stack.append(found.group(1) if found else None)
        elif char == ")" and stack:
            stack.pop()
    return "producer-input-literal" if any(stack) else "selected-output-literal"

def main(*, newline_suffix=(142,), newline_both=(203,), grammar_omissions=(8, 203),
         technical=(143, 144), compound=(52, 53, 55, 56, 82, 125, 126, 128, 129, 193, 194),
         hallucination=(147, 148, 156), decompression=(196, 197),
         helper_overrides=None, extra_notes=None):
    raw = INPUT.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED
    source = json.loads(raw)
    frames = {}
    for line in FRAMES.splitlines():
        if line:
            number, text = line.split(" ", 1)
            assert int(number) not in frames
            frames[int(number)] = text
    assert set(frames) == set(range(1, len(source["entries"]) + 1))
    entries = []
    for number, original in enumerate(source["entries"], 1):
        japanese = frames[number]
        if number in newline_suffix or number in newline_both:
            japanese += "\n"
        if number in newline_both:
            japanese = "\n" + japanese
        variants = {}
        for variant in original["required_helper_variants"]:
            if variant == "dream":
                variants[variant] = japanese.rstrip("。！") + "という夢を見ている。"
            elif variant == "underwater":
                assert "聞こえる" in japanese
                variants[variant] = japanese.replace("聞こえる", "かろうじて聞こえる")
            else:
                raise AssertionError((number, variant))
        if helper_overrides and number in helper_overrides:
            variants = helper_overrides[number]
            assert set(variants) == set(original["required_helper_variants"])
        records, producers = [], []
        for site in original["official_source_contracts"]:
            for argument in site["arguments"]:
                expression = argument["source_expression"]
                roles = []
                for candidate in argument["source_literal_candidates"]:
                    english = candidate["english_literal"]
                    assert english in LITERALS, (number, english)
                    role = token_role(expression, candidate["start"])
                    roles.append(role)
                    records.append({
                        "message_id": original["id"], "argument_name": argument["id_candidate"],
                        "source": site["source"], "line": site["line"], "blob_sha256": site["blob_sha256"],
                        "source_expression": expression, "source_literal_ordinal": candidate["ordinal"],
                        "english_source_literal": english, "source_expression_literal_start": candidate["start"],
                        "source_expression_literal_end": candidate["end"],
                        "original_quoted_token": expression[candidate["start"]:candidate["end"]],
                        "japanese": LITERALS[english], "literal_role": role,
                        "runtime_binding_approved": False,
                        "binding_constraint": (
                            "Keep original helper input unchanged. The completed original public grammar/name result, including original conjugation, modifiers and uncertainty, needs its own native descriptor; this lemma is not the returned phrase."
                            if role == "producer-input-literal" else
                            "Only the original selected terminal literal issues its descriptor. Do not re-evaluate branch predicates, RNG or names, and do not match completed English. Japanese grammar realization is context-specific to this whole frame."
                        ),
                    })
                schema = next(item for item in original["typed_arguments"] if item["name"] == argument["id_candidate"])
                if schema["type"] == "text":
                    producers.append({
                        "argument_name": argument["id_candidate"], "source": site["source"], "line": site["line"],
                        "source_expression": expression, "original_type": "text", "source_literal_roles": roles,
                        "required_contract": "Capture only the original consumed completed public result once. Bind original selected literals or the already exposed name/appearance/tense/article/possessive/quantity/BUC/modifier/hallucination composition without any new name, knowledge, state or RNG call. Unknown, clipped, unsupported, overwritten or uncertified producer returns the complete exact original English message.",
                        "japanese_rendering_requirement": "Realize the whole authored Japanese clause at this frame's grammatical position, including the original uncertainty, tense, ownership and all visible modifiers. An input lemma cannot stand in for a composed public phrase.",
                        "runtime_binding_approved": False,
                    })
        omitted = []
        if number in grammar_omissions:
            omitted = [{"argument": "arg_2", "reason": "Japanese has no English plural -s suffix or a/an article; retain the full original consumed argument union and original native evaluation."}]
        notes = [
            "Whole Japanese is authored directly from the exact official English frame. Original C argument union, flags, widths, precision, signedness, source conditionals and helper order remain unchanged.",
            "Source authoring only: no native producer binding, compiled runtime change or full Japanese coverage claim. User-entered names/engraving/technical identifiers are literal public values, never translated by lookup.",
            "Each source token is identified by exact official expression, ordinal, offset and quoted bytes. Helper inputs remain original English; only a proven completed producer may compose Japanese."
        ]
        if number in technical:
            notes.append("This is language-independent generated C enum syntax. Exact braces, four-space indentation, named dynamic width, numeric alignment and separators remain original.")
        if number in compound:
            notes.append("Tobjnam contains both the visible object name and the original inflected predicate; Japanese needs that completed compound producer once, not a raw translated verb token or a second naming call.")
        if number in hallucination:
            notes.append("Original hallucination/random joke selection is preserved. The interface neither reveals real resisted properties nor draws RNG for translation.")
        if number in decompression:
            notes.append("The original selected un/empty prefix denotes decompression/compression. Proposed 解除/empty composes 圧縮解除/圧縮 in this whole frame; original fork/wait/file operations and diagnostic facts are unchanged.")
        if extra_notes and number in extra_notes:
            notes.extend(extra_notes[number])
        entries.append({
            "id": original["id"], "whole_message_ja": japanese,
            "original_api": original["original_api"], "original_english_literal": original["original_english_literal"],
            "english_whole_named_template": original["english_whole_named_template"],
            "source_translation_review_status": "requires-source-producer-contract",
            "source_translation_approved": True, "source_argument_schema": original["typed_arguments"],
            "argument_schemas": original["required_argument_union"], "printf_conversions": original["printf_conversions"],
            "omitted_grammar_arguments": omitted, "required_helper_variants": original["required_helper_variants"],
            "helper_variant_templates_ja": variants, "required_source_literal_translations": records,
            "requires_public_name_or_grammar_producer": bool(producers),
            "required_public_name_or_grammar_producers": producers,
            "official_sites_reviewed": original["official_source_contracts"], "translation_notes": notes,
            "source_capture_constraints": ["Only exact original consumed public fields are captured. English printf precision, helper suppression and source-selected window owner stay unchanged; never serialize unused or hidden data.", "Rendering and locale replay are pure: no native state, RNG, name, history, sound or input operations."],
            "runtime_binding_approved": False, "runtime_integration": False,
        })
        if not original["english_whole_named_template"].strip():
            assert not japanese.strip()
            entries[-1]["structural_spacer"] = True
    result = {"schema_version": 1, "category": source["category"], "batch": source["batch"],
              "source_batch_sha256": EXPECTED, "provenance": source["provenance"],
              "authorship": "Direct whole-message official-source Japanese authoring with explicit unbound public producer contracts.",
              "entries": entries, "runtime_binding_approved": False, "runtime_integration": False}
    output = ROOT / source["output_fragment_path"]
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ids": len(entries), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))

if __name__ == "__main__":
    main()
