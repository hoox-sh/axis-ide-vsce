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
  AXIS_ICON_IDS,
  AXIS_ICON_MEDIA,
  axisIconLabel,
  axisIconSvg,
  deskActionIcon,
  deskRunIcon,
  isAxisIconId,
  startCardIcon,
} from './icons';

describe('axis icons', () => {
  test('every registered id renders a currentColor SVG', () => {
    for (const id of AXIS_ICON_IDS) {
      expect(isAxisIconId(id)).toBe(true);
      const svg = axisIconSvg(id);
      expect(svg).toContain('<svg');
      expect(svg).toContain('stroke="currentColor"');
      expect(svg).toContain('viewBox="0 0 16 16"');
      expect(svg).toContain('aria-hidden="true"');
      expect(svg).toContain('class="axis-icon"');
      expect(svg).toContain('width="16"');
    }
    expect(isAxisIconId('nope')).toBe(false);
    expect(axisIconSvg('nope')).toBe('');
  });

  test('size, class, and aria-label options', () => {
    const svg = axisIconSvg('run', { size: 12.4, className: 'btn__icon', label: 'Run <now>' });
    expect(svg).toContain('width="12"');
    expect(svg).toContain('height="12"');
    expect(svg).toContain('class="btn__icon"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="Run &lt;now&gt;"');
    expect(svg).not.toContain('aria-hidden');
    expect(axisIconSvg('run', { size: 0 })).toContain('width="16"');
    expect(axisIconSvg('run', { size: Number.NaN })).toContain('width="16"');
    expect(axisIconSvg('run', { className: '  ' })).toContain('class="axis-icon"');
    expect(axisIconSvg('run', { label: '   ' })).toContain('aria-hidden="true"');
  });

  test('axisIconLabel escapes text and optional wrapper class', () => {
    const plain = axisIconLabel('csv', 'CSV <file>');
    expect(plain).toContain('axis-icon__label');
    expect(plain).toContain('CSV &lt;file&gt;');
    expect(plain).toContain('stroke="currentColor"');
    const wrapped = axisIconLabel('apply', 'Apply', {
      className: 'row',
      iconClass: 'i',
      size: 14,
    });
    expect(wrapped).toContain('class="row"');
    expect(wrapped).toContain('class="i"');
    expect(axisIconLabel('run', 'Go', { className: '  ' })).not.toContain('class="  "');
  });

  test('start, desk action, and run maps cover the chrome surfaces', () => {
    expect(startCardIcon('hosted')).toBe('hosted');
    expect(startCardIcon('local')).toBe('local');
    expect(startCardIcon('editor')).toBe('editor');
    expect(deskActionIcon('axis.start')).toBe('start');
    expect(deskActionIcon('axis.runScript')).toBe('run');
    expect(deskActionIcon('axis.stopRun')).toBe('stop');
    expect(deskActionIcon('axis.openChart')).toBe('chart');
    expect(deskActionIcon('axis.pickData')).toBe('data');
    expect(deskActionIcon('axis.debug.start')).toBe('debug-start');
    expect(deskActionIcon('axis.debug.stepBar')).toBe('debug-step');
    expect(deskActionIcon('axis.debug.toggleBarBreakpoint')).toBe('breakpoint');
    expect(deskActionIcon('axis.showRunOutput')).toBe('output');
    expect(deskActionIcon('axis.engine.menu')).toBe('engine');
    expect(deskActionIcon('axis.engine.setup')).toBe('install');
    expect(deskActionIcon('axis.openWalkthroughFixture')).toBe('walkthrough');
    expect(deskActionIcon('axis.profiler.show')).toBe('profiler');
    expect(deskActionIcon('axis.secrets.setProKey')).toBe('key');
    expect(deskActionIcon('axis.secrets.setWorkerKey')).toBe('key');
    expect(deskActionIcon('axis.secrets.clear')).toBe('clear');
    expect(deskActionIcon('axis.statusbar.showPopup')).toBe('menu');
    expect(deskActionIcon('workbench.action.reloadWindow')).toBeUndefined();
    expect(deskRunIcon('running')).toBe('status-run');
    expect(deskRunIcon('error')).toBe('status-error');
    expect(deskRunIcon('stopped')).toBe('status-stopped');
    expect(deskRunIcon('ok')).toBe('status-ok');
    expect(deskRunIcon('idle')).toBe('status-idle');
  });

  test('media icon paths are under media/icons', () => {
    for (const path of Object.values(AXIS_ICON_MEDIA)) {
      expect(path.startsWith('media/icons/')).toBe(true);
      expect(path.endsWith('.svg')).toBe(true);
    }
    expect(AXIS_ICON_MEDIA.play).toBe('media/icons/play.svg');
    expect(AXIS_ICON_MEDIA.stop).toBe('media/icons/stop.svg');
  });
});
