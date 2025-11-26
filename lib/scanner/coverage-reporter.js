const chalk = require('chalk')

/**
 * Calculate coverage statistics from scan results
 * @param {Object} scanResults - Scan results object
 * @returns {Object} Coverage statistics { total, identified, unknown, percentage }
 */
function calculateCoverage(scanResults) {
  // Handle cases where scanResults might be undefined or null
  if (!scanResults) {
    return {
      total: 0,
      identified: 0,
      unknown: 0,
      percentage: 0.0,
    }
  }

  // Support both old format (packages array) and new format (totalDependencies)
  let totalPackages = 0
  let unknownPackages = 0

  if (scanResults.packages) {
    // Old format: packages array
    totalPackages = scanResults.packages.length
    unknownPackages = scanResults.packages.filter(p => p.license === 'UNKNOWN').length
  } else if (scanResults.totalDependencies !== undefined) {
    // New format: totalDependencies, compatible, incompatible, unknown
    totalPackages = scanResults.totalDependencies
    unknownPackages = scanResults.unknown || 0
  } else {
    // Unknown format
    return {
      total: 0,
      identified: 0,
      unknown: 0,
      percentage: 0.0,
    }
  }

  const identifiedPackages = totalPackages - unknownPackages
  const percentage = totalPackages > 0
    ? ((identifiedPackages / totalPackages) * 100).toFixed(1)
    : '0.0'

  return {
    total: totalPackages,
    identified: identifiedPackages,
    unknown: unknownPackages,
    percentage: parseFloat(percentage),
  }
}

/**
 * Get emoji indicator based on coverage percentage
 * @param {number} percentage - Coverage percentage
 * @returns {string} Emoji indicator (✅/⚠️/❌)
 */
function getCoverageEmoji(percentage) {
  if (percentage >= 90) return '✅'
  if (percentage >= 70) return '⚠️'
  return '❌'
}

/**
 * Display coverage report to console
 * @param {Object} coverage - Coverage object from calculateCoverage
 */
function displayCoverage(coverage) {
  console.log(chalk.blue('\n📊 Scan Coverage:'))

  const emoji = getCoverageEmoji(coverage.percentage)
  console.log(`${emoji} ${coverage.identified}/${coverage.total} packages identified (${coverage.percentage}%)`)

  if (coverage.unknown > 0) {
    console.log(chalk.yellow(`⚠️  ${coverage.unknown} packages with unknown licenses`))
  }

  if (coverage.percentage < 80) {
    console.log(chalk.yellow('\n💡 Tip: Some packages may need manual LICENSE file inspection'))
  }
}

module.exports = { calculateCoverage, displayCoverage, getCoverageEmoji }
