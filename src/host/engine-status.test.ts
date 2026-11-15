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
import type { LocalEngineStatus } from '../run/local-engine';
import { engineStatusView } from './engine-status';

const STOPPED: LocalEngineStatus = { state: 'stopped' };

describe('engineStatusView', () => {
  test('hides a stopped engine outside local mode', () => {
    expect(engineStatusView(STOPPED, 'auto')).toEqual({ show: false, text: '', tooltip: '' });
    expect(engineStatusView(undefined, 'server')).toEqual({
      show: false,
      text: '',
      tooltip: '',
    });
  });

  test('shows a stopped local engine', () => {
    const view = engineStatusView(STOPPED, 'local');
    expect(view.show).toBe(true);
    expect(view.text).toBe('$(circle-outline) PYNE local');
    expect(view.tooltip).toContain('stopped');
  });

  test('shows a starting local engine', () => {
    const view = engineStatusView({ state: 'starting', port: 5002 }, 'local');
    expect(view.text).toBe('$(sync~spin) PYNE local');
    expect(view.tooltip).toContain('starting');
  });

  test('shows a ready local engine', () => {
    const view = engineStatusView(
      { state: 'ready', port: 5002, endpoint: 'http://127.0.0.1:5002' },
      'local',
    );
    expect(view.text).toBe('$(check) PYNE local');
    expect(view.tooltip).toContain('http://127.0.0.1:5002');
  });

  test('shows an error even outside local mode', () => {
    const view = engineStatusView({ state: 'error', error: 'ENOENT' }, 'auto');
    expect(view.show).toBe(true);
    expect(view.text).toBe('$(error) PYNE local');
    expect(view.tooltip).toContain('ENOENT');
  });

  test('shows a ready engine even after switching mode', () => {
    const view = engineStatusView(
      { state: 'ready', port: 1, endpoint: 'http://127.0.0.1:1' },
      'pyodide',
    );
    expect(view.show).toBe(true);
  });
});
