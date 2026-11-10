import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { Switch } from "@/components/Switch";

function Controlled({ onChange }: { onChange?: (next: boolean) => void }) {
  const [on, setOn] = useState(false);
  return <Switch label="kami" checked={on} onChange={next => { setOn(next); onChange?.(next); }} />;
}

it("is a named switch that toggles from the keyboard and shows its state in text", async () => {
  const changes = vi.fn();
  render(<Controlled onChange={changes} />);
  const control = screen.getByRole("switch", { name: "kami" });
  expect(control).not.toBeChecked();
  expect(control).toHaveTextContent("Off");

  await userEvent.tab();
  expect(control).toHaveFocus();
  await userEvent.keyboard(" ");

  expect(control).toBeChecked();
  expect(control).toHaveTextContent("On");
  expect(changes).toHaveBeenCalledWith(true);
});

it("does not change while disabled", async () => {
  const changes = vi.fn();
  render(<Switch label="kami" checked onChange={changes} disabled />);

  await userEvent.click(screen.getByRole("switch", { name: "kami" }));

  expect(changes).not.toHaveBeenCalled();
});
