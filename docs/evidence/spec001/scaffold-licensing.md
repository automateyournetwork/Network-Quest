# Spec Kit scaffold publication review — T010 follow-up

Reviewed 2026-11-25 in loop 021. **The existing local Spec Kit scaffold can be
included in the reviewed public source checkout with its preserved MIT notice.**
This closes the scaffold-notice omission in T010; it does not approve unrelated
operator records, a game release or any aggregate gate.

## Source and actual license

The local init and integration records identify Spec Kit `0.7.1.dev0`. The
installed CLI's distribution metadata identifies the official Git repository
and commit `2f5417f0addba343b07c8f805b6b30159cab1dad`; the pinned upstream
`pyproject.toml` independently has that version. This is a development version,
not an invented stable release tag.

An anonymous download of the [official immutable source archive](https://codeload.github.com/github/spec-kit/tar.gz/2f5417f0addba343b07c8f805b6b30159cab1dad)
was inspected without extracting or running its code. Archive size: 2,670,791
bytes. SHA-256: `b658097ddb4c5b489f6cbe825670048b47822148a5e886bb72ce731cedbe73e3`.
The archive remains in an ignored local cache; no CLI, environment or archive
is included by this change.

The complete [MIT license at that revision](https://github.com/github/spec-kit/blob/2f5417f0addba343b07c8f805b6b30159cab1dad/LICENSE)
is copied byte for byte to [licenses/scaffold/spec-kit/LICENSE](../../../licenses/scaffold/spec-kit/LICENSE).
It preserves **Copyright GitHub, Inc.**, the permission conditions and disclaimer.
The MIT text requires retaining its copyright and permission notice with copies
or substantial portions. The root original-work licenses do not replace it.
Copy size: 1,061 bytes. SHA-256:
`d593b55e21973e1e19e80dc3b55a908f474b265300f8d34c54d1b9e3a5a4a48f`.

The pinned [Git extension manifest](https://github.com/github/spec-kit/blob/2f5417f0addba343b07c8f805b6b30159cab1dad/extensions/git/extension.yml)
identifies Git Branching Workflow `1.0.0`, `spec-kit-core`, the same repository
and MIT. All 17 local extension files match that source byte for byte; the local
registry's `source: local` denotes installation origin, not a different copyright
owner. The copied workflow identifies Full SDD Cycle `1.0.0` and GitHub.

The source archive contains root `LICENSE` and an unrelated
`extensions/template/LICENSE`; the extension-authoring template is absent from
this project. No separate LICENSE, NOTICE or COPYING accompanies the copied
Git extension, core templates/scripts, Codex integration scripts or workflow.
No additional third-party notice was found within this bounded copied subtree.

## Files, generated wrappers and project changes

[scaffold-provenance.json](../../../licenses/scaffold-provenance.json) records
every one of the 54 existing `.agents/` and `.specify/` files, their local
SHA-256, upstream paths/hashes where applicable and installation hashes where
available. This is a point-in-time provenance record; subsequent edits should
update it and retain this review's history.

| Classification | Files | Evidence |
| --- | ---: | --- |
| Byte-identical upstream files | 27 | Five core Bash scripts, two unchanged templates, two Codex scripts, 17 Git extension files, one workflow |
| Generated core skills unchanged since installation | 7 | Current SHA-256 equals the recorded integration installation hash; source metadata points to the pinned command templates |
| Migrated Git skills | 5 | Their bodies equal the pinned command bodies after removing YAML frontmatter and outer whitespace |
| Project-modified source derivatives | 6 | Two core skills and four templates differ from installation hashes |
| Generated installation/configuration records | 8 | Metadata and selected defaults; no standalone upstream file claimed |
| Original project constitution | 1 | Project-authored governance, separately identified as CC BY 4.0 |

The exact tool/version used to migrate the five Git skill wrappers is **unknown**.
Their `metadata.source` identifies the bundled commands, and the body comparison
establishes the copied content. The wrapper conversion is not claimed to be
independently authored game code or a new upstream release. Core skill generation
also substitutes project paths, shell commands and arguments; it is not evidence
of a separate copyright owner.

The six project changes, already present before this review, are:

- `.agents/skills/speckit-implement/SKILL.md`: dependency-ordered execution batches,
  scoped checkpoints and continuation of independent work.
- `.agents/skills/speckit-tasks/SKILL.md`: constitutional verification, source-first
  cases, episode evidence and actual acceptance coverage.
- `.specify/templates/agent-file-template.md`: governing-contract instructions.
- `.specify/templates/plan-template.md`: project architecture, constitutional
  gates, traceability and evidence requirements.
- `.specify/templates/spec-template.md`: project scope, teaching, persistence,
  media, access and release criteria.
- `.specify/templates/tasks-template.md`: project paths, required verification,
  evidence and episode-completion boundaries.

The original explanatory prose added by Network Quest remains within its
CC BY 4.0 offer. Underlying upstream content remains MIT. Existing project docs
created using these templates are not relabeled wholesale as original third-party
software, and generated headings do not remove the upstream attribution. See
[THIRD-PARTY-NOTICES.md](../../../THIRD-PARTY-NOTICES.md#spec-kit-development-scaffold)
and [NOTICE](../../../NOTICE).

## Public/private boundary

Keep `.specify/memory/constitution.md`, the supporting local scaffold, AGENTS and
the public handoff/evidence links available in the source checkout. Blanket
exclusion of `.specify/` or `.agents/` is unnecessary and would break governance
and contributor workflows. Agent commands are development source; the game
runtime package need not include them. The local manifests contain tool versions,
hashes, installation dates and selected defaults, not credentials. Auto-commit
configuration remains disabled; no hook was executed by this review.

The candidate-path review identified existing implementation/host records that
need narrowly scoped public sanitization of operator metadata and local machine
paths. The coordinator received filenames/line references only. Preserve the full
operational record privately and retain the public capability results, unresolved
gates and local documentation links. Do not delete evidence wholesale or publish
private operator configuration alongside it. Review the final staged diff after
sanitization; this bounded check is not a whole-repository secret-scan certificate.

No `.env`, private OAuth/website configuration, player data or unrelated user-level
skill root was read. Only the installed Spec Kit CLI's package provenance metadata
outside the repository was consulted; those machine paths are not copied here.
Ignored caches/environments remain private. No ignore rule, scaffold source,
tracking file, plan, constitution, application code or schema was changed.

## Verification and limits

The [loop 021 record](../../implementation/loops/021-T010.md) records executed
checks. The unchanged npm/Composer 154-package inventory and 203 notices were not
downloaded or audited again. This review adds one scaffold license and an
independent provenance manifest; it does not change those dependency counts.

The coordinator still owns the exact staging decision, commit and push. No staging,
Git commit, remote mutation, installation, media generation or publication occurred
in this loop. G0–G7 and production-media/owner acceptance remain as recorded by
their own tasks.

Copyright 2026 John Capobianco. Original report text: CC BY 4.0.
Third-party license text and upstream portions retain their MIT terms.
