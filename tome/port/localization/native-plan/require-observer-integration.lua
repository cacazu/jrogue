-- GPL-3.0-or-later. SOURCE EXAMPLE ONLY: the parent integrates into its existing
-- require wrapper. Do not execute in place of the actual retained boot driver.
-- semantic_module and rust_resolve must be supplied by the real platform host.
local function install_native_localization_observer(semantic_module, native_installer, rust_resolve, reviewed_supplements, preferred_locale, callbacks, reviewed_format_policies)
  callbacks = callbacks or {}
  return native_installer.new{
    semantic = semantic_module,
    default_locale = "ja_JP",
    -- Parent must actually hydrate its locale preference before using this
    -- source example. true means that check completed, not an assumed future.
    locale_preferences_ready = true,
    preferred_locale = preferred_locale,
    resolve = rust_resolve,
    supplements = reviewed_supplements,
    -- ID-keyed readonly proxy to format-policy.json.policies; only the two
    -- exact source-reviewed UTF-8 string layout contracts are accepted.
    format_policies = reviewed_format_policies,
    on_unmapped = callbacks.on_unmapped,
    on_missing_japanese = callbacks.on_missing_japanese,
    on_native_delegate = callbacks.on_native_delegate,
  }
end

-- Parent's existing wrapper already calls original_require(name) and maintains
-- offline flags/input callbacks. Add localization:on_required(name, result)
-- immediately after that original call, before returning result. It observes
-- config and engine.I18N; it does not replace the parent's wrapper.
return install_native_localization_observer
