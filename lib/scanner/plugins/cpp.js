/**
 * C/C++ Ecosystem Plugin (Conan)
 * Scans Conan dependencies for license information
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')

/**
 * Detect if this is a C/C++ Conan project
 * @returns {boolean} True if conanfile.txt or conanfile.py exists
 */
function detect() {
  return fs.existsSync('conanfile.txt') || fs.existsSync('conanfile.py')
}

/**
 * Parse conanfile.txt to get dependency list
 * @returns {string[]} Array of dependency references (e.g., ['boost/1.81.0', 'openssl/3.0.7'])
 */
function parseConanfile() {
  let content = ''

  if (fs.existsSync('conanfile.txt')) {
    content = fs.readFileSync('conanfile.txt', 'utf8')
  } else if (fs.existsSync('conanfile.py')) {
    // For conanfile.py, we rely on conan info command instead
    // Return empty array - getConanPackages will get the actual deps
    return []
  }

  const deps = []
  const lines = content.split('\n')
  let inRequires = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Check for [requires] section
    if (trimmed === '[requires]') {
      inRequires = true
      continue
    }

    // Check for other sections (end of requires)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inRequires = false
      continue
    }

    // Parse dependency in requires section
    if (inRequires && trimmed && !trimmed.startsWith('#')) {
      deps.push(trimmed)
    }
  }

  return deps
}

/**
 * Get installed Conan packages via CLI
 * Supports both Conan 1.x and Conan 2.x
 * @returns {Array} Array of package objects with name, version, license, path
 */
function getConanPackages() {
  let output
  let isConan2 = false

  try {
    // Try Conan 2.x command first
    output = execSync('conan graph info . --format=json', {
      encoding: 'utf8',
      timeout: 30000, // 30 second timeout for graph operations
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })
    isConan2 = true
  } catch (error) {
    // Check if it's a "command not found" for conan itself
    if (error.message.includes('command not found') ||
        error.message.includes('not recognized') ||
        error.message.includes('ENOENT')) {
      throw new Error(
        'Conan not installed.\n\n' +
        'Install Conan: pip install conan\n' +
        'Or skip scanning: licenseguard init --noscan'
      )
    }

    // If Conan 2.x command failed, try Conan 1.x
    if (error.message.includes('Unknown command') ||
        error.message.includes('not a Conan command')) {
      try {
        output = execSync('conan info . --only requires --json', {
          encoding: 'utf8',
          timeout: 10000,
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe']
        })
        isConan2 = false
      } catch (error2) {
        // Check for project not installed
        if (error2.message.includes('Unable to find') ||
            error2.message.includes('not found in local cache')) {
          throw new Error(
            'Conan dependencies not installed.\n\n' +
            'Run: conan install .\n' +
            'Or skip scanning: licenseguard init --noscan'
          )
        }
        throw new Error('Failed to get Conan package info: ' + error2.message)
      }
    } else {
      // Check for project not installed (Conan 2.x errors)
      if (error.message.includes('No such file') ||
          error.message.includes('does not exist') ||
          error.message.includes('ERROR: Package')) {
        throw new Error(
          'Conan dependencies not installed.\n\n' +
          'Run: conan install . --build=missing\n' +
          'Or skip scanning: licenseguard init --noscan'
        )
      }
      throw new Error('Failed to get Conan package info: ' + error.message)
    }
  }

  const data = JSON.parse(output)

  if (isConan2) {
    // Conan 2.x format: { "graph": { "nodes": { "0": {...}, "1": {...} } } }
    const nodes = data.graph?.nodes || {}
    return Object.values(nodes)
      .filter(node => node.ref && node.ref !== 'conanfile') // Skip root node
      .map(node => {
        // Parse reference like "boost/1.81.0"
        const ref = node.ref || ''
        const match = ref.match(/^([^/]+)\/([^@#]+)/)

        return {
          name: match ? match[1] : ref,
          version: match ? match[2] : 'unknown',
          license: node.license || null,
          path: node.package_folder || node.source_folder || 'conan-cache'
        }
      })
  } else {
    // Conan 1.x format: array of package objects
    return data.map(pkg => {
      const ref = pkg.reference || pkg
      const match = ref.match(/^([^/]+)\/([^@]+)/)

      return {
        name: match ? match[1] : ref,
        version: match ? match[2] : 'unknown',
        license: pkg.license || null,
        path: pkg.export_folder || pkg.package_folder || 'conan-cache'
      }
    })
  }
}

/**
 * Extract license from Conan package metadata
 * @param {Object} pkg - Package object from getConanPackages
 * @returns {string} License identifier or 'UNKNOWN'
 */
function extractConanLicense(pkg) {
  // If license is already in package info, use it
  if (pkg.license) {
    // Conan license can be a string or array
    if (Array.isArray(pkg.license)) {
      return pkg.license[0] || 'UNKNOWN'
    }
    return pkg.license
  }

  // Try to read license from conanfile.py in cache
  if (pkg.path && pkg.path !== 'conan-cache') {
    const conanfilePath = path.join(pkg.path, 'conanfile.py')
    if (fs.existsSync(conanfilePath)) {
      try {
        const content = fs.readFileSync(conanfilePath, 'utf8')
        // Look for license = "..." or license = '...'
        const match = content.match(/license\s*=\s*["']([^"']+)["']/)
        if (match) {
          return match[1]
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    // Try LICENSE file
    const licensePath = path.join(pkg.path, 'licenses', 'LICENSE')
    if (fs.existsSync(licensePath)) {
      // Could parse LICENSE file content, but for now mark as found
      return 'UNKNOWN' // Would need license detection logic
    }
  }

  return 'UNKNOWN'
}

/**
 * Scan all Conan dependencies for license compatibility
 * @param {string} projectLicense - The project's license (SPDX format)
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  // Get installed packages via Conan CLI
  const packages = getConanPackages()

  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: packages.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: [],
    packages: [] // Include packages for HTML generation
  }

  // Scan each dependency
  for (let i = 0; i < packages.length; i++) {
    showProgress(i + 1, packages.length)

    const pkg = packages[i]
    const license = extractConanLicense(pkg)

    // Add package to results for HTML generation
    results.packages.push({
      name: pkg.name,
      version: pkg.version,
      license: license
    })

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
        location: pkg.path
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
  parseConanfile,
  getConanPackages,
  extractConanLicense
}
