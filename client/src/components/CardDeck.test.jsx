import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { FIBONACCI_DECK } from "../../../shared/events.js";
import CardDeck from "./CardDeck.jsx";

function Harness({ initial = null, disabled = false, onSelect = () => {} }) {
  const [selected, setSelected] = useState(initial);
  return (
    <>
      <CardDeck
        cards={FIBONACCI_DECK}
        selected={selected}
        disabled={disabled}
        onSelect={(value) => {
          onSelect(value);
          setSelected(value);
        }}
      />
      <button type="button">After the deck</button>
    </>
  );
}

function renderDeck(props) {
  const choices = [];
  render(<Harness onSelect={(value) => choices.push(value)} {...props} />);
  return { user: userEvent.setup(), choices };
}

const card = (name) => screen.getByRole("button", { name });

describe("CardDeck", () => {
  it("is a labelled group of toggle buttons with spoken names", () => {
    renderDeck();

    expect(screen.getByRole("group", { name: "Your estimate" })).toBeTruthy();
    expect(card("0 points")).toBeTruthy();
    expect(card("1 point")).toBeTruthy();
    expect(card("21 points")).toBeTruthy();
    expect(card("Unsure")).toBeTruthy();
    expect(card("Need a break")).toBeTruthy();
    expect(card("5 points").getAttribute("aria-pressed")).toBe("false");
  });

  it("is a single Tab stop that starts on the first card", async () => {
    const { user } = renderDeck();

    await user.tab();
    expect(document.activeElement).toBe(card("0 points"));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After the deck" }));
  });

  it("starts on the selected card when there is one", async () => {
    const { user } = renderDeck({ initial: "8" });
    await user.tab();
    expect(document.activeElement).toBe(card("8 points"));
  });

  it("moves focus with the arrow keys without voting, wrapping at the ends", async () => {
    const { user, choices } = renderDeck();
    await user.tab();

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("1 point"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(card("2 points"));
    await user.keyboard("{ArrowUp}{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(card("Need a break"));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(card("0 points"));
    expect(choices).toEqual([]);
  });

  it("jumps to the first and last card with Home and End", async () => {
    const { user } = renderDeck();
    await user.tab();

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(card("Need a break"));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(card("0 points"));
  });

  it("votes with Enter or Space and shows the card as pressed", async () => {
    const { user, choices } = renderDeck();
    await user.tab();

    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");
    expect(choices).toEqual(["5"]);
    expect(card("5 points").getAttribute("aria-pressed")).toBe("true");

    await user.keyboard("{ArrowRight} ");
    expect(choices).toEqual(["5", "8"]);
  });

  it("clears the vote when the selected card is pressed again", async () => {
    const { user, choices } = renderDeck({ initial: "3" });

    await user.click(card("3 points"));

    expect(choices).toEqual([null]);
    expect(card("3 points").getAttribute("aria-pressed")).toBe("false");
  });

  it("can be disabled while reconnecting or after the reveal", () => {
    renderDeck({ disabled: true });
    expect(screen.getAllByRole("button").filter((button) => button.disabled)).toHaveLength(10);
  });

  it("shows the break card as the word Break, not an emoji", () => {
    renderDeck();
    const breakCard = card("Need a break");
    expect(breakCard.textContent).toBe("Break");
    expect(screen.queryByText("☕")).toBeNull();
  });
});
