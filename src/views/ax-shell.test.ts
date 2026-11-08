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
import { axBtnClass, axBtnHtml } from './ax-shell';

describe('axBtnClass', () => {
  test('defaults to primary md', () => {
    expect(axBtnClass()).toBe('ax-btn ax-btn--primary ax-btn--md');
  });

  test('accepts variant, size, and extra layout hook', () => {
    expect(axBtnClass('secondary', 'sm', 'workers-probe-all')).toBe(
      'ax-btn ax-btn--secondary ax-btn--sm workers-probe-all',
    );
  });

  test('ignores blank extra', () => {
    expect(axBtnClass('ghost', 'md', '  ')).toBe('ax-btn ax-btn--ghost ax-btn--md');
  });
});

describe('axBtnHtml', () => {
  test('emits frozen ax-btn structure with label span', () => {
    const html = axBtnHtml({ id: 'workers-probe-all', label: 'Probe all', className: 'workers-probe-all' });
    expect(html).toContain('type="button"');
    expect(html).toContain('id="workers-probe-all"');
    expect(html).toContain('class="ax-btn ax-btn--primary ax-btn--md workers-probe-all"');
    expect(html).toContain('<span class="ax-btn__label">Probe all</span>');
    expect(html).not.toContain('onclick');
  });

  test('supports submit + data-action + title', () => {
    const html = axBtnHtml({
      id: 'watchlist-add',
      label: 'Add',
      type: 'submit',
      dataAction: 'add',
      title: 'Add symbol',
      variant: 'primary',
    });
    expect(html).toContain('type="submit"');
    expect(html).toContain('data-action="add"');
    expect(html).toContain('title="Add symbol"');
  });
});
