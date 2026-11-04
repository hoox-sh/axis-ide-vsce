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
  alertsAddFromArgs,
  alertsIdFromArgs,
  ALERTS_NOTICE_ERROR,
  ALERTS_NOTICE_INFO,
  ALERTS_STUDIO_VIEW,
} from './alerts-messages';

describe('alerts studio constants', () => {
  test('wire id and notice levels match the old flash semantics', () => {
    expect(ALERTS_STUDIO_VIEW).toBe('alerts');
    // The old webview painted text === ALERTS_TITLE_REQUIRED with the error
    // class and everything else with info.
    expect(ALERTS_NOTICE_ERROR).toBe('error');
    expect(ALERTS_NOTICE_INFO).toBe('info');
  });
});

describe('alertsAddFromArgs', () => {
  test('trims the title and keeps a non-empty condition (old alerts.add parse)', () => {
    const titled = alertsAddFromArgs({ title: ' T ' });
    expect(titled).toEqual({ title: 'T' });
    expect(titled && 'condition' in titled).toBe(false);

    expect(
      alertsAddFromArgs({
        title: ' BTC ',
        condition: ' close > 1 ',
      }),
    ).toEqual({ title: 'BTC', condition: 'close > 1' });

    const blankCond = alertsAddFromArgs({
      title: 'X',
      condition: '   ',
    });
    expect(blankCond).toEqual({ title: 'X' });
    expect(blankCond && 'condition' in blankCond).toBe(false);

    const numCond = alertsAddFromArgs({
      title: 'X',
      condition: 1,
    });
    expect(numCond).toEqual({ title: 'X' });
    expect(numCond && 'condition' in numCond).toBe(false);
  });

  test('blank titles are kept as empty strings so the panel can flash', () => {
    expect(alertsAddFromArgs({ title: 5 })).toEqual({ title: '' });
    expect(alertsAddFromArgs({ title: '   ' })).toEqual({ title: '' });
    expect(alertsAddFromArgs({})).toEqual({ title: '' });
  });

  test('non-object args are dropped like the old parser nulls', () => {
    expect(alertsAddFromArgs(null)).toBeNull();
    expect(alertsAddFromArgs(undefined)).toBeNull();
    expect(alertsAddFromArgs(1)).toBeNull();
    expect(alertsAddFromArgs('alerts.add')).toBeNull();
    expect(alertsAddFromArgs([])).toBeNull();
  });

  test('hostile args never throw', () => {
    const boom = new Proxy(
      {},
      {
        get() {
          throw new Error('boom');
        },
      },
    );
    expect(() => alertsAddFromArgs(boom)).not.toThrow();
    expect(alertsAddFromArgs(boom)).toBeNull();

    const titleBoom = {
      get title(): string {
        throw new Error('title');
      },
    };
    expect(() => alertsAddFromArgs(titleBoom)).not.toThrow();
    expect(alertsAddFromArgs(titleBoom)).toBeNull();
  });
});

describe('alertsIdFromArgs', () => {
  test('trims toggle/remove ids (old alerts.toggle / alerts.remove parse)', () => {
    expect(alertsIdFromArgs({ id: ' a1 ' })).toBe('a1');
    expect(alertsIdFromArgs({ id: 'a1' })).toBe('a1');
    expect(alertsIdFromArgs({ id: 'a1', extra: true })).toBe('a1');
  });

  test('blank, missing, and non-string ids are dropped', () => {
    expect(alertsIdFromArgs({ id: '  ' })).toBeNull();
    expect(alertsIdFromArgs({ id: '' })).toBeNull();
    expect(alertsIdFromArgs({})).toBeNull();
    expect(alertsIdFromArgs({ id: 4 })).toBeNull();
    expect(alertsIdFromArgs(null)).toBeNull();
    expect(alertsIdFromArgs(undefined)).toBeNull();
    expect(alertsIdFromArgs(1)).toBeNull();
    expect(alertsIdFromArgs('alerts.toggle')).toBeNull();
    expect(alertsIdFromArgs([])).toBeNull();
  });

  test('hostile args never throw', () => {
    const boom = new Proxy(
      {},
      {
        get() {
          throw new Error('boom');
        },
      },
    );
    expect(() => alertsIdFromArgs(boom)).not.toThrow();
    expect(alertsIdFromArgs(boom)).toBeNull();
  });
});
