import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { createFakeSessions, deferred } from "../../test/fakes.js";
import { ApiError } from "../api.js";
import { ServicesProvider } from "../services.jsx";
import CreateRoomPage from "./CreateRoomPage.jsx";

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderPage(api) {
  const sessions = createFakeSessions();
  render(
    <ServicesProvider value={{ api, sessions }}>
      <MemoryRouter initialEntries={["/new"]}>
        <Routes>
          <Route path="/new" element={<CreateRoomPage />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { user: userEvent.setup(), sessions };
}

const roomName = () => screen.getByLabelText("Room name");
const yourName = () => screen.getByLabelText("Your name");
const submit = () => screen.getByRole("button", { name: /creat(e|ing) room/i });

describe("CreateRoomPage", () => {
  it("labels both fields and states their limits", () => {
    renderPage({});

    expect(screen.getByRole("heading", { level: 1, name: "Create a room" })).toBeTruthy();
    expect(roomName().getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Up to 60 characters.")).toBeTruthy();
    expect(
      screen.getByText(
        "First name or nickname, up to 40 characters. Everyone in the room sees it.",
      ),
    ).toBeTruthy();
  });

  it("refuses a 41-character name without calling the server", async () => {
    const calls = [];
    const { user } = renderPage({ createRoom: async (body) => calls.push(body) });

    await user.type(roomName(), "Sprint 12");
    await user.type(yourName(), "x".repeat(41));
    await user.click(submit());

    expect(screen.getByText("Use 1 to 40 characters.")).toBeTruthy();
    expect(yourName().getAttribute("aria-invalid")).toBe("true");
    expect(calls).toEqual([]);
  });

  it("asks for a room name when it is empty", async () => {
    const { user } = renderPage({});
    await user.type(yourName(), "Dana");
    await user.click(submit());
    expect(screen.getByText("Use 1 to 60 characters.")).toBeTruthy();
  });

  it("creates the room, remembers the seat, and opens the room", async () => {
    const calls = [];
    const api = {
      createRoom: async (body) => {
        calls.push(body);
        return { code: "ABCDEFGH", participantId: "p-1", rejoinToken: "t".repeat(43) };
      },
    };
    const { user, sessions } = renderPage(api);

    await user.type(roomName(), "  Sprint   12 ");
    await user.type(yourName(), "Dana");
    await user.click(submit());

    expect(calls).toEqual([{ roomName: "Sprint 12", displayName: "Dana" }]);
    expect(sessions.seats.get("ABCDEFGH")).toEqual({ participantId: "p-1", token: "t".repeat(43) });
    expect(screen.getByTestId("path").textContent).toBe("/room/ABCDEFGH");
  });

  it("shows that it is working and prevents a second submit", async () => {
    const pending = deferred();
    const { user } = renderPage({ createRoom: () => pending.promise });

    await user.type(roomName(), "Sprint 12");
    await user.type(yourName(), "Dana");
    await user.click(submit());

    expect(submit().textContent).toBe("Creating room…");
    expect(submit().disabled).toBe(true);
    pending.reject(new ApiError("INTERNAL", "Something went wrong"));
  });

  it("shows a server error and lets the user try again", async () => {
    const { user } = renderPage({
      createRoom: async () => {
        throw new ApiError("RATE_LIMITED", "Too many requests. Please slow down.");
      },
    });

    await user.type(roomName(), "Sprint 12");
    await user.type(yourName(), "Dana");
    await user.click(submit());

    expect(screen.getByRole("alert").textContent).toBe("Too many requests. Please slow down.");
    expect(submit().disabled).toBe(false);
  });
});
