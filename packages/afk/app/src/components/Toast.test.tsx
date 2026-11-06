import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "@/components/Toast";

function Trigger({ withAction = false, onUndo = () => {} }: { withAction?: boolean; onUndo?: () => void }) {
  const toast = useToast();
  const show = () => toast.show("kami turned off", withAction ? { action: { label: "Undo", onAction: onUndo } } : {});
  return <button type="button" onClick={show}>Turn off</button>;
}

afterEach(() => { vi.useRealTimers(); });

it("announces feedback politely and clears it after 4.5 seconds", () => {
  vi.useFakeTimers();
  render(<ToastProvider><Trigger /></ToastProvider>);

  fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
  expect(screen.getByRole("status")).toHaveTextContent("kami turned off");

  act(() => { vi.advanceTimersByTime(4_400); });
  expect(screen.getByRole("status")).toHaveTextContent("kami turned off");
  act(() => { vi.advanceTimersByTime(200); });
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("keeps feedback with an action for 7 seconds and runs the action once", () => {
  vi.useFakeTimers();
  const undo = vi.fn();
  render(<ToastProvider><Trigger withAction onUndo={undo} /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Turn off" }));

  act(() => { vi.advanceTimersByTime(6_000); });
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));

  expect(undo).toHaveBeenCalledOnce();
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});
