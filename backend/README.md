# TALAS sync backend — `talasFunction`

The AWS Lambda handler that implements `POST /sync` for the TALAS web client,
backed by the existing DynamoDB **`talas`** table (partition key `userId`).

The browser never touches DynamoDB directly. Flow:

```
React app ──HTTPS (VITE_TALAS_SYNC_URL)──> talasFunction ──AWS SDK──> talas table
```

## Files

| File | Purpose |
|------|---------|
| `index.mjs` | The Lambda handler (`handler` export). |
| `package.json` | AWS SDK v3 dependencies. |
| `test-sync.mjs` | Smoke test against a live Function URL. |

## How records map to the `talas` table (Option A)

The table partition key is `userId`, so each record's logical `id` is stored
there. Each item:

| Attribute | Value |
|-----------|-------|
| `userId` (PK) | the record's `id`, e.g. `learner-maria` |
| `store` | `learners` / `teachers` / `assessments` / `assignments` |
| `updatedAt` | ISO timestamp (drives last-write-wins) |
| `deleted` | `true` for tombstones |
| `data` | the full client record, round-tripped verbatim |

## Deploy (Console)

1. **Install deps and zip** (locally, in this folder):
   ```powershell
   npm install
   Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath talasFunction.zip -Force
   ```
2. **Upload**: Lambda Console → `talasFunction` → **Code** tab → **Upload from → .zip file** → pick `talasFunction.zip`.
3. **Runtime/handler**: set runtime to **Node.js 20.x** (or newer) and the handler to **`index.handler`**.
4. **Permissions**: Configuration → **Permissions** → open the execution role → attach a policy granting DynamoDB access to the `talas` table (see below).
5. **Timeout**: Configuration → General → bump timeout to ~10s (the default 3s is tight for a cold start + scan).
6. **Function URL**: Configuration → **Function URL** → Create → **Auth type: NONE** → enable **CORS** (origin `*`, method `POST`, header `content-type`). Copy the URL.

## Deploy (CLI alternative)

```powershell
npm install
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath talasFunction.zip -Force
aws lambda update-function-code --function-name talasFunction --zip-file fileb://talasFunction.zip --region ap-southeast-2
aws lambda update-function-configuration --function-name talasFunction --handler index.handler --runtime nodejs20.x --timeout 10 --region ap-southeast-2
```

## IAM policy (attach to the Lambda execution role)

Replace the account id if different.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:ap-southeast-2:467590375048:table/talas"
    }
  ]
}
```

## Test the deployed endpoint

```powershell
# quick check
curl -Method POST "https://<id>.lambda-url.ap-southeast-2.on.aws/" -Body '{"since":null,"changes":[]}' -ContentType "application/json"

# full push+pull round trip
node test-sync.mjs https://<id>.lambda-url.ap-southeast-2.on.aws/
```

A healthy response looks like `{"serverTime":"...","changes":[...]}`.

## Wire it into the web app

Put the Function URL in the project root `.env`:

```
VITE_TALAS_SYNC_URL=https://<id>.lambda-url.ap-southeast-2.on.aws/
```

Restart `npm run dev`. The SyncIndicator's "no sync endpoint configured" hint
disappears and "Last synced" starts updating.

## Notes / tradeoffs

- Pull uses a filtered **Scan** — simple and fine for demo data. For scale, add
  a GSI on `updatedAt` and switch to **Query**.
- **No auth** (open Function URL) — demo only. The client has an
  `Authorization` header hook (`setAuthTokenProvider`) ready for Cognito/JWT.
- Last-write-wins by `updatedAt` can drop a concurrent edit to the same record.
