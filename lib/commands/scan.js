/**
 * Scan Command Handler
 * Runs dependency scanning without modifying project files
 */

const chalk = require('chalk')
const fs = require('fs')
const path = require('path')
const inquirer = require('inquirer')
const { runInit } = require('./init')
const { scanDependencies, displayConflictReport } = require('../scanner')
const { detectLicenseFromText } = require('../scanner/license-detector')
const { calculateCoverage, displayCoverage } = require('../scanner/coverage-reporter')
const { generateHTML, writeHTMLFile } = require('../formatters/html-generator')

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
 * Check if license string is valid (not null, empty, or UNLICENSED)
 * @param {string|null} license - License to validate
 * @returns {boolean} True if valid license
 */
function isValidLicense(license) {
  return !!(license && license !== 'UNLICENSED' && license.trim() !== '')
}

/**
 * Detect license from Node.js package.json
 * @returns {string|null} Detected license or null
 */
function detectNodeLicense() {
  try {
    if (!fs.existsSync('package.json')) return null

    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    return pkg.license || null
  } catch (error) {
    return null
  }
}

/**
 * Detect license from Rust Cargo.toml
 * @returns {string|null} Detected license or null
 */
function detectRustLicense() {
  try {
    if (!fs.existsSync('Cargo.toml')) return null

    const content = fs.readFileSync('Cargo.toml', 'utf8')
    const match = content.match(/license\s*=\s*"([^"]+)"/)
    return match ? match[1] : null
  } catch (error) {
    return null
  }
}

/**
 * Detect license from Python pyproject.toml or setup.py
 * @returns {string|null} Detected license or null
 */
function detectPythonLicense() {
  // Try pyproject.toml first
  try {
    if (fs.existsSync('pyproject.toml')) {
      const content = fs.readFileSync('pyproject.toml', 'utf8')
      // Try different patterns for pyproject.toml
      let match = content.match(/license\s*=\s*["{]([^"'}]+)["}]/)
      if (!match) {
        // Try project.license pattern
        match = content.match(/project\.license\s*=\s*["{]([^"'}]+)["}]/)
      }
      if (match) return match[1]
    }
  } catch (error) {
    // Continue to setup.py fallback
  }

  // Fallback to setup.py
  try {
    if (fs.existsSync('setup.py')) {
      const content = fs.readFileSync('setup.py', 'utf8')
      const match = content.match(/license\s*=\s*["']([^"']+)["']/)
      if (match) return match[1]
    }
  } catch (error) {
    // Ignore
  }

  return null
}

/**
 * Detect license from Go go.mod (less standardized)
 * @returns {string|null} Detected license or null
 */
function detectGoLicense() {
  try {
    // Check go.mod for license comment
    if (fs.existsSync('go.mod')) {
      const content = fs.readFileSync('go.mod', 'utf8')
      const match = content.match(/\/\/\s*license:\s*([^\n]+)/i)
      if (match) return match[1].trim()
    }

    // Check common source files for license headers
    const sourceFiles = ['main.go', 'LICENSE', 'LICENSE.txt']
    for (const file of sourceFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8')
        // Look for SPDX-License-Identifier
        const match = content.match(/SPDX-License-Identifier:\s*([^\n]+)/i)
        if (match) return match[1].trim()
      }
    }
  } catch (error) {
    // Ignore
  }

  return null
}

/**
 * Detect license from C++ conanfile.txt or CMakeLists.txt
 * @returns {string|null} Detected license or null
 */
function detectCppLicense() {
  try {
    // Try conanfile.txt
    if (fs.existsSync('conanfile.txt')) {
      const content = fs.readFileSync('conanfile.txt', 'utf8')
      const match = content.match(/license\s*=\s*([^\n]+)/)
      if (match) return match[1].trim()
    }

    // Try CMakeLists.txt
    if (fs.existsSync('CMakeLists.txt')) {
      const content = fs.readFileSync('CMakeLists.txt', 'utf8')
      // Look for license comment
      const match = content.match(/#\s*license:\s*([^\n]+)/i)
      if (match) return match[1].trim()
    }
  } catch (error) {
    // Ignore
  }

  return null
}

/**
 * Auto-detect project license from package manager files
 * Tries multiple ecosystems in priority order
 * @returns {string|null} Detected license or null
 */
function autoDetectLicense() {
  const strategies = [
    { name: 'package.json', detector: detectNodeLicense },
    { name: 'Cargo.toml', detector: detectRustLicense },
    { name: 'pyproject.toml/setup.py', detector: detectPythonLicense },
    { name: 'go.mod', detector: detectGoLicense },
    { name: 'conanfile.txt/CMakeLists.txt', detector: detectCppLicense }
  ]

  for (const strategy of strategies) {
    const license = strategy.detector()
    if (isValidLicense(license)) {
      return license
    }
  }

  return null // Could not auto-detect
}

/**
 * Check if running in interactive mode (TTY and not CI)
 * @returns {boolean} True if interactive mode
 */
function isInteractive() {
  return process.stdin.isTTY && !process.env.CI
}

/**
 * Get project name from package.json or current directory
 * @returns {string} Project name
 */
function getProjectName() {
  try {
    const pkgPath = path.join(process.cwd(), 'package.json')
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      return pkg.name || path.basename(process.cwd())
    }
  } catch (error) {
    // Ignore errors, fall back to directory name
  }

  return path.basename(process.cwd())
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

  // 2. Check for config file existence
  const configPath = '.licenseguardrc'
  const configExists = fs.existsSync(configPath)

  // 3. Determine Project License
  let projectLicense = options.license

  if (!projectLicense && !configExists) {
    // Config missing - determine mode (interactive vs CI/CD)
    const interactive = isInteractive()

    if (interactive) {
      // Interactive mode: Prompt user to run init
      console.log(chalk.yellow('⚠️  Configuration not found.\n'))
      console.log('LicenseGuard needs to know your project\'s license to detect conflicts.')
      console.log(chalk.gray('(e.g. MIT projects can\'t use GPL libraries)\n'))

      const answer = await inquirer.prompt([{
        type: 'confirm',
        name: 'initNow',
        message: 'Would you like to initialize configuration now?',
        default: true
      }])

      if (answer.initNow) {
        // Run init interactively
        await runInit(options)
        console.log(chalk.blue('\n🔍 Continuing with scan...\n'))
        // Config now exists, reload it
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
          projectLicense = config.license
        }
      } else {
        console.log(chalk.yellow('Okay, scanning aborted. Run licenseguard init when ready.'))
        process.exit(0)
      }
    } else {
      // CI/CD mode: Auto-detect license
      projectLicense = autoDetectLicense()

      if (!projectLicense) {
        console.error(chalk.red('✗ Error: No configuration found and license could not be auto-detected.'))
        console.log(chalk.yellow('\nFor CI/CD usage, commit .licenseguardrc to your repository:'))
        console.log(chalk.blue('  1. Run: licenseguard init'))
        console.log(chalk.blue('  2. Commit: git add .licenseguardrc && git commit\n'))
        process.exit(1)
      }

      console.log(chalk.blue(`ℹ️  Auto-detected project license: ${projectLicense} (from package manager)\n`))
    }
  } else if (!projectLicense) {
    // Config exists, try to load it
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
    const hasConflicts = await displayConflictReport(results, projectLicense, {
      explain: options.explain
    })

    // 4.5. Display Coverage Report
    const coverage = calculateCoverage(results)
    displayCoverage(coverage)

    // 4.6. Generate HTML Attribution (if requested)
    if (options.format === 'html') {
      const projectName = getProjectName()
      const html = generateHTML(results, projectName)
      writeHTMLFile(html, './CREDITS.html')
    }

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

module.exports = {
  runScan,
  autoDetectLicense,
  detectNodeLicense,
  detectRustLicense,
  detectPythonLicense,
  detectGoLicense,
  detectCppLicense,
  isValidLicense,
  isInteractive,
  getProjectName
}
