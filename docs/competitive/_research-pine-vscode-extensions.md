# Pine / Pyne VS Code extensions inventory

**Scope:** live VS Marketplace, Open VSX, and public READMEs for TradingView Pine Script / Pyne editor extensions. Cursor / Windsurf / VSCodium are treated as Open VSX clients unless a listing says otherwise.  
**Out of scope:** AXIS (`hoox-sh.axis-ide`, `hoox-sh.axis`, `hoox-sh.axis-pack`), PYNE Language Support (`hoox-sh.pyne`), scored comparison (Docs card). No VSIX install into VSCodium.  
**Fetched:** 2026-11-09. Claims are **Confirmed** (stated on a cited page) or **Inferred** (reasonable from cited text, not explicit). Install counts are live listing numbers, not unique users.

## How to read this

- **MSFT installs** = Visual Studio Marketplace install counter on the item page.  
- **OVSX downloads** = Open VSX `downloadCount`. Missing listing = `—` (not on Open VSX).  
- **Version** = Marketplace gallery CDN version (item icon URL) unless noted. Open VSX can lag.  
- Cursor: no Cursor-only Pine extension found. Cursor/Windsurf/VSCodium install path is Open VSX when the publisher published there ([jpantsjoha README](https://marketplace.visualstudio.com/items?itemName=jpantsjoha.pinescript-v6-extension)).

Search queries used: Marketplace `pine script`, `pinescript`, `pine`, `tradingview`, `pyne`; Open VSX `https://open-vsx.org/api/-/search?query=pine` plus `pinescript`, `tradingview`, `pyne`.

## Index (by Marketplace installs, live 2026-11-09)

| Id | Display | Ver | License | MSFT | OVSX | One-line claim |
| --- | --- | --- | --- | --- | --- | --- |
| `ex-codes.pine-script-syntax-highlighter` | Pine Script Syntax Highlighter | **3.4.0** MSFT / **1.0.5** OVSX (stale) | MIT | 86,173 | 7,188 | v6 highlighting, completion, hover, format, 97 snippets, offline checks |
| `JeylaniB.pinescript` | Pine Script | 3.0.1 | MIT | 51,340 | — | V5 highlighting, snippets, language-reference hovers |
| `leifcr.pine-script-syntax-highlighting` | Pine Script Syntax Highlighting | 0.1.5 | MIT | 17,161 | — | Highlighting only; repo archived 2023 |
| `frizLabz.pinescript-v5-vscode` | Pine Script v5 | 0.1.7 | Unknown (GH badge) | 14,471 | — | “Language Server”: hover, libs, templates, TV lint |
| `JeylaniB.pine-editor-themes` | Pine Editor Themes | 1.0.0 | Unknown | 13,150 | — | Companion color themes for JeylaniB.pinescript |
| `salbert11.pinescript-helper` | PineScript Helper | 3.4.3 | MIT | 11,270 | — | Fork of JeylaniB: V5 highlight, snippets, hovers, bundled themes |
| `TradesDontLie.pinescript-v6-vscode` | Pine Script v6 | 0.1.0 | MIT (README) | 8,486 | — | v6 LS clone of frizLabz; placeholder GitHub URLs |
| `kaigouthro.pinescript-vscode` | Pine Script VS Code | 0.1.8 | MIT | 2,997 | — | TV API lint + local parse; 20+ themes; ErrorLens dep |
| `salbert11.pinescript-color-themes` | PineScript Color Themes | 2.2.0 | MIT | 2,964 | — | Theme pack for PineScript Helper (fork of JeylaniB themes) |
| `jpantsjoha.pinescript-v6-extension` | Pine Script v6 IDE Tools | 0.7.1 | MIT | 1,681 | 1,780 | Unofficial v6 validator + IntelliSense; Cursor via OVSX |
| `0xjcf.pine-script-syntax` | Pine Script Syntax | 1.0.0 listing / repo 0.0.5 | MIT | 916 | — | Highlight + 4 themes; no snippets/validation |
| `revanthpobala.pine-script-pro` | Pine Script Pro | 1.4.0 MSFT CDN / **1.4.2** OVSX | Modified MIT | 644 | 11,584 | WASM linter, format, inlay hints, inputs preview |
| `weaming.pinescript-language-v6` | Pine Script Language v6 | 0.1.4 | MIT | 362 | — | v6 highlight, IntelliSense, rename, inlay, validate |
| `LinXueyuanStdio.pinescript-render` | PineScript Render | 0.1.1 | MIT | 164 | — | Language support + vectorbt backtest preview panel |
| `pynesys.pyneide` | PyneIDE | 0.14.1 | GPL-3.0-only | 57 | 1,368 | Full IDE: LS, chart, debugger, PyneCore runtime |
| `ferranborreguero.pinecone` | Pine Script (pinecone) | 0.2.6 | MPL-2.0 | 44 | 1,488 | pinecone LS: diagnostics, lint, format, nav |

Excluded from scoring inventory (this product): `hoox-sh.pyne`, `hoox-sh.axis-ide`, `hoox-sh.axis`, `hoox-sh.axis-pack`.  
Not Pine: Rosé Pine themes, p5.js, Piny/Pinegrow, Pi coding agent, Pinedoro timer.

---

## 1. `ex-codes.pine-script-syntax-highlighter`

| Field | Value |
| --- | --- |
| Publisher | `ex-codes` (author Yankı Küçük). OVSX `publishedBy` noemk2 on the **stale** 1.0.5 listing. |
| Version | **3.4.0** Marketplace ([CDN](https://marketplace.visualstudio.com/items?itemName=ex-codes.pine-script-syntax-highlighter), [package.json](https://github.com/yankikucuk/pine-script-syntax-highlighter/blob/master/package.json)). Open VSX still **1.0.5** (2023-05-17) — Cursor/VSCodium OVSX users do **not** get the v6 IDE. |
| License | MIT |
| MSFT / OVSX | 86,173 / 7,188 |
| Claim | Pine Script v6 highlighting, completion, hover, signature help, snippets, themes, compiler diagnostics. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=ex-codes.pine-script-syntax-highlighter) · [OVSX 1.0.5](https://open-vsx.org/extension/ex-codes/pine-script-syntax-highlighter) · [GitHub](https://github.com/yankikucuk/pine-script-syntax-highlighter) |
| Engine | VS Code `^1.96.0` (3.4.0). OVSX 1.0.5 was `^1.37.0`. |

Feature bullets (3.4.0 Marketplace README / GitHub package.json):

- **Confirmed.** Completions for v6 built-ins, keywords, user symbols, named args, `import` paths.  
- **Confirmed.** Go to definition, find all references, rename with scope; refuse rename of built-ins.  
- **Confirmed.** Hover + signature help; Open Reference to TradingView v6 docs.  
- **Confirmed.** 97 v6 snippets (skeletons, inputs, plots, strategy, TA).  
- **Confirmed.** Format Document / Selection; conservative indent (4 spaces); default formatter for `[pinescript]`.  
- **Confirmed.** Offline lint (`pinescript.lint.enabled`, default on): missing/old version, legacy names, local-scope `plot`, unknown/duplicate args, unused.  
- **Confirmed.** Convert to v6 command. Templates: New Indicator / Strategy / Library. Docstrings + type annotations.  
- **Confirmed.** Color swatches + picker. Semantic tokens. Outline. Local library index.  
- **Confirmed.** Opt-in remote: `pinescript.libraries.remote` (default **true**) and `pinescript.diagnostics.remote` (default **false**, full script to TV compiler).  
- **Confirmed.** Themes Pine Dark / Pine Light. Files `.pine` / `.pinescript` / first-line `//@version=`.  
- **Inferred.** Highest Marketplace install count is historical (name is still “Syntax Highlighter” from the 1.x highlighter era).

---

## 2. `JeylaniB.pinescript`

| Field | Value |
| --- | --- |
| Publisher | `JeylaniB` |
| Version | **3.0.1** (gallery CDN + [GitHub package.json](https://github.com/jeyllani/pinescript/blob/main/package.json)). README footer still says *1.0.1*. |
| License | MIT |
| MSFT / OVSX | 51,340 / — (not on Open VSX) |
| Claim | Pine Script V5 syntax highlighting and snippets. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=JeylaniB.pinescript) · [GitHub](https://github.com/jeyllani/pinescript) |

- **Confirmed.** TextMate grammar `source.ps`; language id `pine`.  
- **Confirmed.** Snippet packs: operators, functions, variables, scripts, comments, unicode, words.  
- **Confirmed.** Language-reference hovers.  
- **Confirmed.** Extensions: `.ps`, `.pine`, `.pinescript`, `.pinecode`, `.tdps`, `.trading`, `.tradingview`, `.script`, `.help`.  
- **Confirmed.** Companion themes: `JeylaniB.pine-editor-themes`.  
- **Confirmed.** Roadmap still lists “Implementing intellisense autocompletion” as future.  
- **Inferred.** V5-era; not a v6 language server.

---

## 3. `leifcr.pine-script-syntax-highlighting`

| Field | Value |
| --- | --- |
| Publisher | `leifcr` |
| Version | **0.1.5** (CDN `1604668524342` ≈ 2020) |
| License | MIT ([package.json](https://github.com/leifcr/pine-script-syntax-highlighting/blob/master/package.json)) |
| MSFT / OVSX | 17,161 / — |
| Claim | Syntax highlighting for Pine Script. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=leifcr.pine-script-syntax-highlighting) · [GitHub archive](https://github.com/leifcr/pine-script-syntax-highlighting) (archived 2023-07-14) |

- **Confirmed.** Grammar for `.pine` only. “It doesn't do tricks… Only colors what you write.”  
- **Confirmed.** Pine4 updates credited to @Jos512.  
- **Confirmed.** Unmaintained.

---

## 4. `frizLabz.pinescript-v5-vscode`

| Field | Value |
| --- | --- |
| Publisher | `frizLabz` (FFriZz) |
| Version | **0.1.7** Marketplace CDN. GitHub `package.json` is **0.1.8** (unpublished ahead). |
| License | Unknown in package.json; Marketplace README shows a GitHub license badge. |
| MSFT / OVSX | 14,471 / — |
| Claim | Pine Script v5 Language Server. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=frizLabz.pinescript-v5-vscode) · [GitHub](https://github.com/FFriZ/Pine-Script-v5-VS-Code) |

- **Confirmed.** Hover docs, library import completions, library source hover, signatures, completions.  
- **Confirmed.** Bundled themes (one matching TV editor). Built-in script browser. Indicator / strategy / library templates. Docstrings. Typify (type generation).  
- **Confirmed.** Language id `pine`; `.ps` / `.pine` / `.pinescript`; markdown embed grammar. 20-ish Pine-* themes in repo package.json.  
- **Inferred.** “Language Server” in the title is a VS Code extension with local providers + HTTP to TradingView, not a separate LSP binary (same architecture as kaigouthro).  
- **Inferred.** kaigouthro 0.1.8 is a continuation (same command ids `pine.docString`, `pine.typify`, `pine.getStandardList`).

---

## 5. `JeylaniB.pine-editor-themes`

| Field | Value |
| --- | --- |
| Publisher | `JeylaniB` |
| Version | **1.0.0** |
| License | Unknown (not stated on listing) |
| MSFT / OVSX | 13,150 / — |
| Claim | Themes for the Pine Script V5 Syntax Highlighting & Snippets extension. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=JeylaniB.pine-editor-themes) · [GitHub pinethemes](https://github.com/jeyllani/pinethemes) |

- **Confirmed.** Themes: Pine Blue / Blue Bold, Editor Dark / Dark Bold, Editor Light / Light Bold, Grey / Grey Bold / Grey !.  
- **Confirmed.** Companion only (no language grammar).

---

## 6. `salbert11.pinescript-helper`

| Field | Value |
| --- | --- |
| Publisher | `salbert11` |
| Version | **3.4.3** (2024-11-09 README) |
| License | MIT |
| MSFT / OVSX | 11,270 / — |
| Claim | Language support for Pine Script V5 with highlighting and snippets. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=salbert11.pinescript-helper) · [GitHub](https://github.com/salbert11/pinescript) |

- **Confirmed.** Fork of `JeylaniB.pinescript`.  
- **Confirmed.** Highlighting, snippets, hovers. Snippets updated to Pine release October 2024.  
- **Confirmed.** Bundles many Pine Theme * color themes (also ships as a separate extension).  
- **Confirmed.** Same odd extension list as JeylaniB (`.ps`, `.pinecode`, `.tradingview`, …).

---

## 7. `TradesDontLie.pinescript-v6-vscode`

| Field | Value |
| --- | --- |
| Publisher | `TradesDontLie` |
| Version | **0.1.0** |
| License | MIT (README); clone URLs are `github.com/yourusername/Pine-Script-v6-VS-Code` |
| MSFT / OVSX | 8,486 / — |
| Claim | Pine Script v6 Language Server with dynamic requests, text features, boolean optimizations. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=TradesDontLie.pinescript-v6-vscode) |

- **Confirmed.** README lists v6 language *behaviors* (series-string `request.*`, short-circuit `and`/`or`, point text sizes, bold/italic, order trimming, negative array indices) as “features.”  
- **Confirmed.** Core claims: highlighting, completion, hover, library integration, themes, templates, type generation, docstring generation.  
- **Confirmed.** “Based on the excellent Pine Script v5 extension by frizLabz.”  
- **Inferred.** Those v6 bullets describe the *language*, not proven extra IDE work; listing looks like a rebrand of the frizLabz/kaigouthro family. Repo links are still placeholders.

---

## 8. `kaigouthro.pinescript-vscode`

| Field | Value |
| --- | --- |
| Publisher | `kaigouthro` (Kai Gouthro) |
| Version | **0.1.8** |
| License | MIT |
| MSFT / OVSX | 2,997 / — |
| Claim | “The definitive” Pine Script Language Server. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=kaigouthro.pinescript-vscode) · [GitHub](https://github.com/kaigouthro/Pine-Script-VS-Code) |
| Engine | VS Code `>=1.96.0`. `extensionDependencies`: `usernamehw.errorlens`. |

- **Confirmed.** Real-time linting via TradingView API (`pine-facade.tradingview.com` named in README). v5 and v6.  
- **Confirmed.** Local parse of UDTs, user functions, `@function`/`@param` docstrings.  
- **Confirmed.** Completions (built-ins, methods, args, UDT `.new`, fuzzy). Ghost-text completions. Signature help. Rich hover + TV docs links. Library import completion and source hover.  
- **Confirmed.** Commands: docstring, typify, built-in script browser, indicator/strategy/library templates, set TV username. Rename F2 (file-wide, “not yet scope”).  
- **Confirmed.** Color picker on color literals. 20+ bundled themes. Markdown fenced-Pine highlighting.  
- **Confirmed.** Untrusted workspaces supported; `secrets: true` capability.  
- **Inferred.** Sends script text to TradingView for lint (same family as frizLabz).

---

## 9. `salbert11.pinescript-color-themes`

| Field | Value |
| --- | --- |
| Publisher | `salbert11` |
| Version | **2.2.0** |
| License | MIT |
| MSFT / OVSX | 2,964 / — |
| Claim | Color themes for PineScript Helper. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=salbert11.pinescript-color-themes) · [GitHub](https://github.com/salbert11/pinethemes) |

- **Confirmed.** Fork of `JeylaniB.pine-editor-themes`. Themes-only. 14 named Pine Theme * variants.

---

## 10. `jpantsjoha.pinescript-v6-extension`

| Field | Value |
| --- | --- |
| Publisher | `jpantsjoha` (Jaroslav Pantsjoha) |
| Version | **0.7.1** (MSFT + OVSX) |
| License | MIT |
| MSFT / OVSX | 1,681 / 1,780 |
| Claim | Unofficial v6 support: real-time validation vs current TV v6 reference, checks that compile but are wrong, IntelliSense and hover. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=jpantsjoha.pinescript-v6-extension) · [OVSX](https://open-vsx.org/extension/jpantsjoha/pinescript-v6-extension) · [GitHub](https://github.com/jpantsjoha/pinescript-vscode-extension) · [jpantsjoha.com](https://jpantsjoha.com) |
| Engine | `^1.88.0`. Explicit Cursor / Windsurf / VSCodium / Gitpod via Open VSX. |

- **Confirmed.** Completions, signature help, hover for 475 v6 built-ins; parameter-name completions; namespace-dot constants.  
- **Confirmed.** Compile-time style errors: arity, misspelled constants, unknown params, undefined functions, invalid input casts, plot-in-block, plot/request limits.  
- **Confirmed.** Semantic checks S1–S10 (repaint `request.security`, `ta.*` in conditionals, accumulator lifetime, scope, unbounded strategy risk, unguarded FRED/ECONOMICS feeds). `// pine-ignore: Sn`.  
- **Confirmed.** Quick fixes (lightbulb). Wrapped-call parsing. v6 highlighting including `type`/`enum`/`method`.  
- **Confirmed.** Commands: Validate current file, Show docs. Settings: `pine.docsMode`, `pine.applyFileAssociation`, optional HTTP completion hook (off).  
- **Confirmed.** Same engine on npm `pinescript-v6-validator`, CLI `validate-cli.js`, and MCP `pinescript-plugin` for agents.  
- **Confirmed.** No chart, no run, no debugger. Unofficial, not affiliated with TradingView.

---

## 11. `0xjcf.pine-script-syntax`

| Field | Value |
| --- | --- |
| Publisher | `0xjcf` |
| Version | Listing **1.0.0**; repo package.json **0.0.5** |
| License | MIT |
| MSFT / OVSX | 916 / — |
| Claim | Syntax highlighting for `.pine` used in TradingView. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=0xjcf.pine-script-syntax) · [GitHub](https://github.com/0xjcf/pine-script-syntax) |

- **Confirmed.** Highlighting: keywords, built-ins, literals, comments, operators, strings.  
- **Confirmed.** Four themes (Dark, Neon Dark, Dimmed Dark, Light); WCAG AA contrast claimed.  
- **Confirmed.** Known issues: no validation, no autocomplete, no snippets.

---

## 12. `revanthpobala.pine-script-pro`

| Field | Value |
| --- | --- |
| Publisher | `revanthpobala` (Revanth Pobala) |
| Version | OVSX **1.4.2** (2026-10-24). Marketplace gallery CDN still **1.4.0**; listing 644 installs. |
| License | Modified MIT — **mandatory attribution** for any reuse, including single lines ([LICENSE.txt](https://github.com/revanthpobala/pinescript-vscode-extension/blob/main/LICENSE.txt)). OVSX field is `MIT`. |
| MSFT / OVSX | 644 / **11,584** (OVSX much larger than MSFT) |
| Claim | Professional language support: static analysis, type-infection checking, intelligent tooltips. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=revanthpobala.pine-script-pro) · [OVSX](https://open-vsx.org/extension/revanthpobala/pine-script-pro) · [GitHub](https://github.com/revanthpobala/pinescript-vscode-extension) |
| Engine | `^1.75.0`. v6 optimized; v3–v5 compatible (README). |

- **Confirmed.** WASM tree-sitter parser; “zero false-positive” / greedy symbol scraper.  
- **Confirmed.** Go to definition, auto-formatter (“Silent Healer”), inlay hints, diagnostics (void assign, arity, namespace). Contextual autocomplete by namespace.  
- **Confirmed.** Status-bar inputs preview. Changelog 1.4.x: workspace library awareness, cross-file completion.  
- **Confirmed.** Hover docs. No run/chart/debugger claimed.  
- **Inferred.** Shares marketing language with `LinXueyuanStdio.pinescript-render` (WASM, greedy scraper, 800+ built-ins).

---

## 13. `weaming.pinescript-language-v6`

| Field | Value |
| --- | --- |
| Publisher | `weaming` |
| Version | **0.1.4** |
| License | MIT |
| MSFT / OVSX | 362 / — |
| Claim | Rich Pine Script v6 language support (CN listing). |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=weaming.pinescript-language-v6) · [GitHub](https://github.com/miaomiaotech/pinescript-v6-vscode-extension) |

- **Confirmed.** Highlight, IntelliSense, signature help, hover, go to definition, find references, rename, inlay hints, color preview, real-time validation.  
- **Confirmed.** Commands `pine.validate`, `pine.showDocs`. Setting `pine.applyFileAssociation` (same names as jpantsjoha).  
- **Inferred.** Likely derived from jpantsjoha’s extension (identical command/setting ids).

---

## 14. `LinXueyuanStdio.pinescript-render`

| Field | Value |
| --- | --- |
| Publisher | `LinXueyuanStdio` (兮尘) |
| Version | **0.1.1** CDN; README badge still 0.1.0 |
| License | MIT |
| MSFT / OVSX | 164 / — |
| Claim | Language support with backtest preview: static analysis, tooltips, vectorbt-powered strategy backtesting. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=LinXueyuanStdio.pinescript-render) · [GitHub](https://github.com/LinXueyuanStdio/evolution-of-pinescript) |
| Engine | VS Code 1.75+; backtest needs Python 3.8+ + `vectorbt` + `yfinance` (optional `ccxt`). |

- **Confirmed.** Preview panel: k-line (Lightweight Charts), equity/drawdown, metrics (net profit, Sharpe, Sortino, …), trades table. Shortcut Ctrl/Cmd+K V.  
- **Confirmed.** Hover 800+ built-ins, namespace autocomplete, signature help, v6 namespaces, WASM tree-sitter.  
- **Confirmed.** Does **not** claim a Pine runtime — backtest is vectorbt/yfinance, not PyneCore / TradingView.  
- **Inferred.** Language core related to Pine Script Pro (same tree-sitter / “zero false-positive” copy).

---

## 15. `pynesys.pyneide`

| Field | Value |
| --- | --- |
| Publisher | `pynesys` (PYNESYS LLC / Adam Wallner) |
| Version | **0.14.1** preview |
| License | GPL-3.0-only |
| MSFT / OVSX | 57 / 1,368 |
| Claim | Pine + Pyne IDE: highlighting, completion, diagnostics, step-through debugger, compile/run, interactive backtest chart. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=pynesys.pyneide) · [OVSX](https://open-vsx.org/extension/pynesys/pyneide) · [pynesys.io](https://pynesys.io) · [GitHub](https://github.com/PyneSys/PyneIDE) |

Deeper public/VSIX inventories already exist: [`_research-pyneide-public.md`](_research-pyneide-public.md), [`_research-pyneide-vsix.md`](_research-pyneide-vsix.md). Short bullets for this card:

- **Confirmed.** Built-in v6 highlight/completion/hover/signature; dedicated Pine LS (native download, not in VSIX).  
- **Confirmed.** Local run on PyneCore (Apache-2.0) + uv/CPython; chart (klinecharts), inputs form, strategy tables, profiler, robustness tests.  
- **Confirmed.** Bar-by-bar debugger (DAP type `pyne`).  
- **Confirmed.** Pine compile is paid cloud (PyneComp); Pyne Python path is free. No first-party telemetry. Untrusted/virtual workspaces unsupported.

---

## 16. `ferranborreguero.pinecone`

| Field | Value |
| --- | --- |
| Publisher | `ferranborreguero` (Ferran Borreguero / ferranbt) |
| Version | **0.2.6** |
| License | MPL-2.0 |
| MSFT / OVSX | 44 / 1,488 |
| Claim | Diagnostics, lint, and formatting via the pinecone language server. |
| Homepage / repo | [Marketplace](https://marketplace.visualstudio.com/items?itemName=ferranborreguero.pinecone) · [OVSX](https://open-vsx.org/extension/ferranborreguero/pinecone) · [GitHub pinecone](https://github.com/ferranbt/pinecone) |
| Engine | `^1.75.0`. Categories: Programming Languages, Linters, Formatters. |

- **Confirmed.** Highlight `.pine`. Diagnostics + lint: repainting `request.security`, lookahead bias, intrabar strategy recalc.  
- **Confirmed.** Format Document. Hover, completion (fields, enums, library exports, `ta.`/`math.`), go to def, find refs (into imports), outline, highlight occurrences, rename across libraries.  
- **Confirmed.** Downloads `pinecone` binary if missing (`pinecone.server.path`). Rust/cargo toolchain.  
- **Confirmed.** No chart / run / debugger claimed.

---

## Open VSX vs Marketplace drift (Cursor-relevant)

| Extension | Marketplace | Open VSX | Note |
| --- | --- | --- | --- |
| `ex-codes.pine-script-syntax-highlighter` | 3.4.0, 86k installs | **1.0.5** (2023), 7.2k | OVSX is the old highlighter only |
| `revanthpobala.pine-script-pro` | 1.4.0 CDN / 644 | **1.4.2** / 11.6k | Stronger on OVSX than MSFT |
| `jpantsjoha.pinescript-v6-extension` | 0.7.1 / 1.7k | 0.7.1 / 1.8k | Publisher names Cursor explicitly |
| `pynesys.pyneide` | 0.14.1 / 57 | 0.14.1 / 1.4k | Preview on both |
| `ferranborreguero.pinecone` | 0.2.6 / 44 | 0.2.6 / 1.5k | OVSX >> MSFT |
| JeylaniB, salbert11, leifcr, frizLabz, kaigouthro, TradesDontLie, weaming, 0xjcf, LinXueyuanStdio | listed | **not found** | Cursor/VSCodium cannot install from OVSX |

---

## Family map (for scoring, not a score)

```
Highlighter / snippets (V5 era)
  JeylaniB.pinescript ──fork──► salbert11.pinescript-helper
  JeylaniB.pine-editor-themes ──fork──► salbert11.pinescript-color-themes
  leifcr.pine-script-syntax-highlighting (archived)
  0xjcf.pine-script-syntax

TV-API “language server” family
  frizLabz.pinescript-v5-vscode ──► kaigouthro.pinescript-vscode
                                 ──► TradesDontLie.pinescript-v6-vscode (v6 rebrand)

Offline v6 language / validator
  ex-codes.pine-script-syntax-highlighter 3.4.x (MSFT only at this version)
  jpantsjoha.pinescript-v6-extension (+ CLI/MCP) ──inferred fork──► weaming.pinescript-language-v6
  revanthpobala.pine-script-pro (WASM) ──related──► LinXueyuanStdio.pinescript-render (+ vectorbt panel)
  ferranborreguero.pinecone (external rust LS)

Full IDE (run + chart + debug)
  pynesys.pyneide
  (excluded) hoox-sh.axis-ide + hoox-sh.pyne
```

## Sources

- VS Marketplace item pages listed above (fetched 2026-11-09).  
- Open VSX search APIs: `query=pine`, `pinescript`, `tradingview`, `pyne`; per-extension APIs for pyneide, pinescript-v6-extension, pine-script-pro, pinecone, pine-script-syntax-highlighter.  
- GitHub `package.json`: yankikucuk, jeyllani, kaigouthro, FFriZ, leifcr, 0xjcf.  
- Sibling research: `_research-pyneide-public.md`, `_research-pyneide-vsix.md`.

No scored comparison in this file.
