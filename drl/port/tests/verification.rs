use drl_web_port::{display::Parameter, verification::Verification};
use std::collections::BTreeMap;

#[test]
fn language_and_repeated_render_preserve_entire_checkpoint() {
    let mut session = Verification::new(5489).unwrap();
    assert_eq!(session.draw(), 3499211612);
    let before = session.checkpoint();
    for _ in 0..100 {
        for english in [true, false] {
            session
                .render(
                    english,
                    "lab.last_value",
                    BTreeMap::from([("value".into(), Parameter::Number(3499211612))]),
                )
                .unwrap();
        }
    }
    assert_eq!(session.checkpoint(), before);
}

#[test]
fn restore_replays_future_values_and_rolls_without_render_entropy() {
    let mut session = Verification::new(123456).unwrap();
    session.draw();
    session.dice(2, 4).unwrap();
    session.observe_input("input_walkleft");
    let checkpoint = session.checkpoint();
    let save = session.save().unwrap();
    let future = [session.draw(), session.dice(2, 4).unwrap(), session.draw()];
    let mut restored = Verification::new(1).unwrap();
    restored.restore(&save).unwrap();
    assert_eq!(restored.checkpoint(), checkpoint);
    assert_eq!(
        [
            restored.draw(),
            restored.dice(2, 4).unwrap(),
            restored.draw()
        ],
        future
    );
}

#[test]
fn corrupt_restore_and_invalid_commands_are_atomic() {
    let mut session = Verification::new(42).unwrap();
    let before = session.checkpoint();
    assert!(session.restore("{}").is_err());
    assert!(session.dice(u32::MAX, 4).is_err());
    assert_eq!(session.checkpoint(), before);
}
