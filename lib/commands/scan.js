/**
 * Scan Command Handler
 * Runs dependency scanning without modifying project files
 */

const chalk = require('chalk')
const fs = require('fs')
const { scanDependencies, displayConflictReport } = require('../scanner')
const { detectLicenseFromText } = require('../scanner/license-detector')

/**
 * Try to detect project license from local files
 * @returns {string|null} Detected license or null
 */
function detectProjectLicense() {
  // 1. Try .licenseguardrc
  if (fs.existsSync('.licenseguardrc')) {
    try {
      const config = JSON.parse(fs.readFileSync('.licenseguardrc', 'utf8'))
      if (config.license) return config.license
    } catch (e) {
      // Ignore config error
    }
  }

  // 2. Try LICENSE file
  const licenseFiles = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'COPYING']
  for (const file of licenseFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8')
      const detected = detectLicenseFromText(content)
      if (detected && detected !== 'UNKNOWN') {
        return detected
      }
    }
  }

  // 3. Try package managers (basic check)
  if (fs.existsSync('package.json')) {
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      if (pkg.license) return pkg.license
    } catch (e) {
      // Ignore malformed package.json
    }
  }

  if (fs.existsSync('Cargo.toml')) {
    // TODO: Parse Cargo.toml for license
  }

  return null
}

/**
 * Run the scan command
 * @param {Object} options - Command options
 */
async function runScan(options) {
  // 1. Handle CWD
  if (options.cwd) {
    try {
      process.chdir(options.cwd)
    } catch (error) {
      throw new Error(`Failed to change directory to ${options.cwd}: ${error.message}`)
    }
  }

  console.log(chalk.blue(`📂 Scanning in: ${process.cwd()}`))

  // 2. Determine Project License
  let projectLicense = options.license

  if (!projectLicense) {
    projectLicense = detectProjectLicense()
    if (projectLicense) {
      console.log(chalk.blue(`ℹ️  Detected project license: ${projectLicense}`))
    }
  }

  if (!projectLicense) {
    throw new Error(
      'Could not determine project license.\n' +
      'Please create a LICENSE file, use "licenseguard init", or specify --license <type>'
    )
  }

  // 3. Run Scan
  console.log(chalk.gray('🔍 Scanning dependencies...'))
  
  try {
    const results = await scanDependencies(projectLicense)

    // 4. Display Report
    const hasConflicts = displayConflictReport(results, projectLicense, {
      explain: options.explain
    })

    // 5. Handle Exit Code
    if (hasConflicts && !options.allow) {
      console.log(chalk.red('\n❌ Scan failed: License conflicts detected.'))
      process.exit(1)
    } else if (hasConflicts && options.allow) {
      console.log(chalk.yellow('\n⚠️  Scan passed (conflicts allowed via flag).'))
    } 
    
    // Handle unknown licenses if fail-on-unknown flag is set
    if (options.failOnUnknown && results.unknown > 0) {
      console.log(chalk.red('\n❌ Scan failed: Unknown licenses detected (--fail-on-unknown).'))
      process.exit(1)
    }

  } catch (error) {
    // Check for specific plugin errors
    if (error.message.includes('No supported package manager')) {
      throw new Error('No supported package manager found (package.json, go.mod, Cargo.toml, etc.)')
    }
    throw error
  }
}

module.exports = { runScan }
