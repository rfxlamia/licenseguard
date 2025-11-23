# LicenseGuard Plugin Interface

This document defines the contract that all ecosystem plugins must implement.

## Overview

LicenseGuard uses a plugin architecture to support multiple package ecosystems. Each ecosystem (Node.js, Rust, Python, Go, C/C++) has its own plugin that handles detection and dependency scanning.

## Plugin Interface Contract

All plugins must export two required methods:

### `detect()`

Detect if this ecosystem is present in the current directory.

```javascript
/**
 * Detect if this ecosystem is present in current directory
 * @returns {boolean} True if ecosystem detected
 */
function detect() {
  // Check for ecosystem manifest files
  // Example: return fs.existsSync('package.json')
}
```

**Returns:** `boolean` - `true` if ecosystem detected, `false` otherwise

**Examples:**
- Node.js: Check for `package.json`
- Rust: Check for `Cargo.toml`
- Python: Check for `requirements.txt`, `setup.py`, or `pyproject.toml`
- Go: Check for `go.mod`
- C/C++: Check for `conanfile.txt`, `vcpkg.json`, or `CMakeLists.txt`

### `scanDependencies(projectLicense)`

Scan all dependencies and return license compatibility information.

```javascript
/**
 * Scan dependencies and return license information
 * @param {string} projectLicense - Project's own license (SPDX format)
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  // 1. Parse ecosystem manifest
  // 2. Extract dependencies
  // 3. Get license info for each dependency
  // 4. Use compat-checker.checkCompatibility() for each
  // 5. Return results in standard format
}
```

**Parameters:**
- `projectLicense` (string) - The project's license in SPDX format (e.g., "MIT", "Apache-2.0")

**Returns:** `Promise<Object>` with the following structure:

```javascript
{
  timestamp: string,           // ISO timestamp of scan
  totalDependencies: number,   // Count of dependencies scanned
  compatible: number,          // Count of compatible dependencies
  incompatible: number,        // Count with license conflicts
  unknown: number,             // Count with unknown licenses
  issues: [                    // Array of issues found
    {
      package: string,         // Package identifier (e.g., "express@4.18.0")
      license: string,         // SPDX license or "UNKNOWN"
      type: string,            // 'conflict' or 'warning'
      reason: string,          // Human-readable explanation
      location: string         // File path where license was found
    }
  ]
}
```

## Using the Compatibility Checker

All plugins MUST use the universal SPDX compatibility checker:

```javascript
const { checkCompatibility } = require('../compat-checker')

// Check if dependency license is compatible with project license
const result = checkCompatibility(projectLicense, depLicense)
// result = { compatible: boolean, reason: string }
```

## Example Plugin Implementation

Here's a minimal example plugin:

```javascript
/**
 * Example Ecosystem Plugin
 */

const fs = require('fs')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')

function detect() {
  return fs.existsSync('manifest.json')
}

async function scanDependencies(projectLicense) {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'))
  const deps = Object.keys(manifest.dependencies || {})

  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: deps.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: []
  }

  for (let i = 0; i < deps.length; i++) {
    showProgress(i + 1, deps.length)

    const depName = deps[i]
    const depLicense = getDepLicense(depName) // Ecosystem-specific

    const compatResult = checkCompatibility(projectLicense, depLicense)

    if (!compatResult.compatible) {
      const isUnknown = depLicense === 'UNKNOWN'

      if (isUnknown) {
        results.unknown++
      } else {
        results.incompatible++
      }

      results.issues.push({
        package: depName,
        license: depLicense,
        type: isUnknown ? 'warning' : 'conflict',
        reason: compatResult.reason,
        location: 'path/to/license/file'
      })
    } else {
      results.compatible++
    }
  }

  return results
}

module.exports = {
  detect,
  scanDependencies
}
```

## Plugin Registration

To add a new plugin to LicenseGuard:

1. Create the plugin file in `lib/scanner/plugins/<ecosystem>.js`
2. Implement `detect()` and `scanDependencies()` methods
3. Add to plugin registry in `lib/scanner/index.js`:

```javascript
const newPlugin = require('./plugins/new-ecosystem')

const plugins = {
  node: nodePlugin,
  newEcosystem: newPlugin  // Add here
}

const pluginOrder = ['node', 'newEcosystem']  // Add to detection order
```

## Plugin Priority Order

When multiple ecosystems are detected (e.g., a Node.js project with native C++ modules), the first detected plugin wins. Current priority:

1. `node` - Node.js (package.json)
2. `cpp` - C/C++ (future)
3. `rust` - Rust (future)
4. `python` - Python (future)
5. `go` - Go (future)

## Testing Plugins

Each plugin should have corresponding tests in `tests/unit/scanner-<ecosystem>.test.js`:

- Test `detect()` returns true/false correctly
- Test `scanDependencies()` returns proper format
- Test license extraction and compatibility checking
- Use `jest.spyOn(fs, ...)` for filesystem mocking

## Code Style

- No semicolons (except empty for loops)
- Single quotes for strings
- 2-space indentation
- Use `async/await` for all async operations
