/**
 * Path Tracer - npm explain Adapter
 * Executes npm explain subprocess to trace dependency chains
 * Example: "app → folly → liburing"
 */

const { execSync } = require('child_process')
const chalk = require('chalk')

// Cache to avoid duplicate npm explain calls
const pathCache = new Map()

/**
 * Trace dependency path using npm explain
 * Executes subprocess and parses JSON output to extract dependency chain
 * @param {string} packageName - Package to trace
 * @param {string} projectRoot - Project root directory
 * @returns {string|null} Formatted dependency path or null on failure
 */
function traceDependencyPath(packageName, projectRoot) {
  // Check cache first
  if (pathCache.has(packageName)) {
    return pathCache.get(packageName)
  }

  try {
    // Execute: npm explain <package> --json
    const output = execSync(`npm explain ${packageName} --json`, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      timeout: 5000 // 5 second timeout
    })

    const paths = JSON.parse(output)
    if (!paths || paths.length === 0) {
      return null
    }

    // Format first path: "app > folly > liburing" → "app → folly → liburing"
    const chain = formatPathChain(paths[0])

    // Cache result
    pathCache.set(packageName, chain)

    return chain

  } catch (error) {
    // npm explain failed (npm not in PATH, old version, etc.)
    console.log(chalk.yellow(`⚠️  Could not trace path for ${packageName}`))
    return null
  }
}

/**
 * Format npm explain output to display format
 * Converts "app > folly > liburing" to "app → folly → liburing"
 * @param {Object} pathData - npm explain path data
 * @returns {string|null} Formatted path string or null
 */
function formatPathChain(pathData) {
  // npm explain returns: { path: "app > folly > liburing" }
  if (pathData && pathData.path) {
    return pathData.path.replace(/ > /g, ' → ')
  }
  return null
}

/**
 * Clear the path cache
 * Useful for testing or when switching projects
 */
function clearCache() {
  pathCache.clear()
}

module.exports = {
  traceDependencyPath,
  formatPathChain,
  clearCache
}
