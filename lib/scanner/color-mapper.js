const chalk = require('chalk')

// License color mapping based on safety level
const LICENSE_COLORS = {
  // Green: Permissive licenses
  'MIT': 'green',
  'Apache-2.0': 'green',
  'BSD-2-Clause': 'green',
  'BSD-3-Clause': 'green',
  'ISC': 'green',
  '0BSD': 'green',
  'Unlicense': 'green',

  // Yellow: Weak copyleft
  'MPL-2.0': 'yellow',
  'LGPL-2.1': 'yellow',
  'LGPL-3.0': 'yellow',
  'EPL-1.0': 'yellow',
  'EPL-2.0': 'yellow',

  // Red: Strong copyleft
  'GPL-2.0': 'red',
  'GPL-3.0': 'red',
  'AGPL-3.0': 'red',

  // Gray: Unknown
  'UNKNOWN': 'gray'
}

// Emoji indicators for accessibility
const EMOJI_INDICATORS = {
  green: '🟢',
  yellow: '⚠️',
  red: '❌',
  gray: '❔'
}

/**
 * Get color for a given license
 * @param {string} license - License identifier (e.g., "MIT", "GPL-3.0")
 * @returns {string} - Color name (green/yellow/red/gray)
 */
function getColor(license) {
  return LICENSE_COLORS[license] || 'gray'
}

/**
 * Get emoji indicator for a given license
 * @param {string} license - License identifier
 * @returns {string} - Emoji indicator
 */
function getEmoji(license) {
  const color = getColor(license)
  return EMOJI_INDICATORS[color]
}

/**
 * Colorize text based on license safety level
 * @param {string} license - License identifier
 * @param {string} text - Text to colorize
 * @returns {string} - Colorized text with chalk
 */
function colorize(license, text) {
  const color = getColor(license)
  return chalk[color](text)
}

/**
 * Colorize text with emoji indicator
 * @param {string} license - License identifier
 * @param {string} text - Text to colorize
 * @returns {string} - Colorized text with emoji prefix
 */
function colorizeWithEmoji(license, text) {
  const emoji = getEmoji(license)
  const coloredText = colorize(license, text)
  return `${emoji} ${coloredText}`
}

module.exports = {
  getColor,
  getEmoji,
  colorize,
  colorizeWithEmoji,
  LICENSE_COLORS,
  EMOJI_INDICATORS
}
