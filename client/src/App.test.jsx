import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import App from "./App.jsx";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routes", () => {
  it("shows the Planning Poker heading on the landing page", () => {
    renderAt("/");

    expect(screen.getByRole("heading", { level: 1, name: "Planning Poker" })).toBeTruthy();
  });

  it("shows the independence disclaimer in the footer on every page", () => {
    renderAt("/");

    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toContain("Independent student project, not affiliated with RIT.");
  });

  it("shows a not-found page with a link home for unknown routes", () => {
    renderAt("/no/such/page");

    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });

  it("shows a site header with a home link and the theme switch on every page", () => {
    renderAt("/no/such/page");

    const header = screen.getByRole("banner");
    expect(header.querySelector('a[href="/"]')?.textContent).toBe("Planning Poker");
    expect(screen.getByRole("group", { name: "Theme" })).toBeTruthy();
  });
});
