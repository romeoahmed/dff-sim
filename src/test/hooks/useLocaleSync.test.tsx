import { vi } from "vitest";

// Mock @/i18n before importing anything else
vi.mock("@/i18n", async () => {
  const { i18n } = await import("@lingui/core");

  return {
    i18n,
    activateLocale: vi.fn(async (locale: string) => {
      i18n.loadAndActivate({ locale, messages: {} });
    }),
  };
});

import { i18n } from "@lingui/core";
import { act, renderHook } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { describe, expect, it } from "vitest";
import { localeAtom } from "@/atoms/ui-atoms";
import { useLocaleSync } from "@/hooks/useLocaleSync";

describe("useLocaleSync", () => {
  it("activates the locale currently set on localeAtom", async () => {
    const store = createStore();
    const spy = vi.spyOn(i18n, "loadAndActivate");

    renderHook(() => useLocaleSync(), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ locale: "en" }));

    await act(async () => {
      store.set(localeAtom, "zh-CN");
      await Promise.resolve();
    });
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ locale: "zh-CN" }));
  });
});
