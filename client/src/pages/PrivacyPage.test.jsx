import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import App from "../App.jsx";
import { ServicesProvider } from "../services.jsx";

function renderAt(path) {
  render(
    <ServicesProvider
      value={{ api: {}, sessions: { load: () => null }, connectSocket: () => null }}
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ServicesProvider>,
  );
}

describe("privacy page", () => {
  it("explains what is collected and why", () => {
    renderAt("/privacy");

    expect(screen.getByRole("heading", { level: 1, name: "Privacy" })).toBeTruthy();
    for (const item of [
      /display name/i,
      /story titles/i,
      /votes/i,
      /IP address/i,
      /this browser/i,
    ]) {
      expect(screen.getAllByText(item).length).toBeGreaterThan(0);
    }
  });

  it("states how long data is kept and how to delete it sooner", () => {
    renderAt("/privacy");

    expect(screen.getByText(/30 days/)).toBeTruthy();
    expect(screen.getByText(/37 days/)).toBeTruthy();
    expect(screen.getByText(/facilitator can delete the room/i)).toBeTruthy();
  });

  it("says there is no tracking and no RIT affiliation", () => {
    renderAt("/privacy");

    expect(screen.getByText(/no analytics, advertising, or tracking/i)).toBeTruthy();
    expect(screen.getAllByText(/not affiliated with RIT/i).length).toBeGreaterThan(0);
  });

  it("gives a way to get in touch", () => {
    renderAt("/privacy");
    expect(
      screen.getByRole("link", { name: "the project's GitHub repository" }).getAttribute("href"),
    ).toBe("https://github.com/RamdathDylan/RITPlanningPoker");
  });

  it.each(["/", "/new", "/privacy"])("links to it from the footer on %s", (path) => {
    renderAt(path);
    const footer = screen.getByRole("contentinfo");
    expect(footer.querySelector('a[href="/privacy"]')?.textContent).toBe("Privacy");
  });
});
