// Fixture only. Only angle conversion is exercised by the bounded RNG suite.
#pragma once
namespace units {
using angle = double;
template<typename T, typename U> struct quantity {
    T stored;
    U unit;
    T value() const { return stored; }
};
}
constexpr double operator""_pi_radians( unsigned long long value ) {
    return value * 3.141592653589793238462643383279502884;
}
