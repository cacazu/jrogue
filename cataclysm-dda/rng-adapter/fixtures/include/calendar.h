// Fixture only. The actual calendar is not part of this bounded RNG integration.
#pragma once
class time_duration {
  public:
    int turns;
};
template<typename T> T to_turns( const time_duration &value ) {
    return static_cast<T>( value.turns );
}
