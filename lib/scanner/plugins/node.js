/**
 * Node.js Ecosystem Plugin
 * Scans node_modules for license information
 */

const fs = require('fs')
const path = require('path')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')
const { deepScan } = require('../deep-scan')

/**
 * Detect if this is a Node.js project
 * @returns {boolean} True if package.json exists
 */
function detect() {
  return fs.existsSync('package.json')
}

/**
 * Parse package.json to get dependencies
 * @returns {{deps: string[], packageJson: Object}} Dependency list and package.json
 */
function parsePackageJson() {
  try {
    const content = fs.readFileSync('package.json', 'utf8')
    const packageJson = JSON.parse(content)

    // Only scan production dependencies
    const deps = Object.keys(packageJson.dependencies || {})

    return { deps, packageJson }
  } catch (error) {
    throw new Error('Failed to read package.json: ' + error.message)
  }
}

/**
 * Extract license info from a dependency
 * @param {string} depName - Dependency name
 * @returns {{name: string, version: string, license: string, path: string}} License info
 */
function extractLicense(depName) {
  const depPath = path.join('node_modules', depName, 'package.json')

  if (!fs.existsSync(depPath)) {
    return {
      name: depName,
      version: 'unknown',
      license: 'NOT_INSTALLED',
      path: depPath
    }
  }

  try {
    const content = fs.readFileSync(depPath, 'utf8')
    const depPackageJson = JSON.parse(content)

    return {
      name: depName,
      version: depPackageJson.version || 'unknown',
      license: depPackageJson.license || 'UNKNOWN',
      path: depPath
    }
  } catch (error) {
    return {
      name: depName,
      version: 'unknown',
      license: 'PARSE_ERROR',
      path: depPath
    }
  }
}

/**
 * Flat scan - scans only top-level dependencies from node_modules
 * This is the fallback when lockfile is not available
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<{packages: Array, unknownCount: number}>} Scan results
 */
async function flatScan(_projectRoot) {
  // Read project package.json
  const { deps } = parsePackageJson()

  const packages = []

  // Scan each top-level dependency
  for (let i = 0; i < deps.length; i++) {
    showProgress(i + 1, deps.length)

    const depName = deps[i]
    const depInfo = extractLicense(depName)

    // Skip if not installed
    if (depInfo.license === 'NOT_INSTALLED' || depInfo.license === 'PARSE_ERROR') {
      packages.push({
        name: depName,
        version: depInfo.version,
        license: 'UNKNOWN'
      })
    } else {
      packages.push({
        name: depName,
        version: depInfo.version,
        license: depInfo.license
      })
    }
  }

  const unknownCount = packages.filter(p => p.license === 'UNKNOWN').length

  return {
    packages,
    unknownCount
  }
}

/**
 * Scan all Node.js dependencies for license compatibility
 * Uses deep scan (lockfile parsing) when available, falls back to flat scan
 * @param {string} projectLicense - The project's license
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  const projectRoot = process.cwd()

  // Check for lockfile - use deep scan if available
  const lockfilePath = path.join(projectRoot, 'package-lock.json')
  let scanResults

  if (fs.existsSync(lockfilePath)) {
    // Deep scan: Parse lockfile to get ALL packages (including transitive)
    scanResults = await deepScan(projectRoot, flatScan)
  } else {
    // Flat scan: Only top-level dependencies
    scanResults = await flatScan(projectRoot)
  }

  // Build compatibility results from scan
  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: scanResults.packages.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: [],
    packages: scanResults.packages // Include packages for HTML generation
  }

  // Check compatibility for each package
  for (const pkg of scanResults.packages) {
    const compatResult = checkCompatibility(projectLicense, pkg.license)

    if (!compatResult.compatible) {
      const isUnknown = pkg.license === 'UNKNOWN'

      if (isUnknown) {
        results.unknown++
      } else {
        results.incompatible++
      }

      results.issues.push({
        package: `${pkg.name}@${pkg.version}`,
        license: pkg.license,
        type: isUnknown ? 'warning' : 'conflict',
        reason: compatResult.reason,
        location: `node_modules/${pkg.name}`
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
  parsePackageJson,
  extractLicense
}
