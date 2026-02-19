# [3.4.0](https://github.com/Gribbs/nsql-cli/compare/v3.3.0...v3.4.0) (2026-02-19)


### Features

* add OAuth 2.0 browser-based authentication ([518085f](https://github.com/Gribbs/nsql-cli/commit/518085ffbb85e7955bc0cf466af290acc728102c))

# [3.3.0](https://github.com/Gribbs/nsql-cli/compare/v3.2.2...v3.3.0) (2025-12-22)


### Features

* add environment variable authentication ([16cedd0](https://github.com/Gribbs/nsql-cli/commit/16cedd04e970c38ec025aeec4941d9a6d269e3e4))

## [3.2.2](https://github.com/Gribbs/nsql-cli/compare/v3.2.1...v3.2.2) (2025-11-23)


### Bug Fixes

* **cli:** read version from package.json instead of hardcoding ([7ba2dc4](https://github.com/Gribbs/nsql-cli/commit/7ba2dc45ba60d357b95e8574bc2cf2e7f240f84f))

## [3.2.1](https://github.com/Gribbs/nsql-cli/compare/v3.2.0...v3.2.1) (2025-11-23)


### Bug Fixes

* configure git remote URL with PAT for semantic-release ([796cc24](https://github.com/Gribbs/nsql-cli/commit/796cc241d11fc74af718f74cfab15bdf7bf599ca))


### Reverts

* remove PAT configuration, use GITHUB_TOKEN directly ([61bdcdd](https://github.com/Gribbs/nsql-cli/commit/61bdcddd2e9cc5a647a392c4d904526b330dc14c))

# [3.2.0](https://github.com/Gribbs/nsql-cli/compare/v3.1.0...v3.2.0) (2025-11-23)


### Bug Fixes

* add test isolation fixes for Release workflow ([546bd74](https://github.com/Gribbs/nsql-cli/commit/546bd74fd92b700ef701c9a8b9ce50f95dbc821e))


### Features

* add automated npm publishing and file input support ([9ef9c39](https://github.com/Gribbs/nsql-cli/commit/9ef9c39c5b50531f15a1fe097041b26a57866b07))


### Reverts

* keep granular token approach for npm authentication ([1f0089f](https://github.com/Gribbs/nsql-cli/commit/1f0089fce51b8d9a50f9f96a2e0524075869a519))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] - Unreleased

### Added

- Initial changelog
- `--cli-input-suiteql` option to read queries from SQL files with `file://` prefix support
- Support for both relative and absolute file paths
- Whitespace normalization for multi-line SQL queries to ensure compatibility with NetSuite's API

### Changed

- Query whitespace is now normalized (newlines and multiple spaces converted to single spaces) to ensure proper parsing by NetSuite's API

## [3.0.0] - Unreleased

### Changed

- Major version update

## [2.0.0] - Unreleased

### Changed

- Major version update

## [1.0.0] - Unreleased

### Added

- Initial release

[3.1.0]: https://github.com/Gribbs/nsql-cli/compare/v3.0.0...v3.1.0
[3.0.0]: https://github.com/Gribbs/nsql-cli/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/Gribbs/nsql-cli/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Gribbs/nsql-cli/releases/tag/v1.0.0
