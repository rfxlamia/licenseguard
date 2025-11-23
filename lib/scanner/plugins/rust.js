/**
 * Rust Ecosystem Plugin (Cargo)
 * Scans Cargo dependencies for license information
 */

const fs = require('fs')
const { execSync } = require('child_process')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')

/**
 * Detect if this is a Rust Cargo project
 * @returns {boolean} True if Cargo.toml exists
 */
function detect() {
  return fs.existsSync('Cargo.toml')
}

/**
 * Get Cargo metadata via CLI
 * @returns {Object} Cargo metadata JSON
 */
function getCargoMetadata() {
  try {
    const output = execSync('cargo metadata --format-version 1', {
      encoding: 'utf8',
      timeout: 30000, // 30 second timeout for large projects
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    return JSON.parse(output)
  } catch (error) {
    // Check if Cargo is not installed
    if (error.message.includes('command not found') ||
        error.message.includes('not recognized') ||
        error.message.includes('ENOENT')) {
      throw new Error(
        'Cargo not installed.\n\n' +
        'Install Rust/Cargo: https://rustup.rs\n' +
        'Or skip scanning: licenseguard init --noscan'
      )
    }

    // Check for project not found / no Cargo.toml
    if (error.message.includes('could not find') ||
        error.message.includes('no Cargo.toml')) {
      throw new Error(
        'No Cargo.toml found in current directory.\n\n' +
        'Make sure you are in a Rust project directory.'
      )
    }

    throw new Error('Failed to get Cargo metadata: ' + error.message)
  }
}

/**
 * Normalize license string from Rust ecosystem conventions to SPDX format
 * Many older Rust crates use "/" instead of " OR " for dual-licensing
 * e.g., "MIT/Apache-2.0" → "MIT OR Apache-2.0"
 *
 * @param {string} license - Raw license string from Cargo metadata
 * @returns {string} Normalized SPDX-compliant license string
 */
function normalizeLicense(license) {
  if (!license) return license

  // Rust ecosystem convention: "/" means OR (dual-licensing)
  // Convert "MIT/Apache-2.0" → "MIT OR Apache-2.0"
  // Handle both "MIT/Apache-2.0" and "Apache-2.0 / MIT" (with spaces)
  if (license.includes('/') && !license.includes(' OR ')) {
    return license
      .split('/')
      .map(part => part.trim())
      .join(' OR ')
  }

  return license
}

/**
 * Extract license from Cargo package metadata
 * @param {Object} pkg - Package object from cargo metadata
 * @returns {string} License identifier or 'UNKNOWN'
 */
function extractCrateLicense(pkg) {
  // Cargo metadata includes license field (SPDX format)
  // e.g., "MIT", "Apache-2.0", "MIT OR Apache-2.0"
  if (pkg.license) {
    // Normalize legacy Rust license format to SPDX
    return normalizeLicense(pkg.license)
  }

  // Some crates use license_file instead
  if (pkg.license_file) {
    return 'UNKNOWN' // Would need to parse license file content
  }

  return 'UNKNOWN'
}

/**
 * Filter packages to only include actual dependencies (not root package)
 * @param {Object} metadata - Cargo metadata object
 * @returns {Array} Array of dependency packages
 */
function filterDependencies(metadata) {
  const packages = metadata.packages || []
  const rootPackageId = metadata.resolve?.root

  // Filter out the root package (the project itself)
  return packages.filter(pkg => {
    // Skip if this is the root package
    if (rootPackageId && pkg.id === rootPackageId) {
      return false
    }

    // Skip packages that are path dependencies from the workspace root
    // These are typically the project's own packages
    if (pkg.source === null && pkg.manifest_path) {
      const manifestPath = pkg.manifest_path
      // If manifest is in the current directory or a subdirectory, it's part of the project
      const cwd = process.cwd()
      if (manifestPath.startsWith(cwd)) {
        return false
      }
    }

    return true
  })
}

/**
 * Scan all Cargo dependencies for license compatibility
 * @param {string} projectLicense - The project's license (SPDX format)
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  // Get metadata via Cargo CLI
  const metadata = getCargoMetadata()

  // Filter to only actual dependencies
  const packages = filterDependencies(metadata)

  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: packages.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: []
  }

  // Scan each dependency
  for (let i = 0; i < packages.length; i++) {
    showProgress(i + 1, packages.length)

    const pkg = packages[i]
    const license = extractCrateLicense(pkg)

    // Check compatibility using universal compat-checker
    const compatResult = checkCompatibility(projectLicense, license)

    if (!compatResult.compatible) {
      const isUnknown = license === 'UNKNOWN'

      if (isUnknown) {
        results.unknown++
      } else {
        results.incompatible++
      }

      results.issues.push({
        package: `${pkg.name}@${pkg.version}`,
        license: license,
        type: isUnknown ? 'warning' : 'conflict',
        reason: compatResult.reason,
        location: pkg.manifest_path || 'crates.io'
      })
    } else {
      results.compatible++
    }
  }

  return results
}

module.exports = {
  detect,
  scanDependencies,
  // Export internal functions for testing
  getCargoMetadata,
  extractCrateLicense,
  filterDependencies,
  normalizeLicense
}
