# Publishing AXIS IDE + Trading Pack

Maintainer guide for dual-publishing **`hoox-sh.axis-ide`** (repository root)
and the optional extension pack **`hoox-sh.axis`** ([`pack/`](./pack/)) to the
**Visual Studio Marketplace** (`@vscode/vsce`) and **Open VSX** (`ovsx`).

| | IDE | Pack |
| --- | --- | --- |
| Path | repository root | `pack/` |
| Extension id | `hoox-sh.axis-ide` | `hoox-sh.axis` |
| Publisher | `hoox-sh` | `hoox-sh` |
| VSIX name | `axis-ide-<ver>.vsix` | `axis-<ver>.vsix` |
| Manifest edge | `extensionDependencies: ["hoox-sh.pyne"]` | `extensionPack: ["hoox-sh.pyne", "hoox-sh.axis-ide"]` |

Hard dependency **`hoox-sh.pyne`** must already be listed on both marketplaces
(same publisher namespace). Pack install only pulls already-published members.

## Tokens and namespace

| Registry | CLI | Secret / env | Notes |
| --- | --- | --- | --- |
| VS Marketplace | `npx @vscode/vsce` | `VSCE_PAT` | Azure DevOps PAT with **Marketplace → Manage** for publisher `hoox-sh` |
| Open VSX | `npx ovsx` | `OVSX_PAT` | Eclipse Open VSX PAT; namespace **`hoox-sh`** must exist (same as PYNE) |

Verify tokens without uploading:

```bash
npx --yes @vscode/vsce verify-pat -p "$VSCE_PAT" hoox-sh
npx --yes ovsx verify-pat -p "$OVSX_PAT" hoox-sh
```

Optional: `npx @vscode/vsce show hoox-sh.pyne` / `npx ovsx show hoox-sh.pyne`
to confirm the PYNE listing before shipping the IDE.

## Dry-run: package only (no upload)

Neither `vsce publish` nor `ovsx publish` exposes a `--dry-run` flag. Treat
**compile → package → `vsce ls` → local VSIX install** as the dry-run.

### IDE (`hoox-sh.axis-ide`)

```bash
# Host + webviews (also runs via vscode:prepublish on package)
bun run compile

# List files that would enter the VSIX (.vscodeignore applied)
bun run ls

# Build the artifact (same flags as package.json "package" script)
bun run package
# → axis-ide-0.1.0.vsix

# Optional local install smoke (requires hoox-sh.pyne already installed)
code --install-extension "./axis-ide-$(node -p "require('./package.json').version").vsix"
```

### Pack (`hoox-sh.axis`)

```bash
bun run --cwd pack ls
bun run --cwd pack package
# → pack/axis-0.1.0.vsix

code --install-extension "./pack/axis-$(node -p "require('./pack/package.json').version").vsix"
```

Root aliases: `bun run pack:package` / `bun run pack:ls`.

Pack VSIX is manifest-only (`extensionPack`); it does not rebundle PYNE or the IDE.

## Publish order

Publish **member extensions before the pack**:

1. **`hoox-sh.pyne`** already live on Marketplace + Open VSX (sibling repo).
2. **`hoox-sh.axis-ide`** → Marketplace, then Open VSX (or both in one release job).
3. **`hoox-sh.axis`** pack → Marketplace, then Open VSX **after** both members
   resolve on that registry.

Rationale: Marketplace/Open VSX resolve `extensionDependencies` /
`extensionPack` by published id. Publishing the pack first leaves one-click
install broken until the IDE (and PYNE) exist on that same gallery.

Bump `package.json` `version` before publishing; both galleries reject re-upload
of an existing version.

## Real publish (release only)

After dry-run packaging and `verify-pat` succeed:

```bash
# --- IDE ---
bun run package
VSIX="axis-ide-$(node -p "require('./package.json').version").vsix"

npx --yes @vscode/vsce publish --pat "$VSCE_PAT" --packagePath "$VSIX" --no-dependencies
npx --yes ovsx publish "$VSIX" -p "$OVSX_PAT"

# --- Pack (only after IDE is visible on both galleries) ---
bun run pack:package
VSIX="pack/axis-$(node -p "require('./pack/package.json').version").vsix"

npx --yes @vscode/vsce publish --pat "$VSCE_PAT" --packagePath "$VSIX" --no-dependencies
npx --yes ovsx publish "$VSIX" -p "$OVSX_PAT"
```

Pre-release / dogfood (optional): add `--pre-release` to both CLIs. Prefer a
GitHub Release VSIX for Cursor dogfood until the gallery listing is ready.

Open VSX may fail on unknown publisher even when Marketplace succeeds — keep
the VSIX on the GitHub Release.

## CI release workflow

[`.github/workflows/release.yml`](./.github/workflows/release.yml) runs on
`v*` tags and `workflow_dispatch`:

1. Builds both VSIX files.
2. Attaches them to the GitHub Release for the tag.
3. Publishes the IDE, then the pack, to Marketplace and Open VSX **only when**
   `VSCE_PAT` and `OVSX_PAT` repository secrets are set.

Add the secrets under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
| --- | --- |
| `VSCE_PAT` | Marketplace publish |
| `OVSX_PAT` | Open VSX publish |

Without the secrets the workflow still produces downloadable VSIX assets.

## `PUBLISH.md` and the VSIX

`.vscodeignore` keeps `**/*.md` out of the VSIX except `README.md`. This file
is repo-only maintainer documentation and is intentionally **not** shipped
inside `axis-ide-*.vsix`.
