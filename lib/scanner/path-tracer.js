/**
 * Path Tracer - npm explain Adapter
 * Executes npm explain subprocess to trace dependency chains
 * Example: "app → folly → liburing"
 */

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')
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
    let executable = 'npm'
    const args = ['explain', packageName, '--json']

    // Windows npm.cmd requires a shell; launch its JavaScript CLI with Node instead.
    if (process.platform === 'win32') {
      const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path')
      const directories = [path.dirname(process.execPath), ...(process.env[pathKey] || '').split(path.delimiter).filter(Boolean)]
      const npmCli = directories
        .map((directory) => path.resolve(directory, 'node_modules', 'npm', 'bin', 'npm-cli.js'))
        .find((file) => fs.existsSync(file))

      if (!npmCli) throw new Error('Could not locate npm JavaScript CLI')
      executable = process.execPath
      args.unshift(npmCli)
    }

    // Pass package metadata as a literal argument, never as shell syntax.
    const output = execFileSync(executable, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'], // Suppress stderr
      timeout: 5000, // 5 second timeout
      shell: false
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
