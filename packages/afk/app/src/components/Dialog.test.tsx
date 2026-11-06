import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { Dialog } from "@/components/Dialog";

function Opener({ canClose = true, onCloseBlocked }: { canClose?: boolean; onCloseBlocked?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Save a repository</button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Save for later"
        description="Nothing is installed."
        canClose={canClose}
        {...(onCloseBlocked ? { onCloseBlocked } : {})}
        footer={<button type="button" className="primary" onClick={() => setOpen(false)}>Save</button>}
      >
        <label>Repository<input name="repository" /></label>
      </Dialog>
    </>
  );
}

it("opens as a named modal and moves focus to its first field", async () => {
  render(<Opener />);

  await userEvent.click(screen.getByRole("button", { name: "Save a repository" }));

  const dialog = screen.getByRole("dialog", { name: "Save for later" });
  expect(dialog).toHaveAccessibleDescription("Nothing is installed.");
  expect(screen.getByRole("textbox", { name: "Repository" })).toHaveFocus();
});

it("closes with Escape and returns focus to what opened it", async () => {
  render(<Opener />);
  const trigger = screen.getByRole("button", { name: "Save a repository" });
  await userEvent.click(trigger);

  await userEvent.keyboard("{Escape}");

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("closes from its Close button and from a footer action", async () => {
  render(<Opener />);
  const trigger = screen.getByRole("button", { name: "Save a repository" });

  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();

  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("stays open when closing is blocked and says so", async () => {
  const blocked = vi.fn();
  render(<Opener canClose={false} onCloseBlocked={blocked} />);
  await userEvent.click(screen.getByRole("button", { name: "Save a repository" }));

  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Close" }));

  expect(screen.getByRole("dialog", { name: "Save for later" })).toBeInTheDocument();
  expect(blocked).toHaveBeenCalledTimes(2);
});
