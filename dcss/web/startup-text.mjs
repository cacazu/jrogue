// Native Text display formatter. GPL-3.0-or-later. Synchronous Rust instance only.
export const STARTUP_TEXT_PIN = {
  "version": 2,
  "schema_version": 2,
  "source": "startup-text-v2",
  "scope": "startup-text-v2",
  "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
  "release": "0.34.1",
  "id": "startup.weapon.prompt",
  "nativeSource": "b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c",
  "nativeSources": {
    "crawl-ref/source/newgame.cc": "b3186394e72e533d40fbf2e69d5b4b8a3b123f847a3a488ac49fb4252b92f10c",
    "crawl-ref/source/output.cc": "2c3c07fa6c7f4e49e9b959da50cc8cff8434b492b807318163a1ce4002fa8d09"
  },
  "boundary": {
    "path": "/build/boundary.wasm",
    "bytes": 1730911,
    "sha256": "4085de458f89f9a1e3471d6f0bb55519bb8464818afb7660fcc67d6a6d01c8e1"
  },
  "catalogs": [
    {
      "path": "/locales/startup/en.json",
      "sha256": "1fe29184d921ff7b809f168394efddd9601681c357481fddb87bda8cc77bb866"
    },
    {
      "path": "/locales/startup/ja.json",
      "sha256": "849f34f6db7f27595bbec292b1ad522baf8757db8c392b82da6c9b0102a629ab"
    },
    {
      "path": "/locales/startup/source-map.json",
      "sha256": "cac159c02ec30ebcadebf8188228d25f15e03af51d1a7533ad25c9c64dec042c"
    },
    {
      "path": "/locales/hud/en.json",
      "sha256": "b798663af3e53d7b69aa83e29eeb9b8bb1e4311eda691fcf1ac86172bceb3271"
    },
    {
      "path": "/locales/hud/ja.json",
      "sha256": "aef2cd906b3b6d732660a369600e256e2c68ea0e05944768f3c433f408e98908"
    },
    {
      "path": "/locales/hud/source-map.json",
      "sha256": "5342725fad28351f57d6ce2397c44958f7134095a426e71f9de3eaa39b095957"
    },
    {
      "path": "/locales/dynamic/en.json",
      "sha256": "fd9833b02b7d7d53d3f5fc4f5d945ad902f8eaa9b10ec9df897351bd2b9f7e48"
    },
    {
      "path": "/locales/dynamic/ja.json",
      "sha256": "30a2955caa27b208011295635b3936fc4a2105b74c5fb637d3f289e2397aadb0"
    },
    {
      "path": "/locales/dynamic/source-map.json",
      "sha256": "5d4da67523be4d33b90faeb7acc7864ad86b9f890edeac527da23747cb9979ed"
    },
    {
      "path": "/locales/entities/source-map.json",
      "sha256": "aaef766c49513f402bbad188343665858f0f5520a2ab98f77ae60d9281b736d3"
    },
    {
      "path": "/locales/entities/species.en.json",
      "sha256": "071bf224b495a209dd1f9ebd482cbf4784fac31b7c88d5a953765c95c9d77cea"
    },
    {
      "path": "/locales/entities/species.ja.json",
      "sha256": "d01b82c16cde13c30f591338713a8df1b36c2a280b3e3c2ff9f62c4a2154f9f5"
    },
    {
      "path": "/locales/entities/jobs.en.json",
      "sha256": "dffec19d521ec853001c046c7bb8c6b5abc01f962dca0bf1ac79694ce3390b1b"
    },
    {
      "path": "/locales/entities/jobs.ja.json",
      "sha256": "58218cc87dab82ee4d763ecf10cfa3940137486ba14f40af16fa158c9afbf965"
    }
  ],
  "en": "You have a choice of weapons.",
  "ja": "武器を選べます。",
  "ids": [
    "startup.weapon.prompt",
    "startup.weapon.recommended.label",
    "startup.weapon.recommended.description",
    "startup.weapon.aptitudes.label",
    "startup.weapon.aptitudes.description",
    "startup.weapon.help.label",
    "startup.weapon.help.description",
    "startup.weapon.random.label",
    "startup.weapon.random.description",
    "startup.weapon.back.label",
    "startup.weapon.back.description",
    "startup.dynamic.species_name",
    "startup.dynamic.job_name",
    "startup.dynamic.character.a",
    "startup.dynamic.character.an",
    "startup.dynamic.welcome.empty",
    "startup.dynamic.welcome.named_only",
    "startup.dynamic.welcome.named_job",
    "startup.dynamic.welcome.named_species",
    "startup.dynamic.welcome.named_species_job",
    "startup.dynamic.welcome.unnamed_job",
    "startup.dynamic.welcome.unnamed_species",
    "startup.dynamic.welcome.unnamed_species_job",
    "hud.magic.drained_label",
    "hud.magic.label",
    "hud.health.drained_label",
    "hud.health.label",
    "hud.noise.label",
    "hud.noise.silenced",
    "hud.gold.label",
    "hud.doom.label",
    "hud.contamination.label",
    "hud.experience.label",
    "hud.next_level.label",
    "hud.place.label",
    "hud.armour.label",
    "hud.evasion.label",
    "hud.shield.label",
    "hud.strength.label",
    "hud.intelligence.label",
    "hud.dexterity.label",
    "hud.time.label",
    "hud.turn.label",
    "hud.equipment.compact_label",
    "hud.equipment.label"
  ],
  "messages": {
    "startup.weapon.prompt": {
      "en": "You have a choice of weapons.",
      "ja": "武器を選べます。",
      "catalog_shape": "string",
      "source_site": "startup.weapon.prompt",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.recommended.label": {
      "en": "+ - Recommended random choice",
      "ja": "+ - おすすめからランダム選択",
      "catalog_shape": "string",
      "source_site": "startup.weapon.recommended.label.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.recommended.description": {
      "en": "Picks a random recommended weapon",
      "ja": "おすすめの武器からランダムに選びます",
      "catalog_shape": "string",
      "source_site": "startup.weapon.recommended.description.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.aptitudes.label": {
      "en": "% - List aptitudes",
      "ja": "% - 適性一覧",
      "catalog_shape": "string",
      "source_site": "startup.weapon.aptitudes.label.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.aptitudes.description": {
      "en": "Lists the numerical skill train aptitudes for all races",
      "ja": "全種族の技能訓練適性を数値で表示します",
      "catalog_shape": "string",
      "source_site": "startup.weapon.aptitudes.description.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.help.label": {
      "en": "? - Help",
      "ja": "? - ヘルプ",
      "catalog_shape": "string",
      "source_site": "startup.weapon.help.label.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.help.description": {
      "en": "Opens the help screen",
      "ja": "ヘルプ画面を開きます",
      "catalog_shape": "string",
      "source_site": "startup.weapon.help.description.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.random.label": {
      "en": "* - Random weapon",
      "ja": "* - ランダムな武器",
      "catalog_shape": "string",
      "source_site": "startup.weapon.random.label.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.random.description": {
      "en": "Picks a random weapon",
      "ja": "武器をランダムに選びます",
      "catalog_shape": "string",
      "source_site": "startup.weapon.random.description.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.back.label": {
      "en": "Bksp - Return to character menu",
      "ja": "Bksp - キャラクター選択に戻る",
      "catalog_shape": "string",
      "source_site": "startup.weapon.back.label.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.weapon.back.description": {
      "en": "Lets you return back to Character choice menu",
      "ja": "キャラクター選択メニューに戻ります",
      "catalog_shape": "string",
      "source_site": "startup.weapon.back.description.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "fixed",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/startup/source-map.json",
      "en_catalog": "/locales/startup/en.json",
      "ja_catalog": "/locales/startup/ja.json"
    },
    "startup.dynamic.species_name": {
      "en": "{species}",
      "ja": "{species}",
      "catalog_shape": "typed",
      "source_site": "startup.dynamic.group.name.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_human.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.job_name": {
      "en": "{job}",
      "ja": "{job}",
      "catalog_shape": "typed",
      "source_site": "startup.dynamic.group.name.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "job": {
          "type": "entity_label",
          "role": "job"
        }
      },
      "source_params": {
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        }
      },
      "preflight_params": {
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.character.a": {
      "en": "You are a {species} {job}.",
      "ja": "あなたは{species}の{job}です。",
      "catalog_shape": "typed",
      "source_site": "startup.name.character.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        },
        "job": {
          "type": "entity_label",
          "role": "job"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_human.name",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.character.an": {
      "en": "You are an {species} {job}.",
      "ja": "あなたは{species}の{job}です。",
      "catalog_shape": "typed",
      "source_site": "startup.name.character.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        },
        "job": {
          "type": "entity_label",
          "role": "job"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_octopode.name",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.empty": {
      "en": "Welcome.",
      "ja": "ようこそ。",
      "catalog_shape": "string",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.named_only": {
      "en": "Welcome, {player_name}.",
      "ja": "{player_name}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "player_name": {
          "type": "actor_label",
          "role": "external_username"
        }
      },
      "source_params": {
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "visibility": "external",
          "form": "name"
        }
      },
      "preflight_params": {
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "form": "name",
          "identity": {
            "visibility": "external",
            "name": "DcssExternalName"
          }
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.named_job": {
      "en": "Welcome, {player_name} the {job}.",
      "ja": "{job}の{player_name}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "job": {
          "type": "entity_label",
          "role": "job"
        },
        "player_name": {
          "type": "actor_label",
          "role": "external_username"
        }
      },
      "source_params": {
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        },
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "visibility": "external",
          "form": "name"
        }
      },
      "preflight_params": {
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        },
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "form": "name",
          "identity": {
            "visibility": "external",
            "name": "DcssExternalName"
          }
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.named_species": {
      "en": "Welcome, {player_name} the {species}.",
      "ja": "{species}の{player_name}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        },
        "player_name": {
          "type": "actor_label",
          "role": "external_username"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        },
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "visibility": "external",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_human.name",
          "form": "name"
        },
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "form": "name",
          "identity": {
            "visibility": "external",
            "name": "DcssExternalName"
          }
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.named_species_job": {
      "en": "Welcome, {player_name} the {species} {job}.",
      "ja": "{species}の{job}、{player_name}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        },
        "job": {
          "type": "entity_label",
          "role": "job"
        },
        "player_name": {
          "type": "actor_label",
          "role": "external_username"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        },
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "visibility": "external",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_human.name",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        },
        "player_name": {
          "kind": "actor_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "form": "name",
          "identity": {
            "visibility": "external",
            "name": "DcssExternalName"
          }
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.unnamed_job": {
      "en": "Welcome, unnamed {job}.",
      "ja": "名無しの{job}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "job": {
          "type": "entity_label",
          "role": "job"
        }
      },
      "source_params": {
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        }
      },
      "preflight_params": {
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.unnamed_species": {
      "en": "Welcome, unnamed {species}.",
      "ja": "名無しの{species}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_human.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "startup.dynamic.welcome.unnamed_species_job": {
      "en": "Welcome, unnamed {species} {job}.",
      "ja": "名無しの{species}の{job}さん、ようこそ。",
      "catalog_shape": "typed",
      "source_site": "startup.welcome.output",
      "native_source": "crawl-ref/source/newgame.cc",
      "category": "dynamic",
      "parameters": {
        "species": {
          "type": "entity_label",
          "role": "species"
        },
        "job": {
          "type": "entity_label",
          "role": "job"
        }
      },
      "source_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "domain": "species",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "domain": "job",
          "form": "name"
        }
      },
      "preflight_params": {
        "species": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "species",
          "id": "species.sp_human.name",
          "form": "name"
        },
        "job": {
          "kind": "entity_label",
          "version": 1,
          "upstream": "1eebc1a2892e1c89776a0d7a10691f8dac8d9796",
          "domain": "job",
          "id": "job.job_fighter.name",
          "form": "name"
        }
      },
      "source_map": "/locales/dynamic/source-map.json",
      "en_catalog": "/locales/dynamic/en.json",
      "ja_catalog": "/locales/dynamic/ja.json"
    },
    "hud.magic.drained_label": {
      "en": "MP: ",
      "ja": "魔: ",
      "catalog_shape": "string",
      "source_site": "hud.magic.drained_label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.magic.label": {
      "en": "Magic:  ",
      "ja": "魔力:   ",
      "catalog_shape": "string",
      "source_site": "hud.magic.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.health.drained_label": {
      "en": "HP: ",
      "ja": "体: ",
      "catalog_shape": "string",
      "source_site": "hud.health.drained_label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.health.label": {
      "en": "Health: ",
      "ja": "体力:   ",
      "catalog_shape": "string",
      "source_site": "hud.health.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.noise.label": {
      "en": "Noise: ",
      "ja": "騒音:  ",
      "catalog_shape": "string",
      "source_site": "hud.noise.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.noise.silenced": {
      "en": "Silenced  ",
      "ja": "沈黙      ",
      "catalog_shape": "string",
      "source_site": "hud.noise.silenced",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.gold.label": {
      "en": "Gold:",
      "ja": "金貨:",
      "catalog_shape": "string",
      "source_site": "hud.gold.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.doom.label": {
      "en": "Doom: ",
      "ja": "破滅: ",
      "catalog_shape": "string",
      "source_site": "hud.doom.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.contamination.label": {
      "en": "Contam: ",
      "ja": "汚染:   ",
      "catalog_shape": "string",
      "source_site": "hud.contamination.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.experience.label": {
      "en": "XL: ",
      "ja": "級: ",
      "catalog_shape": "string",
      "source_site": "hud.experience.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.next_level.label": {
      "en": "Next: ",
      "ja": "次:   ",
      "catalog_shape": "string",
      "source_site": "hud.next_level.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.place.label": {
      "en": "Place: ",
      "ja": "場所:  ",
      "catalog_shape": "string",
      "source_site": "hud.place.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.armour.label": {
      "en": "AC:",
      "ja": "防:",
      "catalog_shape": "string",
      "source_site": "hud.armour.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.evasion.label": {
      "en": "EV:",
      "ja": "避:",
      "catalog_shape": "string",
      "source_site": "hud.evasion.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.shield.label": {
      "en": "SH:",
      "ja": "盾:",
      "catalog_shape": "string",
      "source_site": "hud.shield.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.strength.label": {
      "en": "Str:",
      "ja": "力: ",
      "catalog_shape": "string",
      "source_site": "hud.strength.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.intelligence.label": {
      "en": "Int:",
      "ja": "知: ",
      "catalog_shape": "string",
      "source_site": "hud.intelligence.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.dexterity.label": {
      "en": "Dex:",
      "ja": "技: ",
      "catalog_shape": "string",
      "source_site": "hud.dexterity.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.time.label": {
      "en": "Time:",
      "ja": "時間:",
      "catalog_shape": "string",
      "source_site": "hud.time.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.turn.label": {
      "en": "Turn:",
      "ja": "手番:",
      "catalog_shape": "string",
      "source_site": "hud.turn.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.equipment.compact_label": {
      "en": "Eq: ",
      "ja": "装: ",
      "catalog_shape": "string",
      "source_site": "hud.equipment.compact_label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    },
    "hud.equipment.label": {
      "en": "Equip: ",
      "ja": "装備:  ",
      "catalog_shape": "string",
      "source_site": "hud.equipment.label",
      "native_source": "crawl-ref/source/output.cc",
      "category": "hud",
      "parameters": {},
      "source_params": {},
      "preflight_params": {},
      "source_map": "/locales/hud/source-map.json",
      "en_catalog": "/locales/hud/en.json",
      "ja_catalog": "/locales/hud/ja.json"
    }
  },
  "entityRegistry": {
    "species": {
      "species.sp_armataur.name": {
        "en": "Armataur",
        "ja": "アルマタウル",
        "identity": "SP_ARMATAUR"
      },
      "species.sp_barachi.name": {
        "en": "Barachi",
        "ja": "バラキ",
        "identity": "SP_BARACHI"
      },
      "species.sp_base_draconian.name": {
        "en": "Draconian",
        "ja": "ドラコニアン",
        "identity": "SP_BASE_DRACONIAN"
      },
      "species.sp_black_draconian.name": {
        "en": "Black Draconian",
        "ja": "黒色ドラコニアン",
        "identity": "SP_BLACK_DRACONIAN"
      },
      "species.sp_centaur.name": {
        "en": "Centaur",
        "ja": "ケンタウロス",
        "identity": "SP_CENTAUR"
      },
      "species.sp_coglin.name": {
        "en": "Coglin",
        "ja": "コグリン",
        "identity": "SP_COGLIN"
      },
      "species.sp_deep_dwarf.name": {
        "en": "Deep Dwarf",
        "ja": "深層ドワーフ",
        "identity": "SP_DEEP_DWARF"
      },
      "species.sp_deep_elf.name": {
        "en": "Deep Elf",
        "ja": "深層エルフ",
        "identity": "SP_DEEP_ELF"
      },
      "species.sp_demigod.name": {
        "en": "Demigod",
        "ja": "半神",
        "identity": "SP_DEMIGOD"
      },
      "species.sp_demonspawn.name": {
        "en": "Demonspawn",
        "ja": "魔神の末裔",
        "identity": "SP_DEMONSPAWN"
      },
      "species.sp_djinni.name": {
        "en": "Djinni",
        "ja": "ジン",
        "identity": "SP_DJINNI"
      },
      "species.sp_felid.name": {
        "en": "Felid",
        "ja": "猫人",
        "identity": "SP_FELID"
      },
      "species.sp_formicid.name": {
        "en": "Formicid",
        "ja": "蟻人",
        "identity": "SP_FORMICID"
      },
      "species.sp_gargoyle.name": {
        "en": "Gargoyle",
        "ja": "ガーゴイル",
        "identity": "SP_GARGOYLE"
      },
      "species.sp_ghoul.name": {
        "en": "Ghoul",
        "ja": "グール",
        "identity": "SP_GHOUL"
      },
      "species.sp_gnoll.name": {
        "en": "Gnoll",
        "ja": "ノール",
        "identity": "SP_GNOLL"
      },
      "species.sp_green_draconian.name": {
        "en": "Green Draconian",
        "ja": "緑色ドラコニアン",
        "identity": "SP_GREEN_DRACONIAN"
      },
      "species.sp_grey_draconian.name": {
        "en": "Grey Draconian",
        "ja": "灰色ドラコニアン",
        "identity": "SP_GREY_DRACONIAN"
      },
      "species.sp_halfling.name": {
        "en": "Halfling",
        "ja": "ハーフリング",
        "identity": "SP_HALFLING"
      },
      "species.sp_high_elf.name": {
        "en": "High Elf",
        "ja": "ハイエルフ",
        "identity": "SP_HIGH_ELF"
      },
      "species.sp_hill_orc.name": {
        "en": "Hill Orc",
        "ja": "丘オーク",
        "identity": "SP_HILL_ORC"
      },
      "species.sp_human.name": {
        "en": "Human",
        "ja": "人間",
        "identity": "SP_HUMAN"
      },
      "species.sp_kobold.name": {
        "en": "Kobold",
        "ja": "コボルド",
        "identity": "SP_KOBOLD"
      },
      "species.sp_lava_orc.name": {
        "en": "Lava Orc",
        "ja": "溶岩オーク",
        "identity": "SP_LAVA_ORC"
      },
      "species.sp_mayflytaur.name": {
        "en": "Mayflytaur",
        "ja": "カゲロウタウル",
        "identity": "SP_MAYFLYTAUR"
      },
      "species.sp_merfolk.name": {
        "en": "Merfolk",
        "ja": "人魚",
        "identity": "SP_MERFOLK"
      },
      "species.sp_meteoran.name": {
        "en": "Meteoran",
        "ja": "メテオラン",
        "identity": "SP_METEORAN"
      },
      "species.sp_minotaur.name": {
        "en": "Minotaur",
        "ja": "ミノタウロス",
        "identity": "SP_MINOTAUR"
      },
      "species.sp_mottled_draconian.name": {
        "en": "Mottled Draconian",
        "ja": "斑模様のドラコニアン",
        "identity": "SP_MOTTLED_DRACONIAN"
      },
      "species.sp_mountain_dwarf.name": {
        "en": "Mountain Dwarf",
        "ja": "山岳ドワーフ",
        "identity": "SP_MOUNTAIN_DWARF"
      },
      "species.sp_mummy.name": {
        "en": "Mummy",
        "ja": "ミイラ",
        "identity": "SP_MUMMY"
      },
      "species.sp_naga.name": {
        "en": "Naga",
        "ja": "ナーガ",
        "identity": "SP_NAGA"
      },
      "species.sp_octopode.name": {
        "en": "Octopode",
        "ja": "オクトポード",
        "identity": "SP_OCTOPODE"
      },
      "species.sp_oni.name": {
        "en": "Oni",
        "ja": "鬼",
        "identity": "SP_ONI"
      },
      "species.sp_pale_draconian.name": {
        "en": "Pale Draconian",
        "ja": "淡色ドラコニアン",
        "identity": "SP_PALE_DRACONIAN"
      },
      "species.sp_poltergeist.name": {
        "en": "Poltergeist",
        "ja": "ポルターガイスト",
        "identity": "SP_POLTERGEIST"
      },
      "species.sp_purple_draconian.name": {
        "en": "Purple Draconian",
        "ja": "紫色ドラコニアン",
        "identity": "SP_PURPLE_DRACONIAN"
      },
      "species.sp_red_draconian.name": {
        "en": "Red Draconian",
        "ja": "赤色ドラコニアン",
        "identity": "SP_RED_DRACONIAN"
      },
      "species.sp_revenant.name": {
        "en": "Revenant",
        "ja": "レヴナント",
        "identity": "SP_REVENANT"
      },
      "species.sp_sludge_elf.name": {
        "en": "Sludge Elf",
        "ja": "泥エルフ",
        "identity": "SP_SLUDGE_ELF"
      },
      "species.sp_spriggan.name": {
        "en": "Spriggan",
        "ja": "スプリガン",
        "identity": "SP_SPRIGGAN"
      },
      "species.sp_tengu.name": {
        "en": "Tengu",
        "ja": "天狗",
        "identity": "SP_TENGU"
      },
      "species.sp_troll.name": {
        "en": "Troll",
        "ja": "トロル",
        "identity": "SP_TROLL"
      },
      "species.sp_vampire.name": {
        "en": "Vampire",
        "ja": "吸血鬼",
        "identity": "SP_VAMPIRE"
      },
      "species.sp_vine_stalker.name": {
        "en": "Vine Stalker",
        "ja": "蔓の潜行者",
        "identity": "SP_VINE_STALKER"
      },
      "species.sp_white_draconian.name": {
        "en": "White Draconian",
        "ja": "白色ドラコニアン",
        "identity": "SP_WHITE_DRACONIAN"
      },
      "species.sp_yellow_draconian.name": {
        "en": "Yellow Draconian",
        "ja": "黄色ドラコニアン",
        "identity": "SP_YELLOW_DRACONIAN"
      }
    },
    "job": {
      "job.job_abyssal_knight.name": {
        "en": "Abyssal Knight",
        "ja": "深淵の騎士",
        "identity": "JOB_ABYSSAL_KNIGHT"
      },
      "job.job_air_elementalist.name": {
        "en": "Air Elementalist",
        "ja": "風の精霊術師",
        "identity": "JOB_AIR_ELEMENTALIST"
      },
      "job.job_alchemist.name": {
        "en": "Alchemist",
        "ja": "錬金術師",
        "identity": "JOB_ALCHEMIST"
      },
      "job.job_artificer.name": {
        "en": "Artificer",
        "ja": "魔道具使い",
        "identity": "JOB_ARTIFICER"
      },
      "job.job_berserker.name": {
        "en": "Berserker",
        "ja": "狂戦士",
        "identity": "JOB_BERSERKER"
      },
      "job.job_brigand.name": {
        "en": "Brigand",
        "ja": "盗賊",
        "identity": "JOB_BRIGAND"
      },
      "job.job_chaos_knight.name": {
        "en": "Chaos Knight",
        "ja": "混沌の騎士",
        "identity": "JOB_CHAOS_KNIGHT"
      },
      "job.job_cinder_acolyte.name": {
        "en": "Cinder Acolyte",
        "ja": "燃え殻の侍祭",
        "identity": "JOB_CINDER_ACOLYTE"
      },
      "job.job_conjurer.name": {
        "en": "Conjurer",
        "ja": "妖術師",
        "identity": "JOB_CONJURER"
      },
      "job.job_death_knight.name": {
        "en": "Death Knight",
        "ja": "死の騎士",
        "identity": "JOB_DEATH_KNIGHT"
      },
      "job.job_delver.name": {
        "en": "Delver",
        "ja": "探索者",
        "identity": "JOB_DELVER"
      },
      "job.job_earth_elementalist.name": {
        "en": "Earth Elementalist",
        "ja": "地の精霊術師",
        "identity": "JOB_EARTH_ELEMENTALIST"
      },
      "job.job_enchanter.name": {
        "en": "Enchanter",
        "ja": "呪術師",
        "identity": "JOB_ENCHANTER"
      },
      "job.job_fighter.name": {
        "en": "Fighter",
        "ja": "戦士",
        "identity": "JOB_FIGHTER"
      },
      "job.job_fire_elementalist.name": {
        "en": "Fire Elementalist",
        "ja": "炎の精霊術師",
        "identity": "JOB_FIRE_ELEMENTALIST"
      },
      "job.job_forgewright.name": {
        "en": "Forgewright",
        "ja": "鍛造術師",
        "identity": "JOB_FORGEWRIGHT"
      },
      "job.job_gladiator.name": {
        "en": "Gladiator",
        "ja": "剣闘士",
        "identity": "JOB_GLADIATOR"
      },
      "job.job_healer.name": {
        "en": "Healer",
        "ja": "治療師",
        "identity": "JOB_HEALER"
      },
      "job.job_hedge_wizard.name": {
        "en": "Hedge Wizard",
        "ja": "野の魔術師",
        "identity": "JOB_HEDGE_WIZARD"
      },
      "job.job_hexslinger.name": {
        "en": "Hexslinger",
        "ja": "呪術射手",
        "identity": "JOB_HEXSLINGER"
      },
      "job.job_hunter.name": {
        "en": "Hunter",
        "ja": "狩人",
        "identity": "JOB_HUNTER"
      },
      "job.job_ice_elementalist.name": {
        "en": "Ice Elementalist",
        "ja": "氷の精霊術師",
        "identity": "JOB_ICE_ELEMENTALIST"
      },
      "job.job_jester.name": {
        "en": "Jester",
        "ja": "道化師",
        "identity": "JOB_JESTER"
      },
      "job.job_monk.name": {
        "en": "Monk",
        "ja": "修行僧",
        "identity": "JOB_MONK"
      },
      "job.job_necromancer.name": {
        "en": "Necromancer",
        "ja": "死霊術師",
        "identity": "JOB_NECROMANCER"
      },
      "job.job_priest.name": {
        "en": "Priest",
        "ja": "司祭",
        "identity": "JOB_PRIEST"
      },
      "job.job_reaver.name": {
        "en": "Reaver",
        "ja": "略奪者",
        "identity": "JOB_REAVER"
      },
      "job.job_shapeshifter.name": {
        "en": "Shapeshifter",
        "ja": "変身術師",
        "identity": "JOB_SHAPESHIFTER"
      },
      "job.job_skald.name": {
        "en": "Skald",
        "ja": "吟遊詩人",
        "identity": "JOB_SKALD"
      },
      "job.job_stalker.name": {
        "en": "Stalker",
        "ja": "潜行者",
        "identity": "JOB_STALKER"
      },
      "job.job_summoner.name": {
        "en": "Summoner",
        "ja": "召喚術師",
        "identity": "JOB_SUMMONER"
      },
      "job.job_wanderer.name": {
        "en": "Wanderer",
        "ja": "放浪者",
        "identity": "JOB_WANDERER"
      },
      "job.job_warper.name": {
        "en": "Warper",
        "ja": "転移術師",
        "identity": "JOB_WARPER"
      }
    }
  },
  "externalNameBytes": 128
};
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const MAX_REQUEST = 4096, MAX_RESPONSE = 8192, MAX_NATIVE_BYTES = 511;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keys = (value, expected) => object(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key));
function freeze(value) {
  if (object(value) || Array.isArray(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
freeze(STARTUP_TEXT_PIN);
function locale(value) {
  if (value !== 'en' && value !== 'ja') throw Error('unsupported native display locale');
  return value;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function entity(value, domain) {
  if (!keys(value, ['kind', 'version', 'upstream', 'domain', 'id', 'form']) || value.kind !== 'entity_label'
      || value.version !== 1 || value.upstream !== STARTUP_TEXT_PIN.upstream || value.domain !== domain || value.form !== 'name'
      || typeof value.id !== 'string' || !Object.hasOwn(STARTUP_TEXT_PIN.entityRegistry[domain], value.id))
    throw Error('unreviewed native entity label descriptor');
  return value.id;
}
function actor(value) {
  if (!keys(value, ['kind', 'version', 'upstream', 'form', 'identity']) || value.kind !== 'actor_label' || value.version !== 1
      || value.upstream !== STARTUP_TEXT_PIN.upstream || value.form !== 'name' || !keys(value.identity, ['visibility', 'name'])
      || value.identity.visibility !== 'external' || typeof value.identity.name !== 'string'
      || !value.identity.name.length || /\p{Cc}/u.test(value.identity.name)
      || Array.from(value.identity.name).some(character => {const point=character.codePointAt(0);return point>=0xd800&&point<=0xdfff;})
      || encoder.encode(value.identity.name).length > STARTUP_TEXT_PIN.externalNameBytes)
    throw Error('unreviewed native external actor descriptor');
  return value.identity.name;
}
export function validateNativeDisplayMessage(id, params) {
  if (typeof id !== 'string' || !Object.hasOwn(STARTUP_TEXT_PIN.messages, id)) throw Error('unreviewed native display ID');
  const schema = STARTUP_TEXT_PIN.messages[id].parameters;
  if (!keys(params, Object.keys(schema))) throw Error('unreviewed native display parameter keys');
  for (const [key, descriptor] of Object.entries(schema)) {
    if (descriptor.type === 'entity_label') entity(params[key], descriptor.role);
    else if (descriptor.type === 'actor_label') actor(params[key]);
    else throw Error('unreviewed native display parameter type');
  }
  if (encoder.encode(JSON.stringify(params)).length > 2047) throw Error('native display parameters exceed reviewed bound');
}
export function expectedNativeDisplayText(id, params, language) {
  validateNativeDisplayMessage(id, params); locale(language);
  const message = STARTUP_TEXT_PIN.messages[id];
  const values = Object.fromEntries(Object.entries(message.parameters).map(([key, schema]) => [key,
    schema.type === 'entity_label' ? STARTUP_TEXT_PIN.entityRegistry[schema.role][entity(params[key], schema.role)][language] : actor(params[key])]));
  const text = message[language].replace(/\{([a-z][a-z0-9_]*)\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw Error('reviewed native template has an unknown placeholder');
    return values[key];
  });
  if (text.includes('\0') || encoder.encode(text).length > MAX_NATIVE_BYTES) throw Error('native display result exceeds reviewed buffer');
  return text;
}
function range(memory, pointer, length) {
  if (!Number.isInteger(pointer) || pointer <= 0 || !Number.isInteger(length) || length <= 0 || pointer + length > memory.buffer.byteLength)
    throw Error('invalid Rust native-display ABI range');
}
export function createStartupTextBridge(exports, language = 'ja') {
  locale(language);
  if (!(exports?.memory instanceof WebAssembly.Memory) || ['dcss_allocate', 'dcss_request', 'dcss_release'].some(name => typeof exports[name] !== 'function')
      || exports.dcss_allocate.length !== 1 || exports.dcss_request.length !== 2 || exports.dcss_release.length !== 2) throw Error('unsupported Rust native-display ABI');
  let busy = false;
  function render(id, params, requestedLanguage) {
    const expected = expectedNativeDisplayText(id, params, requestedLanguage);
    if (busy) throw Error('reentrant Rust native-display formatting');
    const inputBytes = encoder.encode(JSON.stringify({ language: requestedLanguage, op: 'text', message: { id, params } }));
    if (!inputBytes.length || inputBytes.length > MAX_REQUEST) throw Error('native-display request exceeds reviewed bound');
    let input = 0, output = 0, length = 0, inputOwned = false, outputOwned = false; busy = true;
    try {
      const allocated = exports.dcss_allocate(inputBytes.length);
      if (!Number.isInteger(allocated) || allocated < -0x80000000 || allocated > 0xffffffff) throw Error('invalid Rust native-display allocation');
      input = allocated >>> 0; range(exports.memory, input, inputBytes.length); inputOwned = true;
      new Uint8Array(exports.memory.buffer, input, inputBytes.length).set(inputBytes);
      const packed = exports.dcss_request(input, inputBytes.length);
      if (typeof packed !== 'bigint' || packed <= 0n || packed > 0xffffffffffffffffn) throw Error('invalid Rust native-display response descriptor');
      output = Number(packed & 0xffffffffn); length = Number(packed >> 32n);
      if (length > MAX_RESPONSE) throw Error('Rust native-display response exceeds reviewed bound');
      range(exports.memory, output, length);
      if (output < input + inputBytes.length && input < output + length) throw Error('Rust native-display output aliases input');
      outputOwned = true;
      const response = JSON.parse(decoder.decode(new Uint8Array(exports.memory.buffer, output, length)));
      if (!keys(response, ['ok', 'value', 'session', 'messages', 'text']) || response.ok !== true || response.value !== null || response.session !== null
          || !Array.isArray(response.messages) || response.messages.length !== 1 || !keys(response.messages[0], ['id', 'params'])
          || response.messages[0].id !== id || canonical(response.messages[0].params) !== canonical(params)
          || !Array.isArray(response.text) || response.text.length !== 1 || response.text[0] !== expected)
        throw Error('Rust native-display response differs from reviewed descriptor/catalog');
      return response.text[0];
    } finally {
      try { if (outputOwned) exports.dcss_release(output, length); }
      finally { try { if (inputOwned) exports.dcss_release(input, inputBytes.length); } finally { busy = false; } }
    }
  }
  for (const id of STARTUP_TEXT_PIN.ids) for (const language of ['en', 'ja']) render(id, STARTUP_TEXT_PIN.messages[id].preflight_params, language);
  return Object.freeze({ language, format(id, params) { return render(id, params, language); } });
}
export async function loadStartupTextBridge(language = 'ja', dependencies = {}) {
  locale(language);
  const fetcher = dependencies.fetcher ?? globalThis.fetch, crypto = dependencies.crypto ?? globalThis.crypto;
  const instantiate = dependencies.instantiate ?? WebAssembly.instantiate;
  if (typeof fetcher !== 'function' || !crypto?.subtle || typeof instantiate !== 'function') throw Error('native display preflight dependencies unavailable');
  if (!/^[a-f0-9]{64}$/.test(STARTUP_TEXT_PIN.boundary.sha256) || STARTUP_TEXT_PIN.boundary.bytes <= 0) throw Error('native v2 boundary pin awaits reviewed Rust build');
  async function bytes(pin, limit) {
    const response = await fetcher(pin.path, { cache: 'no-store' });
    if (!response?.ok) throw Error('native display artifact fetch failed: ' + pin.path);
    const buffer = await response.arrayBuffer();
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > limit || (pin.bytes !== undefined && buffer.byteLength !== pin.bytes)) throw Error('native display artifact size mismatch');
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    if (Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('') !== pin.sha256) throw Error('native display artifact checksum mismatch: ' + pin.path);
    return new Uint8Array(buffer);
  }
  const assets = {};
  for (const pin of STARTUP_TEXT_PIN.catalogs) assets[pin.path] = JSON.parse(decoder.decode(await bytes(pin, 256 * 1024)));
  for (const [id, expected] of Object.entries(STARTUP_TEXT_PIN.messages)) {
    const source = assets[expected.source_map], receipt = source?.messages?.find(message => message.id === id);
    const enEntry = assets[expected.en_catalog]?.[id], jaEntry = assets[expected.ja_catalog]?.[id];
    const enText = typeof enEntry === 'string' ? enEntry : enEntry?.text;
    const jaText = typeof jaEntry === 'string' ? jaEntry : jaEntry?.text;
    if (source?.schema_version !== 1 || source.commit !== STARTUP_TEXT_PIN.upstream || source.release !== STARTUP_TEXT_PIN.release
        || !source.source_files?.some(file => file.path.replace(/^upstream\//,'') === expected.native_source && file.sha256 === STARTUP_TEXT_PIN.nativeSources[expected.native_source])
        || enText !== expected.en || jaText !== expected.ja
        || receipt?.expected_en !== expected.en || !Array.isArray(receipt.source_sites) || !receipt.source_sites.includes(expected.source_site))
      throw Error('native display source binding mismatch: ' + id);
    // The descriptor schemas are generated from the reviewed dynamic source map;
    // scalar startup/HUD bindings must still carry exactly empty parameters.
    if (Object.keys(expected.parameters).length === 0 && !keys(receipt.params, [])) throw Error('fixed native display source parameters changed');
    if (canonical(receipt.params) !== canonical(expected.source_params)) throw Error('native display source parameter schema mismatch: ' + id);
    if (expected.catalog_shape === 'typed' && (!keys(enEntry,['text','params'])||!keys(jaEntry,['text','params'])
        || canonical(enEntry.params)!==canonical(expected.source_params)
        || canonical(jaEntry.params)!==canonical(expected.source_params))) throw Error('dynamic catalog descriptor schema mismatch: '+id);
    if (expected.catalog_shape === 'string' && (typeof enEntry!=='string'||typeof jaEntry!=='string'))
      throw Error('fixed native catalog value must be a string: '+id);
  }
  const registry = assets['/locales/entities/source-map.json'];
  if (registry?.schema_version !== 1 || registry.commit !== STARTUP_TEXT_PIN.upstream || registry.release !== STARTUP_TEXT_PIN.release) throw Error('native entity registry source mismatch');
  for (const domain of ['species', 'job']) for (const [id, value] of Object.entries(STARTUP_TEXT_PIN.entityRegistry[domain])) {
    const record = registry.records?.find(record => record.kind === domain && record.name_id === id);
    if (!record || record.identity !== value.identity || record.name !== value.en || assets['/locales/entities/' + (domain === 'job' ? 'jobs' : 'species') + '.en.json']?.[id] !== value.en
        || assets['/locales/entities/' + (domain === 'job' ? 'jobs' : 'species') + '.ja.json']?.[id] !== value.ja) throw Error('native entity name binding mismatch: ' + id);
  }
  const result = await instantiate(await bytes(STARTUP_TEXT_PIN.boundary, STARTUP_TEXT_PIN.boundary.bytes), {});
  return createStartupTextBridge(result?.instance?.exports, language);
}
