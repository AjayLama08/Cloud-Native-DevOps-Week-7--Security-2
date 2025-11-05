# Secure Backend Service Example

## Project

This project is the Week 7 backend caller: Azure Functions for managing Products
and notifying the tutor-provided `devnull-svc` receiver after an upsert.

Follow the published Week 7 worksheet in order. Complete the receiver in Part B,
then use this README for the local caller checks (C1–C2), caller deployment (C3),
and shared Auth0 setup with the Product SPA (Part D). Both Function Apps use
Windows Consumption, Functions 4 and Node.js 22, with separate storage accounts
in one Week 7 resource group. Keep both apps available until the SPA checks
finish, then use [Cleanup](#cleanup) for Part F.

### Available Endpoints

- `GET /api/products` - Public products, or products including prices with a valid OAuth2 token granting `read:products`
- `POST /api/products` - Upsert (create or update) a product; protected by the caller's host key when deployed
- `PUT /api/products` - Upsert (create or update) a product; protected by the caller's host key when deployed

### OAuth2 Token Validation and Price Redaction

The `GET /api/products` endpoint supports optional OAuth2 access token validation using the `jose` library.

- **Without an Authorization header**: `200 OK`, with `pricePence` set to `null` in the response JSON.
- **With a malformed, invalid, expired or expiry-less bearer token**: `401 Unauthorized`, with no Product data.
- **With a valid token but missing `read:products` scope**: `403 Forbidden`, with no Product data.
- **With a valid token and `read:products` scope**: `200 OK`, including prices. In this example, this scope gates access to restricted price information.

Token validation requires `exp` and checks the signature, issuer, audience and relevant time claims using `jose`. A correctly signed token without an expiry is rejected with `401`. A verification infrastructure/configuration failure returns `503 Service Unavailable`, rather than treating the token as invalid or returning anonymous data. OAuth2 token validation must be enabled via configuration (see below).

### Trace the GET request

`src/functions/list-products-http.ts` extracts the bearer token from the
Authorization header with `parseBearerToken` from `src/infra/parse-bearer-token.ts` and maps results
and authentication failures to HTTP responses. It passes the token string
(or `null` for an absent header) to
`createListProductsDeps` in `src/config/composition-root.ts`. That request-scoped
composition function invokes the configured validator for a supplied token,
obtains the plain `AuthContext` and assembles the Product dependencies.
`src/app/list-products.ts` then enforces `read:products` and redacts anonymous
prices. Neither the composition root nor the validator depends on Azure's
`HttpRequest` type; header extraction and HTTP decisions stay in the handler.

## Development environment

Start Docker and wait until its engine is running before opening VS Code.
Use VS Code and the Dev Containers extension.
Follow the Week 5–6 history-preserving private-copy workflow:

1. In VS Code, choose **Git: Clone** from the Command Palette and enter
   `https://github.com/tpdavison/cis3039-example-security-svc.git`.
2. Open the cloned folder, then choose **Dev Containers: Reopen in Container**.
3. In GitHub, create an empty **private** repository named
   `cis3039-example-security-svc`, without a README, licence or `.gitignore`.
4. In the container terminal, replace `YOUR_GITHUB_USERNAME` and set the remote:

```bash
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/cis3039-example-security-svc.git
git remote -v
git branch --show-current
```

Confirm that both remote URLs name your private repository and the branch is
`main`, then push the existing history:

```bash
git push -u origin main
```

If you already have a private copy, continue there. Keep the existing history;
do not initialise a new repository or create a public fork. This practice copy
is separate from your assessment implementation.

Run all remaining Bash commands from this repository's root inside the course
Dev Container, including on Windows. It uses
`ghcr.io/tpdavison/devops-labs:2026-latest`, Node.js 22, TypeScript 7 and Azure
Functions runtime/Core Tools 4. Check the tools and restore locked dependencies:

```bash
node --version
npm --version
func --version
az version
auth0 --version
npm ci
```

Stop if installation fails; retain the lockfile and confirm you are in the
supported container. `npm test` is a placeholder that exits with status 1;
no automated test suite is supplied for this lab.

## Local setup and checks

Copy the non-secret template. If `local.settings.json` already exists, skip
this command and edit the existing file instead:

```bash
cp local.settings.template.json local.settings.json
```

Keep `FUNCTIONS_WORKER_RUNTIME` set to `node`. Remove any `PRODUCT_UPDATED_KEY`
entry from an older local settings file; provide keys only through shell
variables. Keep host keys and access tokens out of settings files, Git, browser
assets and screenshots. Azure application settings supply deployed secrets.
Refer briefly to Week 5 for assessment configuration practice.

Type-check the caller and resolve any errors:

```bash
npm run typecheck
```

Then build it and continue only after the build succeeds:

```bash
npm run build
```

For worksheet C1, continue to [Product Updated Notifications](#product-updated-notifications)
to connect the local caller to your deployed receiver.

### Standalone development reference: dummy adapter

This optional local route checks the caller without a receiver. Set the editable
`PRODUCT_UPDATED_ENDPOINT` constant to `''` in `src/config/composition-root.ts`
so the dummy logger is selected, then start the host:

```bash
npm start
```

`npm start` cleans and rebuilds `dist/` before starting the Functions host at
`http://localhost:7071`. Check that GET, POST and PUT are registered on
`/api/products`. Leave the host running and open a second Bash terminal at the
same repository root for HTTP calls. If port 7071 is occupied, stop your own
previous Functions host before retrying.

#### List the seeded Products

```bash
curl -i http://localhost:7071/api/products
```

Expect `200` and two seeded Products: `p-001` (Seeded Widget) and `p-002`
(Seeded Gadget). Each has `pricePence: null` in the anonymous response JSON.
No Auth0 settings are needed for this anonymous check.

#### Upsert a Product

```bash
curl -i http://localhost:7071/api/products \
  -H 'Content-Type: application/json' \
  --data-binary @samples/product-post.json
```

`--data-binary` sends a POST. Expect `200` with `id: "product-123"` and
`pricePence: 1999`. The host terminal logs `Product updated event:` through the
dummy adapter. Repeat the GET to see `product-123` with its price redacted.
Repeating the POST updates the same ID; PUT is also supported.

Check malformed input separately:

```bash
curl -i http://localhost:7071/api/products \
  -H 'Content-Type: application/json' \
  --data-binary '{'
```

Expect `400` and `Request body must be valid JSON`, without a notification.
A `502` on the valid POST means an HTTP notifier is configured; stop the host
and check the endpoint constant before repeating this dummy check.

If the host reports a storage-health warning, check the actual HTTP responses
above: this HTTP-only fake-repository example uses no storage bindings. A host
that fails to register or serve these routes has not passed the checkpoint.

The repository is an in-memory fake: saved Products disappear on process
restart and are not shared across Azure instances. Do not use a later Azure
GET as the only proof of a successful upsert. Use its POST response and the
receiver log for downstream delivery evidence. No database is introduced here.
Stop the local host with Ctrl+C before proceeding.

## Product Updated Notifications

This service saves the Product, then synchronously sends a "product updated" notification.
A GET only lists Products; use POST or PUT to trigger the notification.

- Default behaviour: uses a dummy adapter that logs the event to the console.
- HTTP adapter: enabled when the editable `PRODUCT_UPDATED_ENDPOINT` constant in
  `src/config/composition-root.ts` contains the complete receiver URL.

The lab keeps three non-secret values together in that composition root:

| Constant                   | Value to enter                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH0_ISSUER`             | Your exact Auth0 issuer, e.g. `https://YOUR_AUTH0_DOMAIN/`, including the trailing slash                                           |
| `AUTH0_AUDIENCE`           | The Auth0 Products API identifier                                                                                                  |
| `PRODUCT_UPDATED_ENDPOINT` | The complete receiver URL, e.g. `https://YOUR_RECEIVER_HOSTNAME/api/product-updated`; empty deliberately selects the dummy adapter |

Set these constants for your own lab resources; a blank receiver endpoint
selects the dummy adapter for the standalone development reference. The notifier
POSTs directly to the endpoint; it appends no route and does not use a base URL. The receiver
returns `202 Accepted` and logs `Product updated:` with the validated payload.
Only `PRODUCT_UPDATED_KEY` is supplied through the local shell or Azure
application settings. There is no `PRODUCT_UPDATED_BASE_URL` environment setting.
For assessment work, refer to Week 5 to externalise the non-secret settings too;
Week 7 focuses on the security code. The SPA's separate `/api` base-URL convention
is unchanged.

The notification has a JSON body shaped as below; `updatedAt` is an ISO timestamp:

```json
{
  "id": "string",
  "name": "string",
  "pricePence": 1234,
  "description": "string",
  "updatedAt": "2025-01-01T12:34:56.000Z"
}
```

### Configure the local caller for the deployed receiver (C1)

In `src/app/upsert-product.ts`, find the save followed by the notifier call.
In `src/infra/http-product-updated-notifier.ts`, find the POST, the
`x-functions-key` header and the HTTP status check.

Stop any local caller with Ctrl+C. In `src/config/composition-root.ts`, set
`PRODUCT_UPDATED_ENDPOINT` to the full receiver URL from worksheet B2:

```typescript
const PRODUCT_UPDATED_ENDPOINT: string =
  'https://YOUR_RECEIVER_HOSTNAME/api/product-updated';
```

In the caller's Bash terminal, sign in to your Azure subscription and list the
available subscriptions:

```bash
az login
az account list \
  --query '[].{Name:name,Id:id,IsDefault:isDefault}' --output table
```

If the current subscription differs from the one used for B2, select it using
its ID from the list. Skip this block if the intended subscription is selected:

```bash
SECURITY_SUBSCRIPTION_ID='YOUR_SUBSCRIPTION_ID'
az account set --subscription "$SECURITY_SUBSCRIPTION_ID"
```

Confirm the active subscription before retrieving the receiver key:

```bash
az account show --query '{Name:name,Id:id}' --output table
```

Enter the same receiver app name and shared group name used in B2. These values
must be set in this Dev Container even if you set them in the receiver terminal:

```bash
RECEIVER_APP_NAME='receiver-lab-YOUR_UID-func'
WEEK7_RESOURCE_GROUP='week7-lab-YOUR_UID-rg'
```

Retrieve the receiver's ordinary host key directly. The app argument is the
**receiver**, even though you run this command in the caller terminal:

```bash
PRODUCT_UPDATED_KEY=$(az functionapp keys list \
  --name "$RECEIVER_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query functionKeys.default --output tsv)
```

Continue only if the lookup succeeds and this non-printing check reports
`Key retrieved`:

```bash
test -n "$PRODUCT_UPDATED_KEY" &&
  test "$PRODUCT_UPDATED_KEY" != None &&
  echo "Key retrieved"
```

If it fails, confirm the active subscription, receiver app name, shared group
and completed receiver deployment, then repeat the lookup and check. Do not
print the key. On success, export it for the local caller process:

```bash
export PRODUCT_UPDATED_KEY
```

Start the local caller in that same terminal. Keep this terminal for deployment:

```bash
npm start
```

`npm start` rebuilds before starting, so it picks up the edited endpoint. Expect
GET, POST and PUT on `/api/products` at `http://localhost:7071`. If port 7071 is
occupied, stop your own previous Functions host before retrying. The adapter
sends `PRODUCT_UPDATED_KEY` in `x-functions-key`. Changing a shell key requires
restarting the local host; never put a literal key in the source constants.

### Verify delivery and failure handling (C2)

From a second Bash terminal at this repository's root, send the sample to the
local caller:

```bash
curl -i http://localhost:7071/api/products \
  -H 'Content-Type: application/json' \
  --data-binary @samples/product-post.json
```

Expect `200` with the saved Product. In the deployed receiver's Azure portal,
open **Functions → product-updated-http → Invocations** and select the matching
**Date (UTC)** entry. Find `Product updated:` with `product-123`, matching the
Product ID and request time. A local dummy-adapter log does not confirm delivery.
If logs are delayed, wait and refresh before repeating the write.

Stop the local caller with Ctrl+C, then restart with a deliberately wrong key:

```bash
PRODUCT_UPDATED_KEY=deliberately-invalid-key npm start
```

The one-line assignment supplies the wrong key to that process and its children
while preserving the real exported value in your terminal. Repeat the POST from
the second terminal. Expect `502`, `success: false` and `productSaved: true`.
The receiver rejects this request before its handler, so expect no matching
handler invocation. Stop the local caller again; the terminal retains the real
exported key for deployment. To resume a successful local check, run `npm start`
in that terminal without the temporary assignment.

In this test, the status reports failed delivery and `productSaved: true`
reports that the save had already happened. Check the receiver before repeating
a write, since another POST can send another notification. This is the
save-before-notify sequence from **Week 6 worksheet B3 and C6**. The saved
Product remains while that process continues; a restart loses it because the
repository is in memory. The process can stop between saving and notifying,
and a timeout can leave delivery uncertain. Keep this interaction synchronous;
no retries or resilience redesign are introduced here.

| Failure | Caller response |
| ------- | --------------- |
| Malformed JSON or invalid Product fields | `400`; no save or notification |
| Configuration failure (invalid/non-HTTPS endpoint or blank receiver key) | `500`; no save or outbound request |
| Save failure | `500`; notification not attempted |
| Receiver rejects delivery (including `401` or `500`), or network failure | `502`, `success: false`, `productSaved: true` |

HTTP configuration is validated before saving: a non-blank endpoint must be an
absolute HTTPS URL and HTTP mode requires a non-blank receiver key. An incorrect
non-blank key exercises the post-save failure path. A blank endpoint selects
dummy mode without requiring a key.

## Azure setup

### Select the subscription and resource names (C3)

After the local positive and negative checks, stop the local caller. In its
Dev Container, confirm that the active subscription is your Azure subscription
used for the receiver in B2:

```bash
az account show --query '{Name:name,Id:id}' --output table
```

If you need to sign in or switch subscriptions, repeat the sign-in, subscription
list and selection steps in [C1](#configure-the-local-caller-for-the-deployed-receiver-c1).
Continue only when the intended subscription is active.

Reuse `WEEK7_RESOURCE_GROUP` from C1 and enter `WEEK7_REGION` using B2's region.
The receiver instructions create the shared group; create the caller's resources
in that existing group. Both Function Apps use Windows Consumption, Functions 4
and Node.js 22, each with its own storage account. The course Dev Container
remains the build environment even though Azure runs the Function Apps on Windows.

Use the course `project-env-uid-type` naming convention and replace `YOUR_UID`
with your chosen lowercase letters and digits. App and storage names must be
globally unique. Storage names join the components without separators and must
contain 3–24 lowercase letters or digits after substitution. Keep the caller's
storage name distinct from the receiver's `week7labYOUR_UIDstore`.

```bash
WEEK7_REGION='YOUR_B2_REGION'
SECURITY_APP_NAME='caller-lab-YOUR_UID-func'
SECURITY_STORAGE_ACCOUNT='callerlabYOUR_UIDstore'
```

If you use a new terminal, enter the same `WEEK7_RESOURCE_GROUP` and
`RECEIVER_APP_NAME` from C1 there and repeat the receiver-key lookup, check and
export before setting the caller's Azure application settings.

### Create the caller resources

Create the caller's storage account in the existing Week 7 group:

```bash
az storage account create \
  --name "$SECURITY_STORAGE_ACCOUNT" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --location "$WEEK7_REGION" \
  --sku Standard_LRS --kind StorageV2 \
  --output none
```

After it succeeds, create the Windows Consumption Function App:

```bash
az functionapp create \
  --name "$SECURITY_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --storage-account "$SECURITY_STORAGE_ACCOUNT" \
  --consumption-plan-location "$WEEK7_REGION" \
  --os-type Windows --runtime node --runtime-version 22 \
  --functions-version 4 --https-only true \
  --output none
```

After creation succeeds, check the runtime settings:

```bash
az functionapp config appsettings list \
  --name "$SECURITY_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query "[?name=='FUNCTIONS_WORKER_RUNTIME' || name=='WEBSITE_NODE_DEFAULT_VERSION'].{Setting:name,Value:value}" \
  --output table
```

Expect `FUNCTIONS_WORKER_RUNTIME` to be `node` and
`WEBSITE_NODE_DEFAULT_VERSION` to select Node.js 22. Stop on resource, runtime
or policy errors and use [Troubleshooting](#troubleshooting) before continuing.

### Configure the deployed caller and publish

Keep `PRODUCT_UPDATED_ENDPOINT` set to the full receiver URL in the composition
root. Use the terminal with the receiver's real exported `PRODUCT_UPDATED_KEY`.
If in doubt, repeat C1's lookup, check and export. Set the receiver key on the
**caller** before the initial publication:

```bash
az functionapp config appsettings set \
  --name "$SECURITY_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --settings "PRODUCT_UPDATED_KEY=${PRODUCT_UPDATED_KEY}" \
  --output none
```

Continue only after the setting succeeds. Build from the repository root in the
course Dev Container:

```bash
npm run build
```

When the build succeeds, publish the compiled output from the same terminal:

```bash
func azure functionapp publish "$SECURITY_APP_NAME" --no-build
```

Stop if publication fails. Do not use `--publish-local-settings`; the local
settings file does not configure Azure. The endpoint and Auth0 constants are
compiled into the app, so changes to them require rebuilding and republishing.
A key-only change uses the application-setting command without code publication;
the app restarts when settings are applied.

### Discover the hostname and check the public endpoint

Display the actual hostname:

```bash
az functionapp show \
  --name "$SECURITY_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query defaultHostName --output tsv
```

If retrieval fails or the output is blank or `None`, check the app name, shared
group and active subscription before continuing. Enter the returned hostname:

```bash
SECURITY_HOSTNAME='YOUR_CALLER_HOSTNAME'
SECURITY_API_BASE_URL="https://${SECURITY_HOSTNAME}/api"
```

The full Products endpoint is `https://YOUR_CALLER_HOSTNAME/api/products`.
For the SPA in D4, use the base URL `https://YOUR_CALLER_HOSTNAME/api`, without
a trailing slash or `/products` suffix. Keep this hostname for the SPA setup.

```bash
curl -i "${SECURITY_API_BASE_URL}/products"
```

Expect `200` with seeded public Products and `pricePence: null`. A `404` suggests
a hostname, route or deployment problem; check the build and publication.

### Retrieve the caller's ordinary host key

In the same terminal, retrieve this service's inbound key:

```bash
SECURITY_HOST_KEY=$(az functionapp keys list \
  --name "$SECURITY_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query functionKeys.default --output tsv)
```

Continue only if the lookup succeeds and this check prints `Key retrieved`:

```bash
test -n "$SECURITY_HOST_KEY" &&
  test "$SECURITY_HOST_KEY" != None &&
  echo "Key retrieved"
```

If it fails, check the active subscription, caller app name, shared group and
completed deployment, then retry. Do not print the key. Export it on success:

```bash
export SECURITY_HOST_KEY
```

This is the ordinary host key named `default`, not the administrative `_master`
key. A host key authorises functions with `authLevel: 'function'` throughout its
receiving Function App. A function-scoped key restricts access to one function.
The master key also permits administrative operations and must not be used for
routine application calls. See [Microsoft's access-key guidance](https://learn.microsoft.com/en-us/azure/azure-functions/function-keys-how-to).

| Secret | Receiving Function App | Where it is used |
| ------ | ---------------------- | ---------------- |
| `SECURITY_HOST_KEY` | This caller service | A backend caller sends it in `x-functions-key` to POST/PUT `/api/products`. |
| `PRODUCT_UPDATED_KEY` | `devnull-svc` receiver | This service sends it in `x-functions-key` to POST `/api/product-updated`. |

These are different secrets for different receiving apps. Neither belongs in the
SPA, a `VITE_*` variable, repository files or screenshots. Keep shell tracing
(`set -x`) off and avoid verbose HTTP output that exposes request headers.
GET `/api/products` retains its separate public/bearer-token contract; a host
key does not grant price access.

### Verify deployed upsert key enforcement and delivery

Send the valid sample without a key. Expect `401`:

```bash
curl -i "${SECURITY_API_BASE_URL}/products" \
  -H 'Content-Type: application/json' \
  --data-binary @samples/product-post.json
```

Send it with a wrong key. Expect `401` again:

```bash
curl -i "${SECURITY_API_BASE_URL}/products" \
  -H 'Content-Type: application/json' \
  -H 'x-functions-key: deliberately-invalid-key' \
  --data-binary @samples/product-post.json
```

Send it with the caller's correct key. Expect `200` with the saved Product:

```bash
curl -i "${SECURITY_API_BASE_URL}/products" \
  -H 'Content-Type: application/json' \
  -H "x-functions-key: ${SECURITY_HOST_KEY}" \
  --data-binary @samples/product-post.json
```

In the receiver portal, open **Functions → product-updated-http → Invocations**
and select the matching **Date (UTC)** entry. Find `Product updated:` with
`product-123`, matching the ID and time of this request to confirm delivery from
Azure. Wait and refresh delayed logs before repeating a write.

A `502` means the save completed but downstream notification failed; check the
caller's receiver endpoint and `PRODUCT_UPDATED_KEY`. A `404` suggests a hostname,
route or deployment problem. If the correct key gives `401`, confirm that
`SECURITY_HOST_KEY` belongs to the caller. The local Functions host normally
bypasses key enforcement, so use deployed endpoints for these key checks.

### Allow the local SPA origin (D3)

Before the SPA checks, allow its origin on the deployed caller:

```bash
az functionapp cors add \
  --name "$SECURITY_APP_NAME" \
  --resource-group "$WEEK7_RESOURCE_GROUP" \
  --allowed-origins http://localhost:5173 \
  --output none
```

CORS lets the browser read the response; it is separate from authentication and
application authorisation. Configure Auth0's callback and origin lists in the
Auth0 setup below.

### Troubleshooting

For region or capacity errors, use the region permitted by your Azure
subscription and used for B2. If policy is unclear, obtain the active subscription
ID from Azure and inspect inherited policy assignments:

```bash
SECURITY_SUBSCRIPTION_ID=$(az account show --query id --output tsv)
```

Stop if the lookup fails or returns blank/`None`. After it succeeds, inspect
the policy assignments:

```bash
az policy assignment list \
  --scope "/subscriptions/${SECURITY_SUBSCRIPTION_ID}" \
  --disable-scope-strict-match true --output json
```

Check with the tutor if the permitted region or capacity remains unclear before
retrying creation.
For a receiver `500`, inspect its invocation logs or Log stream at the request
time; the caller reports failed delivery as `502`.

### Optional local and production reference

For local SPA → local caller development, restart the local host with
`npm start -- --cors http://localhost:5173`. The guided Part D checks use the
local SPA and deployed caller. For a deployed SPA, add its actual HTTPS origin
to the caller's Azure CORS list and the Auth0 application lists in step 5.

## Auth0 Setup

Use this ordered setup for the backend and Product SPA together. Reuse one
tenant, one Products API, one SPA application and the same test users; do not
repeat tenant or user creation when moving to `cis3039-example-security-app`.
Run Bash commands in this backend repository's course Dev Container unless a
step explicitly switches to the SPA. Stop and resolve errors before continuing.

### 1. Select the shared tenant

[Create your own free Auth0 account](https://auth0.com/signup) and use a tenant
from that account for both the API and SPA. If you already have your own account,
reuse its lab tenant. Use the course naming convention for a new tenant (for
example, `shopping-dev-ab47`). Sign in and list your tenants:

```bash
auth0 login
auth0 tenants list
```

Enter your listed tenant domain without `https://` or a trailing slash, then
select it:

```bash
AUTH0_DOMAIN='YOUR_AUTH0_DOMAIN'
auth0 tenants use "$AUTH0_DOMAIN"
```

Confirm that the active tenant is the one intended for both examples. Keep the
actual domain, including its region suffix, for the backend and SPA settings.

### 2. Register the Products API and enable RBAC

`products-dev-api` is the Auth0 registration for the Products API deployed as
the caller in Part C. Choose a stable API identifier, for example
`https://products.shopping.thamco.com`.
It is an identifier for the token audience, not an address that must resolve.
It is separate from this backend's deployed `https://.../api` HTTP base URL.

Record the identifier for both backend and SPA configuration:

```bash
AUTH0_AUDIENCE='YOUR_PRODUCTS_API_IDENTIFIER'
```

If the API already exists, skip creation and open it in the Dashboard to check
the settings below. Otherwise create it:

```bash
auth0 apis create \
  --name products-dev-api \
  --identifier "$AUTH0_AUDIENCE" \
  --scopes read:products \
  --signing-alg RS256 \
  --enforce-policies \
  --token-dialect access_token \
  --offline-access=false \
  --no-input --json
```

Under **Applications → APIs → your API**, check that:

- **Permissions** defines `read:products`.
- **Settings → RBAC Settings → Enable RBAC** is on.
- **Add Permissions in the Access Token** is off. The backend checks granted
  `scope`, not the optional `permissions` array.
- Tokens use RS256; offline access/refresh tokens are not needed for this example.

Keep the API identifier exactly the same in every backend and SPA audience
setting. Accept consent when Auth0 asks; localhost may still require it, so
skipping consent is not a prerequisite for this lab.

### 3. Create a reader role and two test users

Create the role once, or reuse an existing role with the same API permission:

```bash
auth0 roles create \
  --name ProductReader \
  --description 'Can read products including prices' \
  --no-input --json
```

Whether you create or reuse the role, record its `id` (beginning `rol_`) from
the creation output or its Dashboard page:

```bash
AUTH0_ROLE_ID='YOUR_PRODUCT_READER_ROLE_ID'
```

If the role already has `read:products` for your Products API, skip the next
command. Otherwise attach the permission:

```bash
auth0 roles permissions add "$AUTH0_ROLE_ID" \
  --api-id "$AUTH0_AUDIENCE" \
  --permissions read:products \
  --no-input
```

Despite the flag name, `--api-id` here takes the API **identifier/audience**,
not the API record's internal `id`.

In the Auth0 Dashboard, open **User Management → Users → Create User**. Create
two disposable test identities in the database connection
`Username-Password-Authentication` (or your tenant's equivalent). Choose your
own distinct test email addresses and passwords meeting that connection's
policy; no shared example password is supplied. Reuse existing suitable test
users if you already have them.

Record each user's `user_id`. Give only the reader user the ProductReader role.
If it is already assigned, confirm it in the Dashboard and skip the command:

```bash
AUTH0_READER_USER_ID='YOUR_READER_USER_ID'
auth0 users roles assign "$AUTH0_READER_USER_ID" \
  --roles "$AUTH0_ROLE_ID" \
  --no-input
```

Leave the second user without `read:products`, including any direct permission
or other role granting it. In the user's Roles/Permissions tabs, confirm the
reader has the permission and the second user does not.

The flow is **role → API permissions → requested/granted scope → backend
check**. With RBAC enabled, the granted API scope is the intersection of what
the SPA requests and what the user has. Signing in alone does not grant price
access. See [Auth0's RBAC guidance](https://auth0.com/docs/get-started/apis/enable-role-based-access-control-for-apis).

### 4. Configure this backend

In `src/config/composition-root.ts`, edit the non-secret constants using the
same tenant and API identifier chosen above:

```typescript
const AUTH0_ISSUER: string = 'https://YOUR_AUTH0_DOMAIN/';
const AUTH0_AUDIENCE: string = 'YOUR_PRODUCTS_API_IDENTIFIER';
```

Use your actual values, not the placeholders. The issuer's trailing slash
matters: the composition root derives the JWKS URL by appending
`.well-known/jwks.json`. No separate JWKS setting is needed. The API audience
is an identifier, not the backend hostname. Keep the real receiver endpoint
constant if continuing the backend-to-backend checks.

Externalised configuration can usually change without republishing. This
example hard-codes the issuer and audience, so changing them requires a rebuild
and republish. For the guided Part D checks, use the deployed caller. Confirm
the active subscription is the one used in C3:

```bash
az account show --query '{Name:name,Id:id}' --output table
```

Build from the same source in the caller Dev Container:

```bash
npm run build
```

When the build succeeds, republish. Resolve any error before proceeding:

```bash
func azure functionapp publish "$SECURITY_APP_NAME" --no-build
```

Keep `PRODUCT_UPDATED_KEY` in Azure application settings as configured above;
there are no `OAUTH2_*` application settings for this lab. Remove obsolete
non-secret entries from older local settings files to avoid confusion. Their
values are not read by this version of the example.

Anonymous requests still work with the Auth0 constants empty. A supplied bearer
token without verification configuration gets `503`, not an anonymous success.
In assessment work, follow Week 5 for externalising the non-secret settings.

For an optional **local-only** check, stop the local host and run `npm start`
with the real exported receiver key to rebuild the constants. This local route
does not replace the deployed caller used by the SPA in Part D.

### 5. Hand off the shared settings to the Product SPA

In the same Auth0 tenant, register one **Single Page Application**. If the Product
SPA registration already exists, skip creation, use its `client_id` and check
its settings below. Otherwise create it for local development:

```bash
auth0 apps create \
  --name products-dev-app \
  --type spa \
  --auth-method None \
  --callbacks http://localhost:5173 \
  --logout-urls http://localhost:5173 \
  --web-origins http://localhost:5173 \
  --no-input --json
```

Record its `client_id`; a SPA needs no client secret. In its Dashboard settings,
confirm Allowed Callback URLs, Allowed Logout URLs and Allowed Web Origins
contain exactly `http://localhost:5173`. For optional production hosting, add
the SPA's actual HTTPS origin to all three lists, matching the SDK's
callback/logout URLs exactly.
Ensure the test users' database connection is enabled for this SPA under its
Connections tab.

Follow the [Product SPA README](https://github.com/tpdavison/cis3039-example-security-app/blob/main/README.md)
for frontend configuration and startup. The guided route is a local SPA calling
the deployed Windows caller in the Week 7 group. Its public settings use the
same tenant, client ID and API audience:

```dotenv
VITE_AUTH0_DOMAIN=YOUR_ACTUAL_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID=YOUR_SPA_CLIENT_ID
VITE_AUTH0_AUDIENCE=YOUR_PRODUCTS_API_IDENTIFIER
VITE_API_BASE_URL=https://YOUR_CALLER_HOSTNAME/api
```

The HTTP base URL is the security backend's real hostname; the audience is the
Auth0 API identifier. Neither setting is a host key. Configure the backend's
Azure CORS list separately for the local/deployed SPA origin; Auth0's allowed
origins do not configure backend CORS or authorise Product requests.

The SPA integration must explicitly request `read:products` in the SDK's
`authorizationParams.scope` (alongside `openid profile email`) and pass the
API audience. Setting an audience alone does not request this permission.
Keep the Auth0 SDK's default in-memory session behaviour and Authorization Code
with PKCE; no explicit refresh-token or persistent `localStorage` configuration
is required. Token-acquisition failures must be displayed as errors, without
falling back to anonymous requests.

### 6. Verify the token and permission states

Use the deployed caller for these checks. Keep `SECURITY_API_BASE_URL` set to
its actual `https://YOUR_CALLER_HOSTNAME/api` URL from C3. In the caller terminal,
send a deliberately invalid token and read the status and response body there:

```bash
curl -i "${SECURITY_API_BASE_URL}/products" \
  -H 'Authorization: Bearer deliberately-invalid-token'
```

Expect `401` with no Product data once token verification is configured.
Open the browser's developer tools and select **Network** before loading the
local SPA at `http://localhost:5173`. Start signed out. For each browser state
below, select the matching `GET /api/products` request and inspect its status
and **Response** JSON. Sign in with each test user to obtain fresh API access
tokens through the SDK; do not copy real tokens into commands. After changing
a role or permission, sign out and sign back in; an existing JWT does not
acquire updated permissions.

| Request                                                                            | Expected result                                 |
| ---------------------------------------------------------------------------------- | ----------------------------------------------- |
| No Authorization header                                                            | `200`, with `pricePence: null` in response JSON |
| Malformed, invalid, expired or expiry-less bearer token                            | `401`, no Product data                          |
| Fresh valid token for the user without `read:products`                             | `403`, no Product data                          |
| Fresh valid token for the reader, with the requested/granted `read:products` scope | `200`, including prices                         |
| Verification service/configuration unavailable                                     | `503`, no anonymous fallback                    |

After checking the reader response, sign out and confirm that the response
returns to `pricePence: null` and the SPA removes previously received prices.
A `401` suggests issuer, audience, signature or time validation; a `403` means
a valid token lacks the required scope. Check RBAC, the role's API identifier
and the SPA's requested scope before changing backend rules. A `503` means
verification configuration or infrastructure is unavailable: check the deployed
issuer/audience and JWKS connectivity rather than treating it as a bad token.

Keep real tokens and credentials out of commands, screenshots and repository
files. Retain the test users and role until the SPA checks are complete, then
follow the shared cleanup below.

## Cleanup

This is the repository-level cleanup for the shared Week 7 environment
(worksheet F1–F2). Keep the caller, receiver and Auth0 setup through Parts B–D,
including the SPA checks. When finished, confirm the active subscription is
your Azure subscription used in B2. If it differs, repeat the subscription
selection before proceeding. Use the same `WEEK7_RESOURCE_GROUP` from B2/C1;
in a new shell, enter that name first.

```bash
az account show \
  --query '{subscriptionName:name,subscriptionId:id}' --output table
```

List all resources in the shared group and confirm every resource is disposable:

```bash
az resource list --resource-group "$WEEK7_RESOURCE_GROUP" \
  --query '[].{resourceName:name,resourceType:type}' --output table
```

If the group contains anything needed for subsequent work, retain it. Otherwise
delete the group **once**, including both Function Apps and their storage accounts.
Check its name in the confirmation prompt. This command waits for deletion:

```bash
az group delete --name "$WEEK7_RESOURCE_GROUP"
```

After deletion completes, verify that the group no longer exists:

```bash
az group exists --name "$WEEK7_RESOURCE_GROUP"
```

Expect `false`. If it returns `true`, check the deletion result and selected
subscription before proceeding. Remove only disposable Auth0 users, roles,
SPA/API registrations that no other example needs. Stop local hosts and clear
secret variables in every caller shell where they were set:

```bash
unset SECURITY_HOST_KEY PRODUCT_UPDATED_KEY ACCESS_TOKEN
```

In every receiver shell where its key was set, clear it too:

```bash
unset RECEIVER_HOST_KEY
```

Technical references:
[Azure Function App CLI reference](https://learn.microsoft.com/en-us/cli/azure/functionapp?view=azure-cli-latest)
and [TypeScript deployment guidance](https://learn.microsoft.com/en-us/azure/azure-functions/typescript-build-options).
