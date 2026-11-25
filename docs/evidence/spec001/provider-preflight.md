# Spec001 provider registration preflight — T004

Date: 2026-11-25. Worker: `/root/loop004_t004`. Baseline commit:
`d4482767aa3c9c794d1cf28d61b40f8aba2279c7`. Coverage: W01/G0,
C6/C12/C13/C15, FR-011/015/016, NQ-10 and the prerequisites for AC11/17.
Contracts: [research R04–R05](../../../specs/001-physical-layer-underworld/research.md),
[API](../../../specs/001-physical-layer-underworld/contracts/game-api.openapi.yaml),
[delivery](../../../specs/001-physical-layer-underworld/contracts/delivery.md).

## Result and observed access

**Partial, updated after owner follow-up:** both OAuth pairs are now stored
privately. The owner explicitly confirmed dedicated Network Quest **production**
registrations using the exact callbacks in the setup guide. This is owner-reported
registration evidence; console settings and real flows have not been independently
inspected or exercised. Least-privilege controls, development/staging registration
and host-originated TLS remain open. The initial audit observations below are
historical and are superseded where the follow-up says so. T004 remains unchecked;
neither G0 nor AC11 passes from credential presence alone.

| Executed check | Result and limit |
| --- | --- |
| Repository prerequisites/checklists | Feature prerequisite script succeeds; requirements 16/16; remediation has no unchecked items. |
| Dedicated local configuration metadata, 18:53:49 UTC | `.env`, `.env.local`, `server/config.local.php`, `server/config.example.php`, `.local` and `server` absent. `.runtime` exists for tooling. No credential file contents opened. |
| Environment names only | Zero variables with both `QUEST`/`GAME` and `GOOGLE`/`GITHUB`/`OAUTH`/`OIDC` in their names. Values were neither read nor emitted. This bounded check cannot rule out an unknown external secret location. |
| `gh auth status --active` | CLI exists; exit 0 and active login reported. Output captured and reduced to booleans; account names, tokens and scopes suppressed. CLI login does not prove game OAuth-app ownership or permission to administer it. |
| `gcloud auth list --filter=status:ACTIVE --format=value(status)` | CLI exists; exit 0, no active account reported. No account/project inventory, login, token acquisition or IAM inspection attempted. |
| Available connector tool names | No GitHub or Google Cloud OAuth administration connector found. |
| Browser access | T003 recorded `CUA_REPL_ENABLED_SURFACES is required`; unavailable surface not retried. Browser login state is unknown. |
| Ignore checks | `git check-ignore` confirms `.env`, `.env.local`, `server/config.local.php`, `.local/provider-secrets.json`, `.runtime/provider-secrets.json` are ignored. Example paths were not created. Ignore rules alone do not secure deployed storage. |
| Owner-requested sibling-project discovery, later in this loop | Bounded scan of 65 immediate sibling project roots and 65 non-example `.env`/`.env.*` files found two Google AI/API-key entries, no Google OAuth client ID/secret pair and no service-account reference. Values were parsed privately for classification, never output, retained or reused. Paths/key names only are in ignored `<ignored-private-discovery-record>`, mode 0600. This is not a whole-disk or Google-account inventory. |
| Existing host evidence | [T003 host audit](host.md): both callback paths returned anonymous HEAD 404; no game deployment at observed paths. Reused those observations without repeating probes. Host-originated provider TLS remains unverified. |
| Primary documentation | Official Google/GitHub pages and Google's public discovery document retrieved on this date; links below support the settings contract, not account readiness. |

No registrations, consent publication, authorizations, credentials, deployments or
messages to third parties were created. The owner explicitly authorized the later
bounded `.env` discovery; no discovered credential was copied or reused. No game
code or mock/provider-flow test ran. The [setup guide](../../setup/oauth.md) supplies
official console links and manual registration steps without claiming setup is done.

## Exact route and environment contract

These defaults agree with the API and delivery documents. The owner confirmed these **production registration values** after the initial
audit. The agent has not directly inspected their console registration or exercised
working endpoints.

| Setting | Exact production value |
| --- | --- |
| Origin | `https://automateyournetwork.com` |
| Game/homepage candidate | `https://automateyournetwork.com/arcade/play/network-quest/` |
| Public detail/homepage alternative | `https://automateyournetwork.com/arcade/network-quest/` |
| API base | `https://automateyournetwork.com/arcade/play/network-quest/api/v1` |
| Google authorized redirect URI | `https://automateyournetwork.com/arcade/play/network-quest/api/v1/auth/google/callback` |
| GitHub authorization callback URL | `https://automateyournetwork.com/arcade/play/network-quest/api/v1/auth/github/callback` |

Callbacks use GET, have no trailing slash or static query/fragment, and must match
the configured server value. Auth starts at CSRF-protected POST
`/auth/google/start` or `/auth/github/start` under the API base. Do not register the
start, session, detail or game root as a callback. Do not derive callback origins
from untrusted request headers or accept arbitrary return URLs. The separate sign-in
window returns a minimal completion page; the game verifies identity through
`GET /session`. Guest memory remains in the game tab.

Google requires an exact redirect match, including scheme, case and trailing slash.
See [Google OIDC redirect parameters](https://developers.google.com/identity/openid-connect/openid-connect#authenticationuriparameters).
Use exact configured callbacks for both providers. Local HTTPS/staging origin,
port, certificate trust and environment-to-client assignments are **not selected or
registered**. Preserve the same nested path and Secure cookies when those inputs
are supplied; do not add a guessed localhost callback or relax TLS to pass a test.

## Google settings to verify with the owner-controlled project

| Control | Required game setting / current status |
| --- | --- |
| Ownership | Dedicated Network Quest project/client, controlled by the owner with the ability to manage OAuth configuration. Project/client reference and administrator role unverified. |
| Client type | Web application, confidential server authorization-code flow. No service-account or browser-token replacement. Client ID and private server secret readiness unverified. |
| Audience | External for this public game. Testing during pre-release work; no publication authorized here. Internal/Personal cannot serve the intended public audience. Console setting unverified. |
| Scopes | Exactly `openid profile`; profile supplies an optional display name. No `email`, offline access or unrelated API scopes. Check both Data Access and actual generated request; console labels alone do not prove runtime scope. |
| Redirect | Exact Google URL above for the production client; no wildcard or extra environment URI. |
| Browser origins | No authorized JavaScript origins needed by the selected backend-only flow; none proposed. Adding a browser flow would require a separate reviewed design. |
| Branding | Network Quest name, owner-managed support/developer contacts, verified domain `automateyournetwork.com`, reachable app description and privacy link; terms if supplied. Actual values/status unverified; private addresses omitted. |
| Environment separation | Separate Google projects for testing and production; exact mapping pending. No testing redirects in the production client. |

Google documents the [web application client type and private credential handling](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)
and [OIDC identity scopes](https://developers.google.com/identity/openid-connect/openid-connect).
The repository's no-email/no-offline choice remains binding; a provider example
requesting wider access is not the game configuration.

[Google's audience guidance](https://support.google.com/cloud/answer/15549945)
distinguishes External, Internal and Personal. It also explicitly exempts requests
limited to basic OIDC identity scopes from the usual Testing user-list warning and
seven-day authorization expiry behavior. Therefore, do not report a mandatory
seven-day expiry or 100-listed-tester limit for this exact identity-only request.
That exception does not prove this project's settings or remove user/organization
account restrictions; later tests still need willing, distinct provider accounts.

[Production policy](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)
requires separate test/production projects and a public homepage on an owned,
verified domain with a privacy link. The candidate game/detail pages currently
return 404 per T003, so that publication prerequisite is not met by naming a URL.
[Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
is separate from scope verification. External production display of the name/logo
may require brand review; identity-only scopes do not establish completed branding
approval. No consent app was published or submitted.

## GitHub settings to verify with the owner-controlled OAuth app

| Control | Required game setting / current status |
| --- | --- |
| Ownership/type | Dedicated identity-only OAuth App under the owner-controlled personal account or organization with administration rights; not the `gh` CLI app or an unrelated website app. Actual app/settings pointer and owner role unavailable. |
| Name/homepage | Network Quest; reachable game homepage when ready. Description explains sign-in for the single save. Proposed homepage is not yet deployed. |
| Callback | Exact GitHub URL above; wildcard matching disabled. Keep only the environment's required callbacks. Actual list/wildcard flags unverified. |
| Device flow | Disabled; this game uses the web authorization-code flow. |
| Expiring tokens | Preserve the current default of expiring user tokens when registering. No background refresh or `offline_access` request is needed; discard any returned refresh token with access tokens after identity verification. Actual setting unverified. |
| Scope request | Serialize explicit empty `scope=` with the GenericProvider; never `user`, `read:user`, `user:email`, `repo`, organization, gist, workflow or offline scopes. Verify outgoing request and actual granted scopes later. |
| Identity lookup | Authenticated `GET https://api.github.com/user`; persist stable numeric `id` as a decimal-string subject and only optional display name. No email/repository API calls, no username/email identity key. |

Current [GitHub registration documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
allows up to ten callback URLs and says expiring user tokens are enabled by default.
Separate game apps per environment are the recommended game isolation policy, not
a claim that GitHub permits only one URL. Personal or organization administration
must be verified on the selected app.

[GitHub's flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
supports S256 PKCE and per-callback exact matching when wildcard matching is off.
Older callbacks may have wildcard matching enabled; inspect it explicitly. Omitting
`scope` can reuse previously authorized scopes, so explicit serialization and a
dedicated app matter. Do not claim an empty request removes an existing broad
grant; inspect the grant and fail closed on unexpected permissions during later
flow validation. Avoid increasing privileges to make login work.

[Scope documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
shows that no-scope tokens still allow reading public information; this is not a
token technically restricted to one endpoint. The game limits its use to identity.
[The authenticated user endpoint](https://docs.github.com/en/rest/users/users#get-the-authenticated-user)
returns the public user response without `read:user`/`user`, sufficient for stable
ID. Discard unused fields, including any public email, instead of logging/storing
the whole response.

## Server handoff and evidence still required

The existing API/research contract requires single-use session-bound state, a
ten-minute transaction, S256 PKCE for both providers, and a Google nonce.
[Google's live discovery metadata](https://accounts.google.com/.well-known/openid-configuration)
advertises S256 and these endpoints:

| Purpose | Endpoint |
| --- | --- |
| Google authorization | `https://accounts.google.com/o/oauth2/v2/auth` |
| Google token exchange | `https://oauth2.googleapis.com/token` |
| Google signing keys | `https://www.googleapis.com/oauth2/v3/certs` |
| GitHub authorization | `https://github.com/login/oauth/authorize` |
| GitHub token exchange | `https://github.com/login/oauth/access_token` |
| GitHub authenticated identity | `https://api.github.com/user` |

Discovery retrieval here does not prove host outbound HTTPS. T003 still needs TLS
verification from the game PHP context to discovery/token/key/identity endpoints.
The eventual implementation must validate Google signature plus typed required
`iss/aud/sub/exp/iat/nonce` against its own client and stored transaction, exchange
codes server-side, consume transactions once and rotate sessions. Provider + stable
subject owns the account; matching emails never merge identities. Provider tokens
must not enter the browser, public source, logs or save records.

Store client secrets only in owner-supplied private server configuration outside
Git and every docroot; do not put them in `VITE_` variables or source examples.
Record only private-location readiness, owner, environment and rotation status in
the public evidence. Client IDs are not secrets, but none is known here. Callback
query strings, authorization codes, state, PKCE verifiers, tokens, session/CSRF
values and provider subjects remain redacted. Game-only private paths and HTTP
denial still depend on H02 in the host audit.

| Blocker | Minimum non-secret input needed | Completion evidence |
| --- | --- | --- |
| P01 Google administration | Owner-controlled game project/client settings pointer (or confirmation none exists), administrator access/role confirmation, audience/branding/domain and environment mapping. | Inspect Web client, exact callback, scopes, contacts/domain status and environment separation; record sanitized settings. |
| P02 GitHub administration | Dedicated game OAuth App settings pointer (or confirmation none exists), owner account/organization and admin-role confirmation. | Inspect exact callback/wildcard flag, device/expiry settings, homepage and dedicated use. `gh` login alone is insufficient. |
| P03 Private inputs/test environment | Selected local HTTPS or isolated staging origin/port, private configuration location/readiness confirmation and willing provider test-account availability; secret values supplied privately to runtime only. | Match each configured client to its exact callbacks; verify secret-path protections without revealing values. |
| P04 Host prerequisites | Resolve T003 host PHP/outbound TLS/private paths and later game-only routing. | Real host/runtime observations, then actual callbacks after auth implementation. Current HEAD 404 is not readiness. |

Notify the coordinator of P01–P03 without delaying this bounded audit. Creating
missing registrations or publishing consent remains separately scoped owner work;
this report does not perform or imply either. Do not repeat unchanged access
attempts or reuse unrelated credentials. T007 must retain these open capabilities.
T036–T058/G2 later prove real Google and GitHub login/cancel, replay/nonce/PKCE
rejection, logout invalidation, account isolation and save/close/restore; mocked
identity and this preflight cannot satisfy those checks or AC11.

## Owner follow-up after loop 004

The owner supplied details from an existing unrelated existing application Web application OAuth client with a YouTube callback. This establishes an existing OAuth client, not a Network Quest registration. No secret value was supplied or stored here. The client label is internal; user-facing branding comes from the project OAuth Branding configuration. A separate Network Quest project/client was recommended to preserve independent branding and scopes. The existing client and secret have not been changed or reused. See the setup guide for exact game callbacks.

The owner subsequently supplied a different Google OAuth client ID and an unmasked secret through the local ignored `.env`. Presence and ID shape were checked without disclosure; values were mapped to the external private configuration using NQ_GOOGLE_CLIENT_ID/NQ_GOOGLE_CLIENT_SECRET, with mode0600. No Google authorization/token request or live sign-in test has run. Published branding, exact registered callback and project environment remain to be verified.

On 2026-11-25 the owner saved GitHub_OAuth_Client_ID and GitHub_OAuth_Client_Secret in the ignored project `.env`. Both were populated, unmasked and distinct from personal-token formats. The coordinator mapped them to NQ_GITHUB_CLIENT_ID/NQ_GITHUB_CLIENT_SECRET in the external private configuration, verified the copy without disclosure and preserved Google values. Both files are mode0600; the private parent is mode0700; project `.env` is ignored and untracked. Both provider pairs are now privately present. This does not establish GitHub registration settings, registered callbacks or real sign-in; no secret was sent to a provider by this check. P01/P02 settings and P03 environment mapping remain open.


The owner then answered “Yes — production registrations” to the explicit question
about dedicated Network Quest apps and the exact automateyournetwork.com callbacks
in `docs/setup/oauth.md`. Record the supplied pairs as production-only. This closes
the unknown environment label and supplies owner confirmation of the two registered
callback values; it does not independently inspect audience, branding, device-flow,
token-expiry or scope controls. Do not load these production pairs into the local
bootstrap. Separate local/staging provider configuration remains later explicit
setup, and real login/cancel/save flows remain G2.
