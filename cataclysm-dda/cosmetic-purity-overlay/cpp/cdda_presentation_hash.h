#pragma once
#ifndef CDDA_PRESENTATION_HASH_V1_H
#define CDDA_PRESENTATION_HASH_V1_H

#include <array>
#include <cstdint>
#include <limits>
#include <string_view>

// Source-only presentation overlay for CDDA 0.I-1, commit 7b2efa5c.
// No engine, clock, mutable static, world query, or persistent random state.
namespace cdda_presentation_v1
{
static_assert( std::numeric_limits<unsigned int>::digits == 32,
               "the pinned native tile mixing assumes 32-bit unsigned int" );
static_assert( std::numeric_limits<int>::digits == 31,
               "the pinned native one_in chance is a 32-bit signed int" );

enum class npc_pass : std::uint32_t { nearby = 1, followers = 2 };

inline std::uint32_t avalanche( std::uint32_t value )
{
    value ^= value >> 16;
    value *= UINT32_C( 0x7feb352d );
    value ^= value >> 15;
    value *= UINT32_C( 0x846ca68b );
    return value ^ ( value >> 16 );
}

inline std::uint32_t append_byte( std::uint32_t value, std::uint8_t byte )
{
    return ( value ^ byte ) * UINT32_C( 16777619 );
}

inline std::uint32_t append_word( std::uint32_t value, std::uint32_t word )
{
    for( unsigned shift = 0; shift < 32; shift += 8 ) {
        value = append_byte( value, static_cast<std::uint8_t>( word >> shift ) );
    }
    return value;
}

inline std::uint32_t append_text( std::uint32_t value, std::string_view text )
{
    const std::uint64_t length = text.size();
    value = append_word( value, static_cast<std::uint32_t>( length ) );
    value = append_word( value, static_cast<std::uint32_t>( length >> 32 ) );
    for( const char byte : text ) {
        value = append_byte( value, static_cast<std::uint8_t>( byte ) );
    }
    return value;
}

inline std::uint32_t append_position( std::uint32_t value,
                                     const std::array<std::int32_t, 3> &position )
{
    for( const std::int32_t component : position ) {
        value = append_word( value, static_cast<std::uint32_t>( component ) );
    }
    return value;
}

inline std::uint32_t weather_seed( std::string_view resolved_tile_id,
                                  const std::array<std::int32_t, 3> &tile_position,
                                  const std::array<std::int32_t, 2> &screen_position )
{
    std::uint32_t value = append_text( UINT32_C( 2166136261 ), "cdda.presentation.weather.v1" );
    value = append_text( value, resolved_tile_id );
    value = append_position( value, tile_position );
    for( const std::int32_t component : screen_position ) {
        value = append_word( value, static_cast<std::uint32_t>( component ) );
    }
    return avalanche( value );
}

inline std::uint32_t npc_key( const std::array<std::int32_t, 3> &origin,
                              const std::array<std::int32_t, 3> &cursor,
                              const std::array<std::int32_t, 3> &position,
                              std::int32_t npc_id, int native_chance, npc_pass pass )
{
    std::uint32_t value = append_text( UINT32_C( 2166136261 ), "cdda.presentation.npc-color.v1" );
    value = append_position( value, origin );
    value = append_position( value, cursor );
    value = append_position( value, position );
    value = append_word( value, static_cast<std::uint32_t>( npc_id ) );
    value = append_word( value, static_cast<std::uint32_t>( native_chance ) );
    value = append_word( value, static_cast<std::uint32_t>( pass ) );
    return avalanche( value );
}

// A pure range calculation, not an engine. The accepted interval has an exact
// multiple of bound words; raw modulo would give an unequal residue count.
// avalanche and the odd stride are permutations of uint32_t, so this local
// enumeration must reach an accepted word. It has no retained counter/state.
// Frame hashes are deterministic: no stochastic-uniformity claim is made.
inline std::uint32_t bounded_word( std::uint32_t key, std::uint32_t bound )
{
    // Private contract of this header's callers: 2 <= bound <= INT32_MAX.
    const std::uint32_t threshold = ( UINT32_C( 0 ) - bound ) % bound;
    for( std::uint32_t ordinal = 0; ; ++ordinal ) {
        const std::uint32_t word = avalanche( key + ordinal * UINT32_C( 0x9e3779b9 ) );
        if( word >= threshold ) {
            return word % bound;
        }
    }
}

inline bool accept_npc_color( int native_chance,
                              const std::array<std::int32_t, 3> &origin,
                              const std::array<std::int32_t, 3> &cursor,
                              const std::array<std::int32_t, 3> &position,
                              std::int32_t npc_id, npc_pass pass )
{
    // Exact native one_in(int) branch, after the caller's original size_t->int
    // conversion. Color equality and candidate count remain in native code.
    if( native_chance <= 1 ) {
        return true;
    }
    return bounded_word( npc_key( origin, cursor, position, npc_id, native_chance, pass ),
                         static_cast<std::uint32_t>( native_chance ) ) == 0;
}
} // namespace cdda_presentation_v1

#endif
