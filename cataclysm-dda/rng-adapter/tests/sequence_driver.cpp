// Differential execution of the entire unchanged original rng.cpp function set.
#include "rng.h"
#include "calendar.h"
#include "debug.h"
#ifdef ADAPTED
#include "rng_snapshot.h"
#endif
#include <cassert>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <limits>
#include <sstream>

static uint64_t bits( double value ) {
    uint64_t result;
    std::memcpy( &result, &value, sizeof( result ) );
    return result;
}
static void value( const char *name, double number ) {
    std::cout << name << ' ' << std::hex << bits( number ) << std::dec << '\n';
}
static void restore_perturbation() {
#ifdef ADAPTED
    size_t count = 0;
    assert( cdda_rng_snapshot_capture( nullptr, 0, &count ) == CDDA_RNG_BUFFER_TOO_SMALL );
    std::vector<uint8_t> bytes( count );
    assert( cdda_rng_snapshot_capture( bytes.data(), bytes.size(), &count ) == CDDA_RNG_OK );
    // Deliberately alter engine, normal cache and each distribution's draw path.
    ( void )rng_bits();
    ( void )rng( -400, 700 );
    ( void )rng_float( -2, 4 );
    ( void )normal_roll( 400, 73 );
    ( void )exponential_roll( 0.5 );
    ( void )chi_squared_roll( 4.5 );
    rng_set_engine_seed( 8734631 );
    assert( cdda_rng_snapshot_restore( bytes.data(), bytes.size() ) == CDDA_RNG_OK );
#endif
}

int main() {
    constexpr unsigned int seeds[] = { 1, 2, 42, 73, 123456, 20261002,
        2147483646U, 2147483647U, 2147483648U, 4294967295U };
    constexpr double trials[] = { 0.125, 0.5, 1, 2, 4.5, 25 };
    for( unsigned int seed : seeds ) {
        rng_set_engine_seed( seed );
        std::cout << "seed " << seed << '\n';
        for( int index = 0; index != 96; ++index ) {
            restore_perturbation();
            std::cout << "bits " << rng_bits() << '\n';
            std::cout << "int " << rng( 2000, -500 ) << '\n';
            std::cout << "wide-int " << rng( std::numeric_limits<int>::min(),
                                               std::numeric_limits<int>::max() ) << '\n';
            std::cout << "fixed-int " << rng( 19, 19 ) << '\n';
            value( "float", rng_float( 13.5, -21.125 ) );
            value( "fixed-float", rng_float( 3.25, 3.25 ) );
            value( "direction", random_direction() );
            value( "normal", normal_roll( index - 48.25, trials[index % 6] ) );
            value( "normal-zero", normal_roll( 1.25, 0 ) );
            value( "exponential", exponential_roll( trials[index % 6] ) );
            value( "chi-squared", chi_squared_roll( trials[index % 6] ) );
            value( "rng-exponential", rng_exponential( -4.5, 3 ) );
            value( "rng-exponential-invalid", rng_exponential( 12, 2 ) );
            std::cout << "one-in " << one_in( index % 15 ) << '\n';
            std::cout << "one-turn-in " << one_turn_in( time_duration{ index % 25 } ) << '\n';
            std::cout << "x-in-y " << x_in_y( 3.25, 13.5 ) << '\n';
            std::cout << "dice " << dice( index % 7, 9 ) << '\n';
            std::cout << "remainder-positive " << roll_remainder( index + 0.375 ) << '\n';
            std::cout << "remainder-negative " << roll_remainder( -index - 0.125 ) << '\n';
            const auto sequence = rng_sequence( 13, 70, -13, index + 42 );
            std::cout << "local-sequence";
            for( int member : sequence ) { std::cout << ' ' << member; }
            std::cout << '\n';
            value( "rng-normal", rng_normal( 50, -7.5 ) );
            value( "rng-normal-fixed", rng_normal( 13, 13 ) );
            value( "chance", normal_roll_chance( 13, 3, index - 3 ) );
            value( "chance-zero", normal_roll_chance( 3, 0, index % 4 ) );
            std::cout << "string " << random_string( index % 19 ) << '\n';
            // Seed zero is upstream's no-op, and reseeding retains normal cache.
            rng_set_engine_seed( 0 );
        }
    }
    const unsigned char text[] = "Cataclysm DDA 0.I-1 RNG";
    std::cout << "hash " << djb2_hash( text ) << '\n';
    value( "nonfinite", rng_float( std::numeric_limits<double>::infinity(), 1 ) );
    value( "nan", rng_float( 0, std::numeric_limits<double>::quiet_NaN() ) );
    std::cout << "diagnostics " << fixture_debug_count << '\n';
}
