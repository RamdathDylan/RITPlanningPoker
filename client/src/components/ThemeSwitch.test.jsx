import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ThemeSwitch from "./ThemeSwitch.jsx";

const root = () => document.documentElement;

describe("ThemeSwitch", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete root().dataset.theme;
  });
  afterEach(() => {
    delete root().dataset.theme;
  });

  it("offers System, Light, and Dark, starting on System", () => {
    render(<ThemeSwitch />);

    expect(screen.getByRole("group", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "System" }).checked).toBe(true);
    expect(screen.getByRole("radio", { name: "Light" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeTruthy();
  });

  it("applies and remembers a chosen theme", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch />);

    await user.click(screen.getByRole("radio", { name: "Dark" }));

    expect(root().dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("pp:theme")).toBe("dark");
  });

  it("goes back to following the device with System", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("pp:theme", "light");
    root().dataset.theme = "light";
    render(<ThemeSwitch />);
    expect(screen.getByRole("radio", { name: "Light" }).checked).toBe(true);

    await user.click(screen.getByRole("radio", { name: "System" }));

    expect(root().dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem("pp:theme")).toBe("system");
  });

  it("still works when the browser blocks storage", async () => {
    const user = userEvent.setup();
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    try {
      render(<ThemeSwitch />);
      await user.click(screen.getByRole("radio", { name: "Dark" }));
      expect(root().dataset.theme).toBe("dark");
    } finally {
      Object.defineProperty(window, "localStorage", original);
    }
  });
});
