mergeInto(LibraryManager.library, {
  jspi_fixture_yield__async: true,
  jspi_fixture_yield__deps: ['$Asyncify'],
  jspi_fixture_yield: function(mode) {
    return Asyncify.handleSleep(function(wakeUp) {
      if (typeof Module.fixtureYield !== 'function') {
        throw new Error('fixture host must provide fixtureYield(mode, wakeUp)');
      }
      Module.fixtureYield(mode, wakeUp);
    });
  }
});
