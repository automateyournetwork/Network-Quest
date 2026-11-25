# Service test directory

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T009 installs PHPUnit and its configuration only. No application tests exist yet;
running `vendor/bin/phpunit --configuration phpunit.xml` from `server/` deliberately
fails on an empty suite. T020 creates the isolated service test harness after G0.
The current bootstrap loads only Composer's autoloader, never private configuration.

Future tests must use disposable storage outside docroot, synthetic identities
confined to tests, and explicit isolated configuration. They must not read real
provider credentials or production player data. Real provider acceptance remains
separate from mock identity checks.
