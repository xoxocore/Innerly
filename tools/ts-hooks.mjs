// Lets a test import the app's own modules by the paths the app writes.
//
// The project resolves "./types" the way a bundler does; Node wants
// "./types.ts". Rather than keeping a transpiled copy of the logic beside the
// real one — which is the copy that eventually stops matching — this fills in
// the extension so the module under test is the module that ships.
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (specifier.startsWith(".") && !/\.[mc]?[jt]s$/.test(specifier)) {
      return next(`${specifier}.ts`, context);
    }
    throw err;
  }
}
