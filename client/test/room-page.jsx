import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import RoomPage from "../src/pages/RoomPage.jsx";
import { ServicesProvider } from "../src/services.jsx";
import { createFakeSessions, createFakeSocket } from "./fakes.js";

function CurrentPath() {
  return <p data-testid="path">{useLocation().pathname}</p>;
}

export function snapshot(overrides = {}) {
  return {
    room: {
      code: "ABCDEFGH",
      name: "Sprint 12",
      status: "idle",
      facilitatorId: "dana",
      currentStoryId: null,
    },
    participants: [
      { id: "dana", displayName: "Dana", role: "voter", connected: true, hasVoted: false },
      { id: "riley", displayName: "Riley", role: "voter", connected: true, hasVoted: false },
    ],
    stories: [],
    round: null,
    me: { participantId: "riley", role: "voter", isFacilitator: false, myVote: null },
    ...overrides,
  };
}

// Renders /room/ABCDEFGH with a fake socket the test controls like a server.
export function renderRoomPage({ seated = true, respond } = {}) {
  const sessions = createFakeSessions();
  if (seated) {
    sessions.save("ABCDEFGH", { participantId: "riley", token: "t".repeat(43) });
  }
  const socket = createFakeSocket({ respond });
  render(
    <ServicesProvider value={{ api: {}, sessions, connectSocket: () => socket }}>
      <MemoryRouter initialEntries={["/room/ABCDEFGH"]}>
        <Routes>
          <Route path="/room/:code" element={<RoomPage />} />
          <Route path="*" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
  const serverSends = (event, ...args) =>
    act(async () => {
      socket.serverSends(event, ...args);
    });
  async function joinWith(state = snapshot()) {
    await serverSends("connect");
    await serverSends("room:state", state);
  }
  return { user: userEvent.setup(), socket, sessions, serverSends, joinWith };
}
