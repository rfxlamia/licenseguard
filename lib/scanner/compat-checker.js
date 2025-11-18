/**
 * License compatibility checker
 * Uses SPDX libraries for standard licenses + custom rules for non-SPDX
 */

const satisfies = require('spdx-satisfies')
const parse = require('spdx-expression-parse')

/**
 * Custom compatibility rules for non-SPDX licenses
 * @type {Object}
 */
const CUSTOM_COMPAT = {
  wtfpl: {
    type: 'permissive',
    compatibleWith: '*', // Compatible with everything
    description: 'Do What The F*ck You Want To Public License'
  }
}

/**
 * Permissive licenses that are generally compatible with each other
 */
const PERMISSIVE_LICENSES = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD']

/**
 * Copyleft licenses that have restrictions
 */
const COPYLEFT_LICENSES = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only', 'LGPL-2.1', 'LGPL-3.0']

/**
 * Check if two licenses are compatible
 * @param {string} projectLicense - The project's license
 * @param {string} depLicense - The dependency's license
 * @returns {{compatible: boolean, reason: string}} Compatibility result
 */
function checkCompatibility(projectLicense, depLicense) {
  // Handle unknown licenses
  if (depLicense === 'UNKNOWN' || !depLicense) {
    return {
      compatible: false, // Warn but don't block (handled by caller)
      reason: 'No license field found'
    }
  }

  // Handle custom licenses (WTFPL, proprietary, etc.)
  const depLowerCase = depLicense.toLowerCase()
  if (CUSTOM_COMPAT[depLowerCase]) {
    if (CUSTOM_COMPAT[depLowerCase].compatibleWith === '*') {
      return { compatible: true, reason: 'Ultra-permissive license' }
    }
  }

  // Validate SPDX expressions
  try {
    parse(projectLicense)
    parse(depLicense)
  } catch (error) {
    // Invalid SPDX expression
    return {
      compatible: false,
      reason: `Invalid SPDX expression: ${depLicense}`
    }
  }

  // Same license is always compatible
  if (projectLicense === depLicense) {
    return { compatible: true, reason: 'Compatible' }
  }

  // Check if both are permissive licenses
  const projectIsPermissive = PERMISSIVE_LICENSES.includes(projectLicense)
  const depIsPermissive = PERMISSIVE_LICENSES.includes(depLicense)

  // Permissive licenses are compatible with each other
  if (projectIsPermissive && depIsPermissive) {
    return { compatible: true, reason: 'Compatible' }
  }

  // Check for copyleft restrictions
  const depIsCopyleft = COPYLEFT_LICENSES.some(lic => depLicense.includes(lic))

  // Permissive project cannot use copyleft dependencies
  if (projectIsPermissive && depIsCopyleft) {
    return {
      compatible: false,
      reason: 'Copyleft incompatible with permissive license'
    }
  }

  // Copyleft project can use permissive dependencies
  const projectIsCopyleft = COPYLEFT_LICENSES.some(lic => projectLicense.includes(lic))
  if (projectIsCopyleft && depIsPermissive) {
    return { compatible: true, reason: 'Compatible' }
  }

  // For complex expressions, try spdx-satisfies
  try {
    const isCompatible = satisfies(depLicense, projectLicense)
    if (isCompatible) {
      return { compatible: true, reason: 'Compatible' }
    }
  } catch (error) {
    // Fall through to default incompatible
  }

  // Default: incompatible
  return {
    compatible: false,
    reason: `License ${depLicense} incompatible with ${projectLicense}`
  }
}

module.exports = { checkCompatibility, CUSTOM_COMPAT }
