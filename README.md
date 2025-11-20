# SuiteQL CLI

A command-line tool for executing SuiteQL queries against NetSuite using the `netsuite-api-client` package. Manage multiple NetSuite account profiles (sandbox/production) with AWS CLI-style configuration.

## Features

- Execute SuiteQL queries from the command line
- Profile-based credential management (similar to AWS CLI)
- Support for multiple NetSuite accounts (sandbox, production, etc.)
- Interactive configuration setup
- JSON output by default
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
suiteql-cli query --query "SELECT id, name FROM customer LIMIT 10"
```

### Using a Specific Profile

Execute a query using a named profile:

```bash
suiteql-cli query --query "SELECT id, name FROM customer LIMIT 10" --profile prod
```

### Query Examples

**Get all customers:**

```bash
suiteql-cli query --query "SELECT id, name, email FROM customer"
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
suiteql-cli query --query "SELECT id, tranid, trandate, total FROM transaction WHERE type = 'SalesOrd' ORDER BY trandate DESC LIMIT 50"
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

**Examples:**

```bash
suiteql-cli query --query "SELECT * FROM customer LIMIT 10"
suiteql-cli query --query "SELECT id, name FROM item" --profile prod
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

By default, all query results are output as JSON with pretty-printing (2-space indentation). This makes it easy to pipe results to other tools or parse programmatically.

**Example output:**

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

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
