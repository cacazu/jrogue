    // Observational phase-one hook. Original input_context is already a friend
    // of input_manager; these non-capturing callbacks allocate no arguments and
    // keep private C++ tables/pointers entirely inside the original module.
    const cdda_browser_input_scope browser_input_scope(
        this,
        []( const void *opaque ) noexcept -> cdda_browser_context_view {
            const input_context &context = *static_cast<const input_context *>( opaque );
            return { &context.category, &context.registered_actions,
                     context.preferred_keyboard_mode, inp_mngr.get_timeout(),
                     context.registered_any_input, context.handling_coordinate_input,
                     context.iso_mode };
        },
        []( const void *opaque, const std::string &action,
        cdda_browser_binding_origin &origin ) noexcept -> const std::vector<input_event> * {
            const input_context &context = *static_cast<const input_context *>( opaque );
            const auto &contexts = inp_mngr.action_contexts;
            // Exact native precedence, including explicitly empty local overrides.
            // Unlike get_input_for_action/get_action_attributes this never inserts.
            if( context.category != default_context_id ) {
                const auto local = contexts.find( context.category );
                if( local != contexts.end() ) {
                    const auto selected = local->second.find( action );
                    if( selected != local->second.end() ) {
                        origin = cdda_browser_binding_origin::context;
                        return &selected->second.input_events;
                    }
                }
            }
            const auto defaults = contexts.find( default_context_id );
            if( defaults != contexts.end() ) {
                const auto selected = defaults->second.find( action );
                if( selected != defaults->second.end() ) {
                    origin = cdda_browser_binding_origin::default_context;
                    return &selected->second.input_events;
                }
            }
            origin = cdda_browser_binding_origin::missing;
            return nullptr; // source action is unbound; do not create a native entry
        } );
