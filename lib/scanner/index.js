/**
 * Dependency License Scanner
 * Scans node_modules for license conflicts
 */

const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const { checkCompatibility } = require('./compat-checker')
const { showProgress } = require('./progress')

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
 * Scan all dependencies for license compatibility
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

/**
 * Display conflict report to console
 * @param {Object} scanResult - Scan results
 * @param {string} projectLicense - The project's license
 * @returns {boolean} True if conflicts found (incompatible licenses), false otherwise
 */
function displayConflictReport(scanResult, projectLicense) {
  if (scanResult.incompatible === 0 && scanResult.unknown === 0) {
    console.log(chalk.green(`\n✅ All ${scanResult.totalDependencies} dependencies compatible with ${projectLicense.toUpperCase()}!`))
    return false // No conflicts
  }

  const issueCount = scanResult.incompatible + scanResult.unknown
  const hasConflicts = scanResult.incompatible > 0

  if (hasConflicts) {
    console.log(chalk.red(`\n❌ ${issueCount} issue(s) found:\n`))
  } else {
    // Only warnings, no conflicts
    console.log(chalk.yellow(`\n⚠️  ${issueCount} warning(s) found:\n`))
  }

  for (const issue of scanResult.issues) {
    if (issue.type === 'conflict') {
      console.log(chalk.red(`❌ ${issue.package} (${issue.license})`))
    } else {
      console.log(chalk.yellow(`⚠️  ${issue.package} (${issue.license})`))
    }
    console.log(chalk.gray(`   ${issue.reason}`))
    console.log(chalk.gray(`   Location: ${issue.location}\n`))
  }

  // Only return true if there are actual conflicts (incompatible licenses)
  // Warnings (unknown licenses) should not block
  return hasConflicts
}

module.exports = {
  scanDependencies,
  parsePackageJson,
  extractLicense,
  displayConflictReport
}
