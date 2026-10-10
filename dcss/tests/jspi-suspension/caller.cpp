#include "fixture.h"
#include <cstdio>

#ifdef FIXTURE_CTOR
namespace
{
bool fixture_ctor_ok = false;

struct FixtureCtor
{
    FixtureCtor()
    {
        try
        {
            const int returned = jspi_fixture_target(0);
            fixture_ctor_ok = returned == 73;
            if (fixture_ctor_ok)
                std::printf("FIXTURE CTOR value=%d\n", returned);
            else
                std::fprintf(stderr, "FIXTURE CTOR FAIL returned=%d expected=73\n", returned);
        }
        catch (...)
        {
            std::fputs("FIXTURE CTOR FAIL unexpected exception\n", stderr);
        }
    }
};

FixtureCtor fixture_ctor;
}
#endif

int main()
{
    std::puts("FIXTURE START");
#ifdef FIXTURE_CTOR
    if (!fixture_ctor_ok)
        return 6;
#endif
    int returned = 0;
    try
    {
        returned = jspi_fixture_target(1);
    }
    catch (...)
    {
        std::fputs("FIXTURE FAIL unexpected first-call exception\n", stderr);
        return 1;
    }
    if (returned != 101)
    {
        std::fprintf(stderr, "FIXTURE FAIL returned=%d expected=101\n", returned);
        return 2;
    }
    std::printf("FIXTURE RETURN value=%d\n", returned);

    int caught = 0;
    try
    {
        (void)jspi_fixture_target(2);
        std::fputs("FIXTURE FAIL second call did not throw\n", stderr);
        return 3;
    }
    catch (int value)
    {
        caught = value;
    }
    catch (...)
    {
        std::fputs("FIXTURE FAIL exception was not an integer\n", stderr);
        return 4;
    }
    if (caught != 102)
    {
        std::fprintf(stderr, "FIXTURE FAIL caught=%d expected=102\n", caught);
        return 5;
    }
    std::printf("FIXTURE CATCH value=%d\n", caught);
    std::puts("FIXTURE PASS");
    return 0;
}
