// Original C++ core RNG state platform adapter. CC BY-SA 3.0.
// Does not replace the engine/distribution algorithms or invoke operator().
#include "rng_snapshot.h"
#include "rng_snapshot_internal.h"
#include "rng.h"
#include <emscripten/version.h>

#include <array>
#include <cstring>
#include <limits>
#include <locale>
#include <sstream>
#include <string>
#include <type_traits>

// Restore validation was audited against this exact trusted libc++ implementation.
// A new compiler/library requires a new provenance record and differential suite.
#if !defined(__EMSCRIPTEN__) || !defined(_LIBCPP_VERSION) || _LIBCPP_VERSION != 220108
#error "RNG serializer currently supports the tested Emscripten libc++ 22.1.8 ABI only"
#endif
#if defined(__FAST_MATH__)
#error "RNG snapshots require faithful floating point semantics (no fast math)"
#endif
#if !defined(CDDA_RNG_BUILD_FP_CONTRACT_OFF) || CDDA_RNG_BUILD_FP_CONTRACT_OFF != 1
#error "Build every RNG translation unit with -ffp-contract=off and define CDDA_RNG_BUILD_FP_CONTRACT_OFF=1"
#endif
#if !defined(__EXCEPTIONS)
#error "The bounded C RNG API needs -fexceptions to convert stream/allocation errors into statuses"
#endif

#define CDDA_STRINGIZE_INNER(x) #x
#define CDDA_STRINGIZE(x) CDDA_STRINGIZE_INNER(x)

namespace {
constexpr size_t max_bytes = 65536;
constexpr size_t max_field_bytes = 4096;
constexpr const char *format = "CDDA-RNG-STREAM/1";
constexpr const char *source =
    "7b2efa5cea38e4d4d97dd0e63b28b9148623da59 "
    "b0bc0aaf772430a4c2202bfd7d1006495d02cd94f66b02677da3ec75458d3074";
constexpr std::array<const char *, 7> names = {
    "engine", "uniform_unsigned", "uniform_integer", "uniform_real",
    "normal", "exponential", "chi_squared"
};

static_assert( sizeof( cata_default_random_engine::result_type ) == 4,
               "The tested wasm engine uses a 32-bit result type" );
// Allocation-free C/Rust ABI query, including its first call. These literals
// cannot throw or trigger lazy stream/library initialization across the FFI.
constexpr char abi[] =
    "cdda-rng-stream/1;emscripten="
    CDDA_STRINGIZE(__EMSCRIPTEN_MAJOR__) "."
    CDDA_STRINGIZE(__EMSCRIPTEN_MINOR__) "."
    CDDA_STRINGIZE(__EMSCRIPTEN_TINY__)
    ";clang=" __clang_version__
    ";libc++=" CDDA_STRINGIZE(_LIBCPP_VERSION)
    ";libc++-abi=" CDDA_STRINGIZE(_LIBCPP_ABI_VERSION)
    ";cxx=" CDDA_STRINGIZE(__cplusplus)
    ";u32=" CDDA_STRINGIZE(__SIZEOF_INT__)
    ";engine=4;f64=" CDDA_STRINGIZE(__SIZEOF_DOUBLE__)
    ";f64-digits=" CDDA_STRINGIZE(__DBL_MANT_DIG__)
    ";byte-order=" CDDA_STRINGIZE(__BYTE_ORDER__)
    ";fp-contract=off;fast-math=off";

template<typename T>
std::string stream_state( const T &state )
{
    std::ostringstream output;
    output.exceptions( std::ios::failbit | std::ios::badbit );
    output.imbue( std::locale::classic() );
    output << state;
    return output.str();
}

std::array<std::string, 7> all_fields( const cata_default_random_engine &engine,
                                      const cdda_rng_distribution_registry &registry )
{
    return { stream_state( engine ), stream_state( registry.rng_uint_dist ),
             stream_state( registry.rng_int_dist ), stream_state( registry.rng_real_dist ),
             stream_state( registry.rng_normal_dist ), stream_state( registry.rng_exponential_dist ),
             stream_state( registry.rng_chi_squared_dist ) };
}

std::string encode()
{
    const auto fields = all_fields( rng_get_engine(), cdda_rng_distributions() );
    std::ostringstream output;
    output.exceptions( std::ios::failbit | std::ios::badbit );
    output.imbue( std::locale::classic() );
    output << format << '\n' << "source " << source << '\n'
           << "abi " << cdda_rng_snapshot_abi() << '\n' << "fields 7\n";
    for( size_t index = 0; index != names.size(); ++index ) {
        output << names[index] << ' ' << fields[index].size() << '\n'
               << fields[index] << '\n';
    }
    output << "end\n";
    return output.str();
}

// Decimal grammar rejects signs, overflow and noncanonical length spellings.
bool decimal( const std::string &text, size_t limit, size_t &result )
{
    if( text.empty() || ( text.size() > 1 && text[0] == '0' ) ) {
        return false;
    }
    result = 0;
    for( const char ch : text ) {
        if( ch < '0' || ch > '9' || result > ( limit - ( ch - '0' ) ) / 10 ) {
            return false;
        }
        result = result * 10 + ch - '0';
    }
    return result <= limit;
}

bool line( const std::string &input, size_t &cursor, std::string &value )
{
    const size_t end = input.find( '\n', cursor );
    if( end == std::string::npos ) {
        return false;
    }
    value = input.substr( cursor, end - cursor );
    cursor = end + 1;
    return true;
}

int decode_fields( const std::string &input, std::array<std::string, 7> &fields )
{
    size_t cursor = 0;
    std::string value;
    if( !line( input, cursor, value ) ) {
        return CDDA_RNG_MALFORMED;
    }
    if( value != format ) {
        return CDDA_RNG_FORMAT_MISMATCH;
    }
    if( !line( input, cursor, value ) || value.compare( 0, 7, "source " ) != 0 ) {
        return CDDA_RNG_MALFORMED;
    }
    if( value != std::string( "source " ) + source ) {
        return CDDA_RNG_SOURCE_MISMATCH;
    }
    if( !line( input, cursor, value ) || value.compare( 0, 4, "abi " ) != 0 ) {
        return CDDA_RNG_MALFORMED;
    }
    if( value != std::string( "abi " ) + cdda_rng_snapshot_abi() ) {
        return CDDA_RNG_ABI_MISMATCH;
    }
    if( !line( input, cursor, value ) || value != "fields 7" ) {
        return CDDA_RNG_MALFORMED;
    }
    for( size_t index = 0; index != names.size(); ++index ) {
        const std::string prefix = std::string( names[index] ) + ' ';
        size_t count = 0;
        if( !line( input, cursor, value ) || value.compare( 0, prefix.size(), prefix ) != 0 ||
            !decimal( value.substr( prefix.size() ), max_field_bytes, count ) || count == 0 ||
            count >= input.size() - cursor || input[cursor + count] != '\n' ) {
            return CDDA_RNG_MALFORMED;
        }
        fields[index] = input.substr( cursor, count );
        cursor += count + 1;
    }
    if( input.substr( cursor ) != "end\n" ) {
        return CDDA_RNG_MALFORMED;
    }
    return CDDA_RNG_OK;
}

template<typename T>
bool parse_state( const std::string &text, T &state )
{
    // libc++'s normal cache is a finite normalized value. All stored parameters
    // are defaults in upstream (each roll passes a separate param_type).
    // Exclude nan/inf, embedded controls/NUL and other nonnumeric tokens before >>.
    for( const char ch : text ) {
        if( std::strchr( "0123456789abcdefABCDEFxXpP+-. ", ch ) == nullptr || ch == '\0' ) {
            return false;
        }
    }
    std::istringstream input( text );
    input.exceptions( std::ios::badbit );
    input.imbue( std::locale::classic() );
    input >> state;
    if( input.fail() ) {
        return false;
    }
    // Canonical reserialization rejects extra tokens, invalid booleans, loss of
    // precision and alternative syntaxes; no original global object is touched.
    return stream_state( state ) == text;
}

int restore_impl( const uint8_t *input, size_t size )
{
    std::array<std::string, 7> fields;
    const int status = decode_fields( std::string( reinterpret_cast<const char *>( input ), size ),
                                      fields );
    if( status != CDDA_RNG_OK ) {
        return status;
    }
    size_t engine_value = 0;
    if( !decimal( fields[0], cata_default_random_engine::max(), engine_value ) ||
        engine_value < cata_default_random_engine::min() ) {
        return CDDA_RNG_INVALID_STATE;
    }
    cata_default_random_engine candidate_engine;
    cdda_rng_distribution_registry candidate;
    const cdda_rng_distribution_registry defaults;
    if( !parse_state( fields[0], candidate_engine ) ||
        !parse_state( fields[1], candidate.rng_uint_dist ) ||
        !parse_state( fields[2], candidate.rng_int_dist ) ||
        !parse_state( fields[3], candidate.rng_real_dist ) ||
        !parse_state( fields[4], candidate.rng_normal_dist ) ||
        !parse_state( fields[5], candidate.rng_exponential_dist ) ||
        !parse_state( fields[6], candidate.rng_chi_squared_dist ) ||
        candidate.rng_uint_dist.param() != defaults.rng_uint_dist.param() ||
        candidate.rng_int_dist.param() != defaults.rng_int_dist.param() ||
        candidate.rng_real_dist.param() != defaults.rng_real_dist.param() ||
        candidate.rng_normal_dist.param() != defaults.rng_normal_dist.param() ||
        candidate.rng_exponential_dist.param() != defaults.rng_exponential_dist.param() ||
        candidate.rng_chi_squared_dist.param() != defaults.rng_chi_squared_dist.param() ) {
        return CDDA_RNG_INVALID_STATE;
    }
    static_assert( std::is_nothrow_copy_assignable<cata_default_random_engine>::value,
                   "engine commit must not throw" );
    static_assert( std::is_nothrow_copy_assignable<cdda_rng_distribution_registry>::value,
                   "distribution commit must not throw" );
    // Call only at a quiescent game-thread boundary. This pair cannot throw and
    // is not externally observable until this function returns. RNG is not thread safe.
    rng_get_engine() = candidate_engine;
    cdda_rng_distributions() = candidate;
    return CDDA_RNG_OK;
}
} // namespace

cdda_rng_distribution_registry &cdda_rng_distributions()
{
    static cdda_rng_distribution_registry registry;
    return registry;
}

extern "C" const char *cdda_rng_snapshot_abi() noexcept
{
    return abi;
}

extern "C" size_t cdda_rng_snapshot_max_bytes() noexcept
{
    return max_bytes;
}

extern "C" int cdda_rng_snapshot_capture( uint8_t *output, size_t capacity, size_t *required ) noexcept
{
    if( required == nullptr || ( output == nullptr && capacity != 0 ) ) {
        return CDDA_RNG_INVALID_ARGUMENT;
    }
    try {
        const std::string bytes = encode();
        *required = bytes.size();
        if( bytes.size() > max_bytes ) {
            return CDDA_RNG_RESOURCE_FAILURE;
        }
        if( capacity < bytes.size() || output == nullptr ) {
            return CDDA_RNG_BUFFER_TOO_SMALL;
        }
        std::memcpy( output, bytes.data(), bytes.size() );
        return CDDA_RNG_OK;
    } catch( ... ) {
        return CDDA_RNG_RESOURCE_FAILURE;
    }
}

extern "C" int cdda_rng_snapshot_restore( const uint8_t *input, size_t size ) noexcept
{
    if( input == nullptr || size == 0 || size > max_bytes ) {
        return CDDA_RNG_INVALID_ARGUMENT;
    }
    try {
        return restore_impl( input, size );
    } catch( ... ) {
        return CDDA_RNG_RESOURCE_FAILURE;
    }
}
