import { i18n } from "@lingui/core";
import { beforeEach, describe, expect, it } from "vitest";

import { activateLocale } from "@/i18n";

describe("locale switch", () => {
  beforeEach(async () => {
    // Reset to a known state before each test.
    await activateLocale("en");
  });

  it("translates a known English msgid", () => {
    // Use message descriptor with the hashed ID that matches compiled catalogs
    expect(i18n._({ id: "RiQMUh" })).toBe("Running");
    expect(i18n._({ id: "Tz0i8g" })).toBe("Settings");
  });

  it("switches to zh-CN and returns Chinese translations for the same ids", async () => {
    await activateLocale("zh-CN");
    expect(i18n._({ id: "RiQMUh" })).toBe("运行中");
    expect(i18n._({ id: "Tz0i8g" })).toBe("设置");
    expect(i18n._({ id: "I1MUm8" })).toBe("电压设置");
  });

  it("switches back to en", async () => {
    await activateLocale("zh-CN");
    await activateLocale("en");
    expect(i18n._({ id: "RiQMUh" })).toBe("Running");
  });
});
