import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { useOperation, useMutation } from "@/api/hooks";
import { fail, fakeClient } from "@/test/fake-client";
import { renderWithApp } from "@/test/render";

function MachineOnly() {
  const kit = useOperation("kit/state");
  const keep = useMutation("kit/machine-only");
  if (kit.error) return <p role="alert">{kit.error.message}</p>;
  if (!kit.data) return <p>Loading</p>;
  return (
    <>
      <p>{kit.data.machineOnly.length} on this machine only</p>
      <button type="button" onClick={() => void keep.run({ name: "kami", enabled: true })}>Keep kami here</button>
      {keep.error ? <p role="alert">{keep.error.message}</p> : null}
    </>
  );
}

const kit = (machineOnly: string[]) => ({ core: [], sources: [], tools: [], undecided: [], machineOnly });

it("renders a failed read as a message instead of throwing", async () => {
  renderWithApp(<MachineOnly />, { client: fakeClient({ "kit/state": () => fail("Settings could not be read.") }) });

  expect(await screen.findByRole("alert")).toHaveTextContent("Settings could not be read.");
});

it("refreshes reads after a change succeeds", async () => {
  let machineOnly: string[] = [];
  renderWithApp(<MachineOnly />, { client: fakeClient({ "kit/state": () => kit(machineOnly), "kit/machine-only": () => { machineOnly = ["kami"]; return { ok: true }; } }) });
  expect(await screen.findByText("0 on this machine only")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Keep kami here" }));

  expect(await screen.findByText("1 on this machine only")).toBeInTheDocument();
});

it("keeps a failed change as a value next to the control", async () => {
  const client = fakeClient({ "kit/state": () => kit([]), "kit/machine-only": () => fail("Choose a valid skill name.") });
  renderWithApp(<MachineOnly />, { client });
  await userEvent.click(await screen.findByRole("button", { name: "Keep kami here" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a valid skill name.");
  await waitFor(() => expect(client.calls.filter(call => call.operation === "kit/state")).toHaveLength(1));
});
