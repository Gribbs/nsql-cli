# nsql CLI

A command-line tool for executing SuiteQL queries against NetSuite. Supports both OAuth 2.0 browser-based login (recommended) and OAuth 1.0 token-based authentication (legacy). Manage multiple NetSuite account profiles (sandbox/production).

## Features

- Execute SuiteQL queries from the command line
- Read queries from SQL files using `--cli-input-suiteql`
- **OAuth 2.0 browser-based authentication** with automatic token refresh
- OAuth 1.0 / TBA legacy authentication support
- Profile-based credential management
- Support for multiple NetSuite accounts (sandbox, production, etc.)
- Interactive configuration setup
- Multiple output formats (JSON, CSV)
- Dry-run mode to preview queries without executing
- Edit existing profiles
- Encrypted storage of sensitive credentials

## Installation

### Global Installation

Install the package globally to use `nsql-cli` from anywhere:

```bash
npm install -g nsql-cli
```

After installation, you can use the `nsql-cli` command directly:

```bash
nsql-cli --help
```

### Local Installation

Install as a development dependency in your project:

```bash
npm install --save-dev nsql-cli
```

Then use it via `npx`:

```bash
npx nsql-cli --help
```

## Authentication

nsql-cli supports two authentication methods:

| Method | Type | Token Lifetime | Best For |
| --- | --- | --- | --- |
| **OAuth 2.0** (recommended) | Browser-based login | 60 min (auto-refreshes) | Local development |
| **OAuth 1.0 / TBA** (legacy) | Long-lived tokens | Indefinite | Legacy environments |

> **CI/CD note:** Neither method above is ideal for CI/CD. OAuth 2.0 Authorization Code Grant requires a browser, and OAuth 1.0 uses long-lived secrets that are a security risk. The recommended approach for CI/CD is **OAuth 2.0 Certificate-Based Authentication** (Client Credentials Grant), which uses an SSL certificate pair to obtain tokens without a browser. This is what SuiteCloud SDK uses via `account:setup:ci`. Certificate-based auth support is planned for a future release of nsql-cli.

---

## OAuth 2.0 Setup (Recommended)

OAuth 2.0 uses browser-based login to obtain short-lived tokens that auto-refresh. No long-lived secrets are stored.

### Step 1: Enable OAuth 2.0 in NetSuite

1. Log in to NetSuite as an **Administrator**
2. Navigate to **Setup > Company > Enable Features**
3. Click the **SuiteCloud** tab
4. Under **Manage Authentication**, check **OAuth 2.0**
5. Click **Save**

### Step 2: Create an Integration Record

1. Navigate to **Setup > Integration > Manage Integrations > New**
2. Fill in the following fields:
   - **Name**: `nsql-cli` (or any descriptive name)
   - **State**: Enabled
3. Under **Authentication**:
   - Uncheck **Token-Based Authentication** (not needed for OAuth 2.0)
   - Check **Authorization Code Grant**
   - **Redirect URI**: Enter `http://localhost:9749/callback`
   - Under **Scope**, check **REST Web Services** only
     (Leave **Client Credentials (Machine To Machine) Grant** unchecked)
4. Click **Save**
5. **Important**: Copy the **Client ID** and **Client Secret** shown on the confirmation page. The Client Secret is only displayed once.

### Step 3: Assign OAuth 2.0 Permissions to Your Role

1. Navigate to **Setup > Users/Roles > Manage Roles**
2. Edit the role you will use for API access
3. Under **Permissions > Setup**, add:
   - **Log in using OAuth 2.0 Access Tokens** (Full)
4. Click **Save**

### Step 4: Configure nsql-cli

You can configure OAuth 2.0 interactively or with command-line flags.

**Interactive setup:**

```bash
nsql-cli configure --profile sandbox
# Select "OAuth 2.0 - Browser login (recommended)"
# Enter your Account ID, Client ID, and Client Secret
```

Then authenticate via browser:

```bash
nsql-cli login --profile sandbox
```

**Non-interactive setup (all flags):**

```bash
nsql-cli login --profile sandbox \
  --account-id TSTDRV1234567 \
  --client-id "your-client-id" \
  --client-secret "your-client-secret"
```

This opens your browser to the NetSuite consent page. After you approve, the CLI receives temporary tokens and stores them. Tokens auto-refresh when you run queries.

**Re-authenticating:** If your refresh token expires, just run `nsql-cli login --profile sandbox` again. Your Client ID and Client Secret are already saved, so no need to re-enter them.

### Finding Your Account ID

Your NetSuite Account ID appears in the URL when logged in: `https://TSTDRV1234567.app.netsuite.com/...`

- **Production accounts**: A numeric ID like `1234567`
- **Sandbox accounts**: Use the format `1234567_SB1`

You can also find it at **Setup > Company > Company Information** under **Account ID**.

---

## OAuth 1.0 / TBA Setup (Legacy)

Token-Based Authentication uses long-lived credentials. This is the legacy method, retained for backward compatibility and CI/CD environments.

### Initial Setup

```bash
nsql-cli configure
# Select "OAuth 1.0 / TBA - Token-based (legacy)"
```

This will prompt you for:

- Consumer Key
- Consumer Secret
- Token
- Token Secret
- Realm

### Multiple Profiles

Create named profiles for different environments:

```bash
nsql-cli configure --profile prod
nsql-cli configure --profile sandbox
```

### Editing Existing Profiles

```bash
nsql-cli configure --profile prod
```

The tool will display the current configuration (with masked sensitive values) and allow you to update any fields.

---

## Configuration Storage

Profiles are stored in `~/.nsql-cli/config.json`. Sensitive values (Client Secret, refresh tokens) are encrypted with AES-256-CBC.

**OAuth 2.0 profile example (stored encrypted):**

```json
{
  "sandbox": {
    "authType": "oauth2",
    "accountId": "TSTDRV1234567",
    "clientId": "abc...",
    "clientSecret": "<encrypted>",
    "accessToken": "eyJ...",
    "refreshToken": "<encrypted>",
    "tokenExpiry": 1708300000000
  }
}
```

**OAuth 1.0 profile example:**

```json
{
  "prod": {
    "consumerKey": "your-consumer-key",
    "consumerSecret": "your-consumer-secret",
    "token": "your-token",
    "tokenSecret": "your-token-secret",
    "realm": "your-realm"
  }
}
```

## Environment Variables (OAuth 1.0)

As an alternative to the configuration file, you can provide OAuth 1.0 credentials via environment variables. This is useful for CI/CD pipelines.

### Supported Environment Variables

| Environment Variable   | Description            |
| ---------------------- | ---------------------- |
| `NSQL_CONSUMER_KEY`    | OAuth consumer key     |
| `NSQL_CONSUMER_SECRET` | OAuth consumer secret  |
| `NSQL_TOKEN`           | OAuth token            |
| `NSQL_TOKEN_SECRET`    | OAuth token secret     |
| `NSQL_REALM`           | NetSuite account realm |

### Credential Precedence

1. **Environment variables** (highest priority) - If ALL 5 environment variables are set, they are used
2. **Profile configuration file** - Falls back to profile when env vars are incomplete

### Docker/CI Usage

```bash
docker run -e NSQL_CONSUMER_KEY="..." \
           -e NSQL_CONSUMER_SECRET="..." \
           -e NSQL_TOKEN="..." \
           -e NSQL_TOKEN_SECRET="..." \
           -e NSQL_REALM="..." \
           my-image nsql-cli query --query "SELECT id FROM customer"
```

## Usage

### Execute a Query

Execute a SuiteQL query using the default profile:

```bash
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1"
```

### Execute a Query from a File

You can also read queries from SQL files using the `--cli-input-suiteql` option. SQL files contain plain SuiteQL query text. Here are examples:

**Query file without parameters:**

Create a file `queries/customers.sql`:

```sql
SELECT id, entityid, companyname
FROM customer
WHERE ROWNUM <= 10
```

Execute it without providing any parameters:

```bash
nsql-cli query --cli-input-suiteql file://./queries/customers.sql

# The file:// prefix is optional
nsql-cli query --cli-input-suiteql ./queries/customers.sql

# Absolute paths also work
nsql-cli query --cli-input-suiteql file:///Users/name/queries/customers.sql
```

**Query file with parameters:**

Create a file `queries/customer-by-id.sql` with placeholders:

```sql
SELECT id, entityid, companyname
FROM customer
WHERE id = :id
```

Execute it by providing the parameter value:

```bash
nsql-cli query --cli-input-suiteql file://./queries/customer-by-id.sql --id 123

# You can also use --param syntax
nsql-cli query --cli-input-suiteql file://./queries/customer-by-id.sql --param id=123
```

**Query file with multiple parameters:**

Create a file `queries/sales-orders.sql` with multiple placeholders:

```sql
SELECT
  id,
  tranid,
  trandate,
  total
FROM transaction
WHERE type = 'SalesOrd'
  AND trandate >= :startDate
  AND ROWNUM <= :limit
ORDER BY trandate DESC
```

Execute it by providing all parameter values:

```bash
nsql-cli query --cli-input-suiteql file://./queries/sales-orders.sql --startDate "2024-01-01" --limit 50
```

**Note:** The `--query` and `--cli-input-suiteql` options are mutually exclusive. You must use one or the other, but not both.

### Using a Specific Profile

Execute a query using a named profile:

```bash
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1" --profile prod
```

### Dry-Run Mode

Preview a query without executing it:

```bash
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1" --dry-run
```

This will display the query, profile, and realm information without making any API calls.

### Output Formats

By default, results are output as JSON. You can also output as CSV:

```bash
# JSON output (default)
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1"

# CSV output
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1" --format csv
```

### Query Parameters

You can use placeholders in your queries and pass values via CLI arguments. Placeholders use the `:name` syntax:

```bash
# Using --param option
nsql-cli query --query "SELECT id FROM customer WHERE id = :id" --param id=123

# Using direct option (--key value)
nsql-cli query --query "SELECT id FROM customer WHERE id = :id" --id 123

# Multiple parameters
nsql-cli query --query "SELECT id FROM customer WHERE id = :id AND entityid = :entityid" --id 123 --entityid "TEST123"

# Parameters with dry-run
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= :limit" --param limit=10 --dry-run
```

**Parameter Types:**

- **Numbers**: Automatically detected and inserted without quotes (e.g., `--id 123` → `123`)
- **Strings**: Automatically quoted (e.g., `--name "Test"` → `'Test'`)
- **Booleans**: Inserted without quotes (e.g., `--active true` → `true`)

**Note:** NetSuite SuiteQL uses `ROWNUM` syntax instead of standard SQL `LIMIT`. Use `WHERE ROWNUM <= :limit` in your queries.

### Query Examples

**Get user event script execution logs (today's logs):**

```bash
nsql-cli query --query "SELECT sn.* FROM ScriptNote sn WHERE sn.scriptType IN (SELECT id FROM userEventScript WHERE scriptid = 'customscript_wwccemployeeaccred') AND TRUNC(sn.date) = TRUNC(SYSDATE) ORDER BY sn.internalid DESC"
```

Or execute from a file:

```bash
nsql-cli query --cli-input-suiteql file://./__tests__/test-queries/script-notes-today.sql
```

**Get customers (limited):**

```bash
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1"
```

**Get transactions for a specific date range:**

```bash
nsql-cli query --query "SELECT id, type, trandate, amount FROM transaction WHERE trandate BETWEEN '2024-01-01' AND '2024-12-31'"
```

**Get items with inventory:**

```bash
nsql-cli query --query "SELECT id, itemid, displayname, quantityavailable FROM item WHERE itemtype = 'InvtPart' AND quantityavailable > 0"
```

**Get employees:**

```bash
nsql-cli query --query "SELECT id, entityid, firstname, lastname, email FROM employee WHERE isinactive = 'F'"
```

**Get sales orders:**

```bash
nsql-cli query --query "SELECT id, tranid, trandate, total FROM transaction WHERE type = 'SalesOrd' AND ROWNUM <= 50 ORDER BY trandate DESC"
```

**Get customer by ID (using parameters):**

```bash
nsql-cli query --query "SELECT id FROM customer WHERE id = :id" --id 123
```

**Execute query from a file:**

```bash
# Create a file with your query
echo "SELECT id FROM customer WHERE ROWNUM <= 10" > query.sql

# Execute it
nsql-cli query --cli-input-suiteql file://./query.sql

# With parameters
nsql-cli query --cli-input-suiteql file://./query.sql --id 123
```

## Command Reference

### `configure`

Set up or edit NetSuite account credentials. Prompts you to choose between OAuth 2.0 and OAuth 1.0 authentication.

**Options:**

- `-p, --profile <name>` - Profile name to configure (defaults to "default")

**Examples:**

```bash
nsql-cli configure
nsql-cli configure --profile prod
nsql-cli configure --profile sandbox
```

### `login`

Authenticate with NetSuite using browser-based OAuth 2.0. Opens your default browser for the NetSuite consent flow and stores the resulting tokens.

**Options:**

- `-p, --profile <name>` - Profile name (defaults to "default")
- `--port <port>` - Local callback server port (defaults to "9749")
- `--account-id <id>` - NetSuite account ID (skips interactive prompt)
- `--client-id <id>` - OAuth 2.0 Client ID (skips interactive prompt)
- `--client-secret <secret>` - OAuth 2.0 Client Secret (skips interactive prompt)
- `--debug` - Enable debug logging (outputs to stderr)

**Examples:**

```bash
# Interactive login (prompts for credentials if not already configured)
nsql-cli login

# Login with a named profile
nsql-cli login --profile sandbox

# Non-interactive login (all flags provided)
nsql-cli login --profile sandbox \
  --account-id TSTDRV1234567 \
  --client-id "your-client-id" \
  --client-secret "your-client-secret"

# Re-authenticate an existing OAuth 2.0 profile (uses saved credentials)
nsql-cli login --profile sandbox

# Use a custom callback port
nsql-cli login --profile sandbox --port 8080
```

### `query`

Execute a SuiteQL query.

**Options:**

- `-q, --query <sql>` - SuiteQL query to execute (required if `--cli-input-suiteql` is not provided)
- `--cli-input-suiteql <file>` - Read SuiteQL query from file (use `file://` prefix for file path). Mutually exclusive with `--query`
- `-p, --profile <name>` - Profile to use (defaults to "default")
- `--dry-run` - Preview the query without executing it
- `--debug` - Enable debug logging (outputs to stderr)
- `-f, --format <format>` - Output format: `json` or `csv` (defaults to "json")
- `--param <key=value>` - Query parameter (can be used multiple times). Use `:key` in query as placeholder
- `--<key> <value>` - Alternative way to pass parameters. Any unknown option is treated as a parameter

**Examples:**

```bash
# Basic query with JSON output
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1"

# Query with specific profile
nsql-cli query --query "SELECT id FROM item WHERE ROWNUM <= 1" --profile prod

# Preview query without executing
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1" --dry-run

# Output results as CSV
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1" --format csv

# Query with parameters
nsql-cli query --query "SELECT id FROM customer WHERE id = :id" --id 123

# Query with multiple parameters
nsql-cli query --query "SELECT id FROM customer WHERE id = :id AND entityid = :entityid" --param id=123 --param entityid="TEST123"

# Combine options
nsql-cli query --query "SELECT id FROM item WHERE ROWNUM <= :limit" --profile prod --format csv --limit 1

# Execute query from file
nsql-cli query --cli-input-suiteql file://./queries/customers.sql

# Execute query from file with parameters
nsql-cli query --cli-input-suiteql file://./queries/customers.sql --id 123

# Execute query from file with dry-run
nsql-cli query --cli-input-suiteql file://./queries/customers.sql --dry-run

# Execute query from file with CSV output
nsql-cli query --cli-input-suiteql file://./queries/customers.sql --format csv

# Debug mode (shows auth flow, token refresh, request/response details)
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1" --debug
```

### Help

Get help for any command:

```bash
nsql-cli --help
nsql-cli configure --help
nsql-cli query --help
```

## Troubleshooting

### No Credentials Found

**Error:** `Error: No credentials found.`

**Solution:**

1. **OAuth 2.0:** Run `nsql-cli login --profile <name>` to authenticate
2. **OAuth 1.0:** Run `nsql-cli configure --profile <name>` or set environment variables
3. Verify you're using the correct `--profile` name (case-sensitive)

### Token Refresh Failed

**Error:** `Token refresh failed: invalid_grant`

**Solution:** Your refresh token has expired. Re-authenticate:

```bash
nsql-cli login --profile <profile-name>
```

### Browser Does Not Open

**Error:** The `login` command doesn't open a browser

**Solution:**

1. Copy the URL printed in the terminal and paste it into your browser manually
2. If running in a headless environment (SSH, container), OAuth 2.0 browser login won't work -- use OAuth 1.0 / TBA instead

### OAuth 2.0: "Invalid Redirect URI"

**Error:** NetSuite shows "Invalid redirect URI" in the browser

**Solution:**

- Verify the Redirect URI in your Integration Record matches exactly: `http://localhost:9749/callback`
- If you use `--port`, ensure the port matches the Redirect URI (e.g., `--port 8080` requires `http://localhost:8080/callback` in NetSuite)

### OAuth 2.0: "Access Denied" or "Insufficient Permissions"

**Solution:**

- Ensure your NetSuite role has the **Log in using OAuth 2.0 Access Tokens** permission (Setup > Users/Roles > Manage Roles)
- Ensure the Integration Record has **REST Web Services** scope enabled
- Ensure your user is assigned a role with SuiteQL access

### Invalid Credentials (OAuth 1.0)

**Error:** `Error executing query: [authentication error]`

**Solution:**

- Verify your credentials are correct
- Check that your token hasn't expired
- Ensure your NetSuite account has SuiteQL access enabled
- Reconfigure the profile: `nsql-cli configure --profile <profile-name>`

### Query Syntax Errors

**Error:** `Error executing query: [SQL syntax error]`

**Solution:**

- Verify your SuiteQL query syntax
- Check NetSuite SuiteQL documentation for supported syntax
- Ensure table and field names are correct

### Permission Errors

**Error:** `Error executing query: [permission denied]`

**Solution:**

- Verify your NetSuite user has SuiteQL access permissions
- Check that the integration role has necessary permissions
- Contact your NetSuite administrator

## Requirements

- Node.js (version 18 or higher)
- NetSuite account with SuiteQL access
- One of:
  - **OAuth 2.0**: Integration Record with Authorization Code Grant enabled (see [OAuth 2.0 Setup](#oauth-20-setup-recommended))
  - **OAuth 1.0**: Consumer Key, Consumer Secret, Token, Token Secret, Realm (see [OAuth 1.0 Setup](#oauth-10--tba-setup-legacy))

## Output Format

The CLI supports two output formats: JSON (default) and CSV.

### JSON Format

By default, all query results are output as JSON with pretty-printing (2-space indentation). This makes it easy to pipe results to other tools or parse programmatically.

**Example JSON output:**

```json
{
  "items": [
    {
      "id": "123",
      "name": "Sample Item",
      "quantity": 100
    }
  ],
  "hasMore": false,
  "totalResults": 1
}
```

### CSV Format

CSV format outputs only the `items` array as a CSV table with headers. Nested objects and arrays are JSON-stringified in their respective cells. This format is useful for importing data into spreadsheets or other CSV-compatible tools.

**Example CSV output:**

```csv
id,name,quantity
123,Sample Item,100
124,Another Item,50
```

**CSV Format Notes:**

- Headers are automatically generated from all keys present in the result items
- Values containing commas, quotes, or newlines are properly escaped
- Nested objects and arrays are JSON-stringified
- Empty results produce an empty string

## License

ISC

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes and version history.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Development setup
- Commit message format (Conventional Commits)
- Pull request process
- Testing requirements
- Release process

Please ensure all commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) format, as this project uses semantic versioning and automated releases.
