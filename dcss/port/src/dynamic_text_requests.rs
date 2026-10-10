//! Tests the actual request boundary after the independently staged TextRuns merge.
use serde_json::{Value, json};

#[test]
fn structured_families_reach_actual_text_runs_and_keep_text_backward_compatible() {
    let source = crate::UPSTREAM_COMMIT;
    let content = json!({"kind":"rich_text","version":1,"upstream":source,"runs":[
        {"kind":"entity","label":{"version":1,"upstream":source,"domain":"species","id":"species.sp_human.name","form":"name"}},
        {"kind":"actor","label":{"version":1,"upstream":source,"form":"name","identity":{"visibility":"external","name":"外{n}"}}},
        {"kind":"item","label":{"version":1,"upstream":source,"identity":{"visibility":"base","class":"potion"},"form":"base_name","count":"2"}},
        {"kind":"quantity","label":{"version":1,"upstream":source,"value":"18446744073709551615"}},
        {"kind":"command","label":{"version":1,"upstream":source,"command":"command.display_spells","binding":"native_resolved","token":"Ctrl+P"}}
    ]});
    for (language, expected) in [
        ("en", "Human外{n}potion18446744073709551615Ctrl+P"),
        ("ja", "人間外{n}薬18446744073709551615Ctrl+P"),
    ] {
        let message = json!({"id":"boundary.dynamic.rich_text","params":{"content":content}});
        let request = json!({"language":language,"op":"text_runs","message":message});
        let response: Value =
            serde_json::from_str(&crate::application::handle(&request.to_string()))
                .expect("response");
        assert_eq!(response["ok"], true);
        assert_eq!(response["text"], json!([expected]));
        assert_eq!(response["value"]["text"], expected);
        assert_eq!(response["messages"], json!([message]));
        let roles = response["value"]["runs"]
            .as_array()
            .expect("runs")
            .iter()
            .map(|run| run["role"].as_str().expect("role"))
            .collect::<Vec<_>>();
        assert_eq!(
            roles,
            [
                "entity_label",
                "external_name",
                "item_label",
                "quantity",
                "command_token"
            ]
        );
        let old_request = json!({"language":language,"op":"text","message":message});
        let old: Value =
            serde_json::from_str(&crate::application::handle(&old_request.to_string()))
                .expect("old response");
        assert_eq!(old["ok"], true);
        assert_eq!(old["value"], Value::Null);
        assert_eq!(old["text"], response["text"]);
        assert_eq!(old["messages"], response["messages"]);
        let mut bad = request.clone();
        bad["message"]["params"]["content"]["runs"][2]["label"]["identity"]["hidden_subtype"] =
            json!("secret_cure");
        let rejected: Value =
            serde_json::from_str(&crate::application::handle(&bad.to_string())).expect("rejection");
        assert_eq!(rejected["ok"], false);
        assert!(!rejected.to_string().contains("secret_cure"));
    }
}
