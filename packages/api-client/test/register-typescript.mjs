import { registerHooks } from "node:module";

// Existing WebSession imports omit extensions; Node's type stripping does not
// resolve those the way Metro/Next do. Keep this compatibility in the test runner.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error.code === "ERR_MODULE_NOT_FOUND" &&
        /^\.{1,2}\//.test(specifier) &&
        !/\.[a-z]+$/i.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
