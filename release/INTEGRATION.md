# Spec001 standalone game package

The package contains the browser game, its dedicated PHP service and locked production dependencies. The release ID in the nested `release.json` identifies a candidate build. The manifest records the exact public game/service Git commit, editable media revision, API and stored data compatibility, both dependency locks, client build digest and packaging recipe digest.

## Build and inspect

Use a public Git checkout, Node 26.13.1 with npm 11.20.0, PHP 8.4 with the extensions in the service lock, Composer 2.11.3, Git, Python 3.11+ and sufficient temporary disk space for a second checkout. Install the locked root npm dependencies with `npm ci` before running the packager. The packager builds from a detached checkout of the requested commit and installs production PHP dependencies in a new directory. `--ref` defaults to HEAD. Package files and their SHA-256 sidecars default to `.local/releases/`. The normal command is:

```sh
npm run package:release -- --ref HEAD --out .local/releases
```

Set `NQ_PHP_BIN` and `NQ_COMPOSER_PHAR` to absolute executable and PHAR paths if Composer is outside PATH. `npm_config_cache` and `COMPOSER_CACHE_DIR` can point to populated public dependency caches. `npm_config_offline=true` and `COMPOSER_DISABLE_NETWORK=1` build with those caches offline. Choose a different game prefix with `--game-base /nested/game/`. The client, PHP route and both callback URLs use the same prefix.

Verify the archive sidecar against the checksum received through the release channel. Extract the archive into a new directory with `tar -xzf "$ARCHIVE" -C "$EMPTY_DIRECTORY"`. From the extraction root, `python3 tools/release-archive.py verify .` checks every regular file, the complete path set and the absence of symlinks. The checksum list covers the static game and private code, source retrieval files, notices and this guide. SHA-256 detects differences from the trusted release. Review the gates and rollback evidence before activating a build.

## Place the game

For the default routes, the only directory tree to expose is `public/arcade/play/network-quest/` at `/arcade/play/network-quest/`. Everything else stays outside every document root. The API front controller loads the private PHP entry using the extracted layout. If the webroot is physically separate, configure the trusted PHP process variable `NQ_PACKAGE_ROOT` with the absolute private extraction root. Keep the entire release-private `private/server` and `private/specs` trees together. The save validator resolves its schema relative to the service directory.

The game-local `.htaccess` requires Apache-compatible rewrite rules, DirectoryIndex and disabled indexes and MultiViews. Every request under `api/v1` must reach the supplied PHP entry with its original URI and method, including both provider callbacks. Enable equivalent rules on other supported servers and verify them in staging. Serve JS, CSS, MP3, PNG, WebP and GLB with their normal MIME types. Revalidate the shell, release manifest and stable media names on use. Only the fingerprinted JS/CSS names can be cached immutably. Enable mod_headers or implement equivalent response headers. The HTML policy permits same-origin scripts, local media/texture blobs and inline layout styles. OAuth opens a separate window and navigates it to the provider. PHP owns callback-page script policy. Preserve the PHP service's no-store and cookie headers on every API response. Use HTTPS throughout. Limit the website detail entry to a link to the nested game and the integration changes to this game's paths.

## Connect the private service

The service requires the reviewed LiteSpeed HTTPS request boundary in production, PHP 8.4, PDO SQLite and the extensions listed in `private/server/composer.json`. Supply `NQ_CONFIG_FILE` pointing to private JSON conforming to `private/server/config.example.json`, and `NQ_DOCUMENT_ROOTS_JSON` containing every canonical absolute webroot. The configuration is a single-link mode-0600 file in a private mode-0700 directory. Set origin, game path, callback URLs, separate Google/GitHub credentials and a random 32-byte base64url rate key. Use separate mode-0700 data, configuration and ledger directories outside all webroots. Supply the actual rollback roots, reviewed backup lifetime and restoration handling window. Keep the deletion ledger and its lock outside all rollback sets. Use `NQ_REQUEST_LOG_DIR` only for a dedicated, protected metadata directory.

With first-time operator provisioning, explicitly open the dedicated game file through `NetworkQuest\Database::open($path, $documentRoots)` and call `migrate()`. For a new independent deletion ledger, exclusively create empty mode-0600 ledger and sibling .lock files and call `NetworkQuest\DeletionLedger::initialize($file, $documentRoots, $rollbackRoots, $policy)` with the reviewed DeletionRetentionPolicy. Load the classes from `private/server/src/Application.php`. A service request never provisions or migrates storage. Preserve existing data on upgrades. The two shipped game migrations install or advance to schema 2. The service requires their exact checksums and the independent version-1 ledger. The v1 API writes save schema 1 with content 1.0.0. It can read schema 1 with content 0.9.1 via the client's authored migration. Apply a migrated save only through the normal conditional save action.

Set up encrypted application and independent ledger backups, keys, monitoring, write drain, restore tests and planned rollback using the supplied operations guide and `private/server/bin/{backup,restore}.php`. Keep private state and keys out of both release directories and package archives. Public provider and host validation belongs to the staged candidate. [Operational commands](../docs/operations.md)

## Source and attribution

The game serves the media register and complete software notices at `credits/media.html` and `credits/notices.txt` under its game path. Original materials retain the root LICENSE, LICENSE-ASSETS and NOTICE. From the extraction root, use `node tools/fetch-sources.mjs --list` to list the index, and `node tools/fetch-sources.mjs --dir DIRECTORY` to retrieve the independently versioned media sources into an existing directory. A repeat using `--verify` rehashes the files offline. Use the repository and media commit in the release manifest for the public sources and revision-specific rights records. The client parity hash includes Vite's private build manifest, distributed as `metadata/vite-manifest.json`. [Retrieval instructions](../docs/source-retrieval.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
