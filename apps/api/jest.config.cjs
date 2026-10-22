const transform = {
  "^.+\\.tsx?$": [
    "@swc/jest",
    {
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
      },
      module: { type: "es6" },
    },
  ],
};

const setupFiles = ["<rootDir>/test/setup.ts"];
const setupFilesAfterEnv = ["<rootDir>/test/after-env.ts"];

module.exports = {
  rootDir: ".",
  extensionsToTreatAsEsm: [".ts"],
  transform,
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  projects: [
    {
      displayName: "unit",
      rootDir: ".",
      testEnvironment: "node",
      testMatch: ["<rootDir>/test/**/*.spec.ts"],
      testPathIgnorePatterns: ["<rootDir>/test/integration/"],
      setupFiles,
      setupFilesAfterEnv,
      transform,
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
    },
    {
      displayName: "integration",
      rootDir: ".",
      testEnvironment: "node",
      testMatch: ["<rootDir>/test/integration/**/*.spec.ts"],
      setupFiles,
      setupFilesAfterEnv,
      transform,
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
    },
  ],
};
