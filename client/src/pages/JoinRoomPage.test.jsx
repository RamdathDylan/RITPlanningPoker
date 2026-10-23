import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { createFakeSessions } from "../../test/fakes.js";
import { ApiError } from "../api.js";
import { ServicesProvider } from "../services.jsx";
import JoinRoomPage from "./JoinRoomPage.jsx";

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

function renderPage({ path = "/join/ABCDEFGH", api = {}, sessions = createFakeSessions() } = {}) {
  render(
    <ServicesProvider value={{ api, sessions }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/join/:code?" element={<JoinRoomPage />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  return { user: userEvent.setup(), sessions };
}

const codeField = () => screen.getByLabelText("Room code");
const nameField = () => screen.getByLabelText("Your name");
const submit = () => screen.getByRole("button", { name: /join(ing)? room/i });

function recordingApi(result) {
  const calls = [];
  return {
    calls,
    joinRoom: async (...args) => {
      calls.push(args);
      if (result instanceof Error) {
        throw result;
      }
      return result;
    },
  };
}

const seat = { participantId: "p-2", rejoinToken: "r".repeat(43) };

describe("JoinRoomPage", () => {
  it("prefills the code from the link", () => {
    renderPage();
    expect(codeField().value).toBe("ABCD-EFGH");
  });

  it("starts empty without a code in the link", () => {
    renderPage({ path: "/join" });
    expect(codeField().value).toBe("");
  });

  it("joins as a voter, remembers the seat, and opens the room", async () => {
    const api = recordingApi(seat);
    const { user, sessions } = renderPage({ api });

    await user.type(nameField(), " Riley ");
    await user.click(submit());

    expect(api.calls).toEqual([["ABCDEFGH", { displayName: "Riley", role: "voter" }]]);
    expect(sessions.seats.get("ABCDEFGH")).toEqual({
      participantId: "p-2",
      token: seat.rejoinToken,
    });
    expect(screen.getByTestId("path").textContent).toBe("/room/ABCDEFGH");
  });

  it("joins as an observer when that box is checked", async () => {
    const api = recordingApi(seat);
    const { user } = renderPage({ api });

    await user.type(nameField(), "Instructor");
    await user.click(screen.getByRole("checkbox", { name: /join as an observer/i }));
    await user.click(submit());

    expect(api.calls[0][1]).toEqual({ displayName: "Instructor", role: "observer" });
  });

  it("shows a taken name on the name field", async () => {
    const api = recordingApi(
      new ApiError("NAME_TAKEN", "Someone in this room already uses that name."),
    );
    const { user } = renderPage({ api });

    await user.type(nameField(), "Dana");
    await user.click(submit());

    const error = screen.getByText("Someone in this room already uses that name.");
    expect(nameField().getAttribute("aria-invalid")).toBe("true");
    expect(nameField().getAttribute("aria-describedby")).toContain(error.id);
  });

  it.each([
    ["ROOM_FULL", "This room is full."],
    ["NOT_FOUND", "Room not found."],
  ])("shows %s as an alert", async (code, message) => {
    const { user } = renderPage({ api: recordingApi(new ApiError(code, message)) });

    await user.type(nameField(), "Riley");
    await user.click(submit());

    expect(screen.getByRole("alert").textContent).toBe(message);
  });

  it("explains an invalid code without calling the server", async () => {
    const api = recordingApi(seat);
    const { user } = renderPage({ path: "/join", api });

    await user.type(codeField(), "nope");
    await user.type(nameField(), "Riley");
    await user.click(submit());

    expect(screen.getByText("Enter the 8-character room code, like ABCD-EFGH.")).toBeTruthy();
    expect(api.calls).toEqual([]);
  });

  it("offers a way back instead of a second seat when this browser already has one", () => {
    const sessions = createFakeSessions();
    sessions.save("ABCDEFGH", { participantId: "p-1", token: "t".repeat(43) });

    renderPage({ sessions });

    expect(screen.getByText("You already have a seat in this room.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Return to the room" }).getAttribute("href")).toBe(
      "/room/ABCDEFGH",
    );
  });
});
