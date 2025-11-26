/**
 * Go Ecosystem Plugin (Go Modules)
 * Scans Go module dependencies for license information
 *
 * Features:
 * - Dynamic module cache location via `go env GOMODCACHE` (AC #7)
 * - Streaming NDJSON parsing via spawn for large projects (AC #8)
 * - Jaccard Index license detection from LICENSE files (AC #6)
 * - SPDX compatibility checking via compat-checker.js (AC #3)
 */

const fs = require('fs')
const path = require('path')
const { spawn, execSync } = require('child_process')
const { checkCompatibility } = require('../compat-checker')
const { showProgress } = require('../progress')
const { detectLicenseFromText } = require('../license-detector')

/**
 * Detect if this is a Go modules project
 * @returns {boolean} True if go.mod exists
 */
function detect() {
  return fs.existsSync('go.mod')
}

/**
 * Get Go module cache path dynamically via `go env GOMODCACHE`
 * Does NOT hardcode $GOPATH/pkg/mod (AC #7)
 *
 * @returns {string} Module cache directory path
 * @throws {Error} If Go is not installed
 */
function getGoModuleCachePath() {
  try {
    const cachePath = execSync('go env GOMODCACHE', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim()

    return cachePath
  } catch (error) {
    if (error.message.includes('command not found') ||
        error.message.includes('not recognized') ||
        error.message.includes('ENOENT')) {
      throw new Error(
        'Go project detected but Go is not installed.\n\n' +
        'Install Go: https://go.dev/doc/install\n' +
        'Or skip scanning: licenseguard init --noscan'
      )
    }
    throw new Error('Failed to get Go module cache path: ' + error.message)
  }
}

/**
 * Get Go modules using streaming (spawn) for large projects (AC #8)
 * Processes NDJSON output line-by-line to avoid maxBuffer limits
 *
 * @returns {Promise<Array>} Array of module objects from go list
 * @throws {Error} If Go is not installed or command fails
 */
async function getGoModulesStreaming() {
  return new Promise((resolve, reject) => {
    const modules = []
    let buffer = ''
    let stderr = ''

    const goList = spawn('go', ['list', '-m', '-json', 'all'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Set timeout (30 seconds for large projects like Kubernetes)
    const timeout = setTimeout(() => {
      goList.kill('SIGTERM')
      reject(new Error(
        'Go module listing timed out after 30 seconds.\n\n' +
        'This may indicate a very large project or network issues.\n' +
        'Try running `go mod download` first to cache dependencies.'
      ))
    }, 30000)

    goList.stdout.on('data', (chunk) => {
      buffer += chunk.toString()

      // Process complete JSON objects (NDJSON format)
      // Go outputs one JSON object per line, but objects may span multiple lines
      // We need to parse complete JSON objects
      let startIdx = 0
      let braceCount = 0
      let inString = false
      let escape = false

      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]

        if (escape) {
          escape = false
          continue
        }

        if (char === '\\' && inString) {
          escape = true
          continue
        }

        if (char === '"') {
          inString = !inString
          continue
        }

        if (inString) continue

        if (char === '{') {
          if (braceCount === 0) startIdx = i
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            // Complete JSON object found
            const jsonStr = buffer.substring(startIdx, i + 1)
            try {
              const module = JSON.parse(jsonStr)
              modules.push(module)
            } catch (parseErr) {
              // Skip malformed JSON
            }
            startIdx = i + 1
          }
        }
      }

      // Keep incomplete data in buffer
      buffer = buffer.substring(startIdx)
    })

    goList.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    goList.on('error', (error) => {
      clearTimeout(timeout)
      if (error.code === 'ENOENT') {
        reject(new Error(
          'Go project detected but Go is not installed.\n\n' +
          'Install Go: https://go.dev/doc/install\n' +
          'Or skip scanning: licenseguard init --noscan'
        ))
      } else {
        reject(new Error('Failed to run go list: ' + error.message))
      }
    })

    goList.on('close', (code) => {
      clearTimeout(timeout)

      if (code !== 0) {
        // Check for common error patterns
        if (stderr.includes('go.mod file not found')) {
          reject(new Error(
            'No go.mod found in current directory.\n\n' +
            'Make sure you are in a Go modules project directory.'
          ))
        } else if (stderr.includes('not a valid module')) {
          reject(new Error('Invalid Go module: ' + stderr))
        } else {
          reject(new Error(`go list exited with code ${code}: ${stderr}`))
        }
        return
      }

      resolve(modules)
    })
  })
}

/**
 * Synchronous fallback for getting Go modules (for smaller projects)
 * @returns {Array} Array of module objects
 */
function getGoModulesSync() {
  try {
    const output = execSync('go list -m -json all', {
      encoding: 'utf8',
      timeout: 30000,
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large projects
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Parse NDJSON (newline-delimited JSON)
    const modules = []
    let braceCount = 0
    let startIdx = 0
    let inString = false
    let escape = false

    for (let i = 0; i < output.length; i++) {
      const char = output[i]

      if (escape) {
        escape = false
        continue
      }

      if (char === '\\' && inString) {
        escape = true
        continue
      }

      if (char === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (char === '{') {
        if (braceCount === 0) startIdx = i
        braceCount++
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          const jsonStr = output.substring(startIdx, i + 1)
          try {
            modules.push(JSON.parse(jsonStr))
          } catch (parseErr) {
            // Skip malformed JSON
          }
          startIdx = i + 1
        }
      }
    }

    return modules
  } catch (error) {
    if (error.message.includes('command not found') ||
        error.message.includes('not recognized') ||
        error.message.includes('ENOENT')) {
      throw new Error(
        'Go project detected but Go is not installed.\n\n' +
        'Install Go: https://go.dev/doc/install\n' +
        'Or skip scanning: licenseguard init --noscan'
      )
    }

    if (error.killed) {
      throw new Error(
        'Go module listing timed out.\n\n' +
        'This may indicate a very large project.\n' +
        'Try running `go mod download` first.'
      )
    }

    throw new Error('Failed to get Go modules: ' + error.message)
  }
}

/**
 * Extract license from Go module in cache using Jaccard Index detection (AC #6)
 *
 * @param {Object} module - Module object with Path, Version, Dir
 * @param {string} cachePath - Go module cache path
 * @returns {string} SPDX license identifier or 'UNKNOWN'
 */
function extractGoLicense(module, cachePath) {
  // Priority 1: Use Dir from go list output if available
  let modulePath = module.Dir

  // Priority 2: Construct path from cache + module path + version
  if (!modulePath && cachePath && module.Path && module.Version) {
    // Go module cache uses lowercase paths and @ for version separator
    // e.g., /home/user/go/pkg/mod/github.com/gin-gonic/gin@v1.9.1
    modulePath = path.join(cachePath, `${module.Path}@${module.Version}`)
  }

  if (!modulePath) {
    return 'UNKNOWN'
  }

  // License file names to check (in order of preference)
  const licenseFiles = [
    'LICENSE',
    'LICENSE.txt',
    'LICENSE.md',
    'LICENCE',       // British spelling
    'LICENCE.txt',
    'LICENCE.md',
    'COPYING',
    'COPYING.txt',
    'MIT-LICENSE',
    'MIT-LICENSE.txt',
    'Apache-License-2.0.txt'
  ]

  for (const filename of licenseFiles) {
    const licensePath = path.join(modulePath, filename)
    try {
      if (fs.existsSync(licensePath)) {
        const content = fs.readFileSync(licensePath, 'utf8')
        // Use Jaccard Index algorithm from license-detector.js (AC #6)
        const detected = detectLicenseFromText(content)
        if (detected && detected !== 'UNKNOWN') {
          return detected
        }
      }
    } catch (err) {
      // Permission error or other issue - continue to next file
      continue
    }
  }

  return 'UNKNOWN'
}

/**
 * Filter modules to only include actual dependencies (not the root module)
 *
 * @param {Array} modules - Array of module objects from go list
 * @returns {Array} Filtered array of dependency modules
 */
function filterDependencies(modules) {
  if (!modules || modules.length === 0) {
    return []
  }

  // The first module is typically the root module (the project itself)
  // It has Main: true flag
  return modules.filter(mod => {
    // Skip the main/root module
    if (mod.Main === true) {
      return false
    }

    // Skip modules without Path (shouldn't happen, but safety check)
    if (!mod.Path) {
      return false
    }

    return true
  })
}

/**
 * Scan all Go module dependencies for license compatibility
 *
 * @param {string} projectLicense - The project's license (SPDX format)
 * @returns {Promise<Object>} Scan results matching plugin interface
 */
async function scanDependencies(projectLicense) {
  // Get module cache path dynamically (AC #7)
  const cachePath = getGoModuleCachePath()

  // Get modules using streaming for large projects (AC #8)
  let allModules
  try {
    allModules = await getGoModulesStreaming()
  } catch (streamErr) {
    // Fallback to sync method for compatibility
    allModules = getGoModulesSync()
  }

  // Filter to only actual dependencies
  const modules = filterDependencies(allModules)

  const results = {
    timestamp: new Date().toISOString(),
    totalDependencies: modules.length,
    compatible: 0,
    incompatible: 0,
    unknown: 0,
    issues: [],
    packages: [] // Include packages for HTML generation
  }

  // Scan each dependency
  for (let i = 0; i < modules.length; i++) {
    showProgress(i + 1, modules.length)

    const mod = modules[i]
    const license = extractGoLicense(mod, cachePath)

    // Add package to results for HTML generation
    results.packages.push({
      name: mod.Path,
      version: mod.Version,
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
        package: `${mod.Path}@${mod.Version}`,
        license: license,
        type: isUnknown ? 'warning' : 'conflict',
        reason: compatResult.reason,
        location: mod.Dir || `${cachePath}/${mod.Path}@${mod.Version}`
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
  getGoModuleCachePath,
  getGoModulesStreaming,
  getGoModulesSync,
  extractGoLicense,
  filterDependencies
}
