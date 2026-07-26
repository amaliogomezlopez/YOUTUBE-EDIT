#!/usr/bin/env node
import {loadDotEnv} from '../src/lib/utils.js';
import {publishingReadiness} from '../src/lib/publishing-readiness.js';

await loadDotEnv();
const report = await publishingReadiness({verify: true});
console.log(JSON.stringify(report, null, 2));
if (Object.values(report.platforms).every((platform) => platform.status !== 'ready')) process.exitCode = 2;
