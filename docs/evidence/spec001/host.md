# Spec001 existing-host audit — T003

Date: 2026-11-25. Initial worker: `/root/loop003_t003`; latest probe:
`/root/loop019_t003_probes`. Baseline commit:
`d4482767aa3c9c794d1cf28d61b40f8aba2279c7`; uncommitted planning and implementation
evidence were preserved. Coverage: W01/G0, C2/C6/C12/C13/C14/C15 and the dedicated
hosting, persistence, privacy and recovery requirements in
[the plan](../../../specs/001-physical-layer-underworld/plan.md) and
[delivery contract](../../../specs/001-physical-layer-underworld/contracts/delivery.md).

## Current result — loops 016 and 019

**SSH and web execution now work.** The earlier disabled-shell attempts below
are retained as history. Loop016 authenticated with the existing SSH agent and
pinned key and executed commands; the lingering `noshell` metadata does not
override that observed success.

[Loop019's executed probes](host-probes.md) verified **PHP8.4.28 CLI and web
(litespeed), PDO SQLite3.54.1, web-created private storage (0700/0600), foreign
keys, DELETE/FULL transactions, two-process contention (258.8ms bounded BUSY),
rollback, interrupted-writer integrity and a consistent VACUUM INTO snapshot**.
Web-origin Google/GitHub TLS verification and an actual temporary cron execution
passed. Own-account cached quotas show 100GiB/250,000 inode limits, with their
21:16:54UTC timestamp and accounting caveats recorded. All temporary public/private
files and the tagged cron entry were removed; final SSH/SFTP verification found
unchanged parent modes and a byte-identical original crontab.

**T003 remains partial; aggregate G0 is not accepted.** Actual provider backup
coverage/expiry and longest manual/downloaded/replicated retention remain unknown.
Fresh live quota/package CPU/process/I/O limits are not established by the cache.
Complete encrypted backup, ledger/key recovery, representative load and real
application/provider acceptance retain their later implementation tasks. Synthetic
snapshot/TLS checks do not establish production restore or OAuth login.

No existing games, analytics, player data, global Apache rules, certificate paths,
permissions or ownership were changed. No game deployment or provider change
occurred. Detailed operator records remain private. No SSH activation or credential
input is needed; continue independently ready development.

## Initial access and scope (historical)

No GoDaddy connector or SSH alias was found. Browser inventory failed with
`CUA_REPL_ENABLED_SURFACES is required`; this does not establish the owner's login
state. Adjacent website operator metadata identified an existing private connection
configuration and known-host file. Existing Python/Paramiko used SSH-agent
credentials with `allow_agent=True`, `look_for_keys=False` and strict known-host
checking. Authentication succeeded; `exec_command('pwd', timeout=10)` timed out.
The script stopped, so `command -v php` and `php --version` **never ran**. The first
timeout did not identify its cause. A separate, bounded SFTP connection succeeded.
The later terminal diagnostic below establishes an account shell restriction; it
does not establish why the original request timed out.

The [loop note](../../implementation/loops/003-T003.md) records exact local operator
pointers and commands. No key file/keychain was opened, credential/environment
values emitted, private website material imported, remote write/probe performed,
analytics endpoint/database queried, or deployment script executed. The historical
website PHP/PDO SQLite claims and [local runtime checks](runtime.md) are not current
host evidence. No private game test path was safely identified for writing.

## Loop 005 — terminal retry and concrete access blocker

Date: 2026-11-25. Worker: `/root/loop005_t003_retry`. The owner reaffirmed the
existing GoDaddy box and asked what account setting was needed. This retry used
the same existing private operator pointers and SSH agent, strict known-host
checking, `allow_agent=True` and `look_for_keys=False`. No key file or keychain was
opened, and no credential value was emitted. Raw remote output was processed in memory;
only execution-marker results, response sizes, exit state and allowlisted
restriction classifications were emitted.

| UTC interval | Distinct bounded attempt | Observed result |
| --- | --- | --- |
| 19:02:20–19:02:33 | One connection; session, `get_pty(term='dumb')`, then `exec_command` with a harmless printf marker | Authentication, PTY and exec requests accepted. No execution marker observed within six seconds. |
| Same connection/interval | New session; `invoke_shell()` without PTY, then a harmless printf marker | Shell request and send accepted. No execution marker observed within six seconds. |
| 19:03:07–19:03:18 | Final diagnostic connection; session, PTY, `invoke_shell()`, marker send and response classification | Requests accepted. Response: 128 stdout bytes, zero stderr bytes; channel closed, exit status 0; no execution marker. Allowlisted classifiers matched `shell_access_disabled` and `contact_support`. |

Authentication was bounded to 18 seconds overall per connection, with 10-second
connect/auth/banner timeouts. Channel requests had eight-second bounds. The final
response collection had a 12-second maximum and 32-KiB safety limit. Both
connections closed. No identical bare `pwd` retry or further authentication loop
was attempted. The final diagnostic was justified by the first connection's
accepted requests without a confirmed command result.

The response establishes **disabled account shell access**. SSH request acceptance
and an exit status of zero do not establish command execution: the marker never
appeared. SFTP remains the previously observed working access method. This result
does not prove that the server itself supports only SFTP, that PHP is absent, or
that another host/database is needed. No PHP, SQLite, quota, cron or outbound-TLS
probe ran. No remote game directory, file, scheduled job or configuration was
created or changed.

### Loop-005 owner action (historical; superseded by loop 006)

Use the existing hosting account for `automateyournetwork.com`:

1. Open GoDaddy **My Products** and find **Web Hosting**.
2. Select **Manage** beside the existing **Web Hosting (cPanel)** account.
3. Open **Settings**, then **Manage** beside **SSH access**.
4. Turn the **SSH access** switch on. If it is already on, leave it on and use
   the support diagnostic below; do not cycle the switch or reset credentials.

These are the current official [GoDaddy SSH-enable steps](https://www.godaddy.com/help/enable-ssh-for-my-web-hosting-cpanel-account-16102),
retrieved 2026-11-25. The only immediate owner input needed is whether this switch
was off and is now on, or was already on. Existing agent authentication works;
no password, private key, new hosting purchase or credential reset is needed for
this diagnostic. An enabled switch is an input to a fresh bounded verification,
not itself proof that host execution or G0 passes.

If the switch is already on but shell access remains disabled, the owner can give
GoDaddy support this non-secret description: “SSH-agent authentication and SFTP
work. PTY/shell requests are accepted, but the account reports disabled shell
access and closes before executing a printf marker. Please check shell access for
this existing cPanel account.” No support message was sent by the agent.

As an optional direct check, open **cPanel → Advanced → Terminal**, if present.
cPanel documents that Terminal requires shell access and the provider-enabled
SSH Access & Terminal feature. An absent Terminal option would not by itself
diagnose which prerequisite is missing. See the official
[Terminal instructions](https://support.cpanel.net/hc/en-us/articles/1500006547541-How-do-I-access-the-terminal-within-a-cPanel-account)
and [feature requirements](https://docs.cpanel.net/cpanel/advanced/terminal-in-cpanel/).
Do not ask the owner to discover PHP versions, private paths or database details
before resolving this concrete access switch. H02–H04 remain later audit work.

## Loop 006 — owner enabled SSH; current account still has no shell

The owner said **“SSH access is now on”** and requested checking the adjacent
`private website workspace` setup. This new input justified one fresh bounded verification,
not a repetition based on unchanged evidence. The existing SSH-agent credentials
and strict known-host record were reused; no password, private key, keychain or
credential value was exposed. No provider, PHP or website setting was changed.

| UTC interval, 2026-11-25 | Actual check | Observed result |
| --- | --- | --- |
| 19:08:08–19:08:19 | Authenticated fresh SSH connection, non-PTY exec with `printf 'NQ_%s_OK\n' HOST_EXEC` | No assembled marker; zero stdout/stderr bytes; closed channel and exit 0. Request acceptance/exit 0 did not prove execution. |
| 19:08:43–19:08:55 | Fresh SSH connection, `get_pty(term='dumb')`, `invoke_shell()`, assembled `HOST_SHELL` printf marker | No marker; 128 stdout bytes, zero stderr bytes; closed channel, exit 0. Allowlisted classifiers matched `shell_access_disabled` and `contact_support`. |
| Same second connection | Bounded SFTP read of `/etc/passwd`, filtered in memory to exactly the configured account | Exactly one matching account; assigned shell **`/usr/local/cpanel/bin/noshell`**. No other account records, username, home path or raw file text emitted or retained. |

Connections had 10-second connect/auth/banner bounds, eight-second channel bounds,
10-/12-second response windows, and 35-/40-second overall alarms. Markers were
assembled by printf; the full expected strings were absent from sent commands, so
terminal echo could not count as execution. Both connections closed. No further
SSH retries, remote writes, public probe uploads or credential resets followed.

The current account-shell observation confirms the restriction independently of
the terminal response. cPanel documents that disabled jailed-shell accounts use
`/usr/local/cpanel/bin/noshell`, and that enabled jailed shells use
`/usr/local/cpanel/bin/jailshell`. This is a provider/account provisioning issue to
resolve; it is not evidence that PHP or SQLite is missing. See cPanel's
[VirtFS shell mapping](https://docs.cpanel.net/knowledge-base/accounts/virtfs-jailed-shell/)
and [shell-access error remedy](https://support.cpanel.net/hc/en-us/articles/360050489653-Shell-access-is-not-enabled-on-your-account),
retrieved 2026-11-25.

### Relevant website setup context, not current runtime proof

Authorized local review covered the website README/deployment instructions,
`discovery/CONNECTION_STATUS.md`, `discovery/SSL_STATUS.md`, backup-status metadata,
the PHP README and existing SSH connection call. No website script was executed,
private website implementation copied, archive opened or analytics data queried.

- The connection record describes an earlier dashboard-enable attempt that still
  left the account at `noshell`. That history explains the known setup; the fresh
  SFTP observation above establishes the account's current shell.
- Deployment instructions retain the old WordPress rollback and a manual
  full-account backup outside docroot, plus a downloaded application archive.
  They defer deletion until migration/recovery acceptance and state no timed
  expiry. These records identify manual/local copy categories to include in H04;
  they do not prove their current contents, present recoverability, future game
  inclusion or any finite maximum retention. No backup contents were opened.
- The PHP README describes the existing website's PDO SQLite service and private
  analytics storage. This supplies an isolation boundary, not today's PHP version,
  loaded-library report or permission to reuse its database/path.
- Historical SSL instructions used cPanel API access and a timer on a separate
  development environment. That is not evidence of a current hosting cron job.
  A bounded search of the named local setup/script locations did not locate a
  usable current cPanel API client/credential pointer. No API authentication was
  attempted, and absence from this search does not prove the account lacks APIs.

The narrow read-only fallback therefore yielded no actual PHP, library, quota or
scheduler report. No dedicated game-only non-public probe parent was established;
no locking/database fixture was created. Existing loop-003 HTTPS/path observations
remain earlier evidence and were not needlessly repeated.

### Loop-006 external input (historical; superseded by loop 016)

Leave the GoDaddy SSH switch on. Ask GoDaddy to **provision the supported shell
for this existing cPanel account and verify an SSH command executes**. The owner
can supply this non-secret diagnostic; no message has been sent by this agent:

> SSH access is On in my GoDaddy dashboard. SSH-agent authentication and SFTP work,
> but a fresh PTY session still reports disabled shell access. The current account
> entry is assigned `/usr/local/cpanel/bin/noshell`. Please provision the supported
> shell for this account, preferably jailed shell if supported, and verify that
> `printf 'NQ_%s_OK\n' HOST_EXEC` prints `NQ_HOST_EXEC_OK`.

cPanel places this change in the provider/administrator's
[Manage Shell Access](https://docs.cpanel.net/whm/account-functions/manage-shell-access/)
interface. This audit does not assume the owner has WHM access. The requested input
is confirmation that the account shell was corrected and a command now executes,
not another toggle attempt, new credentials, a hosting purchase or a list of
unfamiliar PHP settings. The cause/timing of the GoDaddy toggle-to-shell mismatch
has not been established. After that external state change, rerun the marker once
and then the allowlisted capability report. H02–H04 still need actual evidence.

## Loop 016 — effective SSH and CLI runtime verified

The owner explicitly requested **“try ssh now”**, then supplied corroborating
website-agent evidence of successful SSH, identity and PHP CLI commands on
November 25 with no remote files changed. That owner report is separate from the
following directly observed results. The owner also authorized continued
development and eventual release after acceptance; this loop remained read-only
and did not activate a release or run any historical deployment script.

| UTC interval, 2026-11-25 | Directly observed check | Result |
| --- | --- | --- |
| 21:19:40–21:19:41 | Fresh SSH-agent connection; assembled unique printf marker followed by `pwd` | Marker present, absolute working-directory response, exit 0. Authentication and real execution both pass. |
| 21:20:58–21:21:00 | Discover command paths; run allowlisted PHP reports with both observed binaries; bounded own-account SFTP shell lookup | Both binaries return the same CLI runtime below. One matching account entry still says `/usr/local/cpanel/bin/noshell`; this metadata does not override executed commands. |
| 21:22:27–21:22:33 | Read-only PHP mapping/quota UAPI, crontab, filesystem capacity/type, home/candidate metadata and in-memory encryption check | CLI crypto feasibility passes; cron list is empty; candidate private directory absent. UAPI returns no JSON, exit 2. |
| 21:23:59–21:24:00 | One diagnostic UAPI retry with in-memory stderr classification | Exit 2; zero stdout bytes, 253 stderr bytes; recognized **“No such file or directory”**. No authentication, permission, unknown-option, syntax, missing-Perl-module or shared-library classifier matched. |

Connections retained `RejectPolicy`, the existing pinned known-host file,
`allow_agent=True` and `look_for_keys=False`. Connect/auth/banner bounds were
8–10 seconds; channel bounds 5–8 seconds; collection windows 6–12 seconds;
overall alarms 25–55 seconds. Only sanitized measurements were emitted. Several
successful commands emitted 45 stderr bytes whose contents were withheld; exit
status, valid JSON and expected markers are recorded rather than assuming empty
stderr. No private key, raw account configuration, absolute hosting home,
crontab contents, credentials or remote terminal transcript was copied.

### Actual CLI report

Both `/usr/local/bin/php` and `/opt/cpanel/ea-php84/root/usr/bin/php` exist and
execute as **PHP 8.4.28, SAPI `cli`**, loading
`/opt/alt/php84/etc/php.ini`. The `php84`/`php83` command names and the explicitly
checked ea-php83 binary were not found; this is a bounded lookup, not a full
installation inventory.

- PDO drivers: `mysql`, `sqlite`. Loaded extensions include PDO, pdo_sqlite,
  sqlite3, pdo_mysql, openssl, curl, mbstring, json, session, ctype, filter, hash
  and iconv. Their reported extension versions are 8.4.28. No database was opened.
- `SQLite3::version()` reports **3.54.1 / 3054001**. This is the SQLite3
  extension's library report; `SELECT sqlite_version()` through PDO and actual
  filesystem transactions remain to be checked in a separate disposable store.
- OpenSSL reports **1.1.1w, 11 Sep 2023**. cURL reports **8.23.0**, SSL
  `OpenSSL/1.1.1w`, zlib **1.2.11**. Version strings establish observed libraries,
  not provider patch provenance, outbound TLS or a security-maintenance verdict.
- CLI limits: memory 128M, execution time 0, input time -1, POST 32M, upload 30M,
  timezone UTC, URL fopen enabled, no configured open_basedir and zero disabled
  function names. These are CLI values, not proven web limits or host quotas.
- Sodium is not loaded. OpenSSL lists `aes-256-gcm`; a fresh synthetic random
  key/IV in process memory successfully encrypts/decrypts a fixed audit string,
  and a changed ciphertext byte is rejected. No secret, ciphertext, file or key
  was persisted/emitted. This proves a usable primitive, not backup format,
  streaming, key management, atomic rotation or recovery implementation.

### Read-only configuration, capacity and operator context

`/usr/local/cpanel/bin/uapi` passed the executable check; `command -v uapi` also
found `/usr/bin/uapi`. The documented full-path CLI calls to
`LangPHP php_get_vhost_versions` and `Quota get_quota_info` both failed before
producing JSON. The sanitized missing-file diagnostic is insufficient to identify
the missing runtime path or establish absent API entitlement. Do not treat it as
a PHP/SQLite feature failure. cPanel's [CLI introduction](https://api.docs.cpanel.net/cpanel/introduction)
documents full-path invocation for CloudLinux; the
[virtual-host version operation](https://api.docs.cpanel.net/specifications/cpanel.openapi/php-settings/langphp-php_get_vhost_versions)
describes configuration reporting, which would still not prove actual web SAPI.

`/usr/bin/crontab -l` completed with exit 0 and **zero job lines**, no observed
CRON_TZ/TZ assignment and no no-crontab/denied classification. No job was added or
executed. `/usr/bin/df -Pk` reports **2,112,617,276 KiB total, 1,115,245,088 used,
911,290,892 available, 56% used** on the home filesystem. These are filesystem-wide
figures, not the account's usable quota. `stat -f -c %T` returns `ext2/ext3`; that
label does not prove mount options, durability or independent-process lock behavior.

The hosting home is a writable directory, mode **0711**, not a symlink. Candidate
**`$HOME/network-quest-private` does not exist**. The existing canonical
`public_html` observation is retained below, but all public roots/aliases were
not mapped because UAPI failed. This candidate is an explicit name for subsequent
isolation review, not an approved or created private store. No analytics/rollback
path is a candidate fixture, and no writable private game parent is yet verified.

Authorized local inspection covered the website `DEPLOYMENT.md`,
`operator current-release record`, generic stage/activate scripts, and the newest
release-specific `hello-planet-hero-release` pair. JSON was parsed and scripts
were inspected with AST; none was executed or copied. The records describe
manifest-scoped static-file staging, backup of changed files, checksum checks and
atomic activation while preserving public-root ownership, prior hashed assets,
analytics and unrelated entries. They supply a useful integration pattern, not
permission to replay an old manifest or proof of Network Quest acceptance.
The historical files and release/rollback copies remain private; no finite overall
retention policy was established by this inspection.

### Next scoped host work

Continue independent local foundations. For the separately scoped host probe,
first confirm every public root/alias and the candidate's realpath/ownership/ACLs;
then use a uniquely named game-only private fixture and guaranteed cleanup for
PDO library reporting, competing transactions, busy timeout, rollback and a
consistent encrypted snapshot. An explicitly isolated web report must execute in
the intended PHP handler, emit only allowlisted runtime values, and prove harmless
private-sentinel HTTP denial before removal. A temporary isolated cron fixture
must preserve the existing crontab byte-for-byte and prove the actual PHP binary,
timezone, execution and cleanup. Account quotas and provider/manual/downloaded/
replicated-copy expiry still need account-specific evidence. Actual restore and
independent deletion-ledger/key recovery remain separate acceptance work.

## Public HTTPS observations

All requests were anonymous **HEAD** requests from this Mac. No browser JavaScript
was executed, request body or OAuth parameters sent, or redirects followed. TLS
verification was left enabled. Eight initial requests ran at
**2026-11-25 18:46:37–18:46:40 UTC**; one protocol-specific follow-up ran at
**18:47:30 UTC**. Paths are relative to `automateyournetwork.com`.

| Scheme and path | Observed response | Meaning and limit |
| --- | --- | --- |
| HTTP `/arcade/` | 301; `Location: https://automateyournetwork.com/arcade/`; curl exit 0 | This existing route redirects to canonical HTTPS. |
| HTTPS `/arcade/` | Initial HTTP/2 200 headers, followed by curl exit 16, `Error in the HTTP2 framing layer`; one `--http1.1` follow-up returned 200, curl exit 0 | Existing arcade is reachable through verified TLS using HTTP/1.1. Preserve the HTTP/2 anomaly; do not report the first transfer as clean or infer its cause. |
| HTTPS `/arcade/network-quest/` | HTTP/2 404, curl exit 0 | Proposed detail entry is not currently served at this path. |
| HTTPS `/arcade/play/network-quest/` | HTTP/2 404, curl exit 0 | Proposed static game is not currently served. |
| HTTPS `/arcade/play/network-quest/api/v1` | HTTP/2 404, curl exit 0 | Proposed API base is not currently served. |
| HTTPS `/arcade/play/network-quest/api/v1/session` | HTTP/2 404, curl exit 0 | No current session-route readiness established. |
| HTTPS `/arcade/play/network-quest/api/v1/auth/google/callback` | HTTP/2 404, curl exit 0 | No current callback routing established; no provider flow attempted. |
| HTTPS `/arcade/play/network-quest/api/v1/auth/github/callback` | HTTP/2 404, curl exit 0 | No current callback routing established; no provider flow attempted. |

Responses identify `Server: Apache`. The successful arcade response includes
`Cache-Control: no-cache`, `X-Content-Type-Options: nosniff` and
`Referrer-Policy: strict-origin-when-cross-origin`. No `X-Powered-By` or
`Strict-Transport-Security` appeared in the captured responses. Those observations
do not establish the effective PHP version, all-host header policy, API no-store
behavior or future nested rewrite behavior. HEAD is a route observation, not a
functional GET/API/provider test. The 404s agree with the absent game directories
below; they do not authorize deployment or prove that the host cannot serve them.

Executed request shape, with each table URL substituted literally:

```sh
curl --silent --show-error --head --connect-timeout 8 --max-time 15 \
  --proto '=http,https' https://automateyournetwork.com/arcade/play/network-quest/
curl --http1.1 --silent --show-error --head --connect-timeout 8 --max-time 15 \
  --proto '=https' https://automateyournetwork.com/arcade/
```

## Current filesystem and backup observations

All paths below are relative to the private hosting home, whose absolute path and
account name are intentionally omitted. `lstat` avoids treating a symlink as a
directory. Permission bits are observations, not a complete access-control audit.

| SFTP metadata | Observed result |
| --- | --- |
| Hosting home | Directory, not a symlink, mode 0711. |
| `public_html` | Directory, not a symlink, mode 0750. |
| `public_html/arcade` | Directory, not a symlink, mode 0755. |
| `public_html/arcade/network-quest` | Not found. |
| `public_html/arcade/play/network-quest` | Not found. |
| Filtered immediate home-directory names | No name matching `network[-_]?quest` was returned. This is not a recursive search or proof that no game path exists anywhere. |
| `.cpanel` | Directory metadata exists, mode 0700; contents not opened. |
| One backup-named file outside `public_html` | **1,509,589,559 bytes**, mode **0600**, mtime **2026-09-23 21:50:40 UTC**. Filename/account path withheld; contents not opened or downloaded. |
| Two backup-named directories outside `public_html` | Modes 0700 and 0755 respectively; contents not listed. Neither has been selected as game recovery storage. |
| Root `.htaccess`, bounded read of at most 65,536 bytes, filtered for PHP AddHandler/SetHandler/AddType declarations | No matching PHP handler declaration returned. No file content was retained in this repository. This cannot identify the inherited web PHP configuration. |

The observed file's size and mtime agree with the operator's historical full-account
backup description. That correspondence is an inference from metadata; its
contents, integrity, recoverability and current inclusion policy were not verified.
Its September timestamp shows an older artifact remains present in November, not
a maximum retention period. The audit did not enumerate or read the backup set.
No reliable longest retention, expiration policy or independently protected game
deletion-ledger recovery location has been established.

No existing private game test path was identified sufficiently to authorize an
isolated write/locking probe. No file was uploaded merely to expose `phpinfo()` or
obtain web execution. A nonexistent public game directory is not a private test
location. Existing analytics storage and website rollback locations are not game
test fixtures.

## Capability matrix and remaining evidence

| Capability | Current evidence | Status and required next observation |
| --- | --- | --- |
| Existing host/public origin | Authenticated SSH command execution and SFTP; earlier arcade HTTPS response and HTTP redirect | **Observed, limited.** Product plan/account limits still unknown. |
| Game-only nested routes and callbacks | Proposed paths return 404; game directories absent | **Pending.** Verify scoped route mapping and denial of private paths in isolated game staging after its authorized setup. |
| Web PHP 8.4 supported patch | No trusted execution report; root handler filter inconclusive | **Unverified.** Exact `PHP_VERSION`, `PHP_SAPI`, loaded extensions and relevant limits from the actual game web context, without environment/secret dumps. |
| CLI PHP for maintenance/cron | Loop 016 executes both discovered PHP paths: 8.4.28, CLI, UTC, effective alt-php84 ini | **Observed.** Shell-access blocker resolved. Compare actual web context and prove scheduled maintenance separately. |
| PDO SQLite and linked SQLite | PDO sqlite/mysql loaded; SQLite3 library 3.54.1; no database opened | **Partial.** Obtain PDO `SELECT sqlite_version()` in a new isolated database, not analytics; prove the required transactions. |
| Filesystem locks/durability | Home filesystem type report `ext2/ext3` and metadata | **Unverified.** Confirm mount behavior; prove two independent processes contend correctly and recover in a disposable private game DB. |
| PHP/OpenSSL/cURL/mbstring/JSON and backup encryption | CLI modules and library versions reported; sodium absent; synthetic OpenSSL AES-256-GCM round trip/tamper rejection pass | **Partial.** Actual web modules, backup construction/key management/rotation and recovery still require verification. |
| Outbound provider HTTPS | No host-originated request executed | **Unverified.** Host cURL TLS verification to the relevant Google/GitHub endpoints; this Mac's public curl checks do not count. |
| Private config/data/session/log/ledger paths | Writable hosting home; `$HOME/network-quest-private` absent; all public aliases not mapped | **Pending (H02).** Confirm isolated outside-docroot path, ownership/ACLs and writable limits; test denial using harmless game sentinels, never real secrets. |
| Disk, inode, CPU/RAM/I/O/process and MySQL quotas | Filesystem-wide free space observed; quota UAPI returns missing-file failure | **Unverified (H03).** Actual account plan, used/available limits and throttling evidence remain needed; filesystem totals are not quotas. |
| Cron and cleanup | crontab list succeeds with zero job lines; CLI PHP path/timezone observed | **Partial (H03).** Safe isolated scheduled execution, host scheduler timezone, cleanup, daily maintenance and alerts remain pending. |
| Consistent encrypted backups | Older private artifact metadata only | **Unverified.** Game-specific consistent snapshot, encryption, atomic promotion, rotation, separate recovery/key availability and failures preserving prior good copies. |
| Actual longest retention | Historic archive still present; subscribed backup options unknown | **Blocked.** Inventory all provider/manual/downloaded/replicated copies that could contain future game data, actual expiry/inclusion policy and restore handling. Seven days is only the proposed application policy. |
| Recovery and deletion ledger | No game DB/ledger exists at observed paths; no restore executed | **Pending.** Independent ledger recovery outside DB rollback sets, post-backup deletion replay and isolated restore drill. No RPO/RTO promise proven. |
| 20 mixed sessions, p95 save <2 seconds | No game service or benchmark exists | **Pending later implementation.** Include contention/errors; generic plan limits or a working website cannot establish this result. |
| Analytics isolation | No analytics DB/endpoint accessed, no remote mutations | **Scope preserved.** Future route/storage/job isolation and unchanged-service checks still require their own evidence. |

## Official sources and account-specific limits

Primary sources retrieved 2026-11-25 describe facilities, **not this account's
configuration or entitlement**:

- GoDaddy documents [PHP selection](https://www.godaddy.com/help/view-or-change-the-php-version-for-my-web-hosting-cpanel-16090),
  [modules](https://www.godaddy.com/help/enable-custom-php-modules-12036) and
  [SSH access](https://www.godaddy.com/help/enable-ssh-for-my-web-hosting-cpanel-account-16102).
  None was changed; an account-wide PHP change could affect analytics.
- [Cron documentation](https://www.godaddy.com/en-ph/help/create-cron-jobs-16086)
  gives `/usr/local/bin/php -q` as an example, not an observed binary here.
  [Resource limits](https://www.godaddy.com/en/help/resource-limits-12001) vary by
  plan; inspect [actual usage](https://www.godaddy.com/en-uk/help/check-my-accounts-resource-usage-19126).
  Generic limits do not prove capacity for 20 mixed game sessions.
- [Daily backup documentation](https://www.godaddy.com/en-uk/help/restore-a-site-using-daily-backups-41162)
  describes one-day access; [upgrade options](https://www.godaddy.com/en-ca/help/upgrade-daily-backups-on-web-hosting-cpanel-42579)
  include 7/14/30 days. Neither establishes this subscription, private-path inclusion,
  manual/downloaded-copy expiration or physical erasure. The planned seven-day
  application policy cannot establish the longest overall retention.

## Same-host choice and remaining inputs after loop019

The selected SQLite **DELETE journal, foreign keys, FULL synchronous mode,
250ms busy timeout and short BEGIN IMMEDIATE transactions passed the isolated
checks** in [host-probes.md](host-probes.md). No same-host database replacement is
currently justified. Later representative load and application recovery must test
real service behavior. Any future database change must preserve dedicated game
storage, server-owned identity/revisions, receipt-first replay, conditional writes
and deletion suppression; analytics remains outside scope.

- **H01:** CLI/web versions, required modules, PDO-linked library and host-origin
  TLS are observed. Actual provider callbacks and sign-in remain later flows.
- **H02:** private-path isolation, web writes, two-process contention, bounded
  BUSY, rollback, interrupted-process integrity and consistent snapshot primitive
  pass. These are not a power-loss durability or full recovery guarantee.
- **H03:** cron actually executed and was fully removed. Dated account cache
  establishes observed disk/inode limits; current adjusted quota and CPU/process/
  I/O limits remain unverified. The local UAPI wrapper has a missing backend.
- **H04:** establish actual provider inclusion/expiry and longest manual/downloaded/
  replicated-copy retention. Existing website backups cover public-root changes,
  not the planned game-private parent. Future game implementation must provide
  encrypted consistent snapshots, independent ledger/key recovery, rotation,
  failure handling and isolated deletion-aware restore before release.

Historical access failures and no-write statements above describe their dated
attempts. Loop019's scoped synthetic writes and verified cleanup supersede those
statements for the current overall audit. Independent local development continues;
missing retention evidence does not block unrelated game code.
