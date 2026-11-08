# Publishing AXIS Trading Pack

Publisher **`hoox-sh`**, extension id **`hoox-sh.axis-pack`**.

Full Marketplace + Open VSX dry-run steps, token verify, and **publish order**
(IDE before pack; pack only after `hoox-sh.pyne` + `hoox-sh.axis-ide` are live
on the target gallery) live in:

**[`../PUBLISH.md`](../PUBLISH.md)**

Quick package dry-run (no upload):

```bash
bun run pack:package
# → pack/axis-pack-<ver>.vsix
```

This `PUBLISH.md` is **repo-only** — listed in pack `.vscodeignore` so it does
not ship inside `axis-pack-*.vsix` (README.md still ships).
