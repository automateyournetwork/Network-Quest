// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import './styles.css';

const status = document.querySelector<HTMLParagraphElement>('#development-status');
if (status === null) {
  throw new Error('The development status element is missing.');
}
status.textContent = 'This build contains setup only. Play is not available yet.';
