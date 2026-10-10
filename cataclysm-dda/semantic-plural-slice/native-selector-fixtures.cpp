// Prepared standalone native fixtures, intentionally uncompiled/unexecuted.
// The original engine and rust-contracts APIs are untouched.
#include <cassert>
#include <cstddef>
#include <initializer_list>
#include <limits>
#include <cstdio>

#ifdef NDEBUG
#error Native selector assertions must remain enabled.
#endif

enum class frozen_native_selector { one, other };

// Mirror the exact translation::translated(int) -> n_gettext(size_t) boundary.
// The native compiler performs its own conversions; Rust never guesses them.
constexpr frozen_native_selector translated_int_selector( int num )
{
    const std::size_t native_n = num;
    return native_n == 1 ? frozen_native_selector::one : frozen_native_selector::other;
}

constexpr frozen_native_selector contextual_translated_int_selector( int num )
{
    // translation::translated(int) -> npgettext(unsigned long long) ->
    // TranslationManager::TranslatePluralWithContext(size_t), exactly.
    const unsigned long long contextual_n = num;
    const std::size_t native_n = contextual_n;
    return native_n == 1 ? frozen_native_selector::one : frozen_native_selector::other;
}

constexpr frozen_native_selector itype_base_selector( unsigned int quantity,
        bool original_resolved_liquid )
{
    if( original_resolved_liquid ) {
        quantity = 1; // src/itype.cpp:111-112, before translation's int argument.
    }
    return translated_int_selector( static_cast<int>( quantity ) );
}

constexpr frozen_native_selector item_variant_or_mtype_selector( unsigned int quantity )
{
    // Exact original native unsigned-to-int conversion remains in C++.
    return translated_int_selector( static_cast<int>( quantity ) );
}

int main()
{
    static_assert( sizeof( int ) == 4, "pinned producer fixtures require int32" );
    static_assert( sizeof( unsigned int ) == 4, "pinned quantity fixtures require uint32" );
    // These are explicit native-compiler ABI gates, not Rust cast assumptions.
    // The future pinned compiler must establish them, or this test cannot run.
    static_assert( static_cast<int>( std::numeric_limits<unsigned int>::max() ) == -1,
                   "unsupported unsigned narrowing ABI: UINT_MAX must become -1" );
    constexpr unsigned int above_signed_max = static_cast<unsigned int>( std::numeric_limits<int>::max() ) + 1u;
    static_assert( static_cast<int>( above_signed_max ) == std::numeric_limits<int>::min(),
                   "unsupported unsigned narrowing ABI at INT_MAX+1" );
    for( const int value : {0, 1, 2, -1, std::numeric_limits<int>::min(),
                           std::numeric_limits<int>::max()} ) {
        const auto expected = value == 1 ? frozen_native_selector::one : frozen_native_selector::other;
        assert( translated_int_selector( value ) == expected );
        assert( contextual_translated_int_selector( value ) == expected );
    }
    for( const unsigned int quantity : {0u, 1u, 2u,
                                       static_cast<unsigned int>( std::numeric_limits<int>::max() )} ) {
        assert( itype_base_selector( quantity, true ) == frozen_native_selector::one );
        const auto expected = quantity == 1u ? frozen_native_selector::one : frozen_native_selector::other;
        assert( itype_base_selector( quantity, false ) == expected );
        assert( item_variant_or_mtype_selector( quantity ) == expected );
    }
    assert( itype_base_selector( std::numeric_limits<unsigned int>::max(), true ) ==
            frozen_native_selector::one );
    for( const unsigned int quantity : {above_signed_max, std::numeric_limits<unsigned int>::max()} ) {
        assert( itype_base_selector( quantity, true ) == frozen_native_selector::one );
        assert( itype_base_selector( quantity, false ) == frozen_native_selector::other );
        assert( item_variant_or_mtype_selector( quantity ) == frozen_native_selector::other );
    }
    // Caller-route witnesses: score uses current value; integer achievement
    // requirements use target; anything/non-int description uses default1.
    const int current = 2, target = 1;
    assert( translated_int_selector( current ) == frozen_native_selector::other );
    assert( translated_int_selector( target ) == frozen_native_selector::one );
    assert( translated_int_selector( 1 ) == frozen_native_selector::one );
    // Higher non-liquid/variant quantities must be frozen by this native path;
    // the Node preparation mirror still rejects them instead of assuming narrowing.
    std::puts( "native plural selector fixtures passed; original game producer remains unconnected" );
}
