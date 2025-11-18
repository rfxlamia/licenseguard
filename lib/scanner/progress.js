/**
 * Progress indicator for dependency scanning
 * Displays "Scanning dependencies... N/total" with in-place updates
 */

/**
 * Show scanning progress indicator
 * @param {number} current - Current dependency count
 * @param {number} total - Total dependencies to scan
 */
function showProgress(current, total) {
  // Clear current line and write progress
  // \r returns to start of line without newline
  process.stdout.write(`\rScanning dependencies... ${current}/${total}`)

  // Newline when complete
  if (current === total) {
    process.stdout.write('\n')
  }
}

module.exports = { showProgress }
