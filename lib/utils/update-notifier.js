const https = require('https')
const fs = require('fs')
const path = require('path')
const os = require('os')
const chalk = require('chalk')

const CACHE_FILE = path.join(os.tmpdir(), 'licenseguard-update-check')
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const FETCH_TIMEOUT_MS = 5000 // 5 seconds

/**
 * Fetch package version info from npm registry
 * @param {string} packageName - Package name to check
 * @returns {Promise<Object>} - Package metadata from npm registry
 */
function fetchNpmVersion(packageName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'registry.npmjs.org',
      path: `/${packageName}`,
      method: 'GET',
      timeout: FETCH_TIMEOUT_MS
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          resolve(parsed)
        } catch (error) {
          reject(new Error('Failed to parse npm registry response'))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('npm registry request timeout'))
    })

    req.end()
  })
}

/**
 * Check if cached result is still valid
 * @returns {boolean} - True if cache exists and is fresh
 */
function isCacheValid() {
  if (!fs.existsSync(CACHE_FILE)) {
    return false
  }

  try {
    const stat = fs.statSync(CACHE_FILE)
    const age = Date.now() - stat.mtimeMs
    return age < CACHE_TTL_MS
  } catch (error) {
    return false
  }
}

/**
 * Compare two semantic version strings
 * @param {string} current - Current version (e.g., "2.1.0")
 * @param {string} latest - Latest version (e.g., "2.2.0")
 * @returns {boolean} - True if latest is newer than current
 */
function isNewerVersion(current, latest) {
  const currentParts = current.split('.').map(Number)
  const latestParts = latest.split('.').map(Number)

  for (let i = 0; i < 3; i++) {
    if (latestParts[i] > currentParts[i]) return true
    if (latestParts[i] < currentParts[i]) return false
  }

  return false // Versions are equal
}

/**
 * Display update banner in terminal
 * @param {string} current - Current version
 * @param {string} latest - Latest available version
 */
function displayUpdateBanner(current, latest) {
  console.log(chalk.yellow('\n╔═══════════════════════════════════════════════╗'))
  console.log(chalk.yellow(`║  Update available: ${current} → ${latest}              ║`))
  console.log(chalk.yellow('║  Run: npm install -g licenseguard-cli@latest  ║'))
  console.log(chalk.yellow('╚═══════════════════════════════════════════════╝\n'))
}

/**
 * Check for updates from npm registry (with caching)
 * Non-blocking, silent failure on errors
 * @param {string} currentVersion - Current version from package.json
 * @returns {Promise<void>}
 */
async function checkForUpdates(currentVersion) {
  try {
    // Check cache validity
    if (isCacheValid()) {
      return // Skip check - cache is fresh
    }

    // Fetch latest version from npm registry
    const data = await fetchNpmVersion('licenseguard-cli')
    const latestVersion = data['dist-tags'].latest

    // Cache result
    fs.writeFileSync(CACHE_FILE, latestVersion, 'utf8')

    // Compare versions and display banner if update available
    if (isNewerVersion(currentVersion, latestVersion)) {
      displayUpdateBanner(currentVersion, latestVersion)
    }
  } catch (error) {
    // Silent failure - don't block user or pollute output
    // Network issues, timeouts, parsing errors all handled gracefully
  }
}

module.exports = {
  checkForUpdates,
  displayUpdateBanner,
  isNewerVersion,
  fetchNpmVersion,
  isCacheValid,
  CACHE_FILE,
  CACHE_TTL_MS
}
