import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import LandingPage from "./LandingPage.jsx";

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderLanding() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}

describe("LandingPage", () => {
  it("links to creating a room", () => {
    renderLanding();
    expect(screen.getByRole("link", { name: "Create a room" }).getAttribute("href")).toBe("/new");
  });

  it("goes to the join page for a valid code typed in any format", async () => {
    const user = renderLanding();

    await user.type(screen.getByLabelText("Room code"), "abcd-efgh");
    await user.click(screen.getByRole("button", { name: "Join room" }));

    expect(screen.getByTestId("path").textContent).toBe("/join/ABCDEFGH");
  });

  it("joins when Enter is pressed in the code field", async () => {
    const user = renderLanding();

    await user.type(screen.getByLabelText("Room code"), "ABCDEFGH{Enter}");

    expect(screen.getByTestId("path").textContent).toBe("/join/ABCDEFGH");
  });

  it.each(["", "ABC", "ABCD-EFG0"])(
    "explains an invalid code (%j) next to the field",
    async (typed) => {
      const user = renderLanding();
      const field = screen.getByLabelText("Room code");

      if (typed) {
        await user.type(field, typed);
      }
      await user.click(screen.getByRole("button", { name: "Join room" }));

      const error = screen.getByText("Enter the 8-character room code, like ABCD-EFGH.");
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")).toContain(error.id);
      expect(screen.queryByTestId("path")).toBeNull();
    },
  );

  it("reaches the create link, the code field, and the join button with Tab, in that order", async () => {
    const user = renderLanding();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Create a room" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Room code"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Join room" }));
  });
});
