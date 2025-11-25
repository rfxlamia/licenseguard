/**
 * Dependency License Scanner - Orchestrator
 * Auto-detects project type and delegates to appropriate plugin
 */

const chalk = require('chalk')

// Import explainCompatibility for --explain flag support
const { explainCompatibility } = require('./compat-checker')

// Import color mapper for license color-coding
const { colorizeWithEmoji } = require('./color-mapper')

// Import ecosystem plugins
const nodePlugin = require('./plugins/node')
const cppPlugin = require('./plugins/cpp')
const rustPlugin = require('./plugins/rust')
const pythonPlugin = require('./plugins/python')
const goPlugin = require('./plugins/go')

// Plugin registry with priority ordering
// Priority: node > cpp > rust > python > go
const plugins = {
  node: nodePlugin,
  cpp: cppPlugin,
  rust: rustPlugin,
  python: pythonPlugin,
  go: goPlugin
}

// Plugin detection order (first match wins)
const pluginOrder = ['node', 'cpp', 'rust', 'python', 'go']

/**
 * Auto-detect project type and get the appropriate plugin
 * @returns {{name: string, plugin: Object}|null} Detected plugin or null
 */
function detectPlugin() {
  for (const name of pluginOrder) {
    const plugin = plugins[name]
    if (plugin && plugin.detect()) {
      return { name, plugin }
    }
  }
  return null
}

/**
 * Scan all dependencies for license compatibility
 * Auto-detects project type and delegates to appropriate plugin
 * @param {string} projectLicense - The project's license
 * @returns {Promise<Object>} Scan results
 */
async function scanDependencies(projectLicense) {
  const detected = detectPlugin()

  if (!detected) {
    throw new Error('No supported package manager detected')
  }

  return await detected.plugin.scanDependencies(projectLicense)
}

/**
 * Display conflict report to console
 * @param {Object} scanResult - Scan results
 * @param {string} projectLicense - The project's license
 * @param {Object} options - Display options
 * @param {boolean} options.explain - Show authoritative source citations
 * @returns {boolean} True if conflicts found (incompatible licenses), false otherwise
 */
function displayConflictReport(scanResult, projectLicense, options = {}) {
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
    // Color-code the license based on safety level
    const coloredLicense = colorizeWithEmoji(issue.license, issue.license)

    if (issue.type === 'conflict') {
      console.log(chalk.red(`❌ ${issue.package} (${coloredLicense})`))
    } else {
      console.log(chalk.yellow(`⚠️  ${issue.package} (${coloredLicense})`))
    }
    console.log(chalk.gray(`   ${issue.reason}`))
    console.log(chalk.gray(`   Location: ${issue.location}`))

    // Show authoritative source citations when --explain is used
    if (options.explain && issue.license && issue.license !== 'UNKNOWN') {
      const explanation = explainCompatibility(projectLicense, issue.license)
      // Extract source citation from explanation (after "📚 Source:")
      const sourceMatch = explanation.match(/📚 Source: (.+?)(?:\n|$)/)
      const urlMatch = explanation.match(/🔗 URL: (.+?)(?:\n|$)/)

      if (sourceMatch || urlMatch) {
        console.log(chalk.blue('   ────────────────────────'))
        if (sourceMatch) {
          console.log(chalk.blue(`   📚 ${sourceMatch[1]}`))
        }
        if (urlMatch) {
          console.log(chalk.blue(`   🔗 ${urlMatch[1]}`))
        }
      }
    }

    console.log() // Blank line between issues
  }

  // Only return true if there are actual conflicts (incompatible licenses)
  // Warnings (unknown licenses) should not block
  return hasConflicts
}

// Re-export plugin functions for backward compatibility
// These are deprecated but kept for BC
const { parsePackageJson, extractLicense } = nodePlugin

module.exports = {
  scanDependencies,
  parsePackageJson,
  extractLicense,
  displayConflictReport,
  // Additional exports for testing
  detectPlugin
}
