import { useEffect, useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { Dialog } from "@/components/Dialog";
import { Icon } from "@/components/Icon";
import type { FolderListing } from "@/screens/settings/types";

export interface FolderBrowserProps {
  open: boolean;
  /** Where browsing starts. */
  start: string;
  title?: string;
  onChoose: (path: string) => void;
  onClose: () => void;
}

function ancestors(path: string): { name: string; path: string }[] {
  const parts = path.split("/").filter(Boolean);
  return [{ name: "/", path: "/" }, ...parts.map((name, index) => ({ name, path: `/${parts.slice(0, index + 1).join("/")}` }))];
}

/** Walks the local folders one level at a time. Reads through the `folders` operation; changes nothing. */
export function FolderBrowser(props: FolderBrowserProps) {
  return props.open ? <BrowserDialog {...props} /> : null;
}

function BrowserDialog({ start, title = "Choose project folder", onChoose, onClose }: FolderBrowserProps) {
  const client = useClient();
  const [path, setPath] = useState(start);
  const [listing, setListing] = useState<FolderListing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void client.run("folders", { path }).then(result => {
      if (!current) return;
      if (result.ok) { setListing(result.value); setError(""); }
      else setError(result.error.message);
    });
    return () => { current = false; };
  }, [client, path]);

  const here = listing?.path ?? path;
  const atRoot = listing ? listing.parent === listing.path : true;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description="Pick the folder, then use it."
      footer={<><button type="button" className="text" onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={!listing} onClick={() => onChoose(here)}>Use this folder</button></>}
    >
      <div className="folder-bar">
        <button type="button" disabled={atRoot || !listing} aria-label="Parent folder" onClick={() => listing && setPath(listing.parent)}><Icon name="back" size="sm" />Parent</button>
        <nav aria-label="Folder breadcrumbs" className="crumbs">
          {ancestors(here).map((part, index) => (
            <span key={part.path}>
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              <button type="button" className="text" aria-current={part.path === here ? "location" : undefined} onClick={() => setPath(part.path)}>{part.name}</button>
            </span>
          ))}
        </nav>
      </div>
      <p className="field-error" role="alert">{error}</p>
      {listing && listing.folders.length === 0 ? <p className="sub">No subfolders.</p> : null}
      {listing && listing.folders.length > 0 ? (
        <div className="folder-list">
          {listing.folders.map(name => (
            <button key={name} type="button" onClick={() => setPath(`${here === "/" ? "" : here}/${name}`)}>
              <span>{name}</span><Icon name="chev" size="sm" />
            </button>
          ))}
        </div>
      ) : null}
    </Dialog>
  );
}
