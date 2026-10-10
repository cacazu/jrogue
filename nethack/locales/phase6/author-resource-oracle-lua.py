"""Authored Japanese from exact pinned original resource units, source-only."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXPECTED = {
    "oracle-batch-1": "b5fbc2b08bcf1ea7a968f1c696cc813f3d5a8146e3db6c9568d111899e1cf54e",
    "lua-direct-message-batch-1": "344fe17b18936cdb2f8cf8d9f9f479481321ff7b0cf44c39a9c9587664f2246d",
    "lua-public-field-batch-1": "f56d9f476065a10e099712baa3187ab610a5dbcc19ed0cf5761e3da761f1940e",
}
FRAMES = {
    "oracle-batch-1": {
        1: "杖の魔力を使い果たしても、そなたは何度も振るうことができる。\n初めは何も起こらぬが、粘り強さは必ず報われよう。\n最後の一振り分の魔力を、なお引き出せるかもしれぬのだ！",
        2: "店主は用心深いが、それでも盗人は多くを盗んできた。\n掘削の杖で床を抜け、逃げ道を素早く作ったのである。",
        3: "鎧や武器の錆に悩んだことがあるなら、こう心得よ。\n混乱した状態で、それらを魔法で強化するために普段使う\n魔法の巻物を読めば、錆を防ぐことができる。\n潤滑の軟膏も、似たような保護を与えられるが、\nその効き目は一時的なものである。",
        4: "コカトリスを見よ。その小さな体は、秘められた力を感じさせぬ。\nコカトリスに触れられた普通の者は石になる。だが、徐々に\n石になるのを感じたとき、死んだトカゲか酸の塊を食べる賢き冒険者は別だ。",
        5: "旅人の中には、迷宮で出来合いの鎧を拾い集める者もいる。\nだが、機転の利く者は知っている。竜の皮の鱗から\n鎧を作る、神秘の方法を。",
        6: "幻の光景に心が乱されたとき、超回復の薬が感覚を\n取り戻させることは、旅人の間ではよく知られている。だが忘れるな。\n病気にするあのありふれた薬も、同じ目的に使えるのだ。",
        7: "トカゲの肉や神々に愛された水を口にすれば、混乱した\n頭をすっきりさせられる。だが、この上なく清らかな生き物の角を\n使えば、そのほかの多くの苦しみも和らげられる。",
        8: "遠く離れた場所へ素早く旅したければ、瞬間移動を\n制御できなくてはならぬ。そして混乱した状態で、普段は近くへ\n自分を瞬間移動させる巻物を読み違えるのだ。勇敢な冒険者には、\n巻物も薬も使わず、ある特定の罠に踏み込んで\n同じことを成し遂げた者もいる。",
        9: "ここを通るほとんどの冒険者は、恐ろしいメドゥーサを越えたいと願う。\nそのための最善の助言は、目隠しをしたまま、\n鏡に映った己の姿を、その怪物自身に見せることだ。",
        10: "「ad aerarium」と書かれた所では、丹念に探せば、魔法の記憶の\n宝物庫へ送る罠への道が見つかることが多い。そこにはクロイソスの\n富が蓄えられている。だが、金を持って宝物庫を逃げ出すのは、入るよりずっと難しい。",
        11: "狡猾な店主は、近づく観光客のけばけばしい服装や、\n好ましくない客の顔を見れば、値を上げることがよく知られている。\n彼らは穏やかな物腰の者と美しい顔の者を好む。\n無作法な者は、不利な取引を覚悟することだ。",
        12: "台所の流しが、厄介な表面に触れた不運な指輪を飲み込むという\nありきたりな話は、多くの教訓よりも真実に近い。だが、それでも\n貪欲な流しの姿に現れる変化を見て、魔法の指輪を\n識別する腕を身につけた者は、ほとんどいない。",
        13: "魔法の生き物の肉は、食べた者に魔法の性質を\n与えることが多い。浮遊する目の新鮮な死体は、テレパシーを\n授ける用途ゆえ魔法使いの間で高値が付く。目の見えぬ者も、それで周囲の心を見つけられる。",
        14: "祝福と呪いを見分けるのは神々の領分である。神々は、\n祈りの場でそれを求める人間に、この知識を授けるだろう。\n神々への奉仕に身を捧げる者ならば、ほかの場所でも授けられる。",
        15: "時として神々は、ふさわしい祈り手に、伝説に響く力を持つ\n名のある刃を恵むことがある。学識ある旅人は、そうした介入なしに、\nオークが憎むエルフの系統の刃を再現することができる。",
        16: "古のイェンダーに由来するとされる、強大な護符の物語は多い。\nその護符には恐るべき力があり、神々は大いにそれを欲している。\n人間が引き出せるのは、畏怖すべき能力の一部にすぎぬ。\n護符を持つ者が、目には見えないものを見て、\n魔法の移動の場所を探したという物語がある。\nその力を得るには、護符を身につけなくてはならぬともいう。\nだが、そうした力には必ず大きな代価が伴う。\n均衡を保つためである。",
        17: "勇気があれば、ゲヘノムの最も深い所で地面が震える場所から、\nモロクの聖域へ入れるという。\n三つの魔法の品の助けが必要となる。\n銀の鐘の澄んだ音が、そなたの訪れを告げる。\nモロクの書に記された恐るべき文字を読めば、大地が激しく震える。\n魔法の燭台の光が、そなたに道を示すであろう。",
        18: "破滅の迷宮の最深部には、さらに下の領域への入口を守る\n城があり、その中には願いの杖がある。\n入城したければ楽器を持ってゆけ。正しい調べで、\n跳ね橋を魔法のように下ろせる。どんな音の並びかを知るのは\n神々だけだが、音楽の達人なら機転の利いた即興で成功するかもしれぬ。\nだが、それほど鋭敏でない者にも手はある。\n城を回り込み、裏門へ向かう用意があればよい。",
        19: "寺院に仕える僧侶に寄進すると神々は喜び、\n寄進した者に様々な恩恵を与えることがあるという。\nだが心せよ！年老いてけちであるより、若くて倹約する方がよい。",
        20: "足元の地面にElberethの名を書けば、\n敵の心を恐れで満たすかもしれぬ。\nこの上なく落ち着いていれば、大いに身の安全を助けるだろう。\nだが、不器用な足で文字をこすり消し、その力を失わせたり、\n勝手な剣の一振りで休戦を破ったりせぬよう用心せよ。",
    },
    "lua-direct-message-batch-1": {
        1: "なんて不思議な感じだ！", 2: "ここには重力がないと気づいた。", 3: "天上界に到着した！",
        4: "ここには{quest_original_alignment_deity}の大寺院がある。", 5: "空気の中に警戒と敵意、そして興奮を感じる！",
        6: "よくやった、人の子よ！", 7: "だが、今こそ最後の試練に立ち向かわねばならぬ…", 8: "自らがふさわしいと証明せよ。さもなくば滅びよ！",
        9: "ヒント：遠くを見る、または地図上の場所を選ぶ\n\n今は「farlook」モードだ。移動キーで動くのはカーソルであり、\nあなた自身ではない。ゲーム内の時間は進まない。このモードは、\n地図を見渡したり、地図上の場所を選んだりするために使う。\n\nこのモードではESCを押すと通常のゲームモードに戻る。\n?を押すとキーの説明が表示される。\n",
        10: "腹が減ってきたようだ。何か食べなければ、飢えて死んでしまう。", 11: "水に囲まれた空気の泡の中に浮かんでいることに気づいた。",
    },
    "lua-public-field-batch-1": {
        1: "探知の宝珠", 2: "X印がその場所を示す。", 3: "アーリマンの心臓", 4: "Elbereth", 5: "力の王笏", 6: "アスクレピオスの杖",
        7: "マーリンの魔法の鏡", 8: "エクスカリバー", 9: "ペルセウス", 10: "ペルセウス", 11: "ペルセウス", 12: "ペルセウス",
        13: "超越の眼", 14: "Elbereth", 15: "聖なる僧帽", 16: "ダイアナの長弓", 17: "盗賊の万能鍵", 18: "村正", 19: "Elbereth", 20: "Elbereth",
        21: "プラチナ・イェンダー・エクスプレス・カード", 22: "成功するまで何度か試す必要のある行動もある",
        23: "扉に向かって移動すると開けられる", 24: "魔法の転移門を通ってチュートリアルを出られる。", 25: "間違った秘密",
        26: "この扉の向こうには暗い通路がある", 27: "そばに四つの罠がある！探してみよう。", 28: "怪物に向かって歩くと攻撃できる。",
        29: "これでごく基本的なことが分かった。魔法の転移門を通ってチュートリアルを出られる。", 30: "この転移門に入るとチュートリアルを出られる",
        31: "岩塊に向かって移動すると押せる", 32: "品によっては見た目が入れ替わり、ゲームごとに異なる", 33: "また魔法の転移門だ。このチュートリアルを出られる",
        34: "重荷を避けよう。動きが遅くなる", 35: "品の所持枠の文字の前に数を付けると、ひとまとめの品の一部だけ落とせる",
        36: "石などの飛び道具は、適した発射用の武器から放つと効果が高い", 37: "スリングを手にしよう", 38: "作成中",
        39: "通れない？荷物を持ちすぎている。", 40: "魔法を唱える", 41: "残念ながら、魔法を唱えるには魔力が足りない。",
        42: "運命の宝珠", 43: "エチオピカの眼", 44: "パグ", 45: "イモリ",
    },
}

for name, frames in FRAMES.items():
    path = ROOT / (name + ".json")
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == EXPECTED[name]
    source = json.loads(raw)
    assert set(frames) == set(range(1, len(source["entries"]) + 1))
    entries = []
    for number, original in enumerate(source["entries"], 1):
        translated = frames[number]
        notes = ["Translated from the exact pinned official source unit. Literal resource percent signs are not parsed as printf; source-selected consumer, offsets, argument union and original game data remain intact.", "Source-only authoring. Bind only after the original consumer selects and exposes this unit; no extra selection, name, state or RNG call, no completed-English matching."]
        if name == "oracle-batch-1":
            notes.append("Retain the complete original selected oracle, advice, uncertainty and literary voice. Whole Japanese paragraph needs a grouped original-delivery descriptor; no recomputed oracle choice or additional game fact.")
        elif name == "lua-direct-message-batch-1":
            notes.append("Preserve original accumulated level-message ordering, original convert_line expansion and named original-alignment deity field. Tutorials explain the same native controls; no new input or time advance.")
        else:
            notes.append("Native predefined name/engraving text stays original for save, artifact lookup, degradation and mechanics. Translate only certified source-origin intact public output; edited, degraded, renamed or uncertain provenance remains literal English/user text.")
            if original["english_named_template"] == "Elbereth":
                notes.append("Elbereth is an exact native mechanical engraving token; it remains Elbereth in Japanese presentation and original game data.")
        entries.append({**original, "whole_message_ja": translated,
                        "source_review_status": "faithful-official-source-equivalent",
                        "translation_notes": notes, "runtime_binding_approved": False})
    result = {"schema_version": 1, "input_sha256": EXPECTED[name], "category": source.get("category"),
              "authorship": "Direct Japanese review of exact pinned official resource units; no runtime binding approval.",
              "entries": entries, "runtime_binding_approved": False}
    output = ROOT / (name + ".authored.json")
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"batch": name, "ids": len(entries), "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))
