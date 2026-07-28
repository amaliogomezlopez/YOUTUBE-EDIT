#!/usr/bin/env node
import {loadDotEnv} from '../src/lib/utils.js';
import {
  runEditorialVideoCli
} from '../src/modules/editorial-video/cli.js';

await loadDotEnv();

runEditorialVideoCli(process.argv.slice(2)).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
