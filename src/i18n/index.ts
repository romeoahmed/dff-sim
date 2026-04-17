import { i18n } from "@lingui/core";
import { messages as enMessages } from "./locales/en/messages.po";
import { messages as zhMessages } from "./locales/zh-CN/messages.po";

i18n.load({ en: enMessages, "zh-CN": zhMessages });
i18n.activate("en");

export { i18n };
