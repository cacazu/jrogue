#pragma once

extern "C" int jspi_fixture_yield(int mode);
extern "C" int jspi_fixture_callee(int mode);

using JspiFixtureTarget = int (*)(int);
// Defined in the other translation unit; the caller cannot fold its initializer.
extern JspiFixtureTarget volatile jspi_fixture_target;
