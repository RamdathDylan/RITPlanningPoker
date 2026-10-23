import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ParticipantList from "./ParticipantList.jsx";

const people = [
  { id: "dana", displayName: "Dana", role: "voter", connected: true, hasVoted: true },
  { id: "riley", displayName: "Riley", role: "voter", connected: true, hasVoted: false },
  { id: "sam", displayName: "Sam", role: "voter", connected: false, hasVoted: false },
  { id: "olive", displayName: "Olive", role: "observer", connected: true, hasVoted: false },
];

function renderList(overrides = {}) {
  render(
    <ParticipantList
      participants={people}
      facilitatorId="dana"
      meId="riley"
      roundOpen
      {...overrides}
    />,
  );
}

const rowFor = (name) => screen.getByText(name).closest("li");

describe("ParticipantList", () => {
  it("has a heading with the number of participants", () => {
    renderList();
    expect(screen.getByRole("heading", { level: 2, name: "Participants (4)" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("says in words who has voted and who is still deciding, with a decorative icon", () => {
    renderList();

    expect(within(rowFor("Dana")).getByText("Voted")).toBeTruthy();
    expect(within(rowFor("Riley")).getByText("Waiting")).toBeTruthy();
    for (const icon of rowFor("Dana").querySelectorAll("svg")) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("marks the facilitator, observers, offline people, and me in text", () => {
    renderList();

    expect(within(rowFor("Dana")).getByText("Facilitator")).toBeTruthy();
    expect(within(rowFor("Olive")).getByText("Observer")).toBeTruthy();
    expect(within(rowFor("Sam")).getByText("Offline")).toBeTruthy();
    expect(within(rowFor("Riley")).getByText("(you)")).toBeTruthy();
  });

  it("doesn't give observers a voting status", () => {
    renderList();
    expect(within(rowFor("Olive")).queryByText(/Voted|Waiting/)).toBeNull();
  });

  it("shows no voting status when no round is open", () => {
    renderList({ roundOpen: false });
    expect(screen.queryByText("Voted")).toBeNull();
    expect(screen.queryByText("Waiting")).toBeNull();
  });

  it("renders names as plain text, never as HTML", () => {
    const sneaky = '<img src=x onerror="alert(1)">';
    render(
      <ParticipantList
        participants={[{ ...people[0], displayName: sneaky }]}
        facilitatorId="dana"
        meId="dana"
        roundOpen={false}
      />,
    );

    expect(screen.getByText(sneaky)).toBeTruthy();
    expect(document.querySelector("img")).toBeNull();
  });
});
