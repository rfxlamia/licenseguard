/**
 * Deep Scan Engine - Lockfile Parser
 * Parses package-lock.json to extract ALL packages (including transitive deps)
 * Supports lockfile v1 (npm 5-6), v2 (npm 7-8), v3 (npm 9+)
 */

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')

/**
 * Main deep scan orchestrator
 * Checks for lockfile, parses it, extracts all packages, handles errors gracefully
 * @param {string} projectRoot - Project root directory
 * @param {Function} flatScan - Fallback flat scan function
 * @returns {Promise<{packages: Array, unknownCount: number}>} Scan results
 */
async function deepScan(projectRoot, flatScan) {
  // 1. Locate lockfile
  const lockfilePath = path.join(projectRoot, 'package-lock.json')

  if (!fs.existsSync(lockfilePath)) {
    console.log(chalk.yellow('⚠️  No lockfile found, falling back to flat scan'))
    return await flatScan(projectRoot)
  }

  try {
    // 2. Parse lockfile
    const lockfileContent = fs.readFileSync(lockfilePath, 'utf8')
    const lockfile = JSON.parse(lockfileContent)
    const lockfileVersion = detectLockfileVersion(lockfile)

    // 3. Route to appropriate parser
    let packages = []
    if (lockfileVersion === 1) {
      packages = parseLockfileV1(lockfile.dependencies || {})
    } else if (lockfileVersion >= 2) {
      packages = parseLockfileV2V3(lockfile.packages || {})
    }

    // 4. Extract licenses
    const results = packages.map(pkg => ({
      name: pkg.name,
      version: pkg.version,
      license: extractLicenseFromPackage(pkg)
    }))

    // Count unknown licenses
    const unknownCount = results.filter(r => r.license === 'UNKNOWN').length

    return {
      packages: results,
      unknownCount
    }

  } catch (error) {
    // Lockfile parse error - fallback to flat scan
    console.log(chalk.yellow('⚠️  Could not parse lockfile, using flat scan'))
    return await flatScan(projectRoot)
  }
}

/**
 * Recursive parser for npm 5-6 nested lockfiles (v1)
 * Flattens nested dependencies structure into flat array
 * @param {Object} dependencies - Dependencies object from lockfile
 * @param {Array} parentPath - Parent dependency path (for tracking)
 * @returns {Array<{name: string, version: string, license: string}>} Flat array of packages
 */
function parseLockfileV1(dependencies, parentPath = []) {
  let packages = []

  for (const [name, info] of Object.entries(dependencies)) {
    packages.push({
      name,
      version: info.version,
      license: info.license
    })

    // Recursively process nested dependencies
    if (info.dependencies) {
      packages.push(...parseLockfileV1(info.dependencies, [...parentPath, name]))
    }
  }

  return packages
}

/**
 * Iterative parser for npm 7+ flat lockfiles (v2/v3)
 * Filters node_modules/ keys and extracts package info
 * @param {Object} packages - Packages object from lockfile
 * @returns {Array<{name: string, version: string, license: string}>} Flat array of packages
 */
function parseLockfileV2V3(packages) {
  return Object.entries(packages)
    .filter(([pkgPath]) => pkgPath.startsWith('node_modules/'))
    .map(([pkgPath, info]) => ({
      name: pkgPath.replace('node_modules/', '').split('/node_modules/').pop(),
      version: info.version,
      license: info.license
    }))
}

/**
 * Detect lockfile version from lockfileVersion field
 * Defaults to v1 if field is missing
 * @param {Object} lockfile - Parsed lockfile object
 * @returns {number} Lockfile version (1, 2, or 3)
 */
function detectLockfileVersion(lockfile) {
  return lockfile.lockfileVersion || 1
}

/**
 * Extract license from package object
 * Uses license field if present, otherwise returns UNKNOWN
 * @param {Object} pkg - Package object
 * @returns {string} License identifier or 'UNKNOWN'
 */
function extractLicenseFromPackage(pkg) {
  // Try license field first
  if (pkg.license && pkg.license !== 'UNKNOWN') {
    return pkg.license
  }

  // Fallback to UNKNOWN
  // Note: Future enhancement could integrate with license-detector.js
  return 'UNKNOWN'
}

module.exports = {
  deepScan,
  parseLockfileV1,
  parseLockfileV2V3,
  detectLockfileVersion,
  extractLicenseFromPackage
}
