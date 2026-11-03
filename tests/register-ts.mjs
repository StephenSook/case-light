// Owns: registering tests/ts-resolve.mjs, so the Lens's pure TypeScript modules can import each other without extensions under Node.
// Talks to: node:module register().
// Must not: load any Lens module itself.

import { register } from "node:module"

register("./ts-resolve.mjs", import.meta.url)
