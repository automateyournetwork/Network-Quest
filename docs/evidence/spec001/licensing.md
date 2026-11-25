# T010 — licenses, notices and production-image terms

Reviewed 2026-11-25 by `/root/loop012_t010`. Scope: C13 (with C2/C5/C11),
FR-023/024 and AC16/17/19, local W01/G0 preparation. **T010 scoped result: PASS;
G0 remains BLOCKED.** This is a source/licensing record, not legal advice,
per-asset clearance, a redistribution warranty or production-release acceptance.
The task uses the explicit T008 → T009/T010 → T011 setup exception. No foundation,
gameplay, publication, provider registration or generation was performed.

## Original work and downstream reuse

- `LICENSE` is the complete unchanged [Apache License 2.0, January 2004](https://www.apache.org/licenses/LICENSE-2.0.txt).
- `LICENSE-ASSETS` is the complete unchanged [CC BY 4.0 International legal text](https://creativecommons.org/licenses/by/4.0/legalcode.txt).
- `NOTICE` applies those terms only to original project-controlled work, retains
  third-party exceptions and supplies attribution. `CONTRIBUTING.md` specifies
  inbound reuse authority, modifications/credit, reference rights, genuine sources,
  generated-media limitations and public retrieval of large editable sources.
- [License source records](../../../licenses/license-text-sources.json) preserve
  actual retrieval URLs, date, byte size and SHA-256, including the full MPL text.
  Official CC text returned HTTP403 through Python's default HTTP client; curl
  retrieved the complete official text successfully. No substitute summary was used.
- Existing native feasibility sources and notices are unchanged. The
  [T005 report](media-feasibility.md) retains all voice/model/source limitations.

## Actual dependency review

The final inventory joins T008's actual npm lock and T009's stable Composer lock:

| Input | SHA-256 | Coverage |
| --- | --- | --- |
| `package-lock.json` | `e7c525a1ac0381f293414b950261cb4814491f9563dd30dda9d3946b3127c9cd` | 109 packages: 59 installed, 50 optional packages inspected through SRI-verified public archives |
| `server/composer.lock` | `0fa6d980d1b29a859a425e0d863268e71d082b0694423d6213f7a4dfdf503007` | 45 installed packages: 20 production, 25 development |

There are 203 byte-preserved legal files, about 2 MiB including inventories/source
records. The readable [package index](../../../licenses/DEPENDENCIES.md) links each
package's notices; [dependency-inventory.json](../../../licenses/dependency-inventory.json)
retains package identities, license labels, immutable source/archive retrieval and
notice hashes. The labels are MIT, Apache-2.0, BSD-3-Clause, ISC, 0BSD and MPL-2.0;
none is silently relabeled as original project code.

Actual notice files include bundled-component copyrights that a package's top-level
label omits. Legal filename discovery includes both LICENSE and LICENCE. The first
inventory attempt correctly failed on `@napi-rs/wasm-runtime`'s missing published
license; obtained the MIT notice from its exact gitHead/peeled tag and recorded
that exception. Rolldown native bindings similarly use the same-version wrapper's
supplied notices, explicitly identified in the inventory. No package was modified.

The 14 MPL lock entries represent axe Playwright, axe-core, Lightning CSS and 11
Lightning CSS native variants. All currently have the development flag. Complete
MPL text/notices and corresponding editable source retrieval are supplied in
[THIRD-PARTY-NOTICES.md](../../../THIRD-PARTY-NOTICES.md#mpl-20-components).
Three pinned upstream source archives were downloaded without credentials and
inspected: five Playwright TypeScript files, 517 axe-core JavaScript files and 112
Lightning CSS Rust files matched the declared source directories. These are source
presence observations, not independent rebuilds of upstream native binaries.

## OpenAI production image terms

The actual `image_gen__imagegen` tool is available in this session. No image was
generated during T010, and no model/version, subscription, enterprise entitlement,
account domicile or custom order form is inferred from tool availability. No
registration, purchase, player key or new account is needed for this review.

Official primary pages inspected on **2026-11-25**:

| Source | Displayed version/effective date | Relevant scope |
| --- | --- | --- |
| [Terms of Use](https://openai.com/policies/terms-of-use/) | Published/effective 2026-01-01 | Individual services; Content and Using our Services |
| [OpenAI Services Agreement](https://openai.com/policies/services-agreement/) | Updated 2025-12-01; effective 2026-01-01 | Business/developer services; §§3, 4 and 12 |
| [Service Terms](https://openai.com/policies/service-terms/) | Updated 2026-11-13 | Precedence, image/video inputs, code generation and specific service exceptions |
| [Usage Policies](https://openai.com/policies/usage-policies/) | Effective 2026-11-20 | Applicable content/use restrictions |
| [Sharing & Publication Policy](https://openai.com/policies/sharing-publication-policy/) | Updated 2022-11-14 | Public sharing/disclosure and review |

The individual Terms allocate input ownership to the user and assign OpenAI's
interest, if any, in output to the user, subject to law. They require input rights,
output evaluation and truthful AI-origin representation. They also say outputs may
be similar and exclude other users' and third-party output from that assignment.
This supports reuse of one's own reviewed output within the applicable conditions;
it does not establish exclusive copyright or clear a reference image's rights.
[Terms of Use](https://openai.com/policies/terms-of-use/)

For business/developer use, Services Agreement §§4.1–4.4 gives the comparable
input/output allocation while requiring authority for inputs and responsibility
for output use/evaluation. Section 12 disclaims non-infringement warranties except
as expressly stated. The common public provisions support the planned production
image workflow; account-specific terms were not inspected and are not represented
as known. No particular indemnity or custom contractual benefit is claimed.
[Services Agreement](https://openai.com/policies/services-agreement/)

Service Terms take precedence where they conflict with the governing agreement.
Image/video inputs require necessary rights/consent for reproducing a person's
likeness. Sharing another person's image on the service does not grant permission
for outside reuse. Code-generation output can contain separately licensed code;
ChatGPT Voice has different restrictions and is not the selected local TTS workflow.
The image review is not a blanket license for every service's output.
[Service Terms](https://openai.com/policies/service-terms/)

Follow the current use restrictions and record genuine manual review/AI disclosure
when sharing. For this project, C11/C13 additionally requires the actual prompt,
references and their rights, original generated file, date/known metadata, edits,
source/hash/credit and per-image acceptance. The public image terms inspected do
not impose a noncommercial-only condition on ordinary own-image output. That is a
bounded text-review finding, not a guarantee of copyrightability or freedom from
third-party claims. The CC BY offer conveys only project-controlled rights and
does not invent copyright in otherwise unprotected portions.
[Usage Policies](https://openai.com/policies/usage-policies/),
[Sharing & Publication Policy](https://openai.com/policies/sharing-publication-policy/)

**R10 terms-review gap: addressed at G0 preparation scope.** Public governing
paths/common output terms and their limits are now recorded. Actual production
provenance must identify the service used and recheck then-applicable terms or any
known account-specific override. That is the normal per-image acceptance step,
not an invented account-registration or approval blocker. Image generation,
visual acceptance and source quotas remain later tasks.

## Privacy, retrieval and executed verification

`.gitignore` already excluded secrets, local configuration, databases, runtime
environments, dependencies, builds, sessions and backups. Added `.cache/`, named
private/player-data/secrets directories, dump/backup database suffixes, npm private
configuration and Composer auth files. Authored `.blend`, `.aup3`, `.aup4`, images,
audio, model-source records, license copies and ordinary SQL migrations remain
trackable. No blanket source/media/archive exclusion was added.

The contributor policy requires anonymous public immutable source retrieval with
size/SHA-256/license records, clean download and actual reopening before release.
The existing small native fixtures stay in Git; model/tool environments stay ignored.
No large-source service/archive was published. The checked MPL source archives
remain only in ignored `.cache/license-review/`; no runtime binaries or model
weights were added to the repository.

Executed checks and final results are recorded in
[loop 012](../../implementation/loops/012-T010.md). The inventory verifier covers
both exact lock sets and all copied hashes. Ignore probes use synthetic paths and
read no credentials or player data. Lock/manifests and `server/` were not edited.
No application/browser tests were warranted by this licensing-only change.

Remaining release work: audit the final delivered bundle and imported scaffold/media,
provide notices/source for what actually ships, verify public large-source retrieval,
and accept each production asset. T005 human listening and the other external G0
capabilities remain separate open evidence. **No gate is passed by this report.**

Copyright 2026 John Capobianco. Original report text: CC BY 4.0.
