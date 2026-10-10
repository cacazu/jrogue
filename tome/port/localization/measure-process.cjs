// External test telemetry only; does not change original Lua execution.
process.on('exit', () => process.stderr.write(`TOME_TEST_PROCESS_PEAK_RSS_BYTES=${process.resourceUsage().maxRSS * 1024}\n`));
