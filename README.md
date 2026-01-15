# nsql CLI

A command-line tool for executing SuiteQL queries against NetSuite using the `netsuite-api-client` package. Manage multiple NetSuite account profiles (sandbox/production).

## Features

- Execute SuiteQL queries from the command line
- Read queries from SQL files using `--cli-input-suiteql`
- Profile-based credential management
- Support for multiple NetSuite accounts (sandbox, production, etc.)
- Interactive configuration setup
- Multiple output formats (JSON, CSV)
- Dry-run mode to preview queries without executing
- Edit existing profiles

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

## Configuration

Before executing queries, you need to configure your NetSuite account credentials.

### Initial Setup

Configure the default profile:

```bash
nsql-cli configure
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
# Configure a production profile
nsql-cli configure --profile prod

# Configure a sandbox profile
nsql-cli configure --profile sandbox
```

### Editing Existing Profiles

To edit an existing profile, simply run configure with the profile name:

```bash
nsql-cli configure --profile prod
```

The tool will display the current configuration (with masked sensitive values) and allow you to update any fields.

### Configuration Storage

Profiles are stored in `~/.nsql-cli/config.json`. The file structure looks like:

```json
{
  "default": {
    "consumerKey": "your-consumer-key",
    "consumerSecret": "your-consumer-secret",
    "token": "your-token",
    "tokenSecret": "your-token-secret",
    "realm": "your-realm"
  },
  "prod": {
    "consumerKey": "...",
    "consumerSecret": "...",
    "token": "...",
    "tokenSecret": "...",
    "realm": "..."
  }
}
```

## Environment Variables

As an alternative to the configuration file, you can provide credentials via environment variables. This is useful for CI/CD pipelines, Docker containers, and other automated environments.

### Supported Environment Variables

| Environment Variable   | Description            |
| ---------------------- | ---------------------- |
| `NSQL_CONSUMER_KEY`    | OAuth consumer key     |
| `NSQL_CONSUMER_SECRET` | OAuth consumer secret  |
| `NSQL_TOKEN`           | OAuth token            |
| `NSQL_TOKEN_SECRET`    | OAuth token secret     |
| `NSQL_REALM`           | NetSuite account realm |

### Credential Precedence

1. **Environment variables** (highest priority) - If ALL 5 environment variables are set, they are used exclusively
2. **Profile configuration file** (lower priority) - Falls back to profile when env vars are incomplete

**Note:** All 5 environment variables must be set for environment variable authentication to be used. If any are missing, the CLI falls back to profile-based authentication.

### Example Usage

```bash
# Set environment variables
export NSQL_CONSUMER_KEY="your-consumer-key"
export NSQL_CONSUMER_SECRET="your-consumer-secret"
export NSQL_TOKEN="your-token"
export NSQL_TOKEN_SECRET="your-token-secret"
export NSQL_REALM="your-realm"

# Execute query (no profile configuration needed)
nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1"
```

### Docker/CI Usage

```bash
# Docker run with environment variables
docker run -e NSQL_CONSUMER_KEY="..." \
           -e NSQL_CONSUMER_SECRET="..." \
           -e NSQL_TOKEN="..." \
           -e NSQL_TOKEN_SECRET="..." \
           -e NSQL_REALM="..." \
           my-image nsql-cli query --query "SELECT id FROM customer"

# GitHub Actions
- name: Run SuiteQL Query
  env:
    NSQL_CONSUMER_KEY: ${{ secrets.NSQL_CONSUMER_KEY }}
    NSQL_CONSUMER_SECRET: ${{ secrets.NSQL_CONSUMER_SECRET }}
    NSQL_TOKEN: ${{ secrets.NSQL_TOKEN }}
    NSQL_TOKEN_SECRET: ${{ secrets.NSQL_TOKEN_SECRET }}
    NSQL_REALM: ${{ secrets.NSQL_REALM }}
  run: nsql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= 1"
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

Set up or edit NetSuite account credentials.

**Options:**

- `-p, --profile <name>` - Profile name to configure (defaults to "default")

**Examples:**

```bash
nsql-cli configure
nsql-cli configure --profile prod
nsql-cli configure --profile sandbox
```

### `query`

Execute a SuiteQL query.

**Options:**

- `-q, --query <sql>` - SuiteQL query to execute (required if `--cli-input-suiteql` is not provided)
- `--cli-input-suiteql <file>` - Read SuiteQL query from file (use `file://` prefix for file path). Mutually exclusive with `--query`
- `-p, --profile <name>` - Profile to use (defaults to "default")
- `--dry-run` - Preview the query without executing it
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

**Solution:** Provide credentials using one of these methods:

1. **Environment variables:** Set all 5 required environment variables:

   ```bash
   export NSQL_CONSUMER_KEY="..."
   export NSQL_CONSUMER_SECRET="..."
   export NSQL_TOKEN="..."
   export NSQL_TOKEN_SECRET="..."
   export NSQL_REALM="..."
   ```

2. **Profile configuration:** Run `nsql-cli configure` to create a profile

### Profile Not Found

**Error:** The CLI shows `Credentials source: (none found)` in dry-run mode

**Solution:**

- Check available profiles by looking at `~/.nsql-cli/config.json`
- Create the profile using `nsql-cli configure --profile profile-name`
- Use the correct profile name (case-sensitive)
- Or set environment variables as described above

### Invalid Credentials

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

- Node.js (version 12 or higher)
- NetSuite account with SuiteQL access
- NetSuite RESTlet credentials (Consumer Key, Consumer Secret, Token, Token Secret, Realm)

## Getting NetSuite Credentials

To use this tool, you need to set up a NetSuite integration:

1. Go to Setup > Integrations > Manage Integrations > New
2. Create a new integration and note the Consumer Key and Consumer Secret
3. Create an access token (Setup > Users/Roles > Access Tokens > New)
4. Note the Token, Token Secret, and Realm
5. Assign appropriate permissions to the integration role

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
