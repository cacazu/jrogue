#!/usr/bin/env python3
"""Official-equivalent frames; native/public producers remain unapproved."""
import hashlib
import json
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OFFICIAL=ROOT.parent/"official-source-audit/NetHack-5.0.0"

# None is an explicit language-neutral envelope or generated C syntax, not
# an invented translation of its dynamic contents. Every such field carries
# a pending source-producer contract and remains runtime-unapproved.
TEMPLATES=[
 "警告：記録「{arg_1:%s}」を書き込めない",
 None,
 "\n{arg_1:%s}\n{arg_2:%s}\n",
 "\n{arg_2:%s}{arg_1:%s}{arg_3:%s}\n",
 "\n{arg_1:%s}の読み込みでエラーが発生した。復旧できない。\n",
 "\nセーブファイル {arg_1:%s} を復旧できない。\n",
 None,
 "\n{arg_1:%s}の書き込みでエラーが発生し、復旧に失敗した（{arg_2:%s}）。\n",
 "    [{arg_1:%-10s}]=\"{arg_2:%s}\"",
 None,
 "注意：上記の {arg_1:%s} が見つからないか、アクセスできない！",
 "読み込み可能なシンボルファイル{arg_1:%s}：",
 None,
 "基本データファイル{arg_1:%s}は、次の場所にまとめられている：",
 "基本データファイル{arg_1:%s}は、多数の個別ファイルに分かれている。",
 "ゲーム終了時の情報開示ファイルがない（{arg_1:%s}）。",
 "あなたの個人設定ファイル{arg_1:%s}：",
 "「{arg_2:%s}」の{arg_1:%s}だ！",
 "「{arg_2:%s}」の{arg_1:%s}のようだ！",
 "{arg_1:%s}がシューッと鳴くのが聞こえた！",
 "{arg_1:%s}を解き放った！",
 "{arg_1:%s}を引き寄せた！",
 "{arg_1:%s}が叫んだ：",
 "近くの{arg_1:%s}農場から流れ込んだものかもしれない。",
 "{arg_1:%s}には何の味もない。",
 "{arg_1:%s}が一瞬輝いた。",
 "奇妙なピリピリする感覚が、あなたの{arg_1:%s}を伝わった。",
 "{arg_3:%s}で、あなたの{arg_1:%s}{arg_2:%s}を洗った。",
 "あなたの{arg_1:%s}はもう滑りやすくない。",
 "とても冷たい{arg_1:%s}を一口飲んだ。",
 "とても温かい{arg_1:%s}を一口飲んだ。",
 "やけどするほど熱い{arg_1:%s}を一口飲んだ。",
 "汚れた{arg_1:%s}が排水口で逆流した。",
 "{arg_1:%s}が、まるで自分の意志で動いているようだ！",
 "うえっ、この{arg_1:%s}はひどい味だ。",
 "この{arg_1:%s}には有毒な廃棄物が含まれている！",
 "あなたの{arg_1:%s}はまだ滑りやすい。",
 "{arg_1:%s}を蛇口の下にかざした。",
 "{arg_2:%s}{arg_1:%s}を排水口に流した。",
 "カーソルを{arg_1:%s}に移動してください：",
 None,
 "不明な方向：「{arg_1:%s}」（{arg_2:%s}）。",
 None,
 "{arg_1:%s}が{arg_2:%s}を動かした。",
 "{arg_1:%s}が{arg_2:%s}を押すと、突然それが消えた！",
 "ここにある岩を{arg_1:%s}越えた。",
 "体を縮めて、岩の{arg_1:%s}。",
 "ドボン！　もう{arg_1:%s}を感じなくなった。",
 "{arg_1:%s}、あなたから離れていった！",
 "{arg_1:%s}が行く手をふさいでいる。",
 "{arg_1:%s}は{arg_2:%s}。",
 "あなたは{arg_1:%s}。",
 "{arg_1:%s}が蜘蛛の巣から抜け出した。",
 "あなたは{arg_2:%s}{arg_1:%s}。",
 "{arg_2:%s}を{arg_1:%s}。",
 "（ヒント：本当に入りたいなら、'{arg_1:%s}' 接頭キーを使って踏み込めます。）",
 "{arg_2:%s}に{arg_1:%s}のを避けた。",
 "失礼、{arg_1:%s}。",
 "{arg_1:%s}が蜘蛛の巣を{arg_2:%s}！",
 "{arg_1:%s}{arg_2:%s}{arg_3:%s}では蜘蛛の巣を切れない！",
 "糸の一部に向かって{arg_1:%s}が、効果はない。",
 "蜘蛛の巣を{arg_1:%s}抜けた。",
 "立ち止まった。{arg_1:%s}は斜めに移動できない。",
 "立ち止まった。{arg_1:%s}はそこを通り抜けられない。",
 "立ち止まった。{arg_1:%s}は{arg_2:%s}{arg_3:%s}から出られない。",
 "立ち止まった。{arg_1:%s}は場所を交換したくないようだ。",
 "{arg_1:%s}を放した。",
 "{arg_1:%s}から逃れることはできない！",
 "{arg_1:%s}から振りほどいて離れた。",
 "{arg_1:%s}があなたと場所を入れ替えた……",
 "{arg_1:%s}に奇妙な振動を感じる。",
 "コルクのように{arg_1:%s}から飛び出した！",
 "{arg_1:%s}から飛び出した。",
 None,
 "その一撃は、あなたの{arg_1:%s}に当たってはじかれた。",
 "{arg_1:%s}を驚かせた！",
 "{arg_1:%s}が不意打ちしてきた！",
 "「ここはデルフォイだよ、{arg_1:%s}。」",
 "{arg_1:%s}の舌を拾い上げた。",
 "底を見ることさえできないのだから、{arg_1:%s}を拾うどころではない。",
 "重さは{arg_1:%s}一トンもありそうだ！",
 "{arg_1:%s}を飲むことならできそうだ……",
 None,
 "{arg_1:%s}は今にも死にそうだ。",
 None,
 "{arg_1:%s}虐殺された生物はいない。",
 "{arg_2:%s}ためのものを{arg_1:%s}持っていない。",
 "金貨を{arg_1:%s}ことはできない。",
 "{arg_1:%s}。",
 "{arg_1:%s}ものを持っていない。",
 "'{arg_1:%s}' は常時インベントリ表示に対応していない。",
 None,
 None,
 "{arg_1:%s}物が{arg_2:%s}ない。",
 "ここには{arg_1:%s}物がある。",
 "ここで{arg_2:%s}を{arg_1:%s}。",
 "{arg_1:%s}に触れるのは致命的な間違いだ……",
 None,
 "合計で{arg_1:%ld}{arg_2:%s}を持ち歩いている。",
 "あなたは{arg_1:%s}。",
 "鎧は着ていないが、{arg_1:%s}が皮膚に埋め込まれている。",
 "{arg_1:%s}、少なくとも1でなければならない。",
 "{arg_1:%s}、{arg_2:%ld}未満でなければならない。",
 "{arg_1:%s}を有効にできなかった。",
 "{arg_1:%s}には少なくとも{arg_2:%d}x{arg_3:%d}の端末が必要だが、現在の端末は{arg_4:%d}x{arg_5:%d}だ。",
 "{arg_1:%s}のを諦めた。",
 "{arg_1:%s}のをやめた。",
 "{arg_1:%s}ことに成功した。",
 "実際、{arg_1:%s}を完全に壊してしまった。",
 "壊した品物の代金として{arg_1:%ld}{arg_2:%s}を支払う必要がある。",
 "{arg_1:%s}のを再開した。",
 "{arg_1:%s}を持てない。手がないのだ！",
 "それをすると、たぶん{arg_1:%s}が溶けるだろう。",
 "{arg_1:%s}には錠がない。",
 "この高さからでは{arg_1:%s}に手が届かない。",
 "跳ね橋に錠がないと{arg_1:%s}。",
 "そこには扉がないと{arg_1:%s}。",
 "{arg_1:%s}を隙間に押し込んで、こじ開けようとした。",
 "{arg_1:%s}で叩き始めた。",
 "そこには扉がないと{arg_1:%s}。",
 "この扉は{arg_1:%s}。",
 "{arg_1:%s}が邪魔だ。",
 "そこには扉がないと{arg_1:%s}。",
 "古く、より原始的な出入口に{arg_1:%s}が巻き起こった。",
 "その雲は{arg_1:%s}。",
 "{arg_1:%s}が{arg_2:%s}！",
 "MAIL=\"{arg_1:%s}\" の状態を取得できない。",
 None,
 "「{arg_1:%s}、{arg_2:%s}！　{arg_3:%s}。」",
 "伝言：{arg_1:%s}。",
 "聞け！　「{arg_1:%s}。」",
 None,
 "MAIL=\"{arg_1:%s}\" の状態をもう取得できない。",
 "「{arg_1:%s}」{arg_2:%s}",
 "{arg_1:%s}が{arg_2:%s}{arg_4:%s}{arg_3:%s}{arg_5:%c}",
 None,
 "{arg_1:%s}の周りで空気がパチパチと鳴った。",
 "{arg_1:%s}の具合がよくなったようだ。",
 "まずい、{arg_1:%s}が死の接触を使っている！",
 "「私のペット{arg_1:%s}よ、泥棒を滅ぼせ！」",
 "あなたの{arg_1:%s}が少し痛む。",
 "あなたの{arg_1:%s}が突然ひどく痛んだ！",
 "あなたの{arg_1:%s}が突然とてもひどく痛んだ！",
 "誰かが{arg_1:%s}を召喚しているのが聞こえた。",
 "{arg_1:%s}が{arg_2:%s}。",
 "{arg_1:%s}と感じる！",
 "{arg_1:%s}混乱していると感じる！",
 "{arg_1:%s}が、{arg_3:%s}行く手から{arg_2:%s}をどかそうとした。",
 "{arg_1:%.99s}の{arg_2:%s}試みは、{arg_4:%.99s}を{arg_3:%s}！",
 "{arg_2:%s}に{arg_1:%s}。",
 "{arg_1:%s}が石に変えられた！",
 "それは{arg_1:%s}に変わった。",
 "{arg_1:%s}が石になった！",
 "{arg_1:%s}が身震いした！",
 "{arg_1:%s}{arg_2:%s}{arg_3:%s}{arg_4:%s}に変わった。",
 "{arg_1:%s}{arg_2:%s}{arg_3:%s}。",
 "{arg_1:%s}のつかむ力が緩んだ。",
 "{arg_1:%s}が{arg_2:%s}によって動けなくなった。",
 "{arg_1:%s}は少し寒そうだ。",
 "{arg_1:%s}は少し温められた。",
 "{arg_1:%s}は突然とても熱くなった！",
 "{arg_1:%s}は少しピリピリした。",
 "{arg_1:%s}はだるそうだ。",
 "{arg_1:%s}が{arg_3:%s}{arg_2:%s}{arg_4:%s}",
 "{arg_1:%s}がやみくもに{arg_2:%s}が、外れた！",
 "{arg_1:%s}があなたの横の場所を攻撃した。",
 "{arg_1:%s}がやみくもに{arg_2:%s}！",
 "{arg_1:%s}が体を広げ、あなたは解放された！",
 "{arg_2:%s}{arg_1:%s}から吐き出された！",
 "{arg_1:%s}から落ちた！",
 "あなたが落ちると、{arg_1:%s}は身を引いた！",
 "{arg_1:%s}に、落下するピアサー（あなた）が当たった！",
 "{arg_1:%s}に、落下するピアサー（あなた）がもう少しで当たるところだった！",
 "{arg_1:%s}がつかむ力を少し緩めた。",
 "{arg_1:%s}があなたを攻撃し始めたが、身を引いた。",
 "近くで{arg_1:%s}が動くのを感じる。",
 "{arg_1:%s}が空気を大きく吸い込んだ！",
 "{arg_1:%s}があなたを完全に消化した！",
 "どうやら{arg_1:%s}はあなたの味が気に入らないようだ。",
 "{arg_1:%s}。",
 "{arg_1:%s}が石に変えられた！",
 "{arg_1:%s}の視線と目が合った。",
 "{arg_1:%s}があなたを鋭く見つめた！",
 "{arg_1:%s}の輝きで目が見えなくなった！",
 "{arg_1:%s}に強く惹かれる。",
 "「ならば、{arg_1:%s}{arg_2:%s}を私に弁償してもらうぞ！」",
 "{arg_1:%s}がため息をついたようだ。",
 "{arg_1:%s}はあなたよりも楽しんだようだ……",
 "あなたは{arg_1:%s}よりも楽しんだようだ……",
 "{arg_1:%s}のことは、いつまでも忘れないだろう……",
 "{arg_1:%s}があなたの{arg_2:%s}を脱がせた。",
 "{arg_1:%s}が死んだ！",
 "{arg_1:%s}には影響がない。",
 "{arg_1:%s}が石になった！",
 "目の見えない{arg_1:%s}の姿では、自分を守ることができない。",
 "{arg_1:%s}があなたによって動けなくなった。",
 "{arg_1:%s}は少し寒そうだ。",
 "{arg_1:%s}は突然とても冷たくなった！",
 "{arg_1:%s}が一瞬、困惑した様子になった。",
 "{arg_1:%s}の声が轟いた：",
 "{arg_1:%s}があなたの前に現れた。",
 "{arg_1:%s}はとても怒っているようだ。",
 "{arg_1:%s}があなたの前に現れた。",
 "{arg_1:%s}が何かを言った。",
 "{arg_1:%s}は何かを要求しているようだ。",
 "{arg_1:%s}は臆病な人間たちを笑いながら消えた。",
 "{arg_1:%s}はあなたを威嚇するようににらみ、それから消えた。",
 "{arg_1:%s}が怒り出した……",
 "{arg_1:%s}への支払いをごまかそうとしたが、手が滑った。",
 "{arg_1:%s}に持っている金貨をすべて渡した。",
 "{arg_1:%s}に{arg_2:%ld}{arg_3:%s}を渡した。",
 "{arg_1:%s}があなたを叱り、こう言った：",
 "{arg_1:%s}が消えた！",
 "{arg_1:%s}が{arg_2:%s}。",
 "{arg_1:%s}は{arg_3:%s}軽く{arg_2:%s}。",
 "{arg_1:%s}が消えていった。",
 "{arg_1:%s}が外へ{arg_2:%s}。",
 "{arg_1:%s}が錆びた。",
 "{arg_1:%s}が少し燃えた。",
 "{arg_1:%s}が溺れた。",
]

LEAVES={
 2:{"Checkpoint data incompletely written":"チェックポイントのデータが完全に書き込まれなかった", " or subsequently clobbered.":"か、その後上書きで壊された。", "Recovery impossible.":"復旧不能。"},
 3:{"Checkpointing was not in effect for":"ではチェックポイント保存が有効になっていなかった", "-- recovery impossible.":"。復旧不能。"},
 8:{"not set":"未設定"},
 24:{"water":"水"},25:{"water":"水"},27:{"gloved ":"手袋をはめた", "":"", "water":"水"},
 29:{"water":"水"},30:{"water":"水"},31:{"water":"水"},32:{"water":"水"},33:{"water":"水"},34:{"water":"水"},35:{"water":"水"},
 38:{"one of ":"の一つ", "":""},
 45:{"step":"歩いて"},46:{"over":"上を越えた", "against":"そばに押し付けた"},
 48:{"suddenly roll":"突然転がり"},
 54:{"see":"見た", "notice":"気づいた", "peaceful":"平和な"},
 56:{"step":"踏み込む"},
 58:{"cuts":"切った", "burns":"焼き切った"},59:{" or ":"や", "":""},
 60:{"hack":"切りつけた", "thrash":"暴れた"},61:{"cut":"切って", "punch":"殴って"},
 71:{"water":"水"},72:{"water":"水"},
 80:{" almost":"ほぼ", "":""},81:{"water":"水"},
 85:{" yet":"まだ", "":""},86:{"else ":"ほかに", "":""},91:{" ":" ", "":""},
 94:{"another":"別の", "an":"一つの"},
 113:{"water":"水"},115:{"feel":"手探りでわかった", "see":"見て取った"},116:{"feel":"手探りでわかった", "see":"見て取った"},119:{"feel":"手探りでわかった", "see":"見て取った"},122:{"feel":"手探りでわかった", "see":"見て取った"},
 134:{" suddenly":"突然", "":"", "appear":"現れた", " next to you":"あなたの隣に", " close by":"近くに"},
 135:{"(G_NOGEN | G_UNIQ)":"(G_NOGEN | G_UNIQ)", "(G_NOGEN)":"(G_NOGEN)", "(G_UNIQ)":"(G_UNIQ)", "":""},
 144:{"appear":"現れた"},145:{"trippier":"もっと幻覚的な気分になった", "trippy":"幻覚的な気分になった"},146:{"more ":"さらに", "":""},
 147:{"the":""},148:{"passes right through":"そのまますり抜けた", "fails to hold":"つかまえられなかった"},
 154:{" and":"、そして", "":""},155:{" and disappears":"、そして姿を消した", "":""},
 179:{"are freaked out":"ぞっとした", "seem unaffected":"影響はないようだ"},
 185:{"twelve pairs of gloves":"手袋を十二組", " and eleven more pairs of gloves":"と、さらに手袋を十一組", "":""},
 213:{"dissolves completely":"完全に溶けた", "shrinks":"小さくなった"},
 214:{"becomes":"なった", "seems":"なったようだ", " slightly":"少し", "":""},
 216:{"spill":"こぼれた"},
}

SPECIAL={
 2:"Adjacent C string tokens are one native string, not independent branches. Capture the original concatenated const-expression identity; token translations compose only at that source, never by splitting rendered English.",
 3:"Three original fields form a diagnostic sentence around the raw lock-file path. The native path stays literal, and source-selected constant phrase parts use their actual call origin.",
 11:"buf is the original file-path/config description suffix; retain its existing parentheses and source condition. Never reread environment variables during rendering.",
 13:"buf is the original basic-data-files suffix and location wording; no new file or environment queries.",
 14:"buf is the original basic-data-files suffix and location wording; no new file or environment queries.",
 17:"badtranslation is an original source-declared quality phrase, tribtitle a public book title. Neither field authorizes reproducing copyrighted third-party book passages.",
 18:"badtranslation is an original source-declared quality phrase, tribtitle a public book title. Preserve the original seems-to uncertainty.",
 43:"what is the original public boulder name computed before the message; the mount is original YMonnam. Capture both completed results once, before the subsequent movobj.",
 48:"Tobjnam already composes object + suddenly-roll. Japanese needs original subject/action component capture; the frame does not authorize slicing the completed English or replaying the name helper.",
 50:"predicament comes from the original trap/anchor branch; capture its full public state phrase and original mount name without inspecting trap state anew.",
 53:"predicament and culprit are original public trap/anchor/surface compositions; Japanese case particles need those original source branches/components, not a second surface query.",
 54:"x_monnam includes exact original visibility, tame/peaceful/custom-name/saddle suppression. Capture original name descriptor and selected see/notice once. Peaceful is an input adjective, not an independent raw output leaf.",
 56:"Original ing_suffix(u_locomotion(step)) and waterbody_name are public completed values. Their movement/water distinctions are captured once, not queried again.",
 58:"Original bare artifact name is already public; do not identify an unknown artifact beyond the actual native result. Preserve cuts versus burns branch.",
 70:"buf already records the original vibration location qualifier; bind that exact original public source selection without a fresh square or mount query.",
 73:"icewarnings is an original three-entry source table, selected from already computed time_left. Original outcome is captured once; no timing/RNG replay.",
 78:"Original s_suffix returns a public possessive name. Japanese requires original name/possessive producer capture, not stripping apostrophes from rendered English.",
 84:"Generated C array data is a language-independent artifact. Preserve named star width, exact unsigned width, comma and original public comment text; no English renaming or semantic entity reconstruction.",
 88:"only_one is the original can-only-throw-one-at-a-time sentence constant. Its original source identity must supply the Japanese predicate; envelope approval does not translate an arbitrary value.",
 91:"prefix,xprname,totalbuf include original inventory letters, quantity, public name and already computed price. Capture the original composition once, with exact verbose/total branch; no extra price/name/knowledge calls.",
 93:"before/after are original inventory filter adjectives/qualifiers, including their original state-dependent choices. Japanese placement depends on original source producer contracts, not rendered-English matching.",
 95:"verb is original feel/see selection and doname_with_price is already computed public object+price. Capture both original components once.",
 101:"Amount is the exact official constant Amount to split from current stack must be. Japanese contextual slot is 現在の山から分ける数は. No arbitrary dynamic text is silently replaced by that constant.",
 102:"Amount is the exact official constant Amount to split from current stack must be. Japanese contextual slot is 現在の山から分ける数は. Exact long upper bound remains unchanged.",
 105:"lock_action returns original unlocking/locking/disarming wording. Japanese verb/noun form is source-contextual, with no second lock_action call.",
 106:"lock_action returns original unlocking/locking/disarming wording. Japanese verb/noun form is source-contextual, with no second lock_action call.",
 107:"lock_action returns original unlocking/locking/disarming wording. Japanese verb/noun form is source-contextual, with no second lock_action call.",
 110:"action is original resumed lock action, captured once; no new lock or target-state queries.",
 120:"mesg is the original door-status phrase selected before this call, including open/closed/locked/broken states. Capture original switch outcome without reopening or querying the door.",
 124:"quickly_dissipates is original public source phrase; Japanese predicate becomes すぐに消えた from that declaration, not text matching.",
 128:"Hello(md),player name and incoming display text are original public values. Keep user/display text literal where intended; translate only source-owned greeting/speech origins. No external message is invented.",
 131:"it_reads includes the original opening quotation and junk_templates is a source table. Japanese quotation/composition needs that original producer identity; no slicing native English to replace the opener.",
 134:"what may be visible mimic furniture/object rather than true monster. Preserve mhidden_description visibility and original vtense/position/exclaim outcomes; never expose the hidden entity type or rerun distu/next2u.",
 135:"Generated C diagnostic comments/macro tokens are language-independent code. Preserve named width, every numeric/char specifier and original name/comment literal; no new monster knowledge.",
 138:"Original mhe is an already computed public pronoun, not permission to inspect or disclose gender anew. Japanese pronoun recipe uses exactly that original public descriptor.",
 139:"plur(count) is original singular/plural selection; Japanese grammar uses the captured plural descriptor, with no new summon/count query.",
 147:"Original the/mhis possessive branch distinguishes ordinary possessive from Rider phrasing. Capture it once; Japanese grammar can omit the definite article as an empty leaf while keeping full original argument union.",
 148:"%.99s arguments are original precision-bounded public byte strings. Binding is rejected until the original 99-byte visible substring producer contract exists; never disclose a full untruncated entity name or treat Rust Unicode scalar count as native C byte precision.",
 149:"buf contains original actor + attack/action composition and target mon_nam_too result. Japanese requires original components and attack verb morphology, not a new combat or name call.",
 154:"Before/freaky are original public pre-change form and reaction wording. Capture exactly the original visibility/name-suppression branches, including It fallback; no new post-polymorph identity query.",
 155:"Before/freaky are original public form/reaction; disappearance is the original was_seen-selected leaf. No new detection or entity-name query.",
 156:"s_suffix(Monnam) is original public possessive. Japanese needs source name/possessive capture; no rendered suffix parsing.",
 157:"buf is original attacker public name/description. Frozen means the original immobilizing effect here; do not add ice/temperature cause facts.",
 163:"Original verb/again/punct come from hitmsg attack type and prior-hit state before native updates. Capture once at that call; never rerun hit logic or inspect previous attacks during repaint.",
 164:"swings is the original weapon-aware source verb. Japanese motion morphology needs that captured selection, not a fresh weapon query.",
 166:"swings is the original weapon-aware source verb. Japanese motion morphology needs that captured selection, not a fresh weapon query.",
 168:"blast is original public expulsion qualifier, constructed from existing native fire/sparks/frost/squelch branches. Use exactly those completed original components; no new damage/perception query.",
 181:"Original public possessive name already identifies only the displayed gaze owner. Source Japanese possession recipe must not parse apostrophes or query name again.",
 183:"Original public possessive name already identifies only the displayed radiance owner. Source Japanese possession recipe must not query hidden identity.",
 194:"Original pmname already emits the player's form with original female/male choice. Preserve that computed public result without inspecting polymorph or gender anew.",
 214:"Original container weight comparison selects becomes versus seems, and original gone flag selects slight qualifier. Capture those outcomes once; do not reweigh contents or reveal hidden object identity.",
 216:"what is the original public spill subject; original vtense inflection becomes Japanese spill predicate from that source descriptor only.",
}


def module(path,name):
    import sys
    spec=spec_from_file_location(name,path);value=module_from_spec(spec)
    sys.modules[name]=value;spec.loader.exec_module(value);return value


def main():
    scanner=module(ROOT/"tools/inventory_source.py","mixed3_scanner")
    helper=module(HERE/"build-reviewed-translations.py","mixed3_helper")
    path=HERE/"english-primary-text-or-mixed-batch-3.json"
    batch=json.loads(path.read_text("utf8"))
    assert len(batch["entries"])==len(TEMPLATES),(len(batch["entries"]),len(TEMPLATES))
    entries=[]
    for i,(source,template) in enumerate(zip(batch["entries"],TEMPLATES)):
        ja=source["english_whole_named_template"] if template is None else template
        disposition="translated-whole-source-frame"
        if template is None:
            disposition="preserved-language-independent-code" if i in (8,9,12,84,135) else "public-composite-frame-pending-source-producer"
        elif i==8:
            disposition="preserved-language-independent-code"
        literal_records=[];dependencies=[];unresolved=[]
        for call in source["official_source_contracts"]:
            blob=hashlib.sha256((OFFICIAL/call["source"]).read_bytes()).hexdigest()
            for arg in call["arguments"]:
                expr=arg["source_expression"]
                typed=next(a for a in source["typed_arguments"] if a["name"]==arg["id_candidate"])
                grammar_input=any(k in expr for k in ("hliquid(","u_locomotion(","Tobjnam(","Yobjnam2(","vtense(","ing_suffix(","x_monnam("))
                concatenated=expr.lstrip().startswith('"') and len(helper.literals(scanner,expr))>1 and '?' not in expr
                dependencies.append({"source":call["source"],"line":call["line"],"argument":arg["id_candidate"],"source_expression":expr,"source_blob_sha256":blob,"source_type":typed["type"],"japanese_slot_role":"source-declared grammar/name/composite/public literal field" if typed["type"]=="text" else "original numeric/character/star-width field","knowledge_guard":"Only original publicly emitted value/components; no additional identity, visibility, state, tense, body, motion or RNG query. Unknown binding preserves exact native English.","producer_input_tokens_not_emitted_values":grammar_input or concatenated,"runtime_binding_approved":False})
                for ordinal,(en,start,end) in enumerate(helper.literals(scanner,expr)):
                    if en not in LEAVES.get(i,{}):
                        unresolved.append({"source":call["source"],"line":call["line"],"argument":arg["id_candidate"],"source_expression":expr,"english_literal":en,"reason":"Not a translated direct output leaf; needs exact original producer/predicate/code context. No identity inferred or invented."})
                        continue
                    role="producer-input-literal" if grammar_input or concatenated else "selected-output-literal"
                    literal_records.append({"source":call["source"],"line":call["line"],"original_call_site":{"source":call["source"],"line":call["line"],"api":source["original_api"]},"argument":arg["id_candidate"],"source_expression":expr,"source_literal_ordinal":ordinal,"source_expression_literal_start":start,"source_expression_literal_end":end,"english_source_literal":en,"japanese":LEAVES[i][en],"literal_role":role,"blob_sha256":blob,"contextual_component_recipe":True,"runtime_binding_approved":False})
        variants={key:("夢の中で、" if key=="dream" else "かすかに、")+ja for key in source["required_helper_variants"]}
        assert all(v in ("dream","underwater") for v in variants)
        notes=["Authored from exact official English sentence and original source contracts. Full typed argument union/specifiers stay intact, including any dynamic star references.","Whole-frame source review does not mean public fields are Japanese. Names, possessive/tense/body/motion compounds, constants, user strings, paths, source tables and caller-supplied text need their exact original producer/disposition. Runtime rendering never reverse-matches English."]
        if template is None:
            notes.append("This language-neutral envelope is intentionally identical; its source-owned dynamic contents are NOT declared translated. Explicit original producer work remains pending.")
        if i in (1,6,11,13,14,17,18,40,42,73,82,88,91,92,93,97,99,101,102,120,124,127,128,129,130,131,133,149,154,155,163,168):
            notes.append("Composite/caller text needs source-origin semantic capture; a completed English buffer is not sufficient evidence for Japanese contents.")
        constraints=["Capture original typed public values and their source-selected descriptors once at the existing call. Never rerun original calls, predicates, name helpers, morphology, RNG or state queries.","Require all original string precision/width, helper context, user/path literals and knowledge restrictions; fail closed to original native English when source binding is unavailable."]
        if i in SPECIAL:constraints.append(SPECIAL[i])
        entries.append({"id":source["id"],"whole_message_ja":ja,"original_api":source["original_api"],"original_english_literal":source["original_english_literal"],"english_whole_named_template":source["english_whole_named_template"],"source_translation_review_status":"requires-source-producer-contract","source_translation_approved":True,"localization_disposition":disposition,"argument_schemas":source["required_argument_union"],"source_argument_schema":source["typed_arguments"],"printf_conversions":source["printf_conversions"],"omitted_grammar_arguments":[],"helper_variant_templates_ja":variants,"required_source_literal_translations":literal_records,"unresolved_source_literal_context":unresolved,"requires_public_name_or_grammar_producer":True,"source_presentation_dependencies":dependencies,"source_capture_constraints":constraints,"official_sites_reviewed":source["official_source_contracts"],"translation_notes":notes,"runtime_binding_approved":False,"runtime_integration":False})
    output={"schema_version":1,"category":"text-or-mixed","batch":3,"provenance":batch["provenance"],"source_batch_sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"authorship":{"kind":"authored-official-English-equivalent-Japanese","date":"2026-10-02"},"entries":entries,"counts":{"ids":len(entries),"sites":sum(len(e["official_sites_reviewed"]) for e in entries),"helper_variants":sum(len(e["helper_variant_templates_ja"]) for e in entries),"source_literal_records":sum(len(e["required_source_literal_translations"]) for e in entries),"translated_nonempty_frames":sum(e["localization_disposition"]=="translated-whole-source-frame" for e in entries),"producer_pending_envelopes":sum(e["localization_disposition"]=="public-composite-frame-pending-source-producer" for e in entries),"language_independent_code_frames":sum(e["localization_disposition"]=="preserved-language-independent-code" for e in entries),"runtime_approved":0},"runtime_binding_approved":False,"runtime_integration":False}
    target=HERE/batch["output_fragment_path"]
    target.write_text(json.dumps(output,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps({"path":target.name,**output["counts"],"sha256":hashlib.sha256(target.read_bytes()).hexdigest()}))


if __name__=="__main__":
    main()
