# SuiteQL CLI

A command-line tool for executing SuiteQL queries against NetSuite using the `netsuite-api-client` package. Manage multiple NetSuite account profiles (sandbox/production).

## Features

- Execute SuiteQL queries from the command line
- Profile-based credential management
- Support for multiple NetSuite accounts (sandbox, production, etc.)
- Interactive configuration setup
- Multiple output formats (JSON, CSV)
- Dry-run mode to preview queries without executing
- Edit existing profiles
- Comprehensive help documentation

## Installation

### Global Installation

Install the package globally to use `suiteql-cli` from anywhere:

```bash
npm install -g suiteql-cli
```

### Local Installation

Install as a development dependency in your project:

```bash
npm install --save-dev suiteql-cli
```

Then use it via `npx`:

```bash
npx suiteql-cli --help
```

## Configuration

Before executing queries, you need to configure your NetSuite account credentials.

### Initial Setup

Configure the default profile:

```bash
suiteql-cli configure
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
suiteql-cli configure --profile prod

# Configure a sandbox profile
suiteql-cli configure --profile sandbox
```

### Editing Existing Profiles

To edit an existing profile, simply run configure with the profile name:

```bash
suiteql-cli configure --profile prod
```

The tool will display the current configuration (with masked sensitive values) and allow you to update any fields.

### Configuration Storage

Profiles are stored in `~/.suiteql-cli/config.json`. The file structure looks like:

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

## Usage

### Execute a Query

Execute a SuiteQL query using the default profile:

```bash
suiteql-cli query --query "SELECT id, name FROM customer WHERE ROWNUM <= 10"
```

### Using a Specific Profile

Execute a query using a named profile:

```bash
suiteql-cli query --query "SELECT id, name FROM customer WHERE ROWNUM <= 10" --profile prod
```

### Dry-Run Mode

Preview a query without executing it:

```bash
suiteql-cli query --query "SELECT id, name FROM customer WHERE ROWNUM <= 10" --dry-run
```

This will display the query, profile, and realm information without making any API calls.

### Output Formats

By default, results are output as JSON. You can also output as CSV:

```bash
# JSON output (default)
suiteql-cli query --query "SELECT id, name FROM customer WHERE ROWNUM <= 10"

# CSV output
suiteql-cli query --query "SELECT id, name FROM customer WHERE ROWNUM <= 10" --format csv
```

### Query Parameters

You can use placeholders in your queries and pass values via CLI arguments. Placeholders use the `:name` syntax:

```bash
# Using --param option
suiteql-cli query --query "SELECT id FROM customer WHERE id = :id" --param id=123

# Using direct option (--key value)
suiteql-cli query --query "SELECT id FROM customer WHERE id = :id" --id 123

# Multiple parameters
suiteql-cli query --query "SELECT id FROM customer WHERE id = :id AND name = :name" --id 123 --name "Test Customer"

# Parameters with dry-run
suiteql-cli query --query "SELECT id FROM customer WHERE ROWNUM <= :limit" --param limit=10 --dry-run
```

**Parameter Types:**

- **Numbers**: Automatically detected and inserted without quotes (e.g., `--id 123` → `123`)
- **Strings**: Automatically quoted (e.g., `--name "Test"` → `'Test'`)
- **Booleans**: Inserted without quotes (e.g., `--active true` → `true`)

**Note:** NetSuite SuiteQL uses `ROWNUM` syntax instead of standard SQL `LIMIT`. Use `WHERE ROWNUM <= :limit` in your queries.

### Query Examples

**Get customers (limited):**

```bash
suiteql-cli query --query "SELECT id, name, email FROM customer WHERE ROWNUM <= 10"
```

**Get transactions for a specific date range:**

```bash
suiteql-cli query --query "SELECT id, type, trandate, amount FROM transaction WHERE trandate BETWEEN '2024-01-01' AND '2024-12-31'"
```

**Get items with inventory:**

```bash
suiteql-cli query --query "SELECT id, itemid, displayname, quantityavailable FROM item WHERE itemtype = 'InvtPart' AND quantityavailable > 0"
```

**Get employees:**

```bash
suiteql-cli query --query "SELECT id, entityid, firstname, lastname, email FROM employee WHERE isinactive = 'F'"
```

**Get sales orders:**

```bash
suiteql-cli query --query "SELECT id, tranid, trandate, total FROM transaction WHERE type = 'SalesOrd' ORDER BY trandate DESC AND ROWNUM <= 50"
```

**Get customer by ID (using parameters):**

```bash
suiteql-cli query --query "SELECT id, name, email FROM customer WHERE id = :id" --id 123
```

## Command Reference

### `configure`

Set up or edit NetSuite account credentials.

**Options:**

- `-p, --profile <name>` - Profile name to configure (defaults to "default")

**Examples:**

```bash
suiteql-cli configure
suiteql-cli configure --profile prod
suiteql-cli configure --profile sandbox
```

### `query`

Execute a SuiteQL query.

**Options:**

- `-q, --query <sql>` - SuiteQL query to execute (required)
- `-p, --profile <name>` - Profile to use (defaults to "default")
- `--dry-run` - Preview the query without executing it
- `-f, --format <format>` - Output format: `json` or `csv` (defaults to "json")
- `--param <key=value>` - Query parameter (can be used multiple times). Use `:key` in query as placeholder
- `--<key> <value>` - Alternative way to pass parameters. Any unknown option is treated as a parameter

**Examples:**

```bash
# Basic query with JSON output
suiteql-cli query --query "SELECT * FROM customer WHERE ROWNUM <= 10"

# Query with specific profile
suiteql-cli query --query "SELECT id, name FROM item" --profile prod

# Preview query without executing
suiteql-cli query --query "SELECT id, name FROM customer" --dry-run

# Output results as CSV
suiteql-cli query --query "SELECT id, name, email FROM customer WHERE ROWNUM <= 10" --format csv

# Query with parameters
suiteql-cli query --query "SELECT id FROM customer WHERE id = :id" --id 123

# Query with multiple parameters
suiteql-cli query --query "SELECT id FROM customer WHERE id = :id AND name = :name" --param id=123 --param name="Test"

# Combine options
suiteql-cli query --query "SELECT id, name FROM item WHERE ROWNUM <= :limit" --profile prod --format csv --limit 50
```

### Help

Get help for any command:

```bash
suiteql-cli --help
suiteql-cli configure --help
suiteql-cli query --help
```

## Troubleshooting

### Configuration File Not Found

**Error:** `Configuration file not found.`

**Solution:** Run `suiteql-cli configure` to create your first profile.

### Profile Not Found

**Error:** `Profile 'profile-name' not found.`

**Solution:**

- Check available profiles by looking at `~/.suiteql-cli/config.json`
- Create the profile using `suiteql-cli configure --profile profile-name`
- Use the correct profile name (case-sensitive)

### Invalid Credentials

**Error:** `Error executing query: [authentication error]`

**Solution:**

- Verify your credentials are correct
- Check that your token hasn't expired
- Ensure your NetSuite account has SuiteQL access enabled
- Reconfigure the profile: `suiteql-cli configure --profile <profile-name>`

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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
