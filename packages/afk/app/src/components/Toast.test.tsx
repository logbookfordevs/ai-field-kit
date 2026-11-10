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

function Failing() {
  const toast = useToast();
  return <button type="button" onClick={() => toast.fail("The library has changes AFK did not make.")}>Save</button>;
}

it("keeps a failure until it is dismissed", () => {
  vi.useFakeTimers();
  render(<ToastProvider><Failing /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  act(() => { vi.advanceTimersByTime(60_000); });
  expect(screen.getByRole("status")).toHaveTextContent("The library has changes AFK did not make.");
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("waits while the pointer or focus is on it", () => {
  vi.useFakeTimers();
  render(<ToastProvider><Trigger withAction /></ToastProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Turn off" }));

  fireEvent.focus(screen.getByRole("button", { name: "Undo" }));
  act(() => { vi.advanceTimersByTime(30_000); });
  expect(screen.getByRole("status")).toHaveTextContent("kami turned off");

  fireEvent.blur(screen.getByRole("button", { name: "Undo" }));
  act(() => { vi.advanceTimersByTime(7_000); });
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("puts focus back on the control that made the change after Undo", () => {
  render(<ToastProvider><Trigger withAction /></ToastProvider>);
  const control = screen.getByRole("button", { name: "Turn off" });
  control.focus();
  fireEvent.click(control);

  const undo = screen.getByRole("button", { name: "Undo" });
  undo.focus();
  fireEvent.click(undo);

  expect(control).toHaveFocus();
});
