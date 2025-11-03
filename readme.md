# Secure Backend Service Example

## Project

This project provides Azure Functions for managing products.

### Available Endpoints

- `GET /api/products` - Public products, or products including prices with a valid OAuth2 token granting `read:products`
- `POST /api/products` - Upsert (create or update) a product
- `PUT /api/products` - Upsert (create or update) a product

### OAuth2 Token Validation and Price Redaction

The `GET /api/products` endpoint supports optional OAuth2 access token validation using the `jose` library.

- **Without an Authorization header**: `200 OK`, with `pricePence` set to `null` in the response JSON.
- **With a malformed, invalid or expired bearer token**: `401 Unauthorized`, with no Product data.
- **With a valid token but missing `read:products` scope**: `403 Forbidden`, with no Product data.
- **With a valid token and `read:products` scope**: `200 OK`, including prices. In this example, this scope gates access to restricted price information.

Token validation checks the signature, issuer, audience and relevant time claims using `jose`. A verification infrastructure/configuration failure returns `503 Service Unavailable`, rather than treating the token as invalid or returning anonymous data. OAuth2 token validation must be enabled via configuration (see below).

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local settings file:

Copy the template to create your local development settings:

```bash
cp local.settings.template.json local.settings.json
```

> **Note:** Never commit your `local.settings.json` to source control. The template is safe to share.

3. Build the project:

```bash
npm run build
```

## Local testing with curl

### Start the Function App

```bash
npm start
```

The function app will start on `http://localhost:7071`.

### List Products

Split the VS Code terminal so you can see the output from the localling running app whilst having a new shell prompt to make a test HTTP call:

```bash
curl -i http://localhost:7071/api/products
```

The fake repo initialises empty, so expect an empty array of products.

### Upsert a Product

Using the sample data file (and a new bash terminal):

```bash
curl -i -X POST http://localhost:7071/api/products \
  -H "Content-Type: application/json" \
  -d @samples/product-post.json
```

Repeating the list products call should now show the new item.

## Azure Setup

### Sign into Azure CLI

Prepare for using the az CLI commands.

1. Ensure you are signed in:

```bash
az login
az account show
```

You should see your account properties displayed if you are successfully signed in.

2. Ensure you know which locations (e.g. uksouth) you are permitted to use:

```bash
az policy assignment list \
  --query "[?name.contains(@, 'sys.regionrestriction')].parameters.listOfAllowedLocations.value | []" \
  -o tsv
```

### Create a Resource Group and Azure Function App

1. Create a resource group (if you do not already have one for this deployment):

```bash
az group create \
  --name <your-resource-group> \
  --location <permitted-location>
```

Remember to follow our naming convention, e.g. shopping-lab-ab47-rg

2. Create a storage account (required for Azure Functions):

```bash
az storage account create \
  --name <yourfuncstorageaccount> \
  --location <permitted-location> \
  --resource-group <your-resource-group> \
  --sku Standard_LRS
```

3. Create the Function App:

```bash
az functionapp create \
  --name <your-function-app> \
  --resource-group <your-resource-group> \
  --storage-account <yourfuncstorageaccount> \
  --consumption-plan-location <permitted-location> \
  --runtime node \
  --functions-version 4
```

### Publish the Project to Azure

Deploy your code to the Function App:

```bash
func azure functionapp publish <your-function-app>
```

You can now access your endpoints at:

```
https://<your-function-app>.azurewebsites.net/api/products
```

If needed, allow cross-domain calls from your app domain and/or localhost, for example:

```bash
az functionapp cors add \
  --name <your-function-app> \
  --resource-group <your-resource-group> \
  --allowed-origins http://localhost:5173
```

### Read the host auth key

```bash
az functionapp keys list \
  --name <your-function-app> \
  --resource-group <your-resource-group> \
  --query masterKey \
  --output tsv
```

This key will need to be shared with any backend service that needs to call `upsertProduct`. Calls to `upsertProduct` must include the key in the `x-functions-key` HTTP header. It is also possible to acquire a key that just works for `upsertProduct` (rather than for the whole service).

## Product Updated Notifications

The non-secret `PRODUCT_UPDATED_ENDPOINT` constant in `src/config/composition-root.ts`
selects notification delivery. Leave it empty for the initial dummy logger check.
For HTTP delivery, edit it to the complete receiver URL, for example
`https://YOUR_RECEIVER_HOSTNAME/api/product-updated`. The notifier uses that URL
directly; it appends no route. Run `npm start` again to rebuild and restart after
editing the constant. For Azure, rebuild with `npm run build`, then republish
with `func azure functionapp publish <your-function-app> --no-build`.

The Product is saved before notification. See Week 6 worksheet B3's in-memory
save followed by failed publication: notification failure does not imply rollback.
For assessment work, follow Week 5 to externalise these non-secret settings too.

Keep `PRODUCT_UPDATED_KEY` in the local shell or the caller's Azure application
settings. Set only the receiver key using
`az functionapp config appsettings set`; keep the full endpoint in the source
constant. A key-only update needs no code publication. Changing the endpoint
requires rebuilding and republishing. Never put keys in source or settings files.

## Auth0 Setup

### 1. Create an Auth0 Tenancy (if you don't have one already)

Visit [auth0.com](https://auth0.com/) and sign-up. Create and name your first tenancy following our usual naming conventions, for example `shopping-dev-ab47`.

### 2. Sign-in to Auth0 CLI

In the VSCode terminal:

```bash
auth0 login
```

Confirm your Auth0 domain (e.g. shopping-dev-ab47.uk.auth0.com):

```bash
auth0 tenants list
```

Keep a note of your domain as you will need it later.

### 3. Register an API (resource server)

Call you api registration something like `products-dev-api`. Use something like `https://products.shopping.thamco.com` for the identifier (it looks like a domain name but doesn't need to actually exist).

```bash
auth0 apis create \
 --name <your-api-name> \
 --identifier <your-api-identifier> \
 --scopes "read:products" \
 --no-input \
 --json
```

> The `identifier` will become the audience (`aud`) for the access tokens your app acquires to access your backend service.

The `scopes` above are examples and can be changed to match your needs.

Since you are the frontend app and backend api author, you can skip requesting user consent to use the API: In the Auth0 web dashboard: APIs → your API → Settings → Access Settings → “Allow Skipping User Consent”.

## OAuth2 Access Tokens

Set the non-secret `AUTH0_ISSUER` and `AUTH0_AUDIENCE` constants in
`src/config/composition-root.ts`. The issuer includes a trailing slash; the root
derives JWKS by appending `.well-known/jwks.json`. Restart locally with `npm start`;
rebuild and republish for Azure. No `OAUTH2_*` environment settings are read.

The HTTP handler uses `parseBearerToken` from `src/infra/parse-bearer-token.ts`,
awaits `createListProductsDeps(token)`, then maps outcomes to HTTP. Anonymous
requests receive redacted 200 responses; invalid, expired or expiry-less tokens
receive 401; valid tokens without `read:products` receive 403; readers receive
prices. Verification infrastructure failures receive 503. JWT `exp` is required.
