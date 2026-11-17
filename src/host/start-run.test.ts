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

import { describe, expect, test } from 'bun:test';
import {
  HOSTED_ENGINE_URL,
  START_CARDS,
  START_COMMAND,
  START_DISMISS_LABEL,
  isStartCard,
  markStep,
  pickingView,
  readStartMessage,
  renderStartHtml,
  runningView,
  settleWaiting,
  shouldMarkStartSeen,
  startCard,
  stepsFor,
} from './start-run';

describe('start messages', () => {
  test('busy and unknown messages are ignored', () => {
    expect(readStartMessage({ type: 'choose', id: 'hosted' }, true)).toEqual({ type: 'ignore' });
    expect(readStartMessage({ type: 'back' }, true)).toEqual({ type: 'ignore' });
    expect(readStartMessage({ type: 'dismiss' }, true)).toEqual({ type: 'ignore' });
    expect(readStartMessage(null, false)).toEqual({ type: 'ignore' });
    expect(readStartMessage('choose', false)).toEqual({ type: 'ignore' });
    expect(readStartMessage([], false)).toEqual({ type: 'ignore' });
    expect(readStartMessage({ type: 'nope' }, false)).toEqual({ type: 'ignore' });
    expect(readStartMessage({ type: 'choose', id: 1 }, false)).toEqual({ type: 'ignore' });
    expect(readStartMessage({ type: 'choose', id: 'auto' }, false)).toEqual({ type: 'ignore' });
    expect(readStartMessage({}, false)).toEqual({ type: 'ignore' });
  });

  test('a free panel accepts back, dismiss, and a known card', () => {
    expect(readStartMessage({ type: 'back' }, false)).toEqual({ type: 'back' });
    expect(readStartMessage({ type: 'dismiss' }, false)).toEqual({ type: 'dismiss' });
    expect(readStartMessage({ type: 'choose', id: 'editor' }, false)).toEqual({
      type: 'choose',
      id: 'editor',
    });
  });
});

describe('axis.start.seen timing', () => {
  test('marks seen only after a finished card or explicit dismiss', () => {
    expect(shouldMarkStartSeen('done')).toBe(true);
    expect(shouldMarkStartSeen('dismiss')).toBe(true);
    expect(shouldMarkStartSeen('reveal')).toBe(false);
    expect(shouldMarkStartSeen('close')).toBe(false);
    expect(shouldMarkStartSeen('error')).toBe(false);
  });
});

describe('start screen', () => {
  test('offers the three engines and rejects unknown ids', () => {
    expect(START_COMMAND).toBe('axis.start');
    expect(HOSTED_ENGINE_URL).toBe('https://pynescript.online');
    expect(START_CARDS.map((card) => card.id)).toEqual(['hosted', 'local', 'editor']);
    expect(isStartCard('hosted')).toBe(true);
    expect(isStartCard('local')).toBe(true);
    expect(isStartCard('editor')).toBe(true);
    expect(isStartCard('auto')).toBe(false);
    expect(startCard('editor').title).toBe('In the editor');
    expect(startCard('hosted').title).toBe('Hosted');
    expect(startCard('missing' as 'hosted').title).toBe('Hosted');
  });

  test('each card has its own setup steps', () => {
    expect(stepsFor('hosted').map((step) => step.id)).toEqual(['save', 'pyne', 'reach']);
    expect(stepsFor('local').map((step) => step.id)).toEqual([
      'python',
      'runtime',
      'venv',
      'pip',
      'verify',
      'save',
    ]);
    expect(stepsFor('editor').map((step) => step.id)).toEqual(['save', 'bundle']);
    expect(stepsFor('hosted').every((step) => step.state === 'wait')).toBe(true);
  });

  test('markStep updates one row and settleWaiting finishes the rest', () => {
    const marked = markStep(stepsFor('hosted'), 'save', 'ok', 'server');
    expect(marked[0]).toEqual({ id: 'save', label: 'Select the hosted engine', state: 'ok', detail: 'server' });
    expect(marked[1]?.state).toBe('wait');
    const cleared = markStep(marked, 'save', 'run');
    expect(cleared[0]?.detail).toBeUndefined();
    expect(markStep(marked, 'missing', 'bad')).toEqual(marked);
    const settled = settleWaiting(marked, 'skip');
    expect(settled.map((step) => step.state)).toEqual(['ok', 'skip', 'skip']);
    expect(settleWaiting([{ id: 'a', label: 'A', state: 'bad' }], 'ok')[0]?.state).toBe('bad');
    expect(settleWaiting([{ id: 'a', label: 'A', state: 'run' }], 'ok')[0]?.state).toBe('ok');
  });

  test('the pick screen is three buttons and the run screen is a checklist', () => {
    const pick = renderStartHtml(pickingView(), 'nonce/1');
    expect(pick).toContain('How should a script run?');
    expect(pick).toContain("script-src 'nonce-nonce1'");
    expect(pick).toContain("style-src 'nonce-nonce1'");
    expect(pick).toContain('<style nonce="nonce1">');
    expect(pick).toContain('nonce="nonce1"');
    expect(pick).not.toContain('unsafe-inline');
    expect(pick).not.toContain('<script>');
    expect(pick).toContain('data-dismiss="1"');
    expect(pick).toContain(START_DISMISS_LABEL);
    expect(pick).toContain("postMessage({ type: 'dismiss' })");
    for (const card of START_CARDS) {
      expect(pick).toContain(`data-choice="${card.id}"`);
      expect(pick).toContain(card.title);
    }
    expect(pick).toContain('class="card__icon"');
    expect(pick).toContain('stroke="currentColor"');
    expect(pick).toContain('aria-label="Hosted"');
    expect(pick).toContain('aria-label="This computer"');
    expect(pick).toContain('aria-label="In the editor"');
    expect(pick).toContain('viewBox="0 0 16 16"');
    const run = renderStartHtml(
      {
        ...runningView('local'),
        phase: 'error',
        message: 'Python <3',
        steps: [
          { id: 'python', label: 'Find Python', state: 'bad', detail: 'need 3.10 & more' },
          { id: 'runtime', label: 'Python', state: 'ok' },
          { id: 'venv', label: 'Folder', state: 'run' },
          { id: 'pip', label: 'Install', state: 'skip' },
        ],
      },
      '',
    );
    expect(run).toContain('This computer');
    expect(run).toContain('Python &lt;3');
    expect(run).toContain('data-state="bad"');
    expect(run).toContain('need 3.10 &amp; more');
    expect(run).toContain('Done');
    expect(run).toContain('Working');
    expect(run).toContain('Skipped');
    expect(run).toContain('data-back="1"');
    expect(run).toContain('nonce="axis"');
    const done = renderStartHtml(
      { phase: 'done', card: 'editor', steps: stepsFor('editor'), message: 'Ready' },
      'ok',
    );
    expect(done).toContain('data-phase="done"');
    expect(done).toContain('In the editor');
    expect(done).toContain('Waiting');
    const bare = renderStartHtml({ phase: 'done', steps: [] }, 'n');
    expect(bare).toContain('<h1>Setup</h1>');
    expect(bare).not.toContain('<ol');
  });
});
