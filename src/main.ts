// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import './styles.css';
import './ui/app-shell.css';
import './app/application.css';
import './ui/styles/layout.css';
import { createIntroductionApplication } from './app/application';

const host = document.querySelector('main');
if (host === null) throw new Error('The application host is missing.');
try {
  const application = createIntroductionApplication(host);
  if (import.meta.hot) import.meta.hot.dispose(() => application.dispose());
} catch {
  const heading = document.createElement('h1'), message = document.createElement('p');
  heading.textContent = 'Network Quest'; message.setAttribute('role', 'alert');
  message.textContent = 'The adventure could not be loaded. No progress was saved. Reload to try again.';
  host.replaceChildren(heading, message);
}
