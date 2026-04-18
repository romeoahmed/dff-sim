import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Lingui's macro imports require a build-time Babel transform to become runtime
// calls. @vitejs/plugin-react@6 does not run its Babel transform on test files
// the same way it does on build/dev, so the macro guards in @lingui/vite-plugin
// fire and tests that render Trans/Plural/useLingui crash. We shim the macro
// surface here with the closest semantic runtime behaviour so tests render the
// final English text (matching what extraction would have produced).
vi.mock("@lingui/react/macro", async () => {
  const React = await import("react");
  const Trans = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Plural = ({ value, one, other }: { value: number; one: string; other: string }) => {
    const template = value === 1 ? one : other;
    return template.replace(/#/g, String(value));
  };
  const useLingui = () => ({
    i18n: {
      _: (desc: { message?: string; id?: string } | string) =>
        typeof desc === "string" ? desc : (desc.message ?? desc.id ?? ""),
    },
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce(
        (acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ""),
        "",
      ),
  });
  return { Trans, Plural, useLingui };
});

vi.mock("@lingui/core/macro", () => {
  const msg = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const message = strings.reduce(
      (acc, str, i) => acc + str + (values[i] !== undefined ? String(values[i]) : ""),
      "",
    );
    return { id: message, message };
  };
  return { msg };
});
