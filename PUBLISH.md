# Publishing AXIS IDE + Trading Pack

Maintainer guide for dual-publishing **`hoox-sh.axis-ide`** (repository root)
and the optional extension pack **`hoox-sh.axis-pack`** ([`pack/`](./pack/)) to the
**Visual Studio Marketplace** (`@vscode/vsce`) and **Open VSX** (`ovsx`).

| | IDE | Pack |
| --- | --- | --- |
| Path | repository root | `pack/` |
| Extension id | `hoox-sh.axis-ide` | `hoox-sh.axis-pack` |
| Publisher | `hoox-sh` | `hoox-sh` |
| VSIX name | `axis-ide-<ver>.vsix` | `axis-pack-<ver>.vsix` |
| Manifest edge | `extensionDependencies: ["hoox-sh.pyne"]` | `extensionPack: ["hoox-sh.pyne", "hoox-sh.axis-ide"]` |

Hard dependency **`hoox-sh.pyne`** must already be listed on both marketplaces
(same publisher namespace). Pack install only pulls already-published members.

## Tokens and namespace

| Registry | CLI | Secret / env | Notes |
| --- | --- | --- | --- |
| VS Marketplace (CI) | `npx @vscode/vsce@4.1.1 publish --oidc` | GitHub OIDC (`id-token: write`) | Trusted Publishing policy on publisher `hoox-sh`. No PAT. |
| VS Marketplace (laptop) | `npx @vscode/vsce` | `VSCE_PAT` | Azure DevOps PAT with **Marketplace → Manage**. Global PATs retire on 1 December 2026. |
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

### Pack (`hoox-sh.axis-pack`)

```bash
bun run pack:ls
bun run pack:package
# → pack/axis-pack-0.3.0.vsix

code --install-extension "./pack/axis-pack-$(node -p "require('./pack/package.json').version").vsix"
```

Root aliases: `bun run pack:package` / `bun run pack:ls`.

Pack VSIX is manifest-only (`extensionPack`); it does not rebundle PYNE or the IDE.

## Publish order

Publish **member extensions before the pack**:

1. **`hoox-sh.pyne`** already live on Marketplace + Open VSX (sibling repo).
2. **`hoox-sh.axis-ide`** → Marketplace, then Open VSX (or both in one release job).
3. **`hoox-sh.axis-pack`** pack → Marketplace, then Open VSX **after** both members
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
VSIX="pack/axis-pack-$(node -p "require('./pack/package.json').version").vsix"

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

1. Builds both VSIX files. A manual `workflow_dispatch` that is not a tag
   still builds both files and does not call `vsce publish` or `ovsx publish`.
2. On a `v*` tag, attaches them to the GitHub Release.
3. On a `v*` tag only, publishes the IDE, then the pack, to the Marketplace
   with `vsce publish --oidc` (`@vscode/vsce@4.1.1`).
4. On a `v*` tag only, publishes the same files to Open VSX when `OVSX_PAT`
   is set.

Marketplace and Open VSX publish only on `v*` tags.

Marketplace auth is a Trusted Publishing policy, not `VSCE_PAT`. Create it
once before the next tag:

1. Open the [publisher management page](https://marketplace.visualstudio.com/manage) for `hoox-sh`.
2. Select **Trusted Publishing**, then **Create**.
3. Policy name: `Release workflow`.
4. Repository owner: `hoox-sh`.
5. Repository: `axis-ide-vsce`.
6. Workflow: `release.yml`.
7. Environment: leave empty. The job does not set a GitHub environment.

The workflow grants `id-token: write`. Each `vsce publish --oidc` requests its
own GitHub token, exchanges it once, and receives a Marketplace credential that
lasts 15 minutes. If that exchange fails, vsce does not fall back to a PAT.
The IDE publish and the pack publish are two exchanges in the same job.

`VSCE_PAT` is only for a laptop publish until global Azure DevOps PATs retire
on 1 December 2026. Open VSX still needs `OVSX_PAT`.

| Secret | Purpose |
| --- | --- |
| `OVSX_PAT` | Open VSX publish |

Without `OVSX_PAT` a `v*` tag still produces the GitHub Release VSIX files
and still attempts the Marketplace publish. Open VSX is skipped. A
`workflow_dispatch` that is not a tag only builds.

## `PUBLISH.md` and the VSIX

`.vscodeignore` keeps `**/*.md` out of the VSIX except `README.md`. This file
is repo-only maintainer documentation and is intentionally **not** shipped
inside `axis-ide-*.vsix`.
