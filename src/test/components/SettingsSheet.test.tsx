import { fireEvent, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import type { ReactElement } from "react";
import { settingsOpenAtom } from "@/atoms/ui-atoms";
import { SettingsSheet } from "@/components/settings/SettingsSheet";

function renderWithStore(ui: ReactElement, store = createStore()) {
  return { ...render(<Provider store={store}>{ui}</Provider>), store };
}

describe("SettingsSheet", () => {
  it("does not render when settingsOpenAtom is false", () => {
    renderWithStore(<SettingsSheet />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the dialog when settingsOpenAtom is true", () => {
    const store = createStore();
    store.set(settingsOpenAtom, true);
    renderWithStore(<SettingsSheet />, store);
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders the Settings heading", () => {
    const store = createStore();
    store.set(settingsOpenAtom, true);
    renderWithStore(<SettingsSheet />, store);
    expect(screen.getByRole("heading", { name: /settings/i })).toBeInTheDocument();
  });

  it("renders a close button", () => {
    const store = createStore();
    store.set(settingsOpenAtom, true);
    renderWithStore(<SettingsSheet />, store);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("close button sets settingsOpenAtom to false", () => {
    const store = createStore();
    store.set(settingsOpenAtom, true);
    renderWithStore(<SettingsSheet />, store);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(store.get(settingsOpenAtom)).toBe(false);
  });

  it("unmounts when settingsOpenAtom is set to false", () => {
    const store = createStore();
    store.set(settingsOpenAtom, true);
    renderWithStore(<SettingsSheet />, store);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
