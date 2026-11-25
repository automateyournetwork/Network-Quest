# Set up Network Quest sign-in

Google/Gemini API keys are for API access, not Google sign-in. The requested local
project scan found API keys, but no reusable Google OAuth web-client pair in its
bounded scope. Network Quest needs dedicated Google and GitHub registrations.

The routes below are the agreed production values; they currently return 404.
Registration alone will not make sign-in work. The game backend and real provider
tests still need implementation. See the [preflight evidence](../evidence/spec001/provider-preflight.md).

## Google

1. Open [Google Cloud Console](https://console.cloud.google.com/) with the account
   that will own Network Quest. Select or create a dedicated game project. Keep
   testing and production in separate projects; Google's [production guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance)
   requires that separation.
2. Open **Google Auth Platform → Branding**. Set the app name to **Network Quest**,
   an owner-managed support email and developer contact. For production, complete
   domain ownership verification for `automateyournetwork.com` and supply a working
   game homepage and privacy-policy URL. The planned game homepage is
   `https://automateyournetwork.com/arcade/play/network-quest/`; it is not live yet.
3. In **Audience**, select **External**. Keep the development app in **Testing**.
   Internal and Personal do not support this game's intended public audience.
   Do not publish the consent app as part of this setup exercise.
4. In **Data Access**, select only `openid` and the profile scope
   (`https://www.googleapis.com/auth/userinfo.profile`; runtime alias `profile`).
   Do not add email, Drive, Gmail, contacts or other scopes. The game's request
   will be exactly `openid profile` with no offline access.
5. In **Clients → Create client**, choose **Web application**. For the production
   client, set this exact **Authorized redirect URI** (no trailing slash):

   ```text
   https://automateyournetwork.com/arcade/play/network-quest/api/v1/auth/google/callback
   ```

   The backend-only design does not need Authorized JavaScript origins. A separate
   development client/project needs the actual chosen local HTTPS or staging URL;
   leave that decision pending until its origin and port are known.
6. Save the client ID and secret directly to private server configuration outside
   the repository and web root. Never paste the secret into chat or put it in a
   `VITE_` variable. Record the project/client settings link and environment label
   so configuration can be checked without sharing the secret.

Google's [client setup guide](https://developers.google.com/identity/protocols/oauth2/web-server#creatingcred)
and [OIDC guide](https://developers.google.com/identity/openid-connect/openid-connect)
cover the flow. [Audience guidance](https://support.google.com/cloud/answer/15549945)
documents a basic-identity exception to ordinary Testing restrictions; listing
test users is not mandatory for this exact scope set. Actual account policies and
[brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
still need checking before public release.

## GitHub

1. Open [Developer settings → OAuth Apps](https://github.com/settings/developers),
   then **New OAuth App**. Use an owner-controlled account, or the equivalent
   organization settings with administration rights. Create a dedicated
   **Network Quest** OAuth App, separate from other websites and the GitHub CLI.
2. Enter the app name and game homepage. Use the production callback below exactly:

   ```text
   https://automateyournetwork.com/arcade/play/network-quest/api/v1/auth/github/callback
   ```

   Disable **wildcard matching** for the callback. Leave **Device Flow** disabled
   and keep **Expire user access tokens** enabled. Separate environment apps are
   recommended for this project. GitHub supports multiple callbacks; add only
   intentionally configured values.
3. Register the app, generate its client secret and store it privately with the
   client ID. Keep only the app settings link and environment label in handoff
   notes; never disclose the secret.
4. Scopes are requested by the game code, not a registration permissions checklist.
   The code must send explicit empty `scope=` and read authenticated `/user` for
   identity. Do not grant `user`, `read:user`, `user:email`, `repo` or organization
   scopes. Do not reuse an app with historical broad grants.

Official instructions: [create an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app),
[authorization and exact callbacks](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps),
and [scope meanings](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).

## What to provide after setup

Provide the Google project/client settings link, GitHub OAuth App settings link,
which environment each belongs to, and confirmation that secrets are stored
privately. Do not send secret values. If registrations already exist, provide their
settings links before creating replacements.

Real completion still requires deployed HTTPS callbacks, private host configuration,
S256/state/nonce validation as applicable, login cancellation, separate account
ownership, and both providers' save/close/restore checks. A successful registration
screen does not pass those tests.
