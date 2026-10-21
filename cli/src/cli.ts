#!/usr/bin/env node
import { run } from "./run.js";

const code = await run(process.argv);
process.exit(code);
