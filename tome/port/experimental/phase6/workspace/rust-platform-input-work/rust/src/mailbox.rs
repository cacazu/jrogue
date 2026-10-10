// SPDX-License-Identifier: GPL-3.0-or-later
// Byte-word transport: append count (1..4) low little-endian bytes; no pointer ABI.
use std::cell::RefCell;
use crate::{Input, Mapped, Mapper};
const INPUT_LIMIT:usize=64*1024;
const OUTPUT_LIMIT:usize=128*1024;
#[derive(Default)]
struct Mailbox { mapper:Mapper, input:Vec<u8>, output:Vec<u8>, input_error:bool }
thread_local! { static MAILBOX:RefCell<Mailbox>=RefCell::new(Mailbox::default()); }

impl Mailbox {
    fn word(&mut self,word:u32,count:u32)->u32 {
        if !(1..=4).contains(&count) || self.input.len().saturating_add(count as usize)>INPUT_LIMIT {
            self.input_error=true;
            return 0;
        }
        if self.input_error { return 0; }
        self.input.extend_from_slice(&word.to_le_bytes()[..count as usize]);
        1
    }
    fn request(&mut self)->u32 {
        let input=std::mem::take(&mut self.input);
        let mapped=if std::mem::take(&mut self.input_error) {
            Mapped::error("input.error.mailbox_limit")
        } else {
            match serde_json::from_slice::<Input>(&input) {
                Ok(input)=>self.mapper.map(input),
                Err(_)=>Mapped::error("input.error.json"),
            }
        };
        let success=u32::from(mapped.error_id.is_none());
        self.output=serde_json::to_vec(&mapped).unwrap_or_default();
        if self.output.is_empty() || self.output.len()>OUTPUT_LIMIT {
            self.output=serde_json::to_vec(&Mapped::error("input.error.output_limit")).unwrap_or_default();
            return 0;
        }
        success
    }
}

// The unsafe attribute is required by edition 2024 for exported symbol names;
// these functions and their transport contain no unsafe Rust or raw pointers.
// Reset is for fresh construction only. A live host must dispatch Blur and drain
// its release packets before reset, because reset cannot mutate native SDL state.
#[allow(unsafe_code)]
#[cfg_attr(target_arch="wasm32",unsafe(no_mangle))]
pub extern "C" fn tome_physical_input_reset() {
    MAILBOX.with(|mailbox| *mailbox.borrow_mut()=Mailbox::default());
}
#[allow(unsafe_code)]
#[cfg_attr(target_arch="wasm32",unsafe(no_mangle))]
pub extern "C" fn tome_physical_input_word(word:u32,count:u32)->u32 {
    MAILBOX.with(|mailbox| mailbox.borrow_mut().word(word,count))
}
#[allow(unsafe_code)]
#[cfg_attr(target_arch="wasm32",unsafe(no_mangle))]
pub extern "C" fn tome_physical_input_request()->u32 {
    MAILBOX.with(|mailbox| mailbox.borrow_mut().request())
}
#[allow(unsafe_code)]
#[cfg_attr(target_arch="wasm32",unsafe(no_mangle))]
pub extern "C" fn tome_physical_input_output_len()->u32 {
    MAILBOX.with(|mailbox| u32::try_from(mailbox.borrow().output.len()).unwrap_or(0))
}
#[allow(unsafe_code)]
#[cfg_attr(target_arch="wasm32",unsafe(no_mangle))]
pub extern "C" fn tome_physical_input_output_word(byteoffset:u32)->u32 {
    MAILBOX.with(|mailbox| {
        let mailbox=mailbox.borrow();
        let mut bytes=[0_u8;4];
        let offset=byteoffset as usize;
        for (index,byte) in bytes.iter_mut().enumerate() {
            *byte=offset.checked_add(index).and_then(|i|mailbox.output.get(i)).copied().unwrap_or(0);
        }
        u32::from_le_bytes(bytes)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn word_transport_is_little_endian_and_bounded() {
        let mut mailbox=Mailbox::default();
        let source=b"{\"kind\":\"blur\"}";
        for chunk in source.chunks(4) {
            let mut word=[0;4];word[..chunk.len()].copy_from_slice(chunk);
            assert_eq!(mailbox.word(u32::from_le_bytes(word),chunk.len() as u32),1);
        }
        assert_eq!(mailbox.request(),1);
        assert!(serde_json::from_slice::<serde_json::Value>(&mailbox.output).expect("output JSON")["handled"].as_bool().expect("handled"));
        assert_eq!(mailbox.word(0,5),0);
        assert_eq!(mailbox.request(),0);
        assert!(String::from_utf8(mailbox.output).expect("UTF8").contains("mailbox_limit"));
    }
    #[test]
    fn invalid_json_cannot_change_held_state() {
        let mut mailbox=Mailbox {input:b"{\"kind\":\"blur\",\"unexpected\":true}".to_vec(), ..Mailbox::default()};
        assert_eq!(mailbox.request(),0);
        assert!(mailbox.mapper.keys.is_empty());
    }
}
