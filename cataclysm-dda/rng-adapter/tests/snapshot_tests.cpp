// Meaningful cache-sensitive tests of the original C++ platform hook.
#include "rng.h"
#include "rng_snapshot.h"
#include "debug.h"
#include <cassert>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <cstdlib>
#include <new>
#include <sstream>

// Fault injection applies to the real standard-library allocation paths. It is
// disabled for every assertion/report and never enters the production overlay.
static long fail_allocation_after = -1;
void *operator new( std::size_t size ) {
    if( fail_allocation_after == 0 ) { throw std::bad_alloc(); }
    if( fail_allocation_after > 0 ) { --fail_allocation_after; }
    if( void *memory = std::malloc( size == 0 ? 1 : size ) ) { return memory; }
    throw std::bad_alloc();
}
void *operator new[]( std::size_t size ) { return ::operator new( size ); }
void operator delete( void *memory ) noexcept { std::free( memory ); }
void operator delete[]( void *memory ) noexcept { std::free( memory ); }
void operator delete( void *memory, std::size_t ) noexcept { std::free( memory ); }
void operator delete[]( void *memory, std::size_t ) noexcept { std::free( memory ); }

static unsigned int rejected = 0;
static unsigned int roundtrips = 0;
static unsigned int neutral_captures = 0;
static uint64_t bits( double number ) {
    uint64_t result;
    std::memcpy( &result, &number, sizeof( result ) );
    return result;
}
static std::string capture() {
    size_t count = 0;
    assert( cdda_rng_snapshot_capture( nullptr, 0, &count ) == CDDA_RNG_BUFFER_TOO_SMALL );
    assert( count != 0 && count <= cdda_rng_snapshot_max_bytes() );
    std::string output( count, '\0' );
    assert( cdda_rng_snapshot_capture( reinterpret_cast<uint8_t *>( output.data() ), count, &count )
            == CDDA_RNG_OK );
    assert( count == output.size() );
    return output;
}
static void restore( const std::string &bytes ) {
    assert( cdda_rng_snapshot_restore( reinterpret_cast<const uint8_t *>( bytes.data() ), bytes.size() )
            == CDDA_RNG_OK );
}
static std::string field( const std::string &bytes, const std::string &name ) {
    size_t start = bytes.find( '\n' + name + ' ' );
    assert( start != std::string::npos );
    start = bytes.find( '\n', start + 1 ) + 1;
    const size_t end = bytes.find( '\n', start );
    return bytes.substr( start, end - start );
}
static std::string replace_field( std::string bytes, const std::string &name,
                                  const std::string &value ) {
    const size_t header = bytes.find( '\n' + name + ' ' ) + 1;
    const size_t start = bytes.find( '\n', header ) + 1;
    const size_t end = bytes.find( '\n', start );
    bytes.replace( header, end - header, name + ' ' + std::to_string( value.size() ) + '\n' + value );
    return bytes;
}
static void bad( const std::string &bytes, int expected = -1 ) {
    const std::string before = capture();
    const int status = cdda_rng_snapshot_restore(
        reinterpret_cast<const uint8_t *>( bytes.data() ), bytes.size() );
    assert( status != CDDA_RNG_OK );
    assert( expected == -1 || status == expected );
    assert( capture() == before );
    ++rejected;
}
static std::vector<uint64_t> continuation() {
    std::vector<uint64_t> output;
    for( unsigned int index = 0; index != 64; ++index ) {
        output.push_back( rng_bits() );
        output.push_back( static_cast<uint64_t>( rng( -7000, 200 ) ) );
        output.push_back( bits( rng_float( -13.25, 37.75 ) ) );
        output.push_back( bits( normal_roll( index - 15.25, 0.125 + index ) ) );
        output.push_back( bits( exponential_roll( 0.125 + ( index % 9 ) ) ) );
        output.push_back( bits( chi_squared_roll( 0.5 + ( index % 13 ) ) ) );
        output.push_back( bits( rng_normal( -200, 100 ) ) );
        output.push_back( static_cast<uint64_t>( dice( 4, 8 ) ) );
    }
    return output;
}
static void warm( int scenario ) {
    if( scenario == 1 || scenario == 8 ) { ( void )rng_bits(); }
    if( scenario == 2 || scenario == 8 ) { ( void )rng( 13, -27 ); }
    if( scenario == 3 || scenario == 8 ) { ( void )rng_float( 7, -2 ); }
    if( scenario == 4 || scenario == 8 ) { ( void )normal_roll( 73, 12 ); }
    if( scenario == 5 ) { ( void )normal_roll( 73, 12 ); ( void )normal_roll( 47, 3 ); }
    if( scenario == 6 || scenario == 8 ) { ( void )exponential_roll( 1.75 ); }
    if( scenario == 7 || scenario == 8 ) { ( void )chi_squared_roll( 17.5 ); }
}
int main( int argc, char **argv ) {
    // Even the first ABI query is allocation-free and cannot unwind across FFI.
    fail_allocation_after = 0;
    const char *abi = cdda_rng_snapshot_abi();
    assert( abi != nullptr && std::strlen( abi ) != 0 );
    assert( cdda_rng_snapshot_max_bytes() == 65536 );
    fail_allocation_after = -1;
    rng_set_engine_seed( 42 );
    const std::string cold = capture();
    const std::string normal_default = field( cold, "normal" );
    constexpr unsigned int seeds[] = { 1, 2, 42, 73, 123456, 20261002,
        2147483646U, 2147483647U, 2147483648U, 4294967295U };
    for( const auto seed : seeds ) {
        for( int scenario = 0; scenario != 9; ++scenario ) {
            restore( cold );
            rng_set_engine_seed( seed );
            warm( scenario );
            const std::string saved = capture();
            for( int render = 0; render != 32; ++render ) {
                assert( capture() == saved );
                assert( cdda_rng_snapshot_abi()[0] != '\0' );
                ++neutral_captures;
            }
            assert( rng_sequence( 73, -300, 500, 8731 ).size() == 73 );
            assert( capture() == saved );
            if( scenario == 4 || scenario == 8 ) {
                assert( field( saved, "normal" ) != normal_default );
            }
            if( scenario == 5 ) { assert( field( saved, "normal" ) == normal_default ); }
            const auto expected = continuation();
            ( void )continuation();
            rng_set_engine_seed( 99991 );
            warm( 8 );
            restore( saved );
            assert( capture() == saved );
            assert( continuation() == expected );
            ++roundtrips;
        }
    }
    // A cache-sensitive test: engine-only restoration must fail, full restoration succeeds.
    restore( cold );
    ( void )normal_roll( 0, 1 );
    const std::string hot = capture();
    const auto engine_only = rng_get_engine();
    const uint64_t expected_normal = bits( normal_roll( 0, 1 ) );
    rng_get_engine() = engine_only;
    assert( bits( normal_roll( 0, 1 ) ) != expected_normal );
    restore( hot );
    assert( bits( normal_roll( 0, 1 ) ) == expected_normal );

    restore( hot );
    const std::string valid = capture();
    // Every truncation is rejected without altering either engine or cache.
    for( size_t size = 0; size != valid.size(); ++size ) { bad( valid.substr( 0, size ) ); }
    bad( valid + "\n" );
    bad( valid + "extra\n" );
    std::string changed = valid;
    changed[0] = 'X';
    bad( changed, CDDA_RNG_FORMAT_MISMATCH );
    changed = valid;
    changed[changed.find( "source " ) + 7] = '0';
    bad( changed, CDDA_RNG_SOURCE_MISMATCH );
    changed = valid;
    changed[changed.find( "abi " ) + 4] = 'X';
    bad( changed, CDDA_RNG_ABI_MISMATCH );
    changed = valid;
    changed.replace( changed.find( "fields 7" ), 8, "fields 6" );
    bad( changed, CDDA_RNG_MALFORMED );
    for( const char *name : { "engine", "uniform_unsigned", "uniform_integer", "uniform_real",
                             "normal", "exponential", "chi_squared" } ) {
        bad( replace_field( valid, name, "" ), CDDA_RNG_MALFORMED );
        bad( replace_field( valid, name, "garbage" ), CDDA_RNG_INVALID_STATE );
        bad( replace_field( valid, name, std::string( 1, '\0' ) ), CDDA_RNG_INVALID_STATE );
    }
    for( const char *number : { "0", "2147483647", "-1", "+1", "01", "4294967296" } ) {
        bad( replace_field( valid, "engine", number ), CDDA_RNG_INVALID_STATE );
    }
    // Valid changed engine is parsed first, corrupted LAST distribution must not commit it.
    changed = replace_field( valid, "engine", "123456" );
    changed = replace_field( changed, "chi_squared", "not-a-number" );
    bad( changed, CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "normal", "0x0p+0 -0x1p+0 0" ), CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "normal", "0x0p+0 0x1p+0 2" ), CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "normal", "0x0p+0 0x1p+0 1 nan" ), CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "normal", "0x0p+0 0x1p+0 1 0x1p+1024" ), CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "uniform_integer", "0 10" ), CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "exponential", "0x1p+1" ), CDDA_RNG_INVALID_STATE );
    bad( replace_field( valid, "chi_squared", "0x1p+1" ), CDDA_RNG_INVALID_STATE );

    // Size-query and short buffers leave caller memory and original RNG untouched.
    std::vector<uint8_t> short_buffer( valid.size() - 1, 0xa5 );
    size_t required = 0;
    assert( cdda_rng_snapshot_capture( short_buffer.data(), short_buffer.size(), &required )
            == CDDA_RNG_BUFFER_TOO_SMALL );
    for( const auto byte : short_buffer ) { assert( byte == 0xa5 ); }
    assert( required == valid.size() && capture() == valid );
    assert( cdda_rng_snapshot_capture( nullptr, 0, nullptr ) == CDDA_RNG_INVALID_ARGUMENT );
    assert( cdda_rng_snapshot_capture( nullptr, 1, &required ) == CDDA_RNG_INVALID_ARGUMENT );
    assert( cdda_rng_snapshot_restore( nullptr, 1 ) == CDDA_RNG_INVALID_ARGUMENT );
    assert( cdda_rng_snapshot_restore( reinterpret_cast<const uint8_t *>( valid.data() ), 65537 )
            == CDDA_RNG_INVALID_ARGUMENT );
    assert( capture() == valid );
    unsigned int capture_resource_failures = 0;
    unsigned int restore_resource_failures = 0;
    std::vector<uint8_t> resource_output( 65536, 0xa5 );
    for( long fail_at = 0; fail_at != 256; ++fail_at ) {
        size_t required_bytes = 0;
        fail_allocation_after = fail_at;
        const int status = cdda_rng_snapshot_capture( resource_output.data(), resource_output.size(),
                           &required_bytes );
        fail_allocation_after = -1;
        assert( capture() == valid );
        if( status == CDDA_RNG_OK ) {
            assert( required_bytes == valid.size() );
            assert( std::memcmp( resource_output.data(), valid.data(), valid.size() ) == 0 );
            break;
        }
        assert( status == CDDA_RNG_RESOURCE_FAILURE );
        for( const uint8_t byte : resource_output ) { assert( byte == 0xa5 ); }
        ++capture_resource_failures;
    }
    const std::string restore_target = replace_field( cold, "engine", "123456" );
    for( long fail_at = 0; fail_at != 256; ++fail_at ) {
        fail_allocation_after = fail_at;
        const int status = cdda_rng_snapshot_restore(
            reinterpret_cast<const uint8_t *>( restore_target.data() ), restore_target.size() );
        fail_allocation_after = -1;
        if( status == CDDA_RNG_OK ) {
            assert( capture() == restore_target );
            restore( valid );
            break;
        }
        assert( capture() == valid );
        assert( status == CDDA_RNG_RESOURCE_FAILURE );
        ++restore_resource_failures;
    }
    assert( capture_resource_failures != 0 && capture_resource_failures < 256 );
    assert( restore_resource_failures != 0 && restore_resource_failures < 256 );
    // Original early-return RNG paths remain neutral.
    rng_set_engine_seed( 0 );
    assert( rng_normal( 13, 13 ) == 13 );
    assert( rng_exponential( 5, 3 ) == 0 );
    assert( one_in( 0 ) );
    assert( rng_float( 0, std::numeric_limits<double>::infinity() ) == 0 );
    assert( capture() == valid );
    if( argc == 2 ) { std::ofstream( argv[1], std::ios::binary ) << valid; }
    std::cout << "{\"roundtrips\":" << roundtrips
              << ",\"continuation_values\":" << roundtrips * 512
              << ",\"neutral_captures\":" << neutral_captures
              << ",\"transactional_rejections\":" << rejected
              << ",\"engine_only_restore_detected_cache_loss\":true,\"abi\":\""
              << cdda_rng_snapshot_abi() << "\",\"capture_resource_failures\":"
              << capture_resource_failures << ",\"restore_resource_failures\":"
              << restore_resource_failures << "}\n";
}
