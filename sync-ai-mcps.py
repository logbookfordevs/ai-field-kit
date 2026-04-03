#!/usr/bin/env python3

from __future__ import annotations

import argparse
import copy
import getpass
import json
import os
import re
import sys
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Set, Tuple


REPO_DIR = Path(__file__).resolve().parent
DEFAULT_SOURCE = REPO_DIR / "mcps" / "mcp.json"
PLACEHOLDER_PATTERN = re.compile(r"\bKEY_[A-Z0-9_]+\b")
CODEX_SERVER_PATTERN = re.compile(
    r'^\[mcp_servers\.(?:"(?P<quoted>[^"]+)"|(?P<bare>[A-Za-z0-9_-]+))\]\s*$',
    re.MULTILINE,
)
BARE_TOML_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


@dataclass(frozen=True)
class Target:
    name: str
    path: Path
    format: str


TARGETS: Dict[str, Target] = {
    "codex": Target("codex", Path.home() / ".codex" / "config.toml", "codex_toml"),
    "gemini": Target("gemini", Path.home() / ".gemini" / "settings.json", "json"),
    "antigravity": Target(
        "antigravity",
        Path.home() / ".gemini" / "antigravity" / "mcp_config.json",
        "json",
    ),
    "claude": Target("claude", Path.home() / ".claude" / ".mcp.json", "json"),
    "opencode": Target(
        "opencode",
        Path.home() / ".config" / "opencode" / "opencode.json",
        "opencode_json",
    ),
}


class SyncError(Exception):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add missing MCP server definitions into local agent configs."
    )
    parser.add_argument(
        "--source",
        default=str(DEFAULT_SOURCE),
        help="Path to the MCP registry JSON file.",
    )
    parser.add_argument(
        "--agent",
        dest="agents",
        action="append",
        choices=sorted(TARGETS.keys()),
        help="Sync only the specified agent. Repeat to target multiple agents.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing files.",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Fail instead of prompting when a KEY_* placeholder is missing.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    source_path = Path(args.source).expanduser().resolve()
    registry = load_registry(source_path)
    placeholders = collect_placeholders(registry)
    replacements = resolve_placeholders(placeholders, args.non_interactive)
    resolved_registry = replace_placeholders(registry, replacements)
    selected_agents = args.agents or list(TARGETS.keys())

    print(f"▶ Using MCP registry: {source_path}")
    if args.dry_run:
        print("▶ Dry run mode enabled")

    changed_agents = 0
    for agent_name in selected_agents:
        target = TARGETS[agent_name]
        desired_servers = build_target_servers(resolved_registry, agent_name)

        if target.format == "json":
            changed = sync_json_target(target, desired_servers, args.dry_run)
        elif target.format == "codex_toml":
            changed = sync_codex_target(target, desired_servers, args.dry_run)
        elif target.format == "opencode_json":
            changed = sync_opencode_target(target, desired_servers, args.dry_run)
        else:
            raise SyncError(f"Unsupported target format: {target.format}")

        if changed:
            changed_agents += 1

    if changed_agents == 0:
        print("✔ Nothing to add. All selected agents already had these MCP servers.")
    else:
        print(f"✔ Sync complete. Updated {changed_agents} agent config(s).")

    return 0


def load_registry(path: Path) -> Mapping[str, Any]:
    if not path.is_file():
        raise SyncError(f"MCP registry not found: {path}")

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, dict) or not isinstance(data.get("servers"), dict):
        raise SyncError('Registry must be a JSON object with a top-level "servers" object.')

    return data


def collect_placeholders(value: Any) -> List[str]:
    placeholders: Set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, str):
            placeholders.update(PLACEHOLDER_PATTERN.findall(node))
            return

        if isinstance(node, list):
            for item in node:
                visit(item)
            return

        if isinstance(node, dict):
            for item in node.values():
                visit(item)

    visit(value)
    return sorted(placeholders)


def resolve_placeholders(placeholders: Iterable[str], non_interactive: bool) -> Dict[str, str]:
    replacements: Dict[str, str] = {}

    for placeholder in placeholders:
        env_value = os.environ.get(placeholder)
        if env_value:
            replacements[placeholder] = env_value
            continue

        if non_interactive:
            raise SyncError(
                f"Missing value for {placeholder}. Export it first or rerun without --non-interactive."
            )

        value = ""
        while not value:
            value = getpass.getpass(f"Enter value for {placeholder}: ").strip()
        replacements[placeholder] = value

    return replacements


def replace_placeholders(value: Any, replacements: Mapping[str, str]) -> Any:
    if isinstance(value, str):
        return PLACEHOLDER_PATTERN.sub(lambda match: replacements[match.group(0)], value)

    if isinstance(value, list):
        return [replace_placeholders(item, replacements) for item in value]

    if isinstance(value, dict):
        return {key: replace_placeholders(item, replacements) for key, item in value.items()}

    return value


def build_target_servers(registry: Mapping[str, Any], agent_name: str) -> "OrderedDict[str, Dict[str, Any]]":
    servers: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()

    for server_id, server_definition in registry["servers"].items():
        if not isinstance(server_definition, dict):
            raise SyncError(f'Server "{server_id}" must be a JSON object.')

        targets = server_definition.get("targets")
        config = server_definition.get("config")

        if not isinstance(targets, dict):
            raise SyncError(f'Server "{server_id}" is missing a valid "targets" object.')
        if not isinstance(config, dict):
            raise SyncError(f'Server "{server_id}" is missing a valid "config" object.')

        target_config = targets.get(agent_name)
        if target_config is None:
            continue
        if not isinstance(target_config, dict):
            raise SyncError(
                f'Server "{server_id}" target "{agent_name}" must be a JSON object.'
            )

        target_name = target_config.get("name")
        if not isinstance(target_name, str) or not target_name:
            raise SyncError(
                f'Server "{server_id}" target "{agent_name}" must define a non-empty "name".'
            )

        merged_config = copy.deepcopy(config)
        for key, value in target_config.items():
            if key == "name":
                continue
            merged_config[key] = copy.deepcopy(value)

        servers[target_name] = merged_config

    return servers


def sync_json_target(
    target: Target, desired_servers: "OrderedDict[str, Dict[str, Any]]", dry_run: bool
) -> bool:
    document = load_json_document(target.path)
    mcp_servers = document.setdefault("mcpServers", {})
    if not isinstance(mcp_servers, MutableMapping):
        raise SyncError(f'{target.path} has a non-object "mcpServers" value.')

    added: List[str] = []
    skipped: List[str] = []

    for server_name, server_config in desired_servers.items():
        if server_name in mcp_servers:
            skipped.append(server_name)
            continue
        mcp_servers[server_name] = server_config
        added.append(server_name)

    report_target_result(target, added, skipped, dry_run)

    if not added or dry_run:
        return bool(added)

    write_with_backup(target.path, json.dumps(document, indent=2) + "\n")
    return True


def sync_codex_target(
    target: Target, desired_servers: "OrderedDict[str, Dict[str, Any]]", dry_run: bool
) -> bool:
    existing_text = read_text_if_exists(target.path)
    existing_names = parse_codex_server_names(existing_text)

    added: List[str] = []
    skipped: List[str] = []
    blocks: List[str] = []

    for server_name, server_config in desired_servers.items():
        if server_name in existing_names:
            skipped.append(server_name)
            continue

        blocks.append(render_toml_server_block(server_name, server_config))
        added.append(server_name)

    report_target_result(target, added, skipped, dry_run)

    if not added or dry_run:
        return bool(added)

    new_text = append_toml_blocks(existing_text, blocks)
    write_with_backup(target.path, new_text)
    return True


def sync_opencode_target(
    target: Target, desired_servers: "OrderedDict[str, Dict[str, Any]]", dry_run: bool
) -> bool:
    document = load_json_document(target.path)
    mcp = document.setdefault("mcp", {})
    if not isinstance(mcp, MutableMapping):
        raise SyncError(f'{target.path} has a non-object "mcp" value.')

    added: List[str] = []
    updated: List[str] = []
    skipped: List[str] = []

    for server_name, server_config in desired_servers.items():
        rendered_config = render_opencode_server_config(server_config)

        if server_name not in mcp:
            mcp[server_name] = rendered_config
            added.append(server_name)
            continue

        if mcp[server_name] == rendered_config:
            skipped.append(server_name)
            continue

        mcp[server_name] = rendered_config
        updated.append(server_name)
    report_target_result(target, added, skipped, dry_run, updated)

    if not (added or updated) or dry_run:
        return bool(added or updated)

    write_with_backup(target.path, json.dumps(document, indent=2) + "\n")
    return True


def render_opencode_server_config(config: Mapping[str, Any]) -> Dict[str, Any]:
    if "url" in config:
        return render_opencode_remote_server_config(config)

    return render_opencode_local_server_config(config)


def render_opencode_local_server_config(config: Mapping[str, Any]) -> Dict[str, Any]:
    command = config.get("command")
    args = config.get("args", [])

    if not isinstance(command, str) or not command:
        raise SyncError('OpenCode local MCP config requires a non-empty string "command".')
    if not isinstance(args, list) or not all(isinstance(item, str) for item in args):
        raise SyncError('OpenCode local MCP config requires "args" to be a list of strings.')

    rendered: Dict[str, Any] = {
        "type": "local",
        "command": [expand_env_vars(command), *[expand_env_vars(item) for item in args]],
    }

    environment = config.get("environment", config.get("env"))
    if environment is not None:
        if not isinstance(environment, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in environment.items()
        ):
            raise SyncError(
                'OpenCode local MCP config requires "environment"/"env" to be an object of strings.'
            )
        rendered["environment"] = {
            key: expand_env_vars(value) for key, value in environment.items()
        }

    enabled = config.get("enabled", False)
    if not isinstance(enabled, bool):
        raise SyncError('OpenCode MCP config "enabled" must be a boolean.')
    rendered["enabled"] = enabled

    if "timeout" in config:
        if not isinstance(config["timeout"], (int, float)):
            raise SyncError('OpenCode MCP config "timeout" must be a number.')
        rendered["timeout"] = config["timeout"]

    return rendered


def render_opencode_remote_server_config(config: Mapping[str, Any]) -> Dict[str, Any]:
    url = config.get("url")
    if not isinstance(url, str) or not url:
        raise SyncError('OpenCode remote MCP config requires a non-empty string "url".')

    rendered: Dict[str, Any] = {
        "type": "remote",
        "url": expand_env_vars(url),
    }

    if "headers" in config:
        headers = config["headers"]
        if not isinstance(headers, dict) or not all(
            isinstance(key, str) and isinstance(value, str) for key, value in headers.items()
        ):
            raise SyncError('OpenCode remote MCP config "headers" must be an object of strings.')
        rendered["headers"] = {
            key: expand_env_vars(value) for key, value in headers.items()
        }

    enabled = config.get("enabled", False)
    if not isinstance(enabled, bool):
        raise SyncError('OpenCode MCP config "enabled" must be a boolean.')
    rendered["enabled"] = enabled

    if "oauth" in config:
        if not isinstance(config["oauth"], dict):
            raise SyncError('OpenCode remote MCP config "oauth" must be an object.')
        rendered["oauth"] = copy.deepcopy(config["oauth"])

    if "timeout" in config:
        if not isinstance(config["timeout"], (int, float)):
            raise SyncError('OpenCode MCP config "timeout" must be a number.')
        rendered["timeout"] = config["timeout"]

    return rendered


def expand_env_vars(value: str) -> str:
    return os.path.expandvars(value)


def load_json_document(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {}

    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, dict):
        raise SyncError(f"Expected a JSON object in {path}.")

    return data


def read_text_if_exists(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def parse_codex_server_names(content: str) -> Set[str]:
    names: Set[str] = set()
    for match in CODEX_SERVER_PATTERN.finditer(content):
        names.add(match.group("quoted") or match.group("bare"))
    return names


def render_toml_server_block(server_name: str, config: Mapping[str, Any]) -> str:
    table_name = format_toml_table_name(server_name)
    lines = [f"[mcp_servers.{table_name}]"]

    for key, value in config.items():
        lines.append(f"{key} = {toml_literal(value)}")

    return "\n".join(lines)


def format_toml_table_name(name: str) -> str:
    if BARE_TOML_KEY_PATTERN.fullmatch(name):
        return name
    escaped = name.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def toml_literal(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, str):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    if isinstance(value, list):
        return "[" + ", ".join(toml_literal(item) for item in value) + "]"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    raise SyncError(
        "Codex TOML output only supports string, boolean, integer, float, and list values."
    )


def append_toml_blocks(existing_text: str, blocks: List[str]) -> str:
    addition = "\n\n".join(blocks)

    if not existing_text.strip():
        return addition + "\n"

    trimmed = existing_text.rstrip()
    return f"{trimmed}\n\n{addition}\n"


def write_with_backup(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    backup_existing_file(path)
    path.write_text(content, encoding="utf-8")


def backup_existing_file(path: Path) -> None:
    if not path.exists():
        return

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_name(f"{path.name}.bak.{timestamp}")
    path.replace(backup_path)
    print(f"   ↳ Backed up existing file to: {backup_path}")


def report_target_result(
    target: Target,
    added: List[str],
    skipped: List[str],
    dry_run: bool,
    updated: List[str] | None = None,
) -> None:
    updated = updated or []
    action = "Would add" if dry_run else "Added"
    update_action = "Would update" if dry_run else "Updated"
    print(f"▶ {target.name}: {target.path}")

    if added:
        print(f"   ↳ {action}: {', '.join(added)}")
    else:
        print("   ↳ Added: nothing")

    if updated:
        print(f"   ↳ {update_action}: {', '.join(updated)}")

    if skipped:
        print(f"   ↳ Skipped existing: {', '.join(skipped)}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SyncError as error:
        print(f"❌ {error}", file=sys.stderr)
        raise SystemExit(1)
    except KeyboardInterrupt:
        print("\n❌ Cancelled.", file=sys.stderr)
        raise SystemExit(130)
