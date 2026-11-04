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

import { afterEach, describe, expect, test } from 'bun:test';
import {
  getStudio,
  listStudios,
  registerStudio,
  type StudioRegistration,
} from './studio-registry';

const VALID: StudioRegistration = {
  id: 'colors',
  title: 'Colors',
  viewId: 'axis.colors',
  retainContextWhenHidden: false,
  actions: { copy: () => {} },
};

const unregisters: Array<() => void> = [];

afterEach(() => {
  for (const unregister of unregisters.splice(0)) unregister();
});

/** registerStudio wrapper that cleans up after the test. */
function register(def: StudioRegistration): () => void {
  const unregister = registerStudio(def);
  unregisters.push(unregister);
  return unregister;
}

describe('registerStudio validation', () => {
  test('rejects non-objects and each invalid field (trusted call site)', () => {
    const bad: Array<[unknown, string]> = [
      [null, 'registration must be an object'],
      [['x'], 'registration must be an object'],
      ['studio', 'registration must be an object'],
      [{ ...VALID, id: '' }, 'id must be a non-empty string'],
      [{ ...VALID, id: 7 }, 'id must be a non-empty string'],
      [{ ...VALID, title: '' }, 'title must be a non-empty string'],
      [{ ...VALID, viewId: '' }, 'viewId must be a non-empty string'],
      [{ ...VALID, retainContextWhenHidden: undefined }, 'retainContextWhenHidden must be a boolean'],
      [{ ...VALID, retainContextWhenHidden: 'yes' }, 'retainContextWhenHidden must be a boolean'],
      [{ ...VALID, bodyClass: 5 }, 'bodyClass must be a string when present'],
      [{ ...VALID, actions: null }, 'actions must be an object'],
      [{ ...VALID, actions: [] }, 'actions must be an object'],
      [{ ...VALID, actions: 'map' }, 'actions must be an object'],
      [{ ...VALID, actions: { copy: 'nope' } }, 'actions.copy must be a function'],
      [{ ...VALID, buildBody: 'body' }, 'buildBody must be a function when present'],
      [{ ...VALID, restore: 'data' }, 'restore must be a function when present'],
    ];
    for (const [def, message] of bad) {
      expect(() => registerStudio(def as never)).toThrow(message);
    }
  });

  test('accepts a minimal registration (optional fields omitted)', () => {
    const minimal: StudioRegistration = {
      id: 'colors',
      title: 'Colors',
      viewId: 'axis.colors',
      retainContextWhenHidden: true,
      actions: {},
    };
    expect(() => register(minimal)).not.toThrow();
    expect(getStudio('colors')).toBe(minimal);
  });

  test('throws on a duplicate id', () => {
    register(VALID);
    expect(() =>
      registerStudio({ ...VALID, viewId: 'axis.colors.again' }),
    ).toThrow('duplicate studio id: colors');
  });
});

describe('registry lookups', () => {
  test('getStudio misses return undefined', () => {
    expect(getStudio('missing-studio')).toBeUndefined();
  });

  test('listStudios preserves registration order', () => {
    register({ ...VALID, id: 'aaa', viewId: 'axis.aaa' });
    register({ ...VALID, id: 'bbb', viewId: 'axis.bbb' });
    const ids = listStudios().map((studio) => studio.id);
    expect(ids).toContain('aaa');
    expect(ids).toContain('bbb');
    expect(ids.indexOf('aaa')).toBeLessThan(ids.indexOf('bbb'));
  });

  test('unregister removes the studio and is idempotent', () => {
    const unregister = register({ ...VALID, id: 'temp', viewId: 'axis.temp' });
    expect(getStudio('temp')).toBeDefined();
    unregister();
    expect(getStudio('temp')).toBeUndefined();
    expect(() => unregister()).not.toThrow();
    // The id is reusable after unregistering.
    expect(() => register({ ...VALID, id: 'temp', viewId: 'axis.temp' })).not.toThrow();
  });
});
