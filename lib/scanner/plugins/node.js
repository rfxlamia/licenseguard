/**
 * Node.js Ecosystem Plugin
 * Scans node_modules for license information
 */

const fs = require('fs')
const path = require('path')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')

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
 * Scan all Node.js dependencies for license compatibility
 * @param {string} projectLicense - The project's license
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  // 1. Read project package.json
  const { deps } = parsePackageJson()

  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: deps.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: []
  }

  // 2. Scan each dependency
  for (let i = 0; i < deps.length; i++) {
    showProgress(i + 1, deps.length)

    const depName = deps[i]
    const depInfo = extractLicense(depName)

    // Skip if not installed
    if (depInfo.license === 'NOT_INSTALLED') {
      continue
    }

    // Handle parse errors as unknown
    if (depInfo.license === 'PARSE_ERROR') {
      results.unknown++
      results.issues.push({
        package: `${depName}@${depInfo.version}`,
        license: 'UNKNOWN',
        type: 'warning',
        reason: 'Failed to parse package.json',
        location: depInfo.path
      })
      continue
    }

    // 3. Check compatibility
    const compatResult = checkCompatibility(projectLicense, depInfo.license)

    if (!compatResult.compatible) {
      const isUnknown = depInfo.license === 'UNKNOWN'

      if (isUnknown) {
        results.unknown++
      } else {
        results.incompatible++
      }

      results.issues.push({
        package: `${depName}@${depInfo.version}`,
        license: depInfo.license,
        type: isUnknown ? 'warning' : 'conflict',
        reason: compatResult.reason,
        location: depInfo.path
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
