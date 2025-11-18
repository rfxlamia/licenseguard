# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-11-18

#### CLI Architecture Migration
- **Migrated from flag-based to subcommand-based routing**
  - Old: `licenseguard --init` → New: `licenseguard init`
  - Old: `licenseguard --ls` → New: `licenseguard ls`
  - Old: `licenseguard --setup` → New: `licenseguard setup`
- **Rationale:** Subcommands provide better CLI semantics and enable future extensibility
- **Migration:** Update all scripts and documentation to use new syntax
- **Backward compatibility:** Use `--noscan` flag for v1.x behavior without dependency scanning

### Added

#### License Compliance Guard
- **Dependency license scanning during init**
  - Scans all npm dependencies for license conflicts
  - Reads `package.json` and `node_modules/*/package.json`
  - Displays scan summary with compatible/incompatible/unknown counts
- **SPDX license compatibility checking**
  - Uses `spdx-satisfies` for industry-standard compatibility rules
  - Checks copyleft vs permissive conflicts (e.g., GPL-3.0 incompatible with MIT)
  - Supports complex license expressions (e.g., "MIT OR Apache-2.0")
- **Conflict detection with blocking**
  - LICENSE creation blocked if incompatible licenses detected
  - Exits with code 1 and error message
  - Shows detailed conflict report with package names, licenses, and reasons
- **scanResult persistence to .licenseguardrc**
  - Optional field to save scan results for transparency
  - Includes timestamp, counts, and issues array
  - Acts as compliance badge (like CI or coverage badges)
  - Prompt with smart defaults: YES for clean scans, NO for conflicts
- **--force flag to override blocking**
  - Creates LICENSE despite conflicts when user explicitly accepts risks
  - Shows warnings but allows proceeding
  - Useful for false positives or acceptable conflicts
- **--noscan flag for v1.x compatibility**
  - Skips dependency scanning entirely
  - Maintains v1.x behavior for non-JavaScript projects
  - No scanResult generated or saved

### Changed

- **Help text improved** - Now shows subcommands with descriptions
- **Error messages enhanced** - More actionable feedback for common issues
- **CLI routing refactored** - Cleaner subcommand architecture
- **Init command enhanced** - Integrated scanning after license selection, before file creation
- **Init-fast command enhanced** - Auto-saves clean scan results, skips saving on conflicts
- **Configuration format extended** - `.licenseguardrc` now supports optional `scanResult` field

### Technical

#### New Dependencies
- `spdx-satisfies@5.x` - SPDX license compatibility checking
- `spdx-expression-parse@4.x` - Parse SPDX license expressions

#### New Modules
- `lib/scanner/index.js` - Dependency scanner with conflict detection
- `lib/compat/rules.js` - License compatibility rules engine

#### Test Coverage
- Added scanner unit tests
- Added file-ops scanResult handling tests
- Maintained 86%+ coverage target

## [1.1.0] - 2025-11-17

### Added
- Initial public release
- Interactive license setup (`init` command)
- Fast mode for CI/CD (`init --fast`)
- 6 embedded license templates (MIT, Apache 2.0, GPL 3.0, BSD 3-Clause, ISC, WTFPL)
- Git hooks for license notifications (post-checkout, pre-commit)
- Global hooks installation via npm postinstall
- `.licenseguardrc` configuration file
- Cross-platform support (Linux, macOS, Windows)

[2.0.0]: https://github.com/v/licenseguard/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/v/licenseguard/releases/tag/v1.1.0
