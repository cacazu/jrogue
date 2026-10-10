// Prepared source tests, deliberately unexecuted while the full-engine link
// window is closed. No native/Rust runtime acceptance follows from this file.
use super::*;

fn npc(chance: i32, pass: NpcPass) -> NpcCollisionFrame {
    NpcCollisionFrame { origin: [15, -8, 0], cursor: [16, -7, 0], position: [20, -4, 0],
        npc_id: 123, native_chance: chance, pass }
}

#[test]
fn canonical_utf8_signed_coordinates_and_native_static_pick() {
    let frame = WeatherFrame { resolved_tile_id: "weather_rain", tile_position: [7, -9, 0],
        screen_position: [30, 14] };
    assert_eq!(weather_seed(&frame), 970_736_461);
    assert_eq!(static_weather_choices(&frame, &[3, 0, 1, 5], &[1, 2]),
        Ok(StaticWeatherChoices { seed: 970_736_461, loc_rand: 2_520_004_080,
            foreground: Some(2), background: Some(0) }));
    let extremes = WeatherFrame { resolved_tile_id: "雪/試験\0ID",
        tile_position: [i32::MIN, i32::MAX, -10], screen_position: [0, -1] };
    assert_eq!(weather_seed(&extremes), 20_751_964);
    assert_eq!(static_weather_choices(&extremes, &[3, 0, 1, 5], &[1, 2]),
        Ok(StaticWeatherChoices { seed: 20_751_964, loc_rand: 2_180_686_522,
            foreground: Some(3), background: Some(1) }));
}

#[test]
fn single_and_zero_weight_lists_keep_native_semantics() {
    let frame = WeatherFrame { resolved_tile_id: "weather_rain", tile_position: [7, -9, 0],
        screen_position: [30, 14] };
    let selected = static_weather_choices(&frame, &[1], &[]).expect("valid fixture weights");
    assert_eq!(selected.loc_rand, 0);
    assert_eq!(selected.foreground, Some(0));
    assert_eq!(selected.background, None);
    let zero = static_weather_choices(&frame, &[0], &[0]).expect("valid fixture weights");
    assert_eq!(zero.foreground, None);
    assert_eq!(zero.background, None);
    assert_eq!(static_weather_choices(&frame, &[i32::MAX as u32, 1], &[]),
        Err(WeightError::NativeTotalOverflow));
}

#[test]
fn native_signed_one_in_branch_and_color_equality() {
    for chance in [i32::MIN, -1, 0, 1] {
        let frame = npc(chance, NpcPass::Nearby);
        assert!(accept_npc_color(&frame));
        assert_eq!(collision_color(5, 9, &frame), 9);
        assert_eq!(collision_color(5, 5, &frame), 5);
    }
    assert!(!accept_npc_color(&npc(2, NpcPass::Nearby)));
    assert!(accept_npc_color(&npc(3, NpcPass::Nearby)));
    assert!(!accept_npc_color(&npc(11, NpcPass::Nearby)));
    assert!(!accept_npc_color(&npc(i32::MAX, NpcPass::Nearby)));
    assert_eq!(collision_color(5, 9, &npc(2, NpcPass::Nearby)), 5);
    assert_eq!(collision_color(5, 9, &npc(3, NpcPass::Nearby)), 9);
}

#[test]
fn incomplete_modulo_interval_is_rejected_and_bounds_hold() {
    let max = std::num::NonZeroU32::new(i32::MAX as u32).expect("nonzero fixture");
    assert_eq!(bounded_word(0, max), 33_350_994); // first word zero rejected
    for bound in [2, 3, 7, 257, 1_073_741_825, i32::MAX as u32] {
        let nonzero = std::num::NonZeroU32::new(bound).expect("nonzero fixture");
        for key in [0, 1, 0x8000_0000, u32::MAX, 0x1234_5678] {
            let value = bounded_word(key, nonzero);
            assert!(value < bound);
            assert_eq!(bounded_word(key, nonzero), value);
        }
    }
}

#[test]
fn repeat_and_interleaving_have_no_retained_random_state() {
    let weather = WeatherFrame { resolved_tile_id: "weather_rain", tile_position: [7, -9, 0],
        screen_position: [30, 14] };
    let original = weather_seed(&weather);
    let collision = npc(3, NpcPass::Nearby);
    let color = accept_npc_color(&collision);
    for chance in 2..80 {
        let _ = accept_npc_color(&npc(chance, NpcPass::Followers));
        assert_eq!(weather_seed(&weather), original);
        assert_eq!(accept_npc_color(&collision), color);
    }
}
