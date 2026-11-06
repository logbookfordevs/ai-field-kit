import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "@tanstack/react-query";
import { expect, it } from "vitest";
import { useClient } from "@/api/ClientProvider";
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

function RulesAndVersion() {
  const rules = useOperation("rules/state");
  const state = useOperation("state");
  const save = useMutation("rules/save");
  const client = useClient();
  const version = useQuery({ queryKey: ["app", "update-check"], queryFn: async () => (await client.app.updateCheck()).ok, staleTime: Infinity });
  if (!rules.data || !state.data || version.data === undefined) return <p>Loading</p>;
  return <button type="button" onClick={() => void save.run({ files: [] })}>Save rules</button>;
}

it("refreshes only the reads a change can affect, and never the app's version check", async () => {
  const client = fakeClient({ "rules/state": () => ({}), state: () => ({}), "rules/save": () => ({}) });
  let versionChecks = 0;
  const check = client.app.updateCheck;
  client.app.updateCheck = async options => { versionChecks++; return await check(options); };
  renderWithApp(<RulesAndVersion />, { client });

  await userEvent.click(await screen.findByRole("button", { name: "Save rules" }));

  await waitFor(() => expect(client.calls.filter(call => call.operation === "rules/state")).toHaveLength(2));
  expect(client.calls.filter(call => call.operation === "state")).toHaveLength(1);
  expect(versionChecks).toBe(1);
});
