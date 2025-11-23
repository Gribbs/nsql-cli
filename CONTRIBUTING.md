# Contributing to nsql-cli

Thank you for your interest in contributing to nsql-cli! This document provides guidelines and instructions for contributing.

## Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/your-username/nsql-cli.git
   cd nsql-cli
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run tests to verify everything works:
   ```bash
   npm test
   ```

## Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to automatically determine version bumps and generate changelogs. **All commit messages must follow this format**, or your pull request will fail CI checks.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

The `<type>` must be one of the following:

- **feat**: A new feature (triggers minor version bump)
- **fix**: A bug fix (triggers patch version bump)
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semi-colons, etc.)
- **refactor**: Code refactoring without changing functionality
- **perf**: Performance improvements
- **test**: Adding or updating tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration
- **chore**: Other changes that don't modify src or test files
- **revert**: Revert a previous commit

### Breaking Changes

To trigger a major version bump, include `BREAKING CHANGE:` in the footer or add `!` after the type:

```
feat!: remove deprecated API

BREAKING CHANGE: The old API has been removed. Use the new API instead.
```

or

```
feat(api)!: remove deprecated endpoint
```

### Examples

✅ **Valid commit messages:**

```
feat: add support for custom query parameters
fix: resolve authentication timeout issue
docs: update installation instructions
refactor: simplify configuration logic
feat!: change default output format to JSON

BREAKING CHANGE: CSV is no longer the default format
```

❌ **Invalid commit messages:**

```
Update code
Fixed bug
WIP: working on feature
Add new stuff
```

### Validating Commit Messages Locally

Before pushing, you can validate your commit messages:

```bash
npm run commitlint
```

Or validate a specific commit message:

```bash
echo "feat: add new feature" | npx commitlint
```

## Pull Request Process

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and write tests for new functionality.

3. **Commit your changes** using the conventional commit format:

   ```bash
   git commit -m "feat: add new feature description"
   ```

4. **Run tests** to ensure everything passes:

   ```bash
   npm test
   ```

5. **Push to your fork**:

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub.

### Pull Request Requirements

- All tests must pass
- All commit messages must follow the conventional commit format
- Code should follow existing style and patterns
- New features should include tests
- Documentation should be updated if needed

## Testing

- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run tests with coverage: `npm run test:coverage`

## Release Process

Releases are handled automatically by [semantic-release](https://github.com/semantic-release/semantic-release) when code is merged to `main`:

1. **Merge PR to main** (after tests pass and PR is approved)
2. **semantic-release automatically**:
   - Analyzes commit messages to determine version bump
   - Updates `package.json` version
   - Updates `CHANGELOG.md`
   - Creates a git tag
   - Publishes to npm
   - Creates a GitHub release

### Version Bump Rules

- **Patch** (`3.1.0` → `3.1.1`): `fix:` commits
- **Minor** (`3.1.0` → `3.2.0`): `feat:` commits
- **Major** (`3.1.0` → `4.0.0`): Commits with `BREAKING CHANGE:` or `feat!:` or `fix!:` or `refactor!:` etc.

## Code Style

- Follow existing code patterns and style
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small

## Questions?

If you have questions or need help, please open an issue on GitHub.

Thank you for contributing! 🎉
