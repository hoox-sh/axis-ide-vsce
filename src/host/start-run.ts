// Copyright (C) 2026 jango_blockchained
//
// This file is part of AXIS IDE (hoox-sh.axis-ide).
//
// AXIS IDE is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, version 3 of the License only.
//
// AXIS IDE is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with AXIS IDE.  If not, see <https://www.gnu.org/licenses/>.
//
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Start screen: three ways a script can run, then the setup steps for the
 * one the user picks. No VS Code imports. The panel only paints this HTML.
 */

import { axisIconSvg, startCardIcon } from './icons';

export const START_COMMAND = 'axis.start';
export const START_SEEN_KEY = 'axis.start.seen';
export const HOSTED_ENGINE_URL = 'https://pynescript.online';
/** Pick-screen control that permanently skips auto-open. */
export const START_DISMISS_LABEL = 'Skip for now';

export type StartCardId = 'hosted' | 'local' | 'editor';
export type StartPhase = 'pick' | 'run' | 'done' | 'error';
export type StartStepState = 'wait' | 'run' | 'ok' | 'bad' | 'skip';
/** Events that might try to persist `axis.start.seen`. */
export type StartSeenEvent = 'reveal' | 'done' | 'dismiss' | 'close' | 'error';

/** Persist seen only after a finished card or an explicit skip — never on reveal/close. */
export function shouldMarkStartSeen(event: StartSeenEvent): boolean {
  return event === 'done' || event === 'dismiss';
}

export type StartCard = {
  id: StartCardId;
  title: string;
  kicker: string;
  body: string;
  facts: readonly string[];
};

export type StartStep = {
  id: string;
  label: string;
  state: StartStepState;
  detail?: string;
};

export type StartView = {
  phase: StartPhase;
  card?: StartCardId;
  steps: readonly StartStep[];
  message?: string;
};

export const START_CARDS: readonly StartCard[] = [
  {
    id: 'hosted',
    title: 'Hosted',
    kicker: 'Nothing to install',
    body: 'The script runs on pynescript.online. AXIS sends the source there. No API key.',
    facts: ['Full PYNE runtime', 'Needs the network', 'Default'],
  },
  {
    id: 'local',
    title: 'This computer',
    kicker: 'One install',
    body: 'AXIS installs the PYNE engine in its own folder and runs it on this machine. The script is not sent to a server.',
    facts: ['Full PYNE runtime', 'Python 3.10–3.13', 'First setup can download Python'],
  },
  {
    id: 'editor',
    title: 'In the editor',
    kicker: 'No install',
    body: 'Pyodide runs a Pine subset inside the editor. The script stays here. Numba, sessions, and cron are not available.',
    facts: ['Nothing uploaded', 'Subset of Pine', 'Ships with AXIS'],
  },
];

const CARD_IDS = new Set<StartCardId>(['hosted', 'local', 'editor']);

export function isStartCard(value: string): value is StartCardId {
  return CARD_IDS.has(value as StartCardId);
}

export type StartMessage =
  | { type: 'choose'; id: StartCardId }
  | { type: 'back' }
  | { type: 'dismiss' }
  | { type: 'ignore' };

/** What the start panel should do with one webview message. Busy drops all of them. */
export function readStartMessage(message: unknown, busy: boolean): StartMessage {
  if (busy) return { type: 'ignore' };
  if (!message || typeof message !== 'object') return { type: 'ignore' };
  const kind = (message as { type?: unknown }).type;
  if (kind === 'back') return { type: 'back' };
  if (kind === 'dismiss') return { type: 'dismiss' };
  if (kind !== 'choose') return { type: 'ignore' };
  const id = (message as { id?: unknown }).id;
  if (typeof id !== 'string' || !isStartCard(id)) return { type: 'ignore' };
  return { type: 'choose', id };
}

export function startCard(id: StartCardId): StartCard {
  const card = START_CARDS.find((item) => item.id === id);
  if (!card) return START_CARDS[0];
  return card;
}

export function stepsFor(card: StartCardId): StartStep[] {
  switch (card) {
    case 'hosted':
      return [
        { id: 'save', label: 'Select the hosted engine', state: 'wait' },
        { id: 'pyne', label: 'Point PYNE smoke at the same host', state: 'wait' },
        { id: 'reach', label: 'Check pynescript.online', state: 'wait' },
      ];
    case 'local':
      return [
        { id: 'python', label: 'Find Python 3.10–3.13', state: 'wait' },
        { id: 'runtime', label: 'Standalone Python, only if needed', state: 'wait' },
        { id: 'venv', label: 'Create the engine folder', state: 'wait' },
        { id: 'pip', label: 'Install the backend', state: 'wait' },
        { id: 'verify', label: 'Check the engine command', state: 'wait' },
        { id: 'save', label: 'Select the local engine', state: 'wait' },
      ];
    case 'editor':
      return [
        { id: 'save', label: 'Select the in-editor engine', state: 'wait' },
        { id: 'bundle', label: 'Check the Pyodide files', state: 'wait' },
      ];
  }
}

export function markStep(
  steps: readonly StartStep[],
  id: string,
  state: StartStepState,
  detail?: string,
): StartStep[] {
  let found = false;
  const next = steps.map((step) => {
    if (step.id !== id) return step;
    found = true;
    const copy: StartStep = { ...step, state };
    if (detail !== undefined) copy.detail = detail;
    else delete copy.detail;
    return copy;
  });
  return found ? next : [...steps];
}

/** Mark leftover waiting or running rows once the setup has finished. */
export function settleWaiting(steps: readonly StartStep[], state: 'ok' | 'skip'): StartStep[] {
  return steps.map((step) =>
    step.state === 'wait' || step.state === 'run' ? { ...step, state } : step,
  );
}

export function pickingView(): StartView {
  return { phase: 'pick', steps: [] };
}

export function runningView(card: StartCardId): StartView {
  return { phase: 'run', card, steps: stepsFor(card) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stepMark(state: StartStepState): string {
  switch (state) {
    case 'ok':
      return 'Done';
    case 'bad':
      return 'Failed';
    case 'run':
      return 'Working';
    case 'skip':
      return 'Skipped';
    default:
      return 'Waiting';
  }
}

function stepsHtml(steps: readonly StartStep[]): string {
  if (steps.length === 0) return '';
  const rows = steps
    .map((step) => {
      const detail = step.detail
        ? `<p class="detail">${escapeHtml(step.detail)}</p>`
        : '';
      return `<li data-state="${step.state}"><span class="mark">${stepMark(step.state)}</span><div><p class="label">${escapeHtml(step.label)}</p>${detail}</div></li>`;
    })
    .join('');
  return `<ol class="steps">${rows}</ol>`;
}

function cardsHtml(): string {
  return START_CARDS.map((card) => {
    const facts = card.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join('');
    const icon = axisIconSvg(startCardIcon(card.id), {
      size: 28,
      className: 'card__icon',
      label: card.title,
    });
    return `<button type="button" class="card" data-choice="${card.id}">
      ${icon}
      <span class="kicker">${escapeHtml(card.kicker)}</span>
      <span class="title">${escapeHtml(card.title)}</span>
      <span class="body">${escapeHtml(card.body)}</span>
      <ul>${facts}</ul>
    </button>`;
  }).join('');
}

/**
 * Start-screen document. One static script posts the card id. Snapshot text
 * is escaped and never becomes a command.
 */
export function renderStartHtml(view: StartView, nonce: string): string {
  const safeNonce = nonce.replace(/[^a-zA-Z0-9]/g, '') || 'axis';
  const csp = [
    "default-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `script-src 'nonce-${safeNonce}'`,
    `style-src 'nonce-${safeNonce}'`,
    "img-src 'none'",
    "connect-src 'none'",
  ].join('; ');
  const chosen = view.card ? startCard(view.card) : undefined;
  const heading =
    view.phase === 'pick'
      ? 'How should a script run?'
      : (chosen?.title ?? 'Setup');
  const lead =
    view.phase === 'pick'
      ? 'PYNE colors the script and checks it. This choice is only the engine that runs it. Pick one. Setup stays on this screen until it finishes.'
      : (chosen?.body ?? '');
  const message = view.message
    ? `<p class="banner" data-phase="${view.phase}">${escapeHtml(view.message)}</p>`
    : '';
  const back =
    view.phase === 'pick'
      ? ''
      : '<button type="button" class="back" data-back="1">Choose a different way</button>';
  const dismiss =
    view.phase === 'pick'
      ? `<p class="dismiss-row"><button type="button" class="back" data-dismiss="1">${escapeHtml(START_DISMISS_LABEL)}</button></p>`
      : '';
  const body =
    view.phase === 'pick'
      ? `<div class="cards">${cardsHtml()}</div>${dismiss}`
      : `${stepsHtml(view.steps)}${back}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Choose how to run</title>
<style nonce="${safeNonce}">
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 24px 40px;
    color: var(--vscode-foreground, #e8eaee);
    background: var(--vscode-editor-background, #0c0e14);
    font-family: var(--vscode-font-family, sans-serif);
    font-size: 14px;
    line-height: 1.4;
  }
  h1 { margin: 0 0 8px; font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
  .lead { margin: 0 0 22px; max-width: 68ch; color: var(--vscode-descriptionForeground, #9aa3b2); }
  .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    min-height: 280px;
    margin: 0;
    padding: 22px;
    text-align: left;
    border-radius: 12px;
    border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.4));
    background: var(--vscode-editorWidget-background, rgba(128, 128, 128, 0.08));
    color: inherit;
    cursor: pointer;
  }
  .card:hover { border-color: var(--vscode-focusBorder, #8b9cff); }
  .card:focus-visible { outline: 2px solid var(--vscode-focusBorder, #8b9cff); outline-offset: 2px; }
  .card__icon {
    display: block;
    width: 28px;
    height: 28px;
    color: var(--vscode-textLink-foreground, #8b9cff);
    flex: 0 0 auto;
  }
  .kicker {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--vscode-textLink-foreground, #8b9cff);
  }
  .title { font-size: 26px; font-weight: 650; letter-spacing: -0.02em; }
  .body { color: var(--vscode-descriptionForeground, #9aa3b2); }
  .card ul { margin: auto 0 0; padding-left: 18px; }
  .steps { list-style: none; margin: 8px 0 18px; padding: 0; max-width: 640px; }
  .steps li {
    display: flex;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.28));
  }
  .mark {
    flex: 0 0 72px;
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  li[data-state="ok"] .mark { color: var(--vscode-testing-iconPassed, #3ddc97); }
  li[data-state="bad"] .mark { color: var(--vscode-errorForeground, #f07178); }
  li[data-state="run"] .mark { color: var(--vscode-textLink-foreground, #8b9cff); }
  li[data-state="skip"] .mark, li[data-state="wait"] .mark { color: var(--vscode-descriptionForeground, #9aa3b2); }
  .label { margin: 0; }
  .detail { margin: 4px 0 0; color: var(--vscode-descriptionForeground, #9aa3b2); }
  .banner { margin: 0 0 12px; font-weight: 600; }
  .banner[data-phase="error"] { color: var(--vscode-errorForeground, #f07178); }
  .banner[data-phase="done"] { color: var(--vscode-testing-iconPassed, #3ddc97); }
  .back {
    min-height: 32px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--vscode-widget-border, rgba(128, 128, 128, 0.4));
    background: transparent;
    color: inherit;
    cursor: pointer;
  }
  .back:focus-visible { outline: 2px solid var(--vscode-focusBorder, #8b9cff); outline-offset: 2px; }
  .dismiss-row { margin: 18px 0 0; }
  @media (max-width: 860px) {
    .cards { grid-template-columns: 1fr; }
    .card { min-height: 0; }
  }
</style>
</head>
<body>
  <h1>${escapeHtml(heading)}</h1>
  <p class="lead">${escapeHtml(lead)}</p>
  ${message}
  ${body}
  <script nonce="${safeNonce}">
    const vscode = acquireVsCodeApi();
    for (const button of document.querySelectorAll('[data-choice]')) {
      button.addEventListener('click', () => {
        vscode.postMessage({ type: 'choose', id: button.getAttribute('data-choice') });
      });
    }
    const back = document.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => vscode.postMessage({ type: 'back' }));
    const dismiss = document.querySelector('[data-dismiss]');
    if (dismiss) dismiss.addEventListener('click', () => vscode.postMessage({ type: 'dismiss' }));
  </script>
</body>
</html>
`;
}
