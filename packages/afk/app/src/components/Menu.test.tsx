import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Menu, MenuItem, MenuSeparator } from "@/components/Menu";

function RowMenu({ onInspect = () => {}, onDelete = () => {} }: { onInspect?: () => void; onDelete?: () => void }) {
  return (
    <Menu label="More for kami">
      <MenuItem onSelect={onInspect}>Inspect</MenuItem>
      <MenuItem onSelect={() => {}} disabledReason="No repository to update from.">Update</MenuItem>
      <MenuSeparator />
      <MenuItem onSelect={onDelete} danger>Delete…</MenuItem>
    </Menu>
  );
}

it("opens a list of plain buttons from a named trigger, without menu roles", async () => {
  const { container } = render(<RowMenu />);
  const trigger = screen.getByRole("button", { name: "More for kami" });
  expect(trigger).toHaveAttribute("aria-expanded", "false");

  await userEvent.click(trigger);

  expect(trigger).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Inspect" })).toHaveFocus();
  expect(container.querySelector("[role=menu],[role=menuitem],[aria-haspopup]")).toBeNull();
});

it("runs the chosen action, closes and returns focus to the trigger", async () => {
  const inspect = vi.fn();
  render(<RowMenu onInspect={inspect} />);
  const trigger = screen.getByRole("button", { name: "More for kami" });
  await userEvent.click(trigger);

  await userEvent.keyboard("{Enter}");

  expect(inspect).toHaveBeenCalledOnce();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
});

it("closes with Escape and returns focus", async () => {
  render(<RowMenu />);
  const trigger = screen.getByRole("button", { name: "More for kami" });
  await userEvent.click(trigger);

  await userEvent.keyboard("{Escape}");

  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(trigger).toHaveFocus();
});

it("keeps an unavailable action reachable and explains why", async () => {
  render(<RowMenu />);
  await userEvent.click(screen.getByRole("button", { name: "More for kami" }));
  await userEvent.tab();

  const update = screen.getByRole("button", { name: "Update" });
  expect(update).toHaveFocus();
  expect(update).toHaveAttribute("aria-disabled", "true");
  expect(update).toHaveAccessibleDescription("No repository to update from.");
  await userEvent.keyboard("{Enter}");
  expect(update).toBeInTheDocument();
});
