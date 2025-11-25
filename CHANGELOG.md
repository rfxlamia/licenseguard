# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2025-11-25

### Added
- **Color-coded License Output** - Visual safety hierarchy for quick risk assessment
  - Green (🟢): Permissive licenses (MIT, Apache-2.0, BSD-*, ISC)
  - Yellow (⚠️): Weak copyleft (MPL-2.0, LGPL-*)
  - Red (❌): Strong copyleft (GPL-*, AGPL-*)
  - Gray (❔): Unknown licenses (requires manual review)
  - Emojis as secondary indicators for accessibility (colorblind-friendly)
  - Works in both light and dark terminal themes
- **Update Notifier** - Automatic update notifications
  - Checks npm registry once per 24 hours
  - Displays banner when newer version available
  - Non-blocking (doesn't slow down CLI startup)
  - Fails silently if network unavailable
  - Cache stored in OS temp directory

### Changed
- All license output now color-coded in `init` command
- Conflict reports now show visual safety indicators

## [2.1.0] - 2025-11-23

### Added

#### Multi-Ecosystem Dependency Scanning
- **C/C++ (Conan) Support**
  - Scans Conan 2.x and 1.x projects
  - Auto-detects `conanfile.txt` and `conanfile.py`
  - Tested with Facebook's folly library (23 dependencies, found 3 real GPL conflicts)
  - Prevents GPL contamination in MIT/Apache projects
- **Rust (Cargo) Support**
  - Scans Cargo projects via `cargo metadata --format-version 1`
  - Auto-detects `Cargo.toml`
  - 100% test coverage
- **Python (pip/pipenv/poetry) Support**
  - **Native Python scanner** using `importlib.metadata` (IPC Bridge approach)
  - **98.6% detection rate** (342/347 packages) vs 9.2% with pip show parsing
  - Auto-detects `requirements.txt`, `Pipfile`, `pyproject.toml`
  - Priority: poetry > pipenv > pip
  - 37 license normalizations for Python ecosystem quirks
  - Batch optimization (30x faster than individual calls)
- **Go (modules) Support**
  - Scans Go modules with streaming NDJSON for large projects
  - Dynamic cache detection via `go env GOMODCACHE`
  - Auto-detects `go.mod`
  - Jaccard Index matching for LICENSE files (no package metadata fallback)

- **Authoritative Source Citations (--explain)**
  - Added `--explain` flag to `init` and `scan` commands
  - Shows citations from FSF, OSI, and Mozilla for compatibility decisions
  - Provides direct URLs to license text and compatibility matrices
  - Helps developers verify "Why is this a conflict?" with legal backing

#### Advanced License Detection
- **Jaccard Index License Detector** (5-layer multi-strategy detection)
  - Layer 1: SPDX-License-Identifier headers (fastest)
  - Layer 2: License header/title detection (for full license texts)
  - Layer 3: Dual-license pattern detection
  - Layer 4: Key phrase patterns (distinctive phrases)
  - Layer 5: Jaccard similarity matching (edge cases)
  - Reduced Go scan warnings from 27 to 7
  - Handles BSD-2-Clause vs BSD-3-Clause differentiation
  - Universal detector usable across all ecosystems
- **GPL Contamination Prevention**
  - Detects copyleft licenses in transitive dependency trees
  - Real-world validation: Found 3 GPL conflicts in folly's 23-dependency tree
  - Business value: Prevents license violations before production

### Changed

#### Architecture
- **Plugin Architecture** - Refactored from monolithic to pluggable ecosystem plugins
  - `lib/scanner/plugins/node.js` - Node.js scanner (extracted from monolithic v2.0)
  - `lib/scanner/plugins/cpp.js` - C/C++ Conan scanner
  - `lib/scanner/plugins/rust.js` - Rust Cargo scanner
  - `lib/scanner/plugins/python.js` - Python scanner with IPC bridge
  - `lib/scanner/plugins/go.js` - Go modules scanner
- **Auto-detection** - Scanner now auto-detects project type (Node > C++ > Rust > Python > Go priority)
- **Node.js Scanner** - Backward compatible, all Epic 2 tests still passing

### Technical

#### New Files
- `lib/scanner/plugins/cpp.js` - Conan plugin (87% coverage)
- `lib/scanner/plugins/rust.js` - Cargo plugin (100% coverage)
- `lib/scanner/plugins/python.js` - Python plugin with IPC bridge (98% coverage)
- `lib/scanner/plugins/python-license-scanner.py` - Native Python scanner script
- `lib/scanner/plugins/go.js` - Go modules plugin (92% coverage)
- `lib/scanner/plugins/node.js` - Refactored Node.js scanner (100% coverage)
- `lib/scanner/license-detector.js` - Jaccard Index multi-strategy detector (85% coverage)

#### Test Growth
- **635 tests** (was 132 in v2.0.0) - **+503 tests, +381% growth**
- **19 test suites** (was ~10 in v2.0.0)
- **0 regressions** - All Epic 2 tests passing
- **Coverage:**
  - Plugins: 94.37% (target: >80%)
  - License detector: 85.41% (target: >80%)
  - Overall: 84.46% statements, 75.95% branches

#### Dependencies
- No new npm dependencies added (uses child_process for ecosystem tools)

#### Performance
- Node.js: <1s for 1500 packages
- Python: ~1-2s for 347 packages (IPC Bridge overhead)
- C++: <1s for 23 packages (Conan metadata parsing)
- Rust: <1s for typical project
- Go: <1s for typical project

### Breaking Changes
None - Fully backward compatible with v2.0.0

### Known Limitations
- Mixed-language projects not yet supported (auto-detection picks first match)
- Python requires Python 3.7+ installed
- C++ requires Conan 1.x or 2.x installed
- Rust requires Cargo installed
- Go requires Go installed

---

**Epic 3 Completed:** Multi-Ecosystem Scanner Support
**Stories Completed:** 3.0 (Plugin Architecture), 3.1 (C++), 3.2 (Rust), 3.3 (Python), 3.4 (Go), plus 2 hotfixes (compat-checker, license-detector)

## [2.0.0] - 2025-11-18

### BREAKING CHANGES

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
- Initial public release (Epic 1)
- Interactive license setup (`init` command)
- Fast mode for CI/CD (`init --fast`)
- 6 embedded license templates (MIT, Apache 2.0, GPL 3.0, BSD 3-Clause, ISC, WTFPL)
- Git hooks for license notifications (post-checkout, pre-commit)
- Global hooks installation via npm postinstall
- `.licenseguardrc` configuration file
- Cross-platform support (Linux, macOS, Windows)
