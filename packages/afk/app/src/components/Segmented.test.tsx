import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { Segmented } from "@/components/Segmented";

const options = [{ value: "manual", label: "Manual" }, { value: "auto", label: "Automatic" }] as const;

function Choice({ onChange }: { onChange: (value: "manual" | "auto") => void }) {
  const [value, setValue] = useState<"manual" | "auto">("manual");
  return <Segmented legend="How kami starts" options={options} value={value} onChange={next => { setValue(next); onChange(next); }} />;
}

it("is a named group of two radios operated with arrow keys", async () => {
  const changes = vi.fn();
  render(<Choice onChange={changes} />);
  expect(screen.getByRole("group", { name: "How kami starts" })).toBeInTheDocument();
  const manual = screen.getByRole("radio", { name: "Manual" });
  expect(manual).toBeChecked();

  await userEvent.click(manual);
  await userEvent.keyboard("{ArrowRight}");

  expect(screen.getByRole("radio", { name: "Automatic" })).toBeChecked();
  expect(changes).toHaveBeenLastCalledWith("auto");
});

it("keeps two choices on one screen independent", async () => {
  render(
    <>
      <Segmented legend="How kami starts" options={options} value="manual" onChange={() => {}} />
      <Segmented legend="How quill starts" options={options} value="auto" onChange={() => {}} />
    </>,
  );

  expect(screen.getByRole("group", { name: "How kami starts" }).querySelector("input:checked")).toHaveAccessibleName("Manual");
  expect(screen.getByRole("group", { name: "How quill starts" }).querySelector("input:checked")).toHaveAccessibleName("Automatic");
});
