fn main() {
    let mut checks = 0_u32;
    let mut failed = 0_u32;
    let text_0 = [119_u8, 101_u8, 97_u8, 116_u8, 104_u8, 101_u8, 114_u8, 95_u8, 114_u8, 97_u8, 105_u8, 110_u8];
    let weather_0 = weather_seed(&WeatherFrame {
        resolved_tile_id: std::str::from_utf8(&text_0).expect("frozen UTF-8"),
        tile_position: [7, -9, 0],
        screen_position: [30, 14],
    });
    checks += 1;
    if weather_0 != 970736461_u32 { failed += 1; }
    println!("{{\"weather\":0,\"seed\":{}}}", weather_0);
    let text_1 = [233_u8, 155_u8, 170_u8, 47_u8, 232_u8, 169_u8, 166_u8, 233_u8, 168_u8, 147_u8, 0_u8, 73_u8, 68_u8];
    let weather_1 = weather_seed(&WeatherFrame {
        resolved_tile_id: std::str::from_utf8(&text_1).expect("frozen UTF-8"),
        tile_position: [-2147483648, 2147483647, -10],
        screen_position: [0, -1],
    });
    checks += 1;
    if weather_1 != 20751964_u32 { failed += 1; }
    println!("{{\"weather\":1,\"seed\":{}}}", weather_1);
    let text_2 = [];
    let weather_2 = weather_seed(&WeatherFrame {
        resolved_tile_id: std::str::from_utf8(&text_2).expect("frozen UTF-8"),
        tile_position: [0, 0, 0],
        screen_position: [0, 0],
    });
    checks += 1;
    if weather_2 != 1125213341_u32 { failed += 1; }
    println!("{{\"weather\":2,\"seed\":{}}}", weather_2);
    let frame_0 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 2,
        pass: NpcPass::Nearby,
    };
    let key_0 = npc_key(&frame_0);
    let accepted_0 = accept_npc_color(&frame_0);
    checks += 1;
    if key_0 != 1957281461_u32 || accepted_0 != false { failed += 1; }
    println!("{{\"npc\":0,\"key\":{},\"accepted\":{}}}", key_0, accepted_0);
    let frame_1 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 3,
        pass: NpcPass::Nearby,
    };
    let key_1 = npc_key(&frame_1);
    let accepted_1 = accept_npc_color(&frame_1);
    checks += 1;
    if key_1 != 2957903112_u32 || accepted_1 != true { failed += 1; }
    println!("{{\"npc\":1,\"key\":{},\"accepted\":{}}}", key_1, accepted_1);
    let frame_2 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 11,
        pass: NpcPass::Nearby,
    };
    let key_2 = npc_key(&frame_2);
    let accepted_2 = accept_npc_color(&frame_2);
    checks += 1;
    if key_2 != 2394937052_u32 || accepted_2 != false { failed += 1; }
    println!("{{\"npc\":2,\"key\":{},\"accepted\":{}}}", key_2, accepted_2);
    let frame_3 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 2147483647,
        pass: NpcPass::Nearby,
    };
    let key_3 = npc_key(&frame_3);
    let accepted_3 = accept_npc_color(&frame_3);
    checks += 1;
    if key_3 != 4085792626_u32 || accepted_3 != false { failed += 1; }
    println!("{{\"npc\":3,\"key\":{},\"accepted\":{}}}", key_3, accepted_3);
    let frame_4 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 0,
        pass: NpcPass::Nearby,
    };
    let key_4 = npc_key(&frame_4);
    let accepted_4 = accept_npc_color(&frame_4);
    checks += 1;
    if key_4 != 273122906_u32 || accepted_4 != true { failed += 1; }
    println!("{{\"npc\":4,\"key\":{},\"accepted\":{}}}", key_4, accepted_4);
    let frame_5 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 1,
        pass: NpcPass::Nearby,
    };
    let key_5 = npc_key(&frame_5);
    let accepted_5 = accept_npc_color(&frame_5);
    checks += 1;
    if key_5 != 3609436889_u32 || accepted_5 != true { failed += 1; }
    println!("{{\"npc\":5,\"key\":{},\"accepted\":{}}}", key_5, accepted_5);
    let frame_6 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: -1,
        pass: NpcPass::Nearby,
    };
    let key_6 = npc_key(&frame_6);
    let accepted_6 = accept_npc_color(&frame_6);
    checks += 1;
    if key_6 != 338164967_u32 || accepted_6 != true { failed += 1; }
    println!("{{\"npc\":6,\"key\":{},\"accepted\":{}}}", key_6, accepted_6);
    let frame_7 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: -2147483648,
        pass: NpcPass::Nearby,
    };
    let key_7 = npc_key(&frame_7);
    let accepted_7 = accept_npc_color(&frame_7);
    checks += 1;
    if key_7 != 2589458578_u32 || accepted_7 != true { failed += 1; }
    println!("{{\"npc\":7,\"key\":{},\"accepted\":{}}}", key_7, accepted_7);
    let frame_8 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 2,
        pass: NpcPass::Followers,
    };
    let key_8 = npc_key(&frame_8);
    let accepted_8 = accept_npc_color(&frame_8);
    checks += 1;
    if key_8 != 1577400621_u32 || accepted_8 != true { failed += 1; }
    println!("{{\"npc\":8,\"key\":{},\"accepted\":{}}}", key_8, accepted_8);
    let frame_9 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 3,
        pass: NpcPass::Followers,
    };
    let key_9 = npc_key(&frame_9);
    let accepted_9 = accept_npc_color(&frame_9);
    checks += 1;
    if key_9 != 296844648_u32 || accepted_9 != true { failed += 1; }
    println!("{{\"npc\":9,\"key\":{},\"accepted\":{}}}", key_9, accepted_9);
    let frame_10 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 11,
        pass: NpcPass::Followers,
    };
    let key_10 = npc_key(&frame_10);
    let accepted_10 = accept_npc_color(&frame_10);
    checks += 1;
    if key_10 != 2844610672_u32 || accepted_10 != true { failed += 1; }
    println!("{{\"npc\":10,\"key\":{},\"accepted\":{}}}", key_10, accepted_10);
    let frame_11 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 2147483647,
        pass: NpcPass::Followers,
    };
    let key_11 = npc_key(&frame_11);
    let accepted_11 = accept_npc_color(&frame_11);
    checks += 1;
    if key_11 != 4022343120_u32 || accepted_11 != false { failed += 1; }
    println!("{{\"npc\":11,\"key\":{},\"accepted\":{}}}", key_11, accepted_11);
    let frame_12 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 0,
        pass: NpcPass::Followers,
    };
    let key_12 = npc_key(&frame_12);
    let accepted_12 = accept_npc_color(&frame_12);
    checks += 1;
    if key_12 != 3918002522_u32 || accepted_12 != true { failed += 1; }
    println!("{{\"npc\":12,\"key\":{},\"accepted\":{}}}", key_12, accepted_12);
    let frame_13 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: 1,
        pass: NpcPass::Followers,
    };
    let key_13 = npc_key(&frame_13);
    let accepted_13 = accept_npc_color(&frame_13);
    checks += 1;
    if key_13 != 4140747742_u32 || accepted_13 != true { failed += 1; }
    println!("{{\"npc\":13,\"key\":{},\"accepted\":{}}}", key_13, accepted_13);
    let frame_14 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: -1,
        pass: NpcPass::Followers,
    };
    let key_14 = npc_key(&frame_14);
    let accepted_14 = accept_npc_color(&frame_14);
    checks += 1;
    if key_14 != 594240713_u32 || accepted_14 != true { failed += 1; }
    println!("{{\"npc\":14,\"key\":{},\"accepted\":{}}}", key_14, accepted_14);
    let frame_15 = NpcCollisionFrame {
        origin: [15, -8, 0],
        cursor: [16, -7, 0],
        position: [20, -4, 0],
        npc_id: 123, native_chance: -2147483648,
        pass: NpcPass::Followers,
    };
    let key_15 = npc_key(&frame_15);
    let accepted_15 = accept_npc_color(&frame_15);
    checks += 1;
    if key_15 != 406332530_u32 || accepted_15 != true { failed += 1; }
    println!("{{\"npc\":15,\"key\":{},\"accepted\":{}}}", key_15, accepted_15);
    let bounded_0 = bounded_word(0_u32,
        std::num::NonZeroU32::new(2147483647_u32).expect("frozen positive bound"));
    checks += 1;
    if bounded_0 != 33350994_u32 { failed += 1; }
    println!("{{\"rejection\":0,\"value\":{}}}", bounded_0);
    let bounded_1 = bounded_word(1_u32,
        std::num::NonZeroU32::new(1073741825_u32).expect("frozen positive bound"));
    checks += 1;
    if bounded_1 != 680104127_u32 { failed += 1; }
    println!("{{\"rejection\":1,\"value\":{}}}", bounded_1);
    let bounded_2 = bounded_word(4294967295_u32,
        std::num::NonZeroU32::new(3_u32).expect("frozen positive bound"));
    checks += 1;
    if bounded_2 != 0_u32 { failed += 1; }
    println!("{{\"rejection\":2,\"value\":{}}}", bounded_2);
    let frame = WeatherFrame { resolved_tile_id: "weather_rain", tile_position: [7, -9, 0], screen_position: [30, 14] };
    let repeated = weather_seed(&frame);
    for chance in 2..80 {
        let _ = accept_npc_color(&NpcCollisionFrame { origin: [15, -8, 0], cursor: [16, -7, 0], position: [20, -4, 0], npc_id: 123, native_chance: chance, pass: NpcPass::Followers });
        if weather_seed(&frame) != repeated { failed += 1; }
    }
    checks += 1;
    println!("{{\"summary\":true,\"checks\":{},\"failed\":{}}}", checks, failed);
    if failed != 0 { std::process::exit(1); }
}
