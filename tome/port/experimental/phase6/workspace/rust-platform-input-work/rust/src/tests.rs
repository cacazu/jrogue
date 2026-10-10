// SPDX-License-Identifier: GPL-3.0-or-later
use super::*;
use serde_json::{Value,json};
fn input(value:Value)->Input { serde_json::from_value(value).expect("typed input") }
fn key(code:&str,key:&str,phase:&str,mods:Value)->Input {
    input(json!({"kind":"key","owned_focus":true,"editable":false,"phase":phase,
        "code":code,"key":key,"repeat":false,"composing":false,"modifiers":mods}))
}
fn point()->Value { json!({"client_x":110.0,"client_y":70.0,
    "rect":{"left":10.0,"top":20.0,"width":200.0,"height":100.0},
    "window_width":800,"window_height":400}) }
fn packet_key(output:&Mapped)->(u32,i32,u32,bool,bool) {
    match output.packets.first().expect("key packet") {
        Packet::Key {scancode,keycode,modifiers,down,repeat} => (*scancode,*keycode,*modifiers,*down,*repeat),
        _=>panic!("expected key"),
    }
}

#[test]
fn original_default_shortcuts_survive() {
    for (code,name,scan,mods,mask) in [("KeyI","i",12,json!({}),0),
        ("KeyM","m",16,json!({}),0),("KeyJ","j",13,json!({}),0),
        ("KeyQ","q",20,json!({"ctrl":true}),0x40),
        ("KeyE","E",8,json!({"shift":true}),1)] {
        let out=Mapper::default().map(key(code,name,"down",mods));
        assert_eq!(packet_key(&out),(scan,i32::from(name.as_bytes()[0].to_ascii_lowercase()),mask,true,false));
        assert!(out.stop_propagation);
        assert_eq!(out.prevent_default,mask & 0xc0 != 0);
        assert!(!out.packets.iter().any(|p|matches!(p,Packet::Text {..})));
    }
}
#[test]
fn external_focus_editing_and_reserved_shortcuts_are_untouched() {
    for change in [json!({"owned_focus":false}),json!({"editable":true}),json!({"composing":true})] {
        let mut value=serde_json::to_value(json!({"kind":"key","owned_focus":true,"editable":false,
            "phase":"down","key":"i","code":"KeyI","repeat":false,"composing":false,"modifiers":{}})).unwrap();
        for (name,value_change) in change.as_object().unwrap(){value[name]=value_change.clone();}
        assert_eq!(Mapper::default().map(input(value)),Mapped::default());
    }
    for code in ["KeyL","KeyW","KeyR","KeyT","KeyN","KeyP","F5","F12"] {
        assert_eq!(Mapper::default().map(key(code,"", "down",json!({"ctrl":true}))),Mapped::default());
    }
    assert_eq!(Mapper::default().map(key("KeyI","i","down",json!({"meta":true}))),Mapped::default());
}
#[test]
fn repeated_keydown_and_focus_lost_keyup_preserve_physical_lifecycle() {
    let mut mapper=Mapper::default();
    mapper.map(key("KeyI","i","down",json!({})));
    assert!(packet_key(&mapper.map(key("KeyI","i","down",json!({})))).4);
    let up=input(json!({"kind":"key","owned_focus":false,"editable":true,"composing":true,
        "phase":"up","key":"Process","code":"KeyI","repeat":false,"modifiers":{}}));
    assert!(!packet_key(&mapper.map(up)).3);
    assert!(mapper.keys.is_empty());
}
#[test]
fn known_modifier_sides_do_not_collapse_to_left() {
    let mut mapper=Mapper::default();
    assert_eq!(packet_key(&mapper.map(key("ShiftRight","Shift","down",json!({"shift":true})))).2,2);
    assert_eq!(packet_key(&mapper.map(key("ShiftLeft","Shift","down",json!({"shift":true})))).2,3);
    assert_eq!(packet_key(&mapper.map(key("ShiftLeft","Shift","up",json!({"shift":true})))).2,2);
    assert_eq!(packet_key(&mapper.map(key("KeyE","E","down",json!({"shift":true})))).2,2);
    assert_eq!(packet_key(&mapper.map(key("ShiftRight","Shift","up",json!({})))).2,0);
}
#[test]
fn blur_releases_native_keys_and_buttons_without_text_or_tick() {
    let mut mapper=Mapper::default();
    mapper.map(key("ControlRight","Control","down",json!({"ctrl":true})));
    mapper.map(key("KeyQ","q","down",json!({"ctrl":true})));
    mapper.map(input(json!({"kind":"mouse_button","owned_focus":true,"phase":"down",
        "button":2,"point":point(),"modifiers":{}})));
    let out=mapper.map(Input::Blur{});
    assert_eq!(out.packets.len(),3);
    assert!(out.packets.iter().all(|p| matches!(p,Packet::Key {down:false,..}|Packet::MouseButton {down:false,..})));
    assert!(mapper.keys.is_empty()&&mapper.buttons.is_empty());
    assert!(out.composition.expect("clear preedit").text.is_empty());
    assert!(!out.prevent_default);
}
#[test]
fn japanese_commit_stays_one_full_utf8_packet_and_preedit_is_host_only() {
    let text="日本語🙂".repeat(20);
    let mut mapper=Mapper::default();
    let composing=mapper.map(input(json!({"kind":"composition","owned_focus":true,
        "text":text,"start":2,"length":3})));
    assert!(composing.packets.is_empty());
    assert!(!composing.prevent_default&&!composing.stop_propagation);
    let out=mapper.map(input(json!({"kind":"text","owned_focus":true,"text":text,"modifiers":{}})));
    assert_eq!(out.packets,vec![Packet::Text {text,modifiers:0}]);
}
#[test]
fn nul_controls_and_excessive_text_reject_without_state_changes() {
    let mut mapper=Mapper::default();
    for text in ["a\0b".to_owned(),"a\nb".to_owned(),"a\u{7f}b".to_owned(),"あ".repeat(6000)] {
        let out=mapper.map(input(json!({"kind":"text","owned_focus":true,"text":text,"modifiers":{}})));
        assert_eq!(out.error_id,Some("input.error.text"));
        assert!(out.packets.is_empty());
    }
    assert!(mapper.keys.is_empty());
}
#[test]
fn coordinate_transform_uses_actual_native_viewport() {
    let mut mapper=Mapper::default();
    let out=mapper.map(input(json!({"kind":"mouse_motion","owned_focus":true,"point":point(),
        "relative":false,"movement_x":0.0,"movement_y":0.0,"buttons":0,"modifiers":{}})));
    assert_eq!(out.packets,vec![Packet::MouseMotion {relative:false,x:400,y:200,modifiers:0}]);
    let out=mapper.map(input(json!({"kind":"mouse_motion","owned_focus":true,"point":point(),
        "relative":true,"movement_x":2.5,"movement_y":-2.0,"buttons":0,"modifiers":{}})));
    assert_eq!(out.packets,vec![Packet::MouseMotion {relative:true,x:10,y:-8,modifiers:0}]);
}
#[test]
fn wheel_scaling_and_mouse_location_match_pinned_backend() {
    for (mode,delta,want) in [(0,100.0,1.0),(1,3.0,1.0),(2,1.0,80.0)] {
        let out=Mapper::default().map(input(json!({"kind":"wheel","owned_focus":true,
            "point":point(),"delta_x":delta,"delta_y":delta,"delta_mode":mode,"modifiers":{}})));
        assert_eq!(out.packets,vec![Packet::Wheel {x:want,y:-want,mouse_x:400,mouse_y:200,modifiers:0}]);
    }
}
#[test]
fn dom_middle_right_and_extended_buttons_keep_sdl_numbers() {
    let mut mapper=Mapper::default();
    for (button,want) in [(0,1),(1,2),(2,3),(3,4),(4,5),(7,8)] {
        let out=mapper.map(input(json!({"kind":"mouse_button","owned_focus":true,
            "phase":"down","button":button,"point":point(),"modifiers":{"alt":true}})));
        assert_eq!(out.packets,vec![Packet::MouseButton {down:true,button:want,x:400,y:200,modifiers:0x100}]);
    }
}
#[test]
fn legacy_keycodes_and_keypad_locations_match_original_sdk() {
    assert_eq!(keycodes::keycode(4,"q",81,0),113);
    assert_eq!(keycodes::keycode(30,"!",49,0),49);
    assert_eq!(keycodes::keycode(228,"Control",17,2),(1<<30)|228);
    assert_eq!(keycodes::keycode(89,"End",35,3),(1<<30)|89);
    assert_eq!(keycodes::keycode(88,"Enter",13,3),(1<<30)|88);
    assert_eq!(keycodes::keycode(135,"ろ",229,0),0);
    assert_eq!(keycodes::keycode(4,"q",0,0),113);
    assert_eq!(keycodes::scancode("F24"),Some(115));
}
#[test]
fn invalid_geometry_and_unknown_schema_are_rejected() {
    let mut bad=point();bad["rect"]["width"]=json!(0);
    let out=Mapper::default().map(input(json!({"kind":"wheel","owned_focus":true,
        "point":bad,"delta_x":1.0,"delta_y":1.0,"delta_mode":0,"modifiers":{}})));
    assert_eq!(out.error_id,Some("input.error.coordinates"));
    assert!(serde_json::from_value::<Input>(json!({"kind":"blur","tick":true})).is_err());
    assert!(serde_json::from_value::<Modifiers>(json!({"unrecognized":true})).is_err());
}

#[test]
fn printable_keydown_allows_committed_text_but_navigation_stays_guarded() {
    let mut mapper=Mapper::default();
    let keydown=mapper.map(key("KeyI","i","down",json!({})));
    assert!(keydown.handled&&keydown.stop_propagation);
    assert!(!keydown.prevent_default);
    assert!(!keydown.packets.iter().any(|packet| matches!(packet,Packet::Text {..})));
    let commit=mapper.map(input(json!({"kind":"text","owned_focus":true,
        "text":"い","modifiers":{}})));
    assert_eq!(commit.packets,vec![Packet::Text {text:"い".to_owned(),modifiers:0}]);
    for (code,name) in [("ArrowLeft","ArrowLeft"),("Backspace","Backspace"),
        ("Tab","Tab"),("F1","F1"),("F24","F24")] {
        let out=mapper.map(key(code,name,"down",json!({})));
        assert!(out.prevent_default&&out.stop_propagation);
    }
    assert!(mapper.map(key("KeyQ","q","down",json!({"ctrl":true}))).prevent_default);
    assert!(mapper.map(key("KeyI","i","up",json!({}))).prevent_default);
}

#[test]
fn over_limit_wheel_rejects_before_changing_physical_mouse_state() {
    let mut mapper=Mapper::default();
    mapper.map(input(json!({"kind":"mouse_button","owned_focus":true,
        "phase":"down","button":0,"point":point(),"modifiers":{}})));
    let before=mapper.buttons.clone();
    let mut moved=point();moved["client_x"]=json!(150.0);
    let rejected=mapper.map(input(json!({"kind":"wheel","owned_focus":true,
        "point":moved,"delta_x":100_001.0*100.0,"delta_y":0.0,
        "delta_mode":0,"modifiers":{}})));
    assert_eq!(rejected.error_id,Some("input.error.wheel"));
    assert!(rejected.packets.is_empty());
    assert_eq!(mapper.buttons,before);
    let boundary=mapper.map(input(json!({"kind":"wheel","owned_focus":true,
        "point":point(),"delta_x":100_000.0*100.0,"delta_y":-100_000.0*100.0,
        "delta_mode":0,"modifiers":{}})));
    assert!(boundary.error_id.is_none());
    assert_eq!(boundary.packets,vec![Packet::Wheel {x:100_000.0,y:100_000.0,
        mouse_x:400,mouse_y:200,modifiers:0}]);
}
