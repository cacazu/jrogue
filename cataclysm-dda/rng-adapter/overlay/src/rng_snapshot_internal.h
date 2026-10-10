// Storage-only refactor: default constructors are identical to upstream statics.
#pragma once
#include <random>

struct cdda_rng_distribution_registry {
    std::uniform_int_distribution<unsigned int> rng_uint_dist;
    std::uniform_int_distribution<int> rng_int_dist;
    std::uniform_real_distribution<double> rng_real_dist;
    std::normal_distribution<double> rng_normal_dist;
    std::exponential_distribution<double> rng_exponential_dist;
    std::chi_squared_distribution<double> rng_chi_squared_dist;
};

cdda_rng_distribution_registry &cdda_rng_distributions();
