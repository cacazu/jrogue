// Inserted into input_context.cpp in the prepared overlay. No lazy map insertion.
cdda_help_semantic::binding_observation input_context::observe_semantic_bindings(
    const std::string &action_id ) const
{
    cdda_help_semantic::binding_observation observation;
    observation.category = category;
    observation.action = action_id;
    const auto &contexts = inp_mngr.action_contexts;
    const action_attributes *attributes = nullptr;
    if( category != default_context_id ) {
        const auto local = contexts.find( category );
        if( local != contexts.end() ) {
            const auto action = local->second.find( action_id );
            if( action != local->second.end() ) {
                attributes = &action->second;
                observation.origin = cdda_help_semantic::binding_origin::context;
            }
        }
    }
    // A present local entry wins even when input_events is empty.
    if( attributes == nullptr ) {
        const auto defaults = contexts.find( default_context_id );
        if( defaults != contexts.end() ) {
            const auto action = defaults->second.find( action_id );
            if( action != defaults->second.end() ) {
                attributes = &action->second;
                observation.origin = cdda_help_semantic::binding_origin::default_context;
            }
        }
    }
    if( attributes != nullptr ) {
        if( attributes->input_events.size() > 128 ) {
            throw std::length_error( "help semantic action exceeds binding limit" );
        }
        for( const input_event &event : attributes->input_events ) {
            observation.bindings.push_back( cdda_help_semantic::copy_binding(
                    event, is_event_type_enabled( event.type ) ) );
        }
    }
    return observation;
}

cdda_help_semantic::name_observation input_context::get_semantic_action_name(
    const std::string &action_id ) const
{
    cdda_help_semantic::name_observation observation;
    const auto override = action_name_overrides.find( action_id );
    if( override != action_name_overrides.end() ) {
        const auto semantic = semantic_action_name_overrides.find( action_id );
        if( semantic != semantic_action_name_overrides.end() ) {
            observation.kind = cdda_help_semantic::name_kind::semantic;
            observation.semantic_id = semantic->second;
        } else {
            observation.legacy_reason = "explicit_unconverted_context_name_override";
        }
        observation.source_category = category;
        return observation;
    }
    // Match original get_action_name's use_basic_action_contexts=true behavior.
    const auto &contexts = inp_mngr.basic_action_contexts;
    const auto lookup = [&]( const std::string &source_category ) -> const action_attributes * {
        const auto context = contexts.find( source_category );
        if( context == contexts.end() ) {
            return nullptr;
        }
        const auto action = context->second.find( action_id );
        return action == context->second.end() ? nullptr : &action->second;
    };
    const auto effective_default = [&]() -> const action_attributes * {
        const action_attributes *basic = lookup( default_context_id );
        if( basic != nullptr ) {
            // Existing empty basic names remain empty; only a missing basic action is synthesized.
            return basic;
        }
        // Original get_action_attributes(..., true) lazily creates a missing basic default
        // with get_default_action_name(), which observes current action_contexts[default].
        // Read that exact fallback without creating the native entry.
        const auto current_default = inp_mngr.action_contexts.find( default_context_id );
        if( current_default == inp_mngr.action_contexts.end() ) {
            return nullptr;
        }
        const auto current_action = current_default->second.find( action_id );
        return current_action == current_default->second.end() ? nullptr : &current_action->second;
    };
    const action_attributes *attributes = category == default_context_id ? nullptr : lookup( category );
    std::string source_category = category;
    if( attributes == nullptr ) {
        attributes = effective_default();
        source_category = default_context_id;
    }
    // For names, unlike key vectors, a local empty name falls back to the default name.
    if( attributes == nullptr || attributes->name.empty() ) {
        attributes = effective_default();
        source_category = default_context_id;
    }
    observation.source_category = source_category;
    if( attributes != nullptr && !attributes->name.empty() ) {
        if( !attributes->semantic_name_id.empty() ) {
            observation.kind = cdda_help_semantic::name_kind::semantic;
            observation.semantic_id = attributes->semantic_name_id;
        } else {
            observation.legacy_reason = "unconverted_loaded_action_name";
        }
        return observation;
    }
    observation.kind = cdda_help_semantic::name_kind::literal_action_id;
    observation.literal_action_id = action_id;
    return observation;
}

void input_context::register_action_semantic( const std::string &action_descriptor,
        const translation &name, const std::string &semantic_id )
{
    // Original registered action and translation are still authoritative.
    register_action( action_descriptor, name );
    if( name.empty() || !cdda_help_semantic::matches_reviewed_label_override(
            semantic_id, category, action_descriptor, name ) ) {
        return;
    }
    try {
        semantic_action_name_overrides[action_descriptor] = semantic_id;
    } catch( ... ) {
        semantic_action_name_overrides.erase( action_descriptor );
    }
}
