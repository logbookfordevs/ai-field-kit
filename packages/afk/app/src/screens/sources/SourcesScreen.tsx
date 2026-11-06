import { useState } from "react";
import { useClient } from "@/api/ClientProvider";
import { useMutation } from "@/api/hooks";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { Menu, MenuItem, MenuSeparator } from "@/components/Menu";
import { Ledger, Row } from "@/components/Row";
import { Switch } from "@/components/Switch";
import { useToast } from "@/components/Toast";
import { useSourcesState } from "@/screens/sources/data";
import { isRepositorySource, plural, shortSource } from "@/text/format";
import { openInstall } from "@/screens/sources/install/store";
import type { FavoriteSource, SourcesState, UpdateResult } from "@/screens/sources/types";
import { Page } from "@/shell/Page";
import "@/screens/sources/Sources.css";
import { Count } from "@/components/Count";

const searchThreshold = 6;

export function SourcesScreen() {
  const state = useSourcesState();

  return (
    <Page title="Sources" description="Where skills come from: install something new, keep repositories for later, and follow the ones your Core comes from.">
      <section aria-labelledby="add-heading">
        <div className="sec-head">
          <div>
            <h2 id="add-heading">Add something new</h2>
            <p className="sub">Install skills into Core, a pack or this machine.</p>
          </div>
        </div>
        <div className="add-row">
          <button type="button" className="primary" onClick={() => openInstall({ source: "repository" })}>From a repository</button>
          <button type="button" onClick={() => openInstall({ source: "upload" })}>From a zip, .skill or folder</button>
        </div>
      </section>

      {state.data ? (
        <>
          <TryLater bookmarks={state.data.settings.favoriteSources} />
          <CoreSources kit={state.data.kit} />
        </>
      ) : state.error ? (
        <EmptyState title="Your sources didn't load" actions={<button type="button" onClick={() => { void state.reload(); }}>Try again</button>}>
          {state.error.message}
        </EmptyState>
      ) : (
        <p className="meta" role="status">Loading your sources…</p>
      )}
    </Page>
  );
}

function skillsSummary(bookmark: FavoriteSource): string {
  return bookmark.skills ? plural(bookmark.skills.length, "skill") : "All skills";
}

function matches(bookmark: FavoriteSource, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [bookmark.name, bookmark.source, bookmark.description ?? "", ...(bookmark.skills ?? [])].some(value => value.toLowerCase().includes(needle));
}

function TryLater({ bookmarks }: { bookmarks: FavoriteSource[] }) {
  const client = useClient();
  const toast = useToast();
  const saveSettings = useMutation("settings");
  const [query, setQuery] = useState("");
  const shown = bookmarks.filter(bookmark => matches(bookmark, query)).sort((a, b) => a.name.localeCompare(b.name));
  const searchable = bookmarks.length > searchThreshold;

  const change = async (update: (list: FavoriteSource[]) => FavoriteSource[]): Promise<boolean> => {
    const fresh = await client.run("state");
    if (!fresh.ok) {
      toast.fail(fresh.error.message);
      return false;
    }
    const { settings } = fresh.value as unknown as SourcesState;
    const saved = await saveSettings.run({ settings: { ...settings, favoriteSources: update(settings.favoriteSources) } });
    if (!saved.ok) toast.fail(saved.error.message);
    return saved.ok;
  };

  const remove = async (bookmark: FavoriteSource) => {
    const index = bookmarks.indexOf(bookmark);
    const same = (other: FavoriteSource) => other.source === bookmark.source && other.name === bookmark.name;
    if (!await change(list => list.filter(other => !same(other)))) return;
    toast.show(`Removed ${bookmark.name} from Try later`, {
      action: {
        label: "Undo",
        onAction: () => { void change(list => list.some(same) ? list : [...list.slice(0, index), bookmark, ...list.slice(index)]); },
      },
    });
    document.getElementById("try-later")?.focus();
  };

  const copyLink = async (bookmark: FavoriteSource) => {
    try {
      await navigator.clipboard.writeText(bookmark.source);
      toast.show(`Copied ${shortSource(bookmark.source)}`);
    } catch {
      toast.show("Couldn’t copy. Select the link and copy it yourself.");
    }
  };

  return (
    <section aria-labelledby="try-later">
      <div className="sec-head">
        <div>
          <h2 id="try-later" tabIndex={-1}>Try later<Count n={bookmarks.length} /></h2>
          <p className="sub">Bookmarked. Nothing installed.</p>
        </div>
        <button type="button" onClick={() => openInstall({ source: "repository", destination: "later" })}>Save a repository</button>
      </div>
      {searchable ? (
        <label className="find-inline">
          <span className="vh">Search Try later</span>
          <span className="search-wrap">
            <Icon name="search" />
            <input type="search" placeholder="Search bookmarks" value={query} autoComplete="off" onChange={event => setQuery(event.target.value)} />
          </span>
        </label>
      ) : null}
      {bookmarks.length === 0 ? (
        <EmptyState title="Nothing saved for later" actions={<button type="button" onClick={() => openInstall({ source: "repository", destination: "later" })}>Save a repository</button>}>
          Bookmark a repository you want to look at later. Nothing is installed until you choose.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title={`No bookmark matches “${query.trim()}”`} actions={<button type="button" onClick={() => setQuery("")}>Clear search</button>} />
      ) : (
        <Ledger label="Try later">
          {shown.map(bookmark => (
            <Row
              key={`${bookmark.source}\n${bookmark.name}`}
              title={bookmark.name}
              {...(bookmark.description ? { description: bookmark.description } : {})}
              meta={shortSource(bookmark.source)}
              aside={<span className="meta">{skillsSummary(bookmark)}</span>}
              actions={
                <>
                  <button type="button" onClick={() => openInstall({ repository: bookmark.source, ...(bookmark.skills ? { skills: bookmark.skills } : {}) })}>
                    Install…<span className="vh"> {bookmark.name}</span>
                  </button>
                  <Menu label={`More for ${bookmark.name}`}>
                    <MenuItem onSelect={() => { void copyLink(bookmark); }}>Copy repository link<span className="vh"> for {bookmark.name}</span></MenuItem>
                    <MenuSeparator />
                    <MenuItem danger onSelect={() => { void remove(bookmark); }}>Remove from Try later<span className="vh"> {bookmark.name}</span></MenuItem>
                  </Menu>
                </>
              }
            />
          ))}
        </Ledger>
      )}
    </section>
  );
}

function CoreSources({ kit }: { kit: SourcesState["kit"] }) {
  return (
    <section aria-labelledby="core-sources">
      <div className="sec-head">
        <div>
          <h2 id="core-sources">Core comes from<Count n={kit.sources.length} /></h2>
          <p className="sub">Following a repository means AFK offers its new skills for Core. Nothing installs by itself.</p>
        </div>
      </div>
      {kit.sources.length === 0 ? (
        <EmptyState title="Core has no repositories yet">Install skills into Core and the repositories they come from will be listed here.</EmptyState>
      ) : (
        <Ledger label="Repositories Core comes from">
          {kit.sources.map(source => <CoreSource key={source.source} source={source} installed={kit.core.filter(skill => skill.source === source.source && skill.status !== "missing").map(skill => skill.name)} />)}
        </Ledger>
      )}
    </section>
  );
}

function CoreSource({ source, installed }: { source: SourcesState["kit"]["sources"][number]; installed: string[] }) {
  const toast = useToast();
  const follow = useMutation("kit/follow");
  const update = useMutation("skills/update");
  const label = source.name ?? shortSource(source.source);
  const fromRepository = isRepositorySource(source.source);

  const toggleFollow = async (next: boolean) => {
    const result = await follow.run({ source: source.source, follow: next });
    if (result.ok) toast.show(`${next ? "Following" : "Stopped following"} ${label}`); else toast.fail(result.error.message);
  };

  const refresh = async () => {
    if (!installed.length) {
      toast.show(`None of the skills from ${label} are installed on this machine.`);
      return;
    }
    toast.show(`Updating ${label}…`, { busy: true });
    const result = await update.run({ scope: "Global", names: installed });
    if (!result.ok) {
      toast.fail(result.error.message);
      return;
    }
    const outcome = result.value as UpdateResult;
    if (outcome.cancelled) toast.show("Update cancelled. Your skills are unchanged.");
    else if (outcome.code === 0) toast.show(outcome.updated ? `Updated ${plural(outcome.updated, "skill")} from ${label}` : `${label} is up to date`);
    else toast.show(`Update failed: ${outcome.lastLine ?? outcome.phase}`);
  };

  return (
    <Row
      className="core-source"
      title={fromRepository ? label : "Uploaded skills"}
      description={fromRepository ? `${plural(source.skills, "skill")} in Core` : `${plural(source.skills, "skill")} in Core. No repository, so no updates.`}
      {...(fromRepository && source.name ? { meta: shortSource(source.source) } : {})}
      {...(fromRepository
        ? {
            aside: <Switch label={`Follow ${label}`} checked={source.follow} disabled={follow.pending} stateText={{ on: "Following", off: "Not following" }} onChange={next => { void toggleFollow(next); }} />,
            actions: <button type="button" className="text" disabled={update.pending} onClick={() => { void refresh(); }}>Update<span className="vh"> {label}</span></button>,
          }
        : {})}
    />
  );
}
