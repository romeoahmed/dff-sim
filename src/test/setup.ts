import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Lingui's macro imports require a build-time transform to become runtime
// calls. Vitest's transform pipeline does not include the SWC plugin we use
// at build time, so the macro guards in @lingui/vite-plugin fire and tests
// that render Trans/Plural/useLingui crash. We shim the macro surface here
// with the closest semantic runtime behaviour so tests render the final
// English text (matching what extraction would have produced).
vi.mock("@lingui/react/macro", async () => {
  const React = await import("react");
  const Trans = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Plural = ({
    value,
    one,
    other,
  }: {
    value: number;
    one: React.ReactNode;
    other: React.ReactNode;
  }): React.ReactElement => {
    const branch = value === 1 ? one : other;
    if (typeof branch === "string") {
      return React.createElement(React.Fragment, null, branch.replace(/#/g, String(value)));
    }
    return React.createElement(React.Fragment, null, branch);
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
