# Semantic text catalogs

These catalogs cover only the Rust migration verification panel: its labels,
PCG and dice output, help, errors, settings, browser storage, and attribution.
They do not claim coverage of upstream DCSS gameplay text, descriptions, names,
plurals, options, or Lua-authored messages. Full gameplay text migration remains
a separate required phase of the game port.

`ja.json` is the default; `en.json` uses the same semantic IDs and parameter
signatures. A semantic ID identifies a meaning, such as `storage.saved`, rather
than containing an English sentence. Callers emit `Message { id, params }`.
Rendering is pure and does not access gameplay state, RNG, storage, audio, time,
or a browser. Parameters such as player names retain their original text.

Catalog values use one of three forms:

```json
{
  "adapter.save": "Save",
  "rng.seed": {
    "text": "Random-number seed: {seed}",
    "params": { "seed": "decimal" }
  },
  "rng.preview": {
    "one": "Preview {n} sample",
    "other": "Preview {n} samples",
    "params": { "n": "quantity" }
  }
}
```

Parameter types are `text`, `decimal`, `unsigned`, `integer`, `number`, `boolean`, and
`quantity`. Quantity is a nonnegative integer; numeric strings are invalid.
`decimal` explicitly accepts a canonical unsigned 64-bit decimal string, including
`u64::MAX`. Seed events use this type so JavaScript never rounds their values.
Plural entries require `n: quantity`. English selects `one` for exactly 1 and
`other` for all other counts. Japanese always selects `other`; the Japanese
catalog retains both forms to preserve bilingual schema parity. Counts use
Japanese counters such as `件` and `回`, not an English plural suffix.

Placeholders use `{name}`. Literal braces use `{{` and `}}`. Substitution walks
parsed template tokens once; it never performs global replacement or treats a
parameter value as another template. Both plural forms must declare and use the
same parameter set. Catalog loading rejects malformed IDs, duplicate IDs,
unknown entry fields, invalid placeholders, empty entries, and placeholder/schema
mismatches. Rendering rejects missing IDs, absent or surplus parameters, null or
structured values, and parameter type mismatches. `Catalog::validate_pair`
requires identical bilingual ID sets, parameter types, and plural shapes.

`error.invalid_request` accepts a `reason` parameter for a reason already
localized with another semantic ID. Do not insert raw English exception text or
developer diagnostics into a Japanese message. Use specific `error.*` IDs for
known user-facing failures.

The Rust renderer returns plain text and performs no HTML escaping because it
does not author HTML. A browser adapter must use `textContent` or text nodes.
Never interpolate rendered text or external player names into `innerHTML`.
Use a CJK-capable system font, allow wrapping, and do not use byte length or ASCII
column width to align Japanese UI labels. Keep player names separate from fixed
layout columns when their width can grow.

Tests in `port/src/display.rs` validate bilingual coverage, placeholder schemas,
typed parameters, English/Japanese quantities, exact preservation of arbitrary
player names, one-pass substitution, serialization, and repeatable rendering.
