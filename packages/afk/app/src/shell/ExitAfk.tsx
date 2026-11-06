import { useEffect, useRef, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { useToast } from "@/components/Toast";

export function ExitButton({ onExited }: { onExited: () => void }) {
  const client = useClient();
  const toast = useToast();
  const [exiting, setExiting] = useState(false);

  const exit = async () => {
    setExiting(true);
    const result = await client.app.exit();
    if (result.ok) { onExited(); return; }
    setExiting(false);
    toast.show(result.error.message);
  };

  return <button type="button" className="text exit-afk" disabled={exiting} onClick={() => void exit()}>{exiting ? "Exiting…" : "Exit AFK"}</button>;
}

export function Closed() {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main id="main" className="closed">
      <div className="brand"><b>afk.</b><span>AI Field Kit</span></div>
      <h1 ref={heading} tabIndex={-1}>AFK is closed</h1>
      <p>The local server has stopped. Your library, settings and skills are unchanged.</p>
      <p>You can close this tab. Run <code>afk</code> in a terminal to open it again.</p>
    </main>
  );
}
