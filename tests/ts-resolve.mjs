// Owns: one module-resolution rule for the unit tests: a relative import with no extension, made from a .ts file, resolves to the .ts file next to it (Lens Studio's own TypeScript allows "./CaseLightGeometry").
// Talks to: Node's module loader (registered by tests/register-ts.mjs).
// Must not: change any other resolution, or touch anything outside the import being resolved.

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith("./") || specifier.startsWith("../")
  const fromTs = typeof context.parentURL === "string" && context.parentURL.endsWith(".ts")
  const hasExtension = /\.[a-z]+$/i.test(specifier)
  if (relative && fromTs && !hasExtension) {
    return nextResolve(`${specifier}.ts`, context)
  }
  return nextResolve(specifier, context)
}
