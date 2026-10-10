// Focused support only: exact selected original definitions; not whole translations/output TUs.
// Diagnostic leaves below abort on every call and cannot silently pass producer checks.
#include "translations.h"
#include "output.h"
#include "debug.h"
#include <algorithm>
#include <cstdint>
#include <cstdlib>
#include <string>
#include <string_view>
#include <vector>

static int current_language_version = INVALID_LANGUAGE_VERSION + 1;
int detail::get_current_language_version()
{
    return current_language_version;
}

std::vector<size_t> get_tag_positions( std::string_view s )
{
    std::vector<size_t> ret;
    size_t pos = s.find( "<color_", 0, 7 );
    while( pos != std::string::npos ) {
        ret.push_back( pos );
        pos = s.find( "<color_", pos + 1, 7 );
    }
    pos = s.find( "</color>", 0, 8 );
    while( pos != std::string::npos ) {
        ret.push_back( pos );
        pos = s.find( "</color>", pos + 1, 8 );
    }
    std::sort( ret.begin(), ret.end() );
    return ret;
}

std::string remove_color_tags( std::string_view s )
{
    std::string ret;
    std::vector<size_t> tag_positions = get_tag_positions( s );
    if( tag_positions.empty() ) {
        return std::string( s );
    }

    size_t next_pos = 0;
    for( size_t tag_position : tag_positions ) {
        ret += s.substr( next_pos, tag_position - next_pos );
        next_pos = s.find( ">", tag_position, 1 ) + 1;
    }

    ret += s.substr( next_pos, std::string::npos );
    return ret;
}

namespace { std::uint32_t fixture_diagnostic_calls = 0; }
void realDebugmsg( const char *, const char *, const char *, const std::string & )
{ ++fixture_diagnostic_calls; std::abort(); }
std::ostream &DebugLog( DebugLevel, DebugClass )
{ ++fixture_diagnostic_calls; std::abort(); }
extern "C" std::uint32_t cdda_fixture_diagnostic_call_count()
{ return fixture_diagnostic_calls; }
