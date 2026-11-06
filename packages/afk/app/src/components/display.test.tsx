import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { EmptyState } from "@/components/EmptyState";
import { Ledger, Row } from "@/components/Row";
import { PathCard } from "@/components/PathCard";
import { Progress } from "@/components/Progress";
import { Tags } from "@/components/Tags";

it("lists rows in a named ledger with their description, context and actions", () => {
  render(
    <Ledger label="Saved for later">
      <Row title="Hairline" description="Typography presets" meta="fieldnotes/hairline" actions={<button type="button">Install…</button>} />
      <Row title="Quill" />
    </Ledger>,
  );

  const rows = within(screen.getByRole("list", { name: "Saved for later" })).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("Typography presets");
  expect(rows[0]).toHaveTextContent("fieldnotes/hairline");
  expect(within(rows[0]!).getByRole("button", { name: "Install…" })).toBeInTheDocument();
});

it("says in text which tags are not downloaded, not only with a dashed border", () => {
  render(<Tags label="Members" items={["kami", { name: "quill", away: true }]} />);

  const tags = within(screen.getByRole("list", { name: "Members" })).getAllByRole("listitem");
  expect(tags.map(tag => tag.textContent)).toEqual(["kami", "quill (not downloaded yet)"]);
});

it("shows a labelled path with its action", () => {
  render(<PathCard label="Library" path="~/.afk/library" action={<button type="button">Copy path</button>} />);

  expect(screen.getByText("~/.afk/library").tagName).toBe("CODE");
  expect(screen.getByText("Library")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy path" })).toBeInTheDocument();
});

it("states what is missing and the next step", () => {
  render(<EmptyState title="Nothing saved for later" actions={<button type="button">Save a repository for later</button>}>Bookmark a repository to look at later.</EmptyState>);

  expect(screen.getByRole("heading", { name: "Nothing saved for later" })).toBeInTheDocument();
  expect(screen.getByText("Bookmark a repository to look at later.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save a repository for later" })).toBeInTheDocument();
});

it("reports determinate and open-ended progress to assistive tech", () => {
  render(
    <>
      <Progress label="Downloading 2 of 5 skills" value={2} max={5} />
      <Progress label="Looking inside the repository" />
    </>,
  );

  const counted = screen.getByRole("progressbar", { name: "Downloading 2 of 5 skills" });
  expect(counted).toHaveAttribute("aria-valuenow", "2");
  expect(counted).toHaveAttribute("aria-valuemax", "5");
  expect(screen.getByRole("progressbar", { name: "Looking inside the repository" })).not.toHaveAttribute("aria-valuenow");
  expect(screen.getByText("Downloading 2 of 5 skills")).toBeVisible();
});
