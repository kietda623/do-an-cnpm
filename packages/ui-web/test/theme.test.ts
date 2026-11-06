import assert from "node:assert/strict";
import { test } from "node:test";
import { isThemeMode, resolveTheme, THEME_STORAGE_KEY } from "../src/theme.ts";

test("recognises only the three supported theme modes", () => {
  assert.equal(isThemeMode("light"), true);
  assert.equal(isThemeMode("dark"), true);
  assert.equal(isThemeMode("system"), true);
  assert.equal(isThemeMode("solar"), false);
  assert.equal(isThemeMode(null), false);
  assert.equal(isThemeMode(undefined), false);
});

test("explicit modes ignore the system preference", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("light", false), "light");
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("system mode follows the operating system preference", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("storage key stays stable for persisted preferences", () => {
  assert.equal(THEME_STORAGE_KEY, "marketplace-theme");
});
