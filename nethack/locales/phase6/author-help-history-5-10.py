"""Reproduce assigned fixed-resource Japanese batches 5..10 (NGPL).

Source-only; writes only the six owned *.authored.json files. It does not
install runtime catalogs, run native tools, alter input keys or publish.
"""
from __future__ import annotations
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re

HERE = Path(__file__).resolve().parent
PINS = {
    5: "96e761e88c6a1636e9f52e42e60298991e1683c41c871e30cfa74f049cfb1601",
    6: "4ebf03d05296c7cd1c83f809f895176bf503ba0caf6bd818c1d9661a93c06c5d",
    7: "dbfa3eca110716263b11c7ed274efd2b74280f917af2a21da00303c447d51654",
    8: "f1325516d34eb387e9dc041060f35b236fa437c23038ca270e4f6db95f924b02",
    9: "3e2ac024d6e4c3c63fece87cad4968547601eef34ab4733272d0ff35a7ca5f37",
    10: "718cfb8df72123eef4ba13fe66f6af8d75caae3e37116536333890dc14ce432d",
}
TRANSLATIONS = {}
TRANSLATIONS[5] = """各職業専用のクエスト、新たな終盤、数多くの新機能を導入し、
NetHack 3.1 を完成させた。バージョン 3.1.0 は1993年1月にリリースされた。
Ken Lorber、Gregg Wonderly、Greg Olson は、Richard Addison、
Mike Passaretti、Olaf Seibert の助力を得て、Amiga 用の NetHack 3.1 を開発した。
Norm Meluch と Kevin Smolkowski は、Carl Schelin、Stephen
Spackman、Steve VanDevender、Paul Winner の助力を得て、NetHack 3.1 を PC に移植した。
Jon W{{tte と Hao-yang Wang は、Ross Brown、Mike Engber、David
Hairston、Michael Hamel、Jonathan Handler、Johnny Lee、Tim Lennan、Rob Menke、
Andy Swanson の助力を得て、Macintosh 用の NetHack 3.1 を開発し、
MPW に移植した。この成果を基に、Bart House が Think C 向けの移植を追加した。
Timo Hakulinen は NetHack 3.1 を OS/2 に移植した。Eric Smith は NetHack 3.1 を
Atari に移植した。Pat Rankin は Joshua Delahunty の助力を得て、
NetHack 3.1 の VMS 版を担当した。Michael Allison は NetHack 3.1 を
Windows NT に移植した。
Dean Luick は David Cohrs の助力を得て、X11 用の NetHack 3.1 を開発した。
地図は画像ではなく文字で描画されたが、nh10.bdf も含まれていた。
これは任意に使用できる独自の X11 フォントで、文字や
句読点の代わりに小さな画像を使う、タイルの先駆けだった。画像は個々の
モンスターや物品の種類には対応せず、モンスターや物品のクラスを置き換えるだけだった。
（つまり、すべての "a" の昆虫に一つの独自画像、すべての "[" の防具に別の画像、
といった形で、甲虫と蟻、マントと靴にそれぞれ異なる画像があるわけではなかった。）
Warwick Allison は、NetHack の画像表示版を
Atari 向けに書いた。小さな絵は「アイコン」と呼ばれ、クラス単位ではなく、
モンスターや物品の個々の種類ごとに異なっていた。
彼はそれらを NetHack 開発チームに提供し、チームは
「タイル」と呼び直した。この独自の呼び方は、その後さまざまな
ほかのゲームにも広まった。NetHack のタイル対応は、ほかのプラットフォームにも実装された。
（初めは MS-DOS、その後は Windows、Qt、X11 にも対応した。）
3.2 の NetHack 開発チームは、Michael Allison、Ken Arromdee、
David Cohrs、Jessie Collet、Steve Creps、Kevin Darcy、Timo Hakulinen、Steve
Linhart、Dean Luick、Pat Rankin、Eric Smith、Mike Stephenson、Janet Walz、
Paul Winner で構成され、1996年4月にバージョン 3.2.0 をリリースした。
バージョン 3.2 は、開発チーム結成の10周年を記念するものとなった。
ゲームへの献身を示すように、最初の NetHack 開発チームの13人全員が、
そのリリースの開発を始めた時点でも、
チームに残っていた。3.1.3 のリリースから
3.2.0 のリリースまでの間に、NetHack 開発チームの創設メンバーの一人である
Dr. Izchak Miller は癌と診断され、亡くなった。そのリリースは、
開発チームと移植チームによって、彼に捧げられた。
バージョン 3.2 は、それ以前の版よりも安定していた。多くのバグが
修正され、悪用できる仕組みが取り除かれ、ゲーム機能もより良いゲーム
プレイのために調整された。
NetHack 3.1 と 3.2 が使われていた間に、ゲームの愛好者の何人かが
独自の変更を加え、これらの「派生版」を公開した。
その例を以下に挙げる。
Tom Proudfoot と Yuval Oren は NetHack++ を作成したが、これはすぐに
NetHack-- と改名された。一部の人が、C のソースコードを C++ に変換したものだと
誤解したためだった。Stephen White は独立に
NetHack Plus を作成した。Tom Proudfoot は後に NetHack Plus と自分の NetHack-- を統合し、
SLASH を作った。Larry Stewart-Zerba と Warwick Allison は、
Wizard Patch によって呪文を唱える仕組みを改善した。Warwick Allison はさらに、
NetHack が Qt インターフェースを使えるよう移植した。
Warren Cheung は SLASH と Wizard Patch を統合して Slash'EM を作り、
Kevin Hugo の助力を得て、さらに機能を追加した。Kevin は後に
NetHack 開発チームに加わり、これらの案の優れた部分を
NetHack 3.3 に取り込んだ。
3.2 の最後の更新は、バグ修正版 3.2.3 だった。これは
2000年を迎える直前の1999年12月に、3.3.0 と同時にリリースされた。
新しい版もあったため、3.2.3 はソースコードのパッチとしてのみ公開され、
通常は用意されていたシステム向けの、すぐに遊べる配布物はなかった。
（古い版の復活を考えている人へ：3.2.3 より前のすべての版には、
2000年問題のバグがあった。ハイスコアファイルとログファイルの日付は、
年を2桁で表していたため、1999年の年表記 99 の次に
2000年の年表記 100 が続いた。書き出し自体は成功したが、意図せず
ファイルの形式に列が一つ増え、スコア項目を
正しく読み戻せなくなった。これにより、新しいハイスコアの登録と、
現在のゲームで幽霊や像にランダムな名前を付けるために、過去のキャラクター名を取得する処理が
妨げられた。）
3.3 の NetHack 開発チームは、Michael Allison、Ken Arromdee、
David Cohrs、Jessie Collet、Steve Creps、Kevin Darcy、Timo Hakulinen、
Kevin Hugo、Steve Linhart、Ken Lorber、Dean Luick、Pat Rankin、Eric Smith、
Mike Stephenson、Janet Walz、Paul Winner で構成され、3.3.0 を
1999年12月に、3.3.1 を2000年8月にリリースした。
バージョン 3.3 には、多くの初めての要素があった。種族と
職業を分けた最初の版だった。エルフの職業クラスは廃止され、エルフの種族に置き換えられた。
また、ドワーフ、ノーム、オークの種族が、
おなじみの人間の種族とともに、初めてゲームに登場した。修行僧とレンジャーの職業が、
考古学者、野蛮人、洞窟人、治療師、騎士、聖職者、盗賊、
侍、観光客、ワルキューレ、そしてもちろん魔法使いに加わった。さらに、
乗騎に乗れるようになった最初の版でもあり、
発見されたすべてのバグを掲載する公開ウェブサイトを持つ最初の版でもあった。
バグ一覧は増え続けたが、それでも 3.3 は十分に安定していて、
1年半を超えて使われ続けた。
3.4 の NetHack 開発チームは、当初 Michael Allison、
Ken Arromdee、David Cohrs、Jessie Collet、Kevin Hugo、Ken Lorber、Dean Luick、
Pat Rankin、Mike Stephenson、Janet Walz、Paul Winner で構成され、Warwick Allison は
2002年3月の NetHack 3.4.0 のリリース直前に加わった。
バージョン 3.3 と同様に、さまざまな人がゲーム全体に貢献するとともに、
NetHack が動作する各プラットフォームへの移植も支えた。
Pat Rankin は VMS 用の 3.4 を保守した。
Michael Allison は MS-DOS 用の NetHack 3.4 を保守した。
Paul Winner と Yitzhak Sapir は励ましを与えてくれた。
Dean Luick、Mark Modrall、Kevin Hugo は、3.4 の Macintosh 版を
保守し、改良した。
Michael Allison、David Cohrs、Alex Kompel、Dion Nicolaas、Yitzhak Sapir は、
Microsoft Windows 用の 3.4 を保守し、改良した。Alex Kompel は、
Windows 版の新しい画像インターフェースを提供した。Alex Kompel はまた、
3.4.1 の Windows CE 版も提供した。
Ron Van Iwaarden は、ここ数回のリリースで OS/2 用 NetHack の唯一の保守担当者だった。
残念ながら Ron の最後の OS/2 マシンは、年の初めに動かなくなった。その年は""".splitlines()

TRANSLATIONS[6] = """2006年だった。Ron がこれほど長年にわたって OS/2 で NetHack を維持してくれたことに、
心から感謝する。
Janne Salmijarvi と Teemu Suikki は、
Janne Salmijarvi が 3.3.1 のために復活させた Amiga 版を、3.4 でも保守し、改良した。
Christian "Marvin" Bressler は、3.3.1 のために復活させた
Atari 版を、3.4 でも保守した。
2003年12月の NetHack 3.4.3 のリリースから、
長いリリースの休止期間が始まった。3.4.3 は驚くほど安定した版となり、
コミュニティーは10年以上にわたって遊び続けることができた。
NetHack 開発チームは、3.4.3 が使われていた間も、
舞台裏でゆっくりと静かにゲームの開発を続けていた。同じ
時期に、NetHack コミュニティーでは新しい派生版がいくつか登場した。
特に Derek S. Ray の sporkhack、Patric Mueller の unnethack、当初 Daniel Thaler が、
後に Alex Smith が手がけた nitrohack とその後継版、
Tung Nguyen の Dynahack が挙げられる。それらの派生版の一部は、今も開発、
保守され、コミュニティーで楽しまれている。
2014年9月、開発中のコードの中間スナップショットが、
別の人々によって公開された。このコードは作業中のもので、
正式なリリースに適したものとするためのデバッグを経ていなかったため、
そのスナップショットに付いていたバージョン番号は、
廃止して公式の NetHack リリースでは決して使わないことになった。
その旨の告知が、NetHack 開発チームの公式ウェブサイト nethack.org に掲載され、
3.4.4、3.5、3.5.0 の
公式リリースは決して行わないと説明された。
2015年1月、NetHack 3.6 のリリースに向けた準備が始まった。
後に 3.6.0 としてリリースされる版の
開発開始時点では、NetHack 開発チームは Warwick Allison、
Michael Allison、Ken Arromdee、David Cohrs、Jessie Collet、Ken Lorber、
Dean Luick、Pat Rankin、Mike Stephenson、Janet Walz、Paul Winner で構成されていた。
3.6.0 のリリースに先立つ2015年初めに、新しいメンバーの Sean Hunt、
Pasi Kallinen、Derek S. Ray が NetHack 開発チームに加わった。
3.6.0 の開発終盤に、ゲームのユーモラスで楽しい要素の多くに
大きな着想を与えた作家、
Terry Pratchett が亡くなった。NetHack 3.6.0 には彼への追悼が導入された。
3.6.0 は2015年12月にリリースされ、3.4.3 のリリース以降の
開発チームの成果と、コミュニティーで親しまれていたパッチの一部が統合された。
多くのバグが修正され、コードの一部が再構成された。
NetHack 開発チームは、Steve VanDevender、
Kevin Smolkowski とともに、NetHack 3.6 が各種の
UNIX で引き続き動作するようにし、X11 インターフェースを保守した。
Ken Lorber、Haoyang Wang、Pat Rankin、Dean Luick は、
MacOS 用の NetHack 3.6 を保守した。
Michael Allison、David Cohrs、Bart House、Pasi Kallinen、Alex Kompel、
Dion Nicolaas、Derek S. Ray、Yitzhak Sapir は、
Microsoft Windows 用の NetHack 3.6 を保守した。
Pat Rankin は NetHack 3.6 の VMS 版を動作させ続けようとしたが、
利用できる環境が限られることに妨げられた。Kevin Smolkowski は、当時最新の
OpenVMS（執筆時点では V8.4）の Alpha と
Integrity（別名 Itanium、別名 IA64）向けに更新とテストを行ったが、VAX 向けには行っていない。
Ray Chason は、3.6 のために MS-DOS 版を復活させ、
必要な更新を広くコミュニティーに提供した。
2018年4月下旬、3.6.0 に対する数百件のバグ修正と新機能の一部が
まとめられ、NetHack 3.6.1 としてリリースされた。
3.6.1 のリリース時点での NetHack 開発チームは、
Warwick Allison、Michael Allison、Ken Arromdee、David Cohrs、Jessie Collet、
Pasi Kallinen、Ken Lorber、Dean Luick、Patric Mueller、Pat Rankin、
Derek S. Ray、Alex Smith、Mike Stephenson、Janet Walz、Paul Winner で構成されていた。
2019年5月初め、さらに320件のバグ修正、いくつかの改良、
採用された curses ウィンドウ版が、3.6.2 としてリリースされた。
Bart House は、何十年もの間、移植チームの参加者としてゲームに貢献してきたが、
2019年5月下旬に NetHack 開発チームに加わった。
NetHack 3.6.3 は2019年12月5日にリリースされ、NetHack 3.6.2 に対する190件を超える
バグ修正を含んでいた。
NetHack 3.6.4 は2019年12月18日にリリースされ、一つのセキュリティー修正と
いくつかのバグ修正を含んでいた。
NetHack 3.6.5 は2020年1月27日にリリースされ、いくつかのセキュリティー修正と
少数のバグ修正を含んでいた。
NetHack 3.6.6 は2020年3月8日にリリースされ、一つのセキュリティー修正と
いくつかのバグ修正を含んでいた。
NetHack 3.6.7 は2023年2月16日にリリースされ、一つのセキュリティー修正と
NetHack 3.6 の次のメジャーリリースに向けた開発は、2015年、
NetHack 3.6.0 のリリースと同じ頃に始まった。この開発は、
2015年から2023年までの各 NetHack 3.6 リリースと並行して続き、
2026年4月末まで継続した。初めて、
開発中の成果が、その進行に合わせて GitHub と SourceForge で公開された。
NetHack-3.7 work-in-progress（WIP、作業中）という名称で進められたが、
次のリリースのバージョン番号は、まだ確定していなかった。
開発を公開したことには多くの利点があり、
課題もあった。変更や新機能をほぼ即座に見て批評できるようになり、
実際にそうする人も多かった。GitHub のプルリクエストの仕組みによって、
開発に直接貢献しやすくなった。
寄せられた貢献は、ゲームの実に多くのバグを解決した。すべての
貢献者に感謝する。
2026年初め、公式リリースの開始を検討できるほど開発が安定してきたため、
開発チームはゲームの変更の内容と数を検討した。
変更には、メジャーリリースにふさわしい十分な深さと
広がりがあることが明らかで、バージョン 5.0 とすることが決まった。
これは 3.x に続く新しいメジャーリリースであり、
バージョン 4.0 としてリリースした場合に生じ得た、既存の派生版との
曖昧さや混乱を招かずに済んだ。
NetHack 5.0.0 は2026年5月2日にリリースされた。
NetHack 5.0.0 のソースコードは、C99 標準に適合するよう、
変更され、近代化された。5.0.0 のリリースには、3100件を超える修正、変更、
機能の更新が含まれていた。
NetHack 5.0 は、従来の lex と yacc による階と
ダンジョンのコンパイラーを、新しい Lua インタープリターを基にした
方式へ置き換えた最初の版だった。Lua は、NetHack 5.0.0 のクエスト文章にも
使われている。開発チーム全員が、これを実現した
Pasi Kallinen の仕事をたたえている。
NetHack 5.0 のリリース時点で、中心となる開発チームには、""".splitlines()


TRANSLATIONS[7] = """現在および過去のメンバーには Warwick Allison、Michael Allison、
Ken Arromdee、David Cohrs、Jessie Collet、Bart House、Kevin Hugo、
Pasi Kallinen、Ken Lorber、Dean Luick、Pat Rankin、Derek S. Ray、
Alex Smith、Patric Mueller、Mike Stephenson、Janet Walz、Paul Winner が含まれる。
Ken Lorber、Pat Rankin、Patrick Mueller、Michael Allison は、
NetHack 5.0 が macOS で動作するよう尽力した。
Ingo Paschke は、どうにか NetHack 5.0 の Amiga 版を復活させた。
そのために、現代のプラットフォーム上でクロスコンパイラーを使用した。彼の成果は共有され、
その尽力のおかげで、ほかの人も容易に Amiga 用の NetHack 5.0 を
作成できるようになった。
Ray Chason は、NetHack 5.0 の MS-DOS 版の保守作業の大半に貢献し、
curses インターフェースの移植も行った。
Michael Allison は、NetHack 5.0 の中核部分の変更後も
msdos 版が動作し続け、存続するよう尽力した。MS-DOS 版のクロスコンパイルが、
それを可能にし、大半を苦労なく進められるよう助けている。
NetHack 5.0 の Windows 版に貢献した人々には、
11年以上前に NetHack 5.0 の開発が始まって以来、
Dion Nicolaas、Derek S. Ray、Yitzhak Sapir がいる。
開発チームは悲しみとともに、亡くなった Ron Van Iwaarden の
過去の貢献を讃え、その記憶を留めたい。彼は過去の複数の NetHack リリースで、
OS/2 用 NetHack の唯一の保守担当者だった。Ron の不在は惜しまれる。
NetHack の公式ウェブサイトは、Ken Lorber が次の場所で管理している。
__PRESERVE__
NetHack コミュニティを代表して、公開 NetHack サーバーを
提供している M. Drew Streib と Pasi Kallinen に、改めて深く感謝する。
その場所は nethack.alt.org である。また、Keith Simpson と Andy Thomson が
hardfought.org を提供していることに感謝する。そして、Junethack、
The November NetHack Tournament といった毎年の NetHack 大会や、
かつての devnull.net に時間と労力を注いでいる、名を挙げきれない冒険者たちにも感謝する。
devnull.net は今はなくなったが、忘れられたわけではない。
__PRESERVE__
時折、netland にいるどこかのいかれた人物が、
ゲームを助ける、ことのほか興味深い変更を送ってくる。
NetHack 開発チームは、ときにそうした不埒者のうち最もたちの悪い者の名を、
次の冒険者一覧に書き留めている。""".splitlines() + ["__PRESERVE__"] * 43 + """ハードウェア、オペレーティングシステム、NetHack のインターフェースによっては、
一部のキー入力を使えない場合がある。
たとえば ^S と ^Q は、XON/XOFF のフロー制御によく使われる。
つまり ^S で出力を停止し、その後の ^Q で停止していた
出力を再開する。その場合、このどちらの文字も、
コマンドのキー入力を待つ NetHack には届かない。そのため、
これらはコマンドとして使われない。ただし NetHack まで届かない場合、'whatdoes' は
そのことを説明できないかもしれない。
^M、<return>、<enter> は、処理のために NetHack へ渡される前に、
^J、<linefeed>、'newline' に変換されることが多い。
そのため ^M はコマンドとして使われない。'whatdoes' が
違う文字を報告しているように見えても、
^M を入力したときに ^J を説明するなら、正しく動作している。
キーボードによっては ^<space> と入力する NUL 文字は、
別のキーボードでは ^@ と入力し、さらに別のキーボードではまったく入力できないこともある。
NUL はコマンドとして使われず、到達する前に ESC へ変換される。
到達先は 'whatdoes' である。^M とは違い、この変換は
NetHack 内で行われる。ただし ^M と同じく、NUL を入力して ESC に関する説明が返るのは、
想定どおりである。
ESC 自体は ^[ と同じ文字であり、これも奇妙な動作の原因になる。
カーソルの矢印キーを含む各種ファンクションキーは、
ESC + [ + その他の文字からなる「エスケープシーケンス」を送り、NetHack が""".splitlines()

TRANSLATIONS[8] = r"""どのコマンドを意図したのか混乱することがある。ESC が処理された後、
それに続く文字は NetHack には、ユーザーが入力したもののように見え、
そのように使われるからである。（ファンクションキーを押して、
主人公が身に着けている防具のメニューが現れたなら、
NetHack にエスケープシーケンスが送られたのである。その ESC が
待機中のキー操作を中止し、次の '[' が、身に着けている防具を表示する
コマンドとして扱われた。「その他の文字」は、メニューを閉じる際に、
無効な選択としておそらく黙って破棄された。）
NetHack の 'altmeta' オプションを有効にしている場合、
<alt> または <option> キーを押しながら別の文字を入力すると、
ESC とその文字が送られ、NetHack は
その文字をメタ文字として扱う。この場合、ESC は
さらに混乱の原因になりうる。ESC + 別の文字という
2文字の組を処理するには、NetHack が ESC を受け取ったとき、
次の文字を待たなければならない。
そうしないと処理を決められないためである。したがって ESC を単独で入力すると、
もう一度入力しなければ、NetHack は待ち続ける。
（その場合は M-ESC ではなく、ESC を入力したものとして扱われる。）
一部のシステムでは、^\ を入力すると、実行中のプロセスに QUIT シグナルが送られる。
おそらくそのプロセスを終了させ、コアダンプを保存させる
可能性もある。この文字は NetHack のどのコマンドにも使われないので、
入力しないこと。
最後にもう一つ、^x と記された文字は、
<control> または <ctrl> キーを押しながら 'x' を入力することを意味する。
制御文字はすべて暗黙に大文字であるが、
入力するときに shift キーを押す必要はない。メタ文字の場合は
逆で、大文字にも小文字にもなる。そのため、
大文字のメタ文字を入力するには、<meta> または <alt> に加えて
shift も使う必要がある。
__PRESERVE__
キー入力で実行されるコマンドを説明する
隣接する罠の種類を表示する
コマンドを中止する（ESCape キーと同じ）
__PRESERVE__
近くの罠、隠し扉、見えていないモンスターを探す
階を地図化する。罠と隠し通路を明らかにするが、隠し扉は明らかにしない
名前またはクラスを指定してモンスターを作る
すべての持ち物を識別済みの状態で所持品を見る
特別な階の位置を一覧表示する
階の間をテレポートする
何かを願う
__PRESERVE__
利用できないデバッグ用コマンド
利用できないデバッグ用コマンド
利用できないデバッグ用コマンド
利用できないデバッグ用コマンド
'#overview' の短縮形。訪れたことのある興味深い階を一覧表示する
利用できないデバッグ用コマンド
利用できないデバッグ用コマンド
__PRESERVE__
__PRESERVE__
南西へ1マス移動する
何かの上に来るまで南西へ進む
西へ1マス移動する
何かの上に来るまで西へ進む
南へ1マス移動する
何かの上に来るまで南へ進む
北へ1マス移動する
何かの上に来るまで北へ進む
東へ1マス移動する
何かの上に来るまで東へ進む
南東へ1マス移動する
何かの上に来るまで南東へ進む
北東へ1マス移動する
何かの上に来るまで北東へ進む
__PRESERVE__
__PRESERVE__
ヘルプ。'?' と同じ
跳ぶ。'#jump' の短縮形
蹴る。'^D' と同じ
中身を扱う。'#loot' の短縮形
回数の入力を始める。続けて数字を入力する
名前を付ける。'#name' の短縮形
罠を外す。'#untrap' の短縮形
__PRESERVE__
道具を使う、または杖を折る
すべての防具、装飾品を外し、武器を手から外す。いずれか、または複数を行う
直前のコマンドを繰り返す
何かの近くに来るまで南西へ進む
扉を閉める
モンスター、個々の物品、または物品の種類に名前を付ける
中断する。ゲームを終了する
物品を一つ落とす
特定の種類の物品を落とす
何かを蹴る（通常は扉、櫃、箱）
何かを食べる
床に文字を刻む
矢筒から弾を射る
続けて方向を指定し、モンスターと戦う（気配を感じていなくても）
続けて方向を指定し、何かの近くに来るまで進む
続けて方向を指定する。control キーを押しながら方向を入力するのと同じ
何かの近くに来るまで西へ進む
所持品を表示する
特定の種類の所持品を表示する
何かの近くに来るまで南へ進む
何かの近くに来るまで北へ進む
何かの近くに来るまで東へ進む
続けて方向を指定し、拾ったり戦ったりせずに移動する
続けて方向を指定し、何も拾わずにある距離を移動する
何かの近くに来るまで南東へ進む""".splitlines()

TRANSLATIONS[9] = """扉を開ける
オプション設定を表示し、場合によっては変更する
買い物の代金を支払う
装飾品を身に着ける（指輪、護符など。防具にも使える）
以前に表示されたゲームメッセージを順に表示する
何かを飲む（薬、水など）
矢筒に入れる弾を選ぶ（終了するには '#quit' を使う）
巻物または魔法書を読む
装飾品を外す（指輪、護符など。防具にも使える）
画面を再描画する
すぐ隣接するすべての場所で、罠と隠し扉を探す
ゲームを保存して終了する（「保存して続行」はできない）
何かを投げる（物品を選び、次に標的ではなく方向を指定する）
防具を一つ脱ぐ（装飾品にも使える）
階の中でテレポートする
何かの近くに来るまで北東へ進む
バージョンを表示する（'#version' はさらに詳しい情報を表示する）
ゲームの開発の歴史を表示する
武器を構える（二刀流なら 'w' で副武器、'x'、'w' で主武器、'X' の順）
防具を一つ身に着ける（装飾品にも使える）
構えている武器と副武器を交換する
二刀流を切り替える
自分の属性を表示する（デバッグモードや探索モードでは、より詳しく表示する）
__PRESERVE__
__PRESERVE__
北西へ1マス移動する
何かの上に来るまで北西へ進む
__PRESERVE__
何かの近くに来るまで北西へ進む
杖を振る
呪文を唱える
__PRESERVE__
ゲームを一時停止する。'fg'（foreground）で再開する
__PRESERVE__
利用できないコマンド：suspend
__PRESERVE__
杖を振る
呪文を唱える
ゲームを一時停止する。'fg'（foreground）で再開する
利用できないコマンド：suspend
北西へ1マス移動する
何かの上に来るまで北西へ進む
何かの近くに来るまで北西へ進む
__PRESERVE__
階段を上る
階段を下りる
記号がどの種類のものに対応するかを表示する
ヘルプメッセージを表示する
__PRESERVE__
シェルに抜ける。シェルで 'exit' を実行すると戻る
利用できないコマンド：shell
発見済みの物品の種類を表示する
一つの物品クラスについて、発見済みの種類を表示する
最短経路のアルゴリズムを使い、地図上の地点へ移動する
何もせずに1ターン休む
__PRESERVE__
何もせずに1ターン休む
床に何があるかを見る
階の地図記号がどの種類のものに対応するかを表示する
現在の場所にあるものを拾う
pickup オプションのオン・オフを切り替える
現在構えている、または準備してある武器を表示する
現在身に着けている防具を表示する
現在身に着けている指輪を表示する
現在身に着けている護符を表示する
現在使っている道具を表示する
使用中の装備をすべて表示する（),[,=,",( の各コマンドをまとめたもの）
所持金を数える
覚えている呪文を一覧表示する
モンスターや物品が視界を遮らない地図を表示する。
拡張コマンドを実行する（候補を一覧表示するには '#?' を使う）
__PRESERVE__
__PRESERVE__
__PRESERVE__
__PRESERVE__
__PRESERVE__
__PRESERVE__
__PRESERVE__
__PRESERVE__
所持品を表示する
西へ移動する
東へ移動する
'F' の前置キー。強制的に戦う
__PRESERVE__
回数の入力を続ける
回数の入力を始めるか、続ける
回数の入力を始めるか、続ける
__PRESERVE__
__PRESERVE__
北西へ移動する
北へ移動する
北東へ移動する
南西へ移動する
南へ移動する
南東へ移動する
__PRESERVE__
北西へ移動する
北へ移動する
北東へ移動する
南西へ移動する""".splitlines()

TRANSLATIONS[10] = """南へ移動する
南東へ移動する
回数の入力を始めるか、続ける
回数の入力を始めるか、続ける
回数の入力を始めるか、続ける
回数の入力を始めるか、続ける
回数の入力を始めるか、続ける
回数の入力を始めるか、続ける
__PRESERVE__
__PRESERVE__
'g' の移動前置キー
'G' の移動前置キー
__PRESERVE__
'G' の移動前置キー
'g' の移動前置キー
特定の種類の所持品を表示する
回数の入力を始めるか、続ける
二刀流を切り替える
__PRESERVE__
拡張コマンドのヘルプを表示する（そのプラットフォームで可能な場合）
所持品の文字を調整する
注釈を付ける。現在のダンジョンの階に名前を付ける
会話する。隣接する生き物に話しかける
行動の記録。守り続けている自主的な挑戦を一覧表示する
物品を何かに浸す
技能を高める。武器技能を確認し、条件を満たしていれば高める
錠をこじ開ける
物品の特別な力を発動する
近くの場所へ跳ぶ
床にある箱の中身を扱う
変身中に、モンスターの特殊能力を使う
モンスター、個々の物品、または物品の種類に名前を付ける
モンスター、個々の物品、または物品の種類に名前を付ける
神々に生贄を捧げる
概要。探索済みのダンジョンの概要を表示する
神々に助けを求めて祈る
終了する（保存せずに退出する）
ランプまたは試金石をこする
騎乗する。鞍の付いた乗用動物に乗る、または降りる
座る
アンデッドを退散させる
ひっくり返す。容器を空にする
何かの罠を外す（罠、扉、櫃）
このバージョンの NetHack のコンパイル時オプションを表示する
顔を拭く
通常のプレイから探索モードへ切り替える
特定のコンパイルフラグに依存しない真偽値のオプション（[] 内は既定値）：
（自分のバージョンにどのオプションがあるかは、現在の
オプション設定を確認するとわかる。設定は 'O' コマンドで開く。）
主人公が何かを聞けるか
身に着けている防具を要約する追加の状態欄を表示する
カーソルの下にある地形を説明する
移動中に掘削用の道具を構えていれば掘る
扉に向かって歩くと、開けようとする
通り過ぎる物品を自動的に拾う
矢筒が空のときに射るなら、選択して、
所持品の適した武器で矢筒を満たす
IBM ROM BIOS 呼び出しの使用を許可する
主人公が恒久的に盲目になる
bones ファイルの読み込みを許可する
マウスの右ボタンで地図をクリックして調べる
方向などのコマンドの誤りに対してヘルプを表示する
画面上の物品に異なる色を使う
飼い慣らされた、または平和的なモンスターを攻撃する前に尋ねる
視界外の床を違う色で表示する
落とした物品を自動拾いから除外する
8ビット文字をそのまま端末へ送る
tty、curses：#（拡張コマンド）にメニューを使う
X11：すべてのコマンドをメニューに含める（T）か、従来の一部だけを含める（F）
非推奨。複合オプション gender:female を使う
同じ物品に同じ文字を保つようにする
所持品を尋ねるコマンドでメニューを表示する
物品を祝福・呪いの状態で絞り込む際、
金貨を X（不明）と U（呪われていない）のどちらに分類するか
/ コマンドの使用時に利用可能な情報をすべて表示する
クリックしたとき、可能なコマンドの一部をメニューに表示する
マウスで自分自身または隣をクリックした場合
ペットを強調して表示する
物品の山を強調して表示する
break を含め、割り込みシグナルを無視する
可能な場合、所持品表示から "uncursed" を省く
導入のメッセージを表示する
暗い通路が視界内にあれば、明るいものとして表示する
箱の中身を扱う際、o/i/b ではなく a/b/c を使う
メールデーモンを有効にする
階段、祭壇、
泉などの上を歩いたとき、物品に隠れていなくても通知する
壁に向かって歩いたときに通知する
メニューを画面に重ね、右寄せにする
MENUCOLOR のパターン照合を有効にして強調する
所持品などの物品メニューの行を強調する。強調には、
色を使えない場合やオフの場合でも、太字、反転などを使うことがある
防具を持たずに主人公を開始する
端末に NUL を送信することを許可する
このオプションをオフにしてみる（NetHack 自身の
遅延処理を使わせる）。移動する物体が部屋をテレポートして横切るように見える場合
何も所持せずに主人公を開始する
所持品を常設のウィンドウに表示する
盗んだ物品について pickup_types の指定を上書きする
投げた物品について pickup_types の指定を上書きする""".splitlines()


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def preserve_prefix(original: str, body: str, source: str) -> str:
    if body == "__PRESERVE__":
        return original
    leading = re.match(r"\s*", original).group()
    if source == "dat/cmdhelp" and "\t" in original:
        key, _ = original.split("\t", 1)
        return key + "\t" + body
    if source == "dat/opthelp":
        # The exact native option identifier, indentation and raw default are
        # structural fields, not author-supplied Japanese text or game facts.
        default = re.search(r"\s+\[[^\]]+\]$", original)
        suffix = default.group() if default else ""
        key = re.match(r"[^\s]+\s{2,}", original)
        prefix = key.group() if key else leading
        return prefix + body + suffix
    return leading + body


def author(batch_number: int) -> dict:
    input_path = HERE / f"help-history-batch-{batch_number}.json"
    raw = input_path.read_bytes()
    if sha(raw) != PINS[batch_number]: raise ValueError("Frozen resource queue changed")
    batch = json.loads(raw)
    translations = TRANSLATIONS[batch_number]
    if len(translations) != len(batch["entries"]):
        raise ValueError(f"Author count mismatch: batch {batch_number}, {len(translations)}")
    entries = []
    for original, body in zip(batch["entries"], translations, strict=True):
        record = original["source_records"][0]
        source = record["source"]
        english = original["english_named_template"]
        japanese = preserve_prefix(english, body, source)
        if english.count("\n") != japanese.count("\n"): raise ValueError("Original paragraph/newline units changed")
        entry = {
            "id": original["id"], "whole_message_ja": japanese,
            "argument_schemas": deepcopy(original["argument_schemas"]),
            "typed_arguments": deepcopy(original["typed_arguments"]),
            "source_records": deepcopy(original["source_records"]),
            "source_review_status": "faithful-official-source-equivalent",
            "runtime_binding_approved": False, "runtime_integration": False,
            "translation_notes": [
                "Individually authored from the exact pinned official source line/resource unit. Retain facts, uncertainty, negation, names, credits, numbers, dates and original paragraph ordering; no newly inferred game rule or current-history update.",
                "Keep original command/control/option key syntax, literal identifiers/default values, glyph examples, line indentation and structural bytes. Translate explanation only; original parser/consumer/source selection stays authoritative.",
                "Emit only the original selected/exposed resource unit with immutable source-issued ID and exact declared union. No runtime English matching, extra name/state/RNG/native call, new UI row or permission bypass. Source authorship does not approve runtime integration.",
                ("Historical proper names/product/version/platform/newsgroup/font identifiers are preserved as credits/source facts; memorial, chronology and attribution remain those of the original upstream history, not new factual assertions."
                 if source == "dat/history" else
                 "Keyboard/command/option instructions retain the exact original input and conditional-interface meanings. This authoring does not adopt older JNetHack input logic or change bindings/configuration.")
            ],
        }
        if body == "__PRESERVE__":
            entry["localization_disposition"] = (
                "preserved-proper-name-credit-layout" if source == "dat/history" and "- - -" not in english and "http" not in english
                else "preserved-structural-marker" if "- - -" in english or source == "dat/cmdhelp"
                else "preserved-literal-address"
            )
            entry["translation_notes"].append(
                "Preserve this complete original proper-name credit table, separator, literal address or resource-parser directive byte for byte. These source/layout tokens are not Japanese prose and must not be substituted with a translated command or inferred name."
            )
        entries.append(entry)
    payload = {
        "schema_version": 1, "category": "help-history", "batch": batch_number,
        "source_commit": batch["source_commit"], "input_sha256": sha(raw),
        "runtime_binding_approved": False, "runtime_integration": False,
        "japanese_runtime_complete": False,
        "authorship": "New Japanese authoring from the exact official NetHack 5.0.0 source; 2026-10-02, NGPL. Original source rights/attributions remain retained.",
        "entries": entries,
    }
    encoded = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    output = input_path.with_name(input_path.stem + ".authored.json")
    output.write_bytes(encoded)
    return {"batch": batch_number, "ids": len(entries), "bytes": len(encoded), "sha256": sha(encoded), "runtime_binding_approved": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", type=int, choices=list(PINS), action="append")
    options = parser.parse_args()
    print(json.dumps([author(number) for number in (options.batch or list(PINS))], ensure_ascii=False, indent=2))
