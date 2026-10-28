const apiNodeModules = `${__dirname}/node_modules`;
const repositoryRoot = `${__dirname}/../..`;

const transform = {
  "^.+\\.tsx?$": [
    `${apiNodeModules}/@swc/jest`,
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
  moduleNameMapper: {
    "^\\./internal/(.*)\\.js$": `${apiNodeModules}/../src/generated/prisma/internal/$1.ts`,
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  projects: [
    {
      displayName: "unit",
      rootDir: ".",
      testEnvironment: "node",
      testMatch: ["<rootDir>/test/**/*.spec.ts", "<rootDir>/src/**/*.spec.ts"],
      testPathIgnorePatterns: ["<rootDir>/test/integration/"],
      setupFiles,
      setupFilesAfterEnv,
      transform,
      moduleNameMapper: {
        "^\\./internal/(.*)\\.js$": `${apiNodeModules}/../src/generated/prisma/internal/$1.ts`,
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
    },
    {
      displayName: "integration",
      rootDir: ".",
      roots: [
        "<rootDir>/test/integration",
        "<rootDir>/../../tests/concurrency",
      ],
      modulePaths: [apiNodeModules],
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/test/integration/**/*.spec.ts",
        "<rootDir>/../../tests/concurrency/**/*.spec.ts",
      ],
      setupFiles,
      setupFilesAfterEnv,
      transform,
      moduleNameMapper: {
        "^\\./internal/(.*)\\.js$": `${apiNodeModules}/../src/generated/prisma/internal/$1.ts`,
        "^(\\.{1,2}/.*)\\.js$": "$1",
      },
    },
    {
      displayName: "contracts",
      rootDir: repositoryRoot,
      roots: ["<rootDir>/tests/contracts"],
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/contracts/**/*.spec.ts"],
      setupFiles: ["<rootDir>/apps/api/test/setup.ts"],
      setupFilesAfterEnv: ["<rootDir>/apps/api/test/after-env.ts"],
      transform,
      modulePaths: [apiNodeModules],
      moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
    },
  ],
};
