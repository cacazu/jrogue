// Unchanged src/cata_utility.h:222-226. CC BY-SA 3.0.
#pragma once
#include <algorithm>
template<typename T>
constexpr T clamp( const T &val, const T &min, const T &max )
{
    return std::max( min, std::min( max, val ) );
}
