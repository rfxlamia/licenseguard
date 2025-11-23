/**
 * Python Ecosystem Plugin (pip/pipenv/poetry)
 * Scans Python dependencies for license information
 * Supports three package managers with priority: poetry > pipenv > pip
 */

const fs = require('fs')
const { execSync } = require('child_process')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')
const { normalize } = require('../license-normalizer')

/**
 * Detect if this is a Python project and return package manager
 * Priority order: poetry > pipenv > pip
 * @returns {string|boolean} 'poetry' | 'pipenv' | 'pip' | false
 */
function detect() {
  const hasPoetry = fs.existsSync('pyproject.toml')
  const hasPipenv = fs.existsSync('Pipfile')
  const hasPip = fs.existsSync('requirements.txt')

  // Priority: poetry > pipenv > pip
  if (hasPoetry) return 'poetry'
  if (hasPipenv) return 'pipenv'
  if (hasPip) return 'pip'

  return false
}

/**
 * Parse requirements.txt to get dependency list
 * @returns {string[]} Array of package names
 */
function parseRequirementsTxt() {
  if (!fs.existsSync('requirements.txt')) {
    return []
  }

  const content = fs.readFileSync('requirements.txt', 'utf8')
  const packages = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    // Extract package name from various formats:
    // requests==2.31.0
    // numpy>=1.24.0
    // pandas~=2.0.0
    // flask[async]>=2.0.0
    // git+https://... (skip)
    // -r requirements-dev.txt (skip)
    // -e . (skip editable installs)

    if (trimmed.startsWith('-') || trimmed.startsWith('git+') || trimmed.startsWith('http')) {
      continue
    }

    // Extract package name before version specifier or extras
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)/)
    if (match) {
      packages.push(match[1])
    }
  }

  return packages
}

/**
 * Parse Pipfile to get dependency list
 * @returns {string[]} Array of package names
 */
function parsePipfile() {
  if (!fs.existsSync('Pipfile')) {
    return []
  }

  const content = fs.readFileSync('Pipfile', 'utf8')
  const packages = []
  let inPackages = false

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Check for [packages] section
    if (trimmed === '[packages]') {
      inPackages = true
      continue
    }

    // Check for other sections (end of packages)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inPackages = false
      continue
    }

    // Parse package in packages section
    // Format: package = "version" or package = {version = "1.0.0"}
    if (inPackages && trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=/)
      if (match) {
        packages.push(match[1])
      }
    }
  }

  return packages
}

/**
 * Parse pyproject.toml to get dependency list (Poetry format)
 * @returns {string[]} Array of package names
 */
function parsePyprojectToml() {
  if (!fs.existsSync('pyproject.toml')) {
    return []
  }

  const content = fs.readFileSync('pyproject.toml', 'utf8')
  const packages = []
  let inDependencies = false

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Check for [tool.poetry.dependencies] section
    if (trimmed === '[tool.poetry.dependencies]') {
      inDependencies = true
      continue
    }

    // Check for other sections (end of dependencies)
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inDependencies = false
      continue
    }

    // Parse package in dependencies section
    // Format: package = "^1.0.0" or package = {version = "^1.0.0"}
    if (inDependencies && trimmed && !trimmed.startsWith('#')) {
      // Skip python version specification
      if (trimmed.startsWith('python =')) {
        continue
      }

      const match = trimmed.match(/^([a-zA-Z0-9_-]+)\s*=/)
      if (match) {
        packages.push(match[1])
      }
    }
  }

  return packages
}

/**
 * Batch fetch licenses using native Python script
 * Uses importlib.metadata directly in Python for maximum reliability
 * Handles: version compatibility, encoding, virtualenv detection
 *
 * @param {string[]} packageNames - Array of package names
 * @param {string} manager - Package manager (for error messages)
 * @returns {Object} Map of { packageName: licenseString }
 */
function getLicensesBatch(packageNames, manager) {
  if (packageNames.length === 0) return {}

  const CHUNK_SIZE = 100  // Process in chunks to avoid stdin size limits
  const licenseMap = {}
  const totalChunks = Math.ceil(packageNames.length / CHUNK_SIZE)

  // Path to Python scanner script
  const scriptPath = `${__dirname}/python-license-scanner.py`

  for (let i = 0; i < packageNames.length; i += CHUNK_SIZE) {
    const currentChunk = Math.floor(i / CHUNK_SIZE) + 1
    showProgress(currentChunk, totalChunks)

    const chunk = packageNames.slice(i, i + CHUNK_SIZE)

    try {
      // Call Python scanner script with package list via stdin
      const input = JSON.stringify(chunk)
      const output = execSync(`python "${scriptPath}"`, {
        input: input,
        encoding: 'utf8',
        timeout: 60000,  // 60 seconds for large chunks
        stdio: ['pipe', 'pipe', 'pipe']
      })

      // Parse JSON response
      const results = JSON.parse(output)

      // Normalize licenses before adding to map (using shared normalizer)
      for (const [pkg, license] of Object.entries(results)) {
        const normalized = normalize(license)
        licenseMap[pkg.toLowerCase()] = normalized
      }

    } catch (error) {
      const stderr = error.stderr || ''
      const message = error.message || ''

      // 1. FATAL: Python not available
      if (message.includes('command not found') ||
          message.includes('not recognized') ||
          message.includes('ENOENT')) {
        throw new Error(
          'Python not installed.\n\n' +
          'Install Python 3.7+ from: https://www.python.org/downloads/\n' +
          'Or skip scanning: licenseguard init --noscan'
        )
      }

      // 2. Try to parse error output for diagnostics
      try {
        const errorData = JSON.parse(stderr)
        if (errorData.error) {
          throw new Error(`Python scanner error: ${errorData.error}`)
        }
      } catch (parseErr) {
        // stderr is not JSON, show raw error
      }

      // 3. FATAL: System errors
      const fatalErrors = [
        'Permission denied',
        'No space left on device',
        'Disk quota exceeded',
        'Read-only file system'
      ]

      const isFatal = fatalErrors.some(err =>
        stderr.includes(err) || message.includes(err)
      )

      if (isFatal) {
        throw new Error(
          'Python scanner failed with system error:\n\n' +
          (stderr || message)
        )
      }

      // 4. UNKNOWN: Mark all packages in this chunk as UNKNOWN
      for (const pkg of chunk) {
        licenseMap[pkg.toLowerCase()] = 'UNKNOWN'
      }
    }
  }

  return licenseMap
}

/**
 * Scan all Python dependencies for license compatibility
 * Uses batch processing for 30x performance improvement on large projects
 * @param {string} projectLicense - The project's license (SPDX format)
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  const manager = detect()

  if (!manager) {
    throw new Error('No Python package manager detected (requirements.txt, Pipfile, or pyproject.toml)')
  }

  // Get dependency list based on manager
  let packages = []
  if (manager === 'poetry') {
    packages = parsePyprojectToml()
  } else if (manager === 'pipenv') {
    packages = parsePipfile()
  } else {
    packages = parseRequirementsTxt()
  }

  // Normalize package names to lowercase for consistent lookup
  packages = packages.map(pkg => pkg.toLowerCase())

  // Batch fetch licenses (O(n/50) instead of O(n) execSync calls)
  const licenseMap = getLicensesBatch(packages, manager)

  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: packages.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: []
  }

  // Process results (fast in-memory loop)
  for (const packageName of packages) {
    const license = licenseMap[packageName] || 'UNKNOWN'

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
        package: packageName,
        license: license,
        type: isUnknown ? 'warning' : 'conflict',
        reason: compatResult.reason,
        location: 'Python site-packages'
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
  parseRequirementsTxt,
  parsePipfile,
  parsePyprojectToml,
  getLicensesBatch
}
