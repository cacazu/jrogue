#include "fixture.h"

extern "C" int jspi_fixture_callee(int mode)
{
    if (mode == 0)
        return 73;
    const int resumed = jspi_fixture_yield(mode);
    if (mode == 2)
        throw resumed;
    return resumed;
}

JspiFixtureTarget volatile jspi_fixture_target = &jspi_fixture_callee;
