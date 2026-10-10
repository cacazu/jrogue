/* SPDX-License-Identifier: GPL-3.0-or-later
 * Test driver for untouched official T-Engine 4 1.7.6 SFMT.c.
 * Wrappers mirror src/core_lua.c by Nicolas Casalini (GPL-3.0-or-later).
 * normal_table.h is extracted verbatim from that source by verify.ps1.
 */
#include <stdio.h>
#include <stdint.h>
#include <inttypes.h>
#include "SFMT.c"
#include "normal_table.h"

static int reference_range(int x, int y) {
    if (x < y) return x + rand_div(1 + y - x);
    return y + rand_div(1 + x - y);
}

static int reference_normal(int mean, int stand) {
    int low = 0, high = 256;
    if (stand < 1) return mean;
    int tmp = (int)rand_div(32768);
    while (low < high) {
        long mid = (low + high) >> 1;
        if (randnor_table[mid] < tmp) low = mid + 1;
        else high = mid;
    }
    int offset = (long)stand * (long)low / 64;
    if (rand_div(100) < 50) return mean - offset;
    return mean + offset;
}

static int reference_dice(int count, int sides) {
    int result = 0;
    for (int i = 0; i < count; ++i) result += 1 + rand_div(sides);
    return result;
}

static double reference_average(int x, int y, int count) {
    double result = 0;
    for (int i = 0; i < count; ++i) {
        int draw = x + rand_div(1 + y - x);
        result += draw;
    }
    return result / (double)count;
}

static double reference_float(double x, double y) {
    float min = x, max = y;
    if (min < max) return genrand_real(min, max);
    return genrand_real(max, min);
}

int main(void) {
    const uint32_t seeds[] = {0, 1, 1234, 0x7fffffff, 0xffffffff, 0xdeadbeef};
    const uint32_t bounds[] = {0, 1, 2, 3, 100, 32768, 624, 65537, 0x7fffffff, 0xffffffff};
    const int ranges[][2] = {{1,6}, {6,1}, {-20,20}, {7,7}, {-100,-1}, {0,32767}, {-1000000,1000000}};
    const int normals[][2] = {{0,1}, {20,8}, {-20,100}, {99,0}, {99,-1}, {1000000,5432}};
    const int calls[] = {0, 1, -1, -2147483647 - 1, 2, 100};
    const int percentages[] = {-10, 0, 1, 50, 99, 100, 120};
    const double floats[][2] = {{0.1, 1.0003}, {5.9, -3.14159}, {4.2,4.2}};
    const int dice[][2] = {{0,6}, {-2,6}, {5,0}, {6,1}, {4,6}, {20,32768}};
    const int averages[][3] = {{0,100,2}, {-1000,1000,10}, {6,6,3}, {-100,-1,1}};
    printf("{\"source\":\"T-Engine 4 1.7.6 scalar SFMT.c\",\"seeds\":[");
    for (unsigned s = 0; s < sizeof(seeds)/sizeof(seeds[0]); ++s) {
        uint32_t seed = seeds[s];
        printf("%s{\"seed\":%"PRIu32",\"words\":[", s ? "," : "", seed);
        init_gen_rand(seed);
        for (int i = 0; i < 2000; ++i) printf("%s%"PRIu32, i ? "," : "", gen_rand32());
        printf("],\"real1_bits\":[");
        init_gen_rand(seed);
        for (int i = 0; i < 1300; ++i) {
            union { double d; uint64_t bits; } value;
            value.d = genrand_real1();
            printf("%s\"%016"PRIx64"\"", i ? "," : "", value.bits);
        }
        printf("],\"bounded\":[");
        init_gen_rand(seed);
        for (unsigned i = 0; i < 1000; ++i) {
            uint32_t bound = bounds[i % (sizeof(bounds)/sizeof(bounds[0]))];
            printf("%s[%"PRIu32",%"PRIu32"]", i ? "," : "", bound, rand_div(bound));
        }
        printf("],\"range\":[");
        init_gen_rand(seed);
        for (unsigned i = 0; i < 1000; ++i) {
            unsigned n = i % (sizeof(ranges)/sizeof(ranges[0]));
            int x = ranges[n][0], y = ranges[n][1];
            printf("%s[%d,%d,%d]", i ? "," : "", x, y, reference_range(x,y));
        }
        printf("],\"normal\":[");
        init_gen_rand(seed);
        for (unsigned i = 0; i < 1000; ++i) {
            unsigned n = i % (sizeof(normals)/sizeof(normals[0]));
            int mean = normals[n][0], stand = normals[n][1];
            printf("%s[%d,%d,%d]", i ? "," : "", mean, stand, reference_normal(mean,stand));
        }
        printf("],\"wrappers\":[");
        init_gen_rand(seed);
        for (unsigned i = 0; i < 300; ++i) {
            int call = calls[i % (sizeof(calls)/sizeof(calls[0]))];
            uint32_t call_value = rand_div(call);
            int chance = calls[(i+1) % (sizeof(calls)/sizeof(calls[0]))];
            int chance_value = rand_div(chance) == 0;
            int percent = percentages[i % (sizeof(percentages)/sizeof(percentages[0]))];
            int percent_value = (int)rand_div(100) < percent;
            unsigned f = i % (sizeof(floats)/sizeof(floats[0]));
            union { double d; uint64_t bits; } float_value;
            float_value.d = reference_float(floats[f][0], floats[f][1]);
            unsigned d = i % (sizeof(dice)/sizeof(dice[0]));
            int dice_value = reference_dice(dice[d][0], dice[d][1]);
            unsigned a = i % (sizeof(averages)/sizeof(averages[0]));
            union { double d; uint64_t bits; } avg_value;
            avg_value.d = reference_average(averages[a][0], averages[a][1], averages[a][2]);
            printf("%s{\"call\":[%d,%"PRIu32"],\"chance\":[%d,%d],\"percent\":[%d,%d],"
                "\"float\":[%.17g,%.17g,\"%016"PRIx64"\"],\"dice\":[%d,%d,%d],"
                "\"average\":[%d,%d,%d,\"%016"PRIx64"\"]}",
                i ? "," : "", call, call_value, chance, chance_value, percent, percent_value,
                floats[f][0], floats[f][1], float_value.bits,
                dice[d][0], dice[d][1], dice_value,
                averages[a][0], averages[a][1], averages[a][2], avg_value.bits);
        }
        printf("]}");
    }
    printf("]}\n");
    return 0;
}
