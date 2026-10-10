//! Effect-free dialog presentation from retained original component observations.
//! Content is resolved by semantic identity; unresolved original strings are errors.

use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use tome_core_contracts::ui::{
    DialogView, UiArgument, UiBounds, UiComponent, UiError, UiItem, UiKey, UiSnapshot, UiText,
};

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct UiFrame {
    pub dialogs: Vec<DialogFrame>,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct DialogFrame {
    pub handle: String,
    pub class_name: String,
    pub bounds: UiBounds,
    pub active: bool,
    pub title: Option<String>,
    pub focused: Option<String>,
    pub actions: Vec<UiKey>,
    pub components: Vec<ComponentFrame>,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ComponentFrame {
    pub handle: String,
    pub class_name: String,
    pub kind: String,
    pub bounds: UiBounds,
    pub hidden: bool,
    pub focused: bool,
    pub text: Option<String>,
    pub items: Vec<ItemFrame>,
    pub selection: Option<u32>,
    pub actions: Vec<UiKey>,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct ItemFrame {
    pub index: u32,
    pub text: String,
}

pub fn render_ui(
    snapshot: &UiSnapshot,
    catalog: &BTreeMap<String, String>,
) -> Result<UiFrame, UiError> {
    snapshot.validate()?;
    Ok(UiFrame {
        dialogs: snapshot
            .stack
            .iter()
            .map(|dialog| render_dialog(dialog, catalog))
            .collect::<Result<_, _>>()?,
    })
}

fn render_dialog(
    dialog: &DialogView,
    catalog: &BTreeMap<String, String>,
) -> Result<DialogFrame, UiError> {
    Ok(DialogFrame {
        handle: dialog.handle.clone(),
        class_name: dialog.class_name.clone(),
        bounds: dialog.bounds.clone(),
        active: dialog.active,
        title: dialog
            .title
            .as_ref()
            .map(|text| resolve_text(text, catalog))
            .transpose()?,
        focused: dialog.focused.clone(),
        actions: dialog.actions.clone(),
        components: dialog
            .components
            .iter()
            .map(|component| render_component(component, catalog))
            .collect::<Result<_, _>>()?,
    })
}
fn render_component(
    component: &UiComponent,
    catalog: &BTreeMap<String, String>,
) -> Result<ComponentFrame, UiError> {
    if !matches!(component.kind.as_str(), "button" | "text" | "list") {
        return Err(UiError::Shape);
    }
    Ok(ComponentFrame {
        handle: component.handle.clone(),
        class_name: component.class_name.clone(),
        kind: component.kind.clone(),
        bounds: component.bounds.clone(),
        hidden: component.hidden,
        focused: component.focused,
        text: component
            .text
            .as_ref()
            .map(|text| resolve_text(text, catalog))
            .transpose()?,
        items: component
            .items
            .iter()
            .map(|UiItem { index, text }| {
                Ok(ItemFrame {
                    index: *index,
                    text: resolve_text(text, catalog)?,
                })
            })
            .collect::<Result<_, UiError>>()?,
        selection: component.selection,
        actions: component.actions.clone(),
    })
}

pub fn resolve_text(text: &UiText, catalog: &BTreeMap<String, String>) -> Result<String, UiError> {
    match text {
        UiText::External { value } => Ok(value.clone()),
        UiText::Unresolved { .. } => Err(UiError::Text),
        UiText::Semantic { id, args } => {
            let template = catalog.get(id).ok_or(UiError::Text)?;
            let mut used = BTreeSet::new();
            let mut result = String::new();
            let mut rest = template.as_str();
            while let Some(start) = rest.find('{') {
                if rest[..start].contains('}') {
                    return Err(UiError::Text);
                }
                result.push_str(&rest[..start]);
                let end = rest[start + 1..].find('}').ok_or(UiError::Text)? + start + 1;
                let name = &rest[start + 1..end];
                if name.is_empty() || name.contains('{') {
                    return Err(UiError::Text);
                }
                let arg = args.get(name).ok_or(UiError::Text)?;
                used.insert(name);
                match arg {
                    UiArgument::External { value } => result.push_str(value),
                    UiArgument::Number { value } => {
                        if !value.is_finite() {
                            return Err(UiError::Number);
                        }
                        result.push_str(&value.to_string());
                    }
                    UiArgument::Text { id } => {
                        let value = catalog.get(id).ok_or(UiError::Text)?;
                        if value.contains('{') || value.contains('}') {
                            return Err(UiError::Text);
                        }
                        result.push_str(value);
                    }
                }
                rest = &rest[end + 1..];
            }
            if rest.contains('}') || used.len() != args.len() {
                return Err(UiError::Text);
            }
            result.push_str(rest);
            Ok(result)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn semantic_text_requires_exact_parameters_and_preserves_external_names() {
        let catalog = BTreeMap::from([
            ("dialog.ask".into(), "{name}：{verb}".into()),
            ("verb.accept".into(), "決定".into()),
        ]);
        let mut args = BTreeMap::from([
            (
                "name".into(),
                UiArgument::External {
                    value: "外部名 {verb} <script>".into(),
                },
            ),
            (
                "verb".into(),
                UiArgument::Text {
                    id: "verb.accept".into(),
                },
            ),
        ]);
        let text = UiText::Semantic {
            id: "dialog.ask".into(),
            args: args.clone(),
        };
        let before = serde_json::to_vec(&text).expect("serialize");
        assert_eq!(
            resolve_text(&text, &catalog),
            Ok("外部名 {verb} <script>：決定".into())
        );
        assert_eq!(serde_json::to_vec(&text).expect("serialize"), before);
        args.insert("extra".into(), UiArgument::Number { value: 1.0 });
        assert_eq!(
            resolve_text(
                &UiText::Semantic {
                    id: "dialog.ask".into(),
                    args
                },
                &catalog
            ),
            Err(UiError::Text)
        );
        assert_eq!(
            resolve_text(
                &UiText::Unresolved {
                    source: "unbound original text".into()
                },
                &catalog
            ),
            Err(UiError::Text)
        );
    }
}
