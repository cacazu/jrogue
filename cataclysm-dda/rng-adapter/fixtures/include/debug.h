// Fixture only; count the original nonfinite rng_float diagnostic.
#pragma once
inline unsigned int fixture_debug_count = 0;
inline void debugmsg( const char * ) { ++fixture_debug_count; }
