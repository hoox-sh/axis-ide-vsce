/**
 * Copyright (C) 2026 jango_blockchained
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/*
 * Storybook preview for the AXIS IDE ax-* design system. Imports the same
 * CSS layers the webviews ship (tokens → theme → motion → components) plus
 * the VS Code token shim, and adds a toolbar decorator that applies the
 * vscode-light / vscode-high-contrast body classes like VS Code does.
 */

import './preview.css';
import '../webview/shared/tokens.css';
import '../webview/shared/theme.css';
import '../webview/shared/motion.css';
import '../webview/shared/components.css';

import type { Renderer, ProjectAnnotations } from '@storybook/html';

const preview: ProjectAnnotations<Renderer> = {
  parameters: {
    layout: 'padded',
  },
  globalTypes: {
    theme: {
      name: 'VS Code theme',
      description: 'Body classes the webviews receive from VS Code',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
          { value: 'high-contrast', title: 'High contrast' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [
    (Story, context) => {
      const body = document.body;
      body.classList.remove(
        'vscode-light',
        'vscode-high-contrast',
        'vscode-high-contrast-light',
      );
      if (context.globals.theme === 'light') body.classList.add('vscode-light');
      if (context.globals.theme === 'high-contrast') {
        body.classList.add('vscode-high-contrast');
      }
      return Story();
    },
  ],
};

export default preview;
