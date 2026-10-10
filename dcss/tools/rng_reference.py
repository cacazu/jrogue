"""Compile selected *unmodified* DCSS source bodies and emit RNG fixtures.

No hand-written reference PRNG is used. Includes/build dependencies are replaced
with a standalone standard-library shim; upstream source bodies are copied from
the pristine checkout. The file hashes in the resulting fixture pin the input.

Run with the official emsdk Python, e.g.:
  python tools/rng_reference.py --emsdk C:/Users/kit/emsdk
This compiles with official em++ and runs its standalone module with official
emsdk Node. All generated files/caches are placed under dcss/.build/rng-reference.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "upstream" / "crawl-ref" / "source"
COMMIT = "1eebc1a2892e1c89776a0d7a10691f8dac8d9796"


def read_source(name: str) -> str:
    return (SOURCE / name).read_text(encoding="utf-8")


def between(text: str, start: str, end: str) -> str:
    begin = text.index(start)
    return text[begin:text.index(end, begin)]


PREAMBLE = r'''
// Standalone fixture harness. Bodies below are extracted from official DCSS.
// DCSS portions: GPL-2.0-or-later; PCG portions: Apache-2.0 / MIT, see pcg.cc.
#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <vector>
using namespace std;
#define ASSERT(condition) assert(condition)
#define TAG_MAJOR_VERSION 34
#define ESCAPE 27
'''

HARNESS = r'''
static void emit_word(const char *name, uint64_t word) {
    cout << "\"" << name << "\":\"" << word << "\"";
}
static void emit_pcg(uint64_t seed, uint64_t sequence) {
    rng::PcgRNG generator(seed, sequence);
    cout << "{"; emit_word("seed",seed); cout << ",";
    emit_word("sequence",sequence); cout << ",\"raw\":[";
    for (int i=0; i<128; ++i) {
        if(i) cout << ",";
        cout << generator.get_uint32();
    }
    cout << "],"; emit_word("state", generator.get_state()); cout << ",";
    emit_word("increment",generator.get_inc());
    cout << ",\"count\":" << generator.get_count() << ",\"bounded\":[";
    const uint32_t bounds[] = {0,1,2,3,5,100,2147483648U,2147483649U,4294967295U};
    bool comma=false;
    for (int repeat=0; repeat<64; ++repeat) for (uint32_t bound : bounds) {
        if(comma) cout << ","; comma=true;
        uint32_t value=generator.get_bounded_uint32(bound);
        cout << "{\"bound\":" << bound << ",\"value\":" << value
             << ",\"count\":" << generator.get_count() << "}";
    }
    cout << "],"; emit_word("next_u64",generator.get_uint64()); cout << "}";
}
static void emit_streams(uint64_t seed_value) {
    rng::seed(seed_value);
    cout << "{"; emit_word("seed", seed_value); cout << ",\"values\":[";
    for(int index=0; index<rng::NUM_RNGS; ++index) {
        if(index) cout << ",";
        rng::PcgRNG &generator=rng::_global_state[index];
        cout << "{"; emit_word("state", generator.get_state()); cout << ",";
        emit_word("increment", generator.get_inc()); cout << ",\"raw\":[";
        for(int draw=0; draw<8; ++draw) {
            if(draw) cout << ",";
            cout << generator.get_uint32();
        }
        cout << "]}";
    }
    cout << "]}";
}
static bool operation_comma=false;
static void emit_operation(const char *name, initializer_list<int> params, int result,
                           rng::PcgRNG &generator, int num=-999999) {
    if(operation_comma) cout << ","; operation_comma=true;
    cout << "{\"name\":\"" << name << "\",\"params\":[";
    bool comma=false; for(int parameter : params) {if(comma) cout << ","; comma=true; cout << parameter;}
    cout << "],\"result\":" << result << ",\"count\":" << generator.get_count();
    if(num != -999999) cout << ",\"num\":" << num;
    cout << "}";
}
static void emit_helpers(uint64_t seed_value) {
    rng::PcgRNG generator(seed_value);
    rng::selected=&generator;
    cout << "{"; emit_word("seed",seed_value); cout << ",\"operations\":[";
    operation_comma=false;
    for(int bound : {-9,0,1,2,3,100,2147483647})
        emit_operation("random2",{bound},random2(bound),generator);
    for(int repeat=0; repeat<32; ++repeat) {
        for(auto dimensions : {pair<int,int>{-1,6},{3,0},{0,6},{42,1},{3,6},{10,20}})
            emit_operation("roll_dice",{dimensions.first,dimensions.second},roll_dice(dimensions.first,dimensions.second),generator);
        emit_operation("random2avg",{10,3},random2avg(10,3),generator);
        emit_operation("random2min",{19,0},random2min(19,0),generator);
        emit_operation("random2min",{19,4},random2min(19,4),generator);
        emit_operation("random2max",{19,4},random2max(19,4),generator);
        for(auto fraction : {pair<int,int>{12,3},{17,3},{-17,3},{3,1}}) {
            emit_operation("div_rand_round",{fraction.first,fraction.second},div_rand_round(fraction.first,fraction.second),generator);
            emit_operation("div_round_up",{fraction.first,fraction.second},div_round_up(fraction.first,fraction.second),generator);
            emit_operation("div_round_near",{fraction.first,fraction.second},div_round_near(fraction.first,fraction.second),generator);
        }
        emit_operation("random_range",{-10,7},random_range(-10,7),generator);
        emit_operation("random_range",{7,7},random_range(7,7),generator);
        for(int random_flag : {0,1}) {
            emit_operation("maybe_random2",{19,random_flag},maybe_random2(19,random_flag),generator);
            emit_operation("maybe_random2_div",{27,3,random_flag},maybe_random2_div(27,3,random_flag),generator);
            emit_operation("maybe_roll_dice",{3,6,random_flag},maybe_roll_dice(3,6,random_flag),generator);
            for(auto dimensions : {pair<int,int>{1,0},{1,17},{3,2},{3,17},{0,5}}) {
                dice_def dice=calc_dice(dimensions.first,dimensions.second,random_flag);
                emit_operation("calc_dice",{dimensions.first,dimensions.second,random_flag},dice.size,generator,dice.num);
            }
        }
        for(auto probability : {pair<int,int>{0,10},{10,10},{1,3},{7,19}})
            emit_operation("x_chance_in_y",{probability.first,probability.second},x_chance_in_y(probability.first,probability.second),generator);
        for(int denominator : {-1,1,19}) emit_operation("one_chance_in",{denominator},one_chance_in(denominator),generator);
        emit_operation("biased_random2",{23,4},biased_random2(23,4),generator);
        emit_operation("coinflip",{},coinflip(),generator);
        double real=random_real(); uint64_t bits; memcpy(&bits,&real,sizeof(bits));
        cout << ",{\"name\":\"random_real\",\"params\":[],\"result\":0,\"bits\":\""
             << bits << "\",\"count\":" << generator.get_count() << "}";
    }
    cout << "]}";
}
int main() {
    const uint64_t seeds[] = {0,1,42,UINT64_MAX,0x0123456789abcdefULL};
    cout << "{";
    // KEY_REFERENCE_JSON
    cout << "\"num_branches\":" << NUM_BRANCHES << ",\"num_rngs\":" << rng::NUM_RNGS << ",\"pcg\":[";
    bool comma=false;
    for(uint64_t seed : seeds) for(uint64_t sequence : {uint64_t(2305843009213693951ULL),uint64_t(54),UINT64_MAX}) {
        if(comma) cout << ","; comma=true; emit_pcg(seed,sequence);
    }
    cout << "],\"streams\":["; comma=false;
    for(uint64_t seed : seeds) {if(comma) cout << ","; comma=true; emit_streams(seed);}
    cout << "],\"helpers\":["; comma=false;
    for(uint64_t seed : seeds) {if(comma) cout << ","; comma=true; emit_helpers(seed);}
    cout << "]}" << endl;
}
'''


def generate_harness() -> str:
    pcg_header = read_source("pcg.h").replace("#pragma once", "")
    pcg_source = read_source("pcg.cc")
    pcg_source = pcg_source[:pcg_source.index("    PcgRNG::PcgRNG(const CrawlVector")]
    pcg_source = pcg_source.replace('#include "AppHdr.h"', "").replace('#include "pcg.h"', "") + "}\n"
    branch_header = read_source("branch-type.h").replace("#pragma once", "").replace('#include "tag-version.h"', "")
    role_header = read_source("rng-type.h").replace("#pragma once", "").replace('#include "branch-type.h"', "")
    key_enum = between(read_source("cio.h"), "enum KEYS", "\n};") + "\n};\n"
    key_names = list(dict.fromkeys(re.findall(r"\b(CK_[A-Z0-9_]+)\s*(?:=|,)", key_enum)))
    key_output = 'cout << "\\\"keys\\\":{";\n'
    for index, name in enumerate(key_names):
        key_output += f'cout << "{"," if index else ""}\\\"{name}\\\":" << {name};\n'
    key_output += 'cout << "},";\n'
    random_source = read_source("random.cc")
    seeding = between(random_source, "    static void _do_seeding", "    void seed()")
    seeding = "namespace rng { static vector<PcgRNG> _global_state(NUM_RNGS);\n" + seeding + "}\n"
    current = "namespace rng { PcgRNG *selected=nullptr; PcgRNG &current_generator(){return *selected;} uint64_t get_uint64(){return selected->get_uint64();} }\n"
    prototypes = between(read_source("random.h"), "bool coinflip();", "/** Chooses one")
    dice_struct = between(read_source("random.h"), "struct dice_def", "constexpr dice_def CONVENIENT_NONZERO_DAMAGE")
    dice_struct += "dice_def calc_dice(int num_dice, int max_damage, bool random=true);\n"
    helpers = between(random_source, "// [low, high]", "// This is used when the front-end")
    # `ui_random` is the only helper depending on the process-global RAII switch;
    # it is irrelevant to these fixtures and is omitted rather than reimplemented.
    ui_start = helpers.index("int ui_random(int max)")
    ui_end = helpers.index("// [0, 1]", ui_start)
    helpers = helpers[:ui_start] + helpers[ui_end:]
    return PREAMBLE + pcg_header + pcg_source + branch_header + role_header + key_enum + seeding + current + prototypes + dice_struct + helpers + HARNESS.replace("// KEY_REFERENCE_JSON", key_output)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--emsdk", type=Path, required=True)
    arguments = parser.parse_args()
    emsdk = arguments.emsdk.resolve()
    build = ROOT / ".build" / "rng-reference"
    build.mkdir(parents=True, exist_ok=True)
    cpp = build / "reference.cpp"
    cpp.write_text(generate_harness(), encoding="utf-8")
    config = (emsdk / ".emscripten").read_text(encoding="utf-8")
    config_values: dict[str, str] = {"__file__": str(emsdk / ".emscripten")}
    # Only official emsdk's fixed path assignments are read; no config is executed.
    for line in config.splitlines():
        if "=" not in line or not line.startswith(("NODE_JS", "PYTHON")):
            continue
        key, value = line.split("=", 1)
        config_values[key.strip()] = value.strip().strip("'\"").replace("$CFGDIR", str(emsdk))
    python = config_values["PYTHON"]
    node = config_values["NODE_JS"]
    emscripten = emsdk / "upstream" / "emscripten"
    compiler = emscripten / "em++.py"
    if not compiler.is_file():
        compiler = emscripten / "em++"
    output = build / "reference.cjs"
    env = os.environ.copy()
    env["EM_CACHE"] = str(build / "cache")
    command = [python, str(compiler), str(cpp), "-std=c++17", "-O2", "-sENVIRONMENT=node", "-sSINGLE_FILE=1", "-sEXIT_RUNTIME=1", "-o", str(output)]
    subprocess.run(command, check=True, env=env)
    result = subprocess.run([node, str(output)], check=True, stdout=subprocess.PIPE, text=True, env=env)
    (build / "reference-output.json").write_text(result.stdout, encoding="utf-8")
    fixture = json.loads(result.stdout)
    input_files = ["pcg.cc", "pcg.h", "random.cc", "random.h", "branch-type.h", "rng-type.h", "tag-version.h", "cio.h"]
    fixture["provenance"] = {
        "upstream_commit": COMMIT,
        "tag_major_version": 34,
        "source_sha256": {name: hashlib.sha256((SOURCE / name).read_bytes()).hexdigest() for name in input_files},
        "compiler": subprocess.run([python, str(compiler), "--version"], check=True, stdout=subprocess.PIPE, text=True, env=env).stdout.strip(),
        "node": subprocess.run([node, "--version"], check=True, stdout=subprocess.PIPE, text=True).stdout.strip(),
        "generator": "dcss/tools/rng_reference.py: source bodies extracted verbatim; standalone dependency shim",
        "licenses": "DCSS GPL-2.0-or-later; PCG output/initialization Apache-2.0; bounded sampling MIT",
    }
    tests = ROOT / "tests"
    tests.mkdir(exist_ok=True)
    target = tests / "reference_rng.json"
    target.write_text(json.dumps(fixture, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"fixture": str(target), "num_branches": fixture["num_branches"], "num_rngs": fixture["num_rngs"], "pcg_cases": len(fixture["pcg"]), "raw_words": sum(len(c["raw"]) for c in fixture["pcg"]), "bounded_draws": sum(len(c["bounded"]) for c in fixture["pcg"]), "stream_cases": len(fixture["streams"]), "helper_operations": sum(len(c["operations"]) for c in fixture["helpers"])}))


if __name__ == "__main__":
    main()
