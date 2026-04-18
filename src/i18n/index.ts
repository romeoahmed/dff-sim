import { i18n } from "@lingui/core";
import type { Locale } from "@/atoms/ui-atoms";

// Compiled catalogs are produced by `bun run lingui:compile` into messages.js
// siblings of the .po files. We dynamic-import so non-active catalogs are code-split.
const catalogs: Record<Locale, () => Promise<{ messages: Record<string, string> }>> = {
  en: () => import("./locales/en/messages.js"),
  "zh-CN": () => import("./locales/zh-CN/messages.js"),
};

export async function activateLocale(locale: Locale): Promise<void> {
  const loader = catalogs[locale];
  const { messages } = await loader();
  i18n.loadAndActivate({ locale, messages });
}

// Synchronously activate an empty "en" catalog so i18n._() is defined
// during the first render — real messages stream in once the dynamic import resolves.
i18n.loadAndActivate({ locale: "en", messages: {} });

export { i18n };
