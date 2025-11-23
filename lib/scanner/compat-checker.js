/**
 * License compatibility checker
 * Uses SPDX libraries for standard licenses + custom rules for non-SPDX
 * Enhanced with authoritative compatibility matrix (FSF, Mozilla, Apache sources)
 */

const parse = require('spdx-expression-parse')
const { normalize, areSameLicense } = require('./license-normalizer')
const COMPAT_MATRIX = require('./license-compatibility-matrix.json')

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
 * Known copyleft license patterns that impose restrictions
 * These require derivative works to use the same license
 */
const COPYLEFT_PATTERNS = [
  'GPL',      // GNU General Public License (GPL-2.0, GPL-3.0, etc.)
  'AGPL',     // GNU Affero General Public License
  'LGPL',     // GNU Lesser General Public License
  'MPL',      // Mozilla Public License
  'EPL',      // Eclipse Public License
  'EUPL',     // European Union Public License
  'CDDL',     // Common Development and Distribution License
  'CPL',      // Common Public License
  'APSL',     // Apple Public Source License
  'OSL',      // Open Software License
  'QPL',      // Q Public License
  'RPSL',     // RealNetworks Public Source License
  'SISSL',    // Sun Industry Standards Source License
  'SPL',      // Sun Public License
  'Watcom'    // Sybase Open Watcom Public License
]

/**
 * Permissive license exceptions that might contain misleading patterns
 * These are ultra-permissive and should ALWAYS be allowed
 */
const PERMISSIVE_EXCEPTIONS = [
  'WTFPL',     // Do What The F*ck You Want To Public License
  'Unlicense', // Public domain dedication
  'CC0',       // Creative Commons Zero (public domain)
  '0BSD'       // BSD Zero Clause (public domain equivalent)
]

/**
 * Detect if a license is copyleft (requires derivative works to use same license)
 * Uses smart pattern matching instead of hardcoded whitelist
 *
 * @param {string} license - SPDX license identifier
 * @returns {boolean} True if copyleft, false if permissive
 *
 * Algorithm:
 * 1. Check if license is ultra-permissive exception → return false
 * 2. Check if license contains copyleft pattern → return true
 * 3. Default to permissive (safe assumption for ~95% of licenses)
 */
function isCopyleft(license) {
  if (!license) return false

  const upper = license.toUpperCase()

  // Tier 1: Ultra-permissive exceptions (always allow)
  if (PERMISSIVE_EXCEPTIONS.some(p => upper.includes(p.toUpperCase()))) {
    return false
  }

  // Tier 2: Known copyleft patterns (block these)
  if (COPYLEFT_PATTERNS.some(pattern => upper.includes(pattern))) {
    return true
  }

  // Tier 3: Default to permissive (safe assumption)
  // Most licenses are permissive (MIT-like, BSD-like, Apache-like)
  return false
}

/**
 * Check license compatibility using authoritative compatibility matrix
 * Handles SPDX normalization, upgrade paths, and explicit compatibility rules
 *
 * @param {string} projectLicense - The project's license (will be normalized)
 * @param {string} depLicense - The dependency's license (will be normalized)
 * @returns {{compatible: boolean, reason: string, severity: string, source: object|null}} Enhanced compatibility result
 *
 * Algorithm:
 * 1. Normalize both licenses to canonical SPDX form
 * 2. Check if same license (compatible)
 * 3. Lookup project license in matrix
 * 4. Check explicit compatibility/incompatibility rules
 * 5. Check upgrade paths (LGPL→GPL, MPL→GPL)
 * 6. Expand wildcards (*permissive*, *copyleft*)
 * 7. Return result with severity and source citations
 */
function checkWithMatrix(projectLicense, depLicense) {
  // Normalize licenses to canonical SPDX form
  const normalizedProject = normalize(projectLicense)
  const normalizedDep = normalize(depLicense)

  // Same license is always compatible
  if (areSameLicense(normalizedProject, normalizedDep)) {
    return {
      compatible: true,
      reason: `Same license (${normalizedDep})`,
      severity: 'PASS',
      source: null
    }
  }

  // Lookup project license in matrix
  const projectEntry = COMPAT_MATRIX.licenses[normalizedProject]

  if (!projectEntry) {
    // Project license not in matrix - fall back to conservative check
    return {
      compatible: true,  // Conservative: allow unknown combinations with warning
      reason: `Unknown project license (${normalizedProject}) - unable to verify compatibility`,
      severity: 'WARNING',
      source: null
    }
  }

  // Check explicit incompatibility first
  if (projectEntry.incompatible_with) {
    // Direct match
    if (projectEntry.incompatible_with.includes(normalizedDep)) {
      return {
        compatible: false,
        reason: `${normalizedDep} explicitly incompatible with ${normalizedProject}`,
        severity: 'ERROR',
        source: projectEntry.sources
      }
    }

    // Wildcard match (*copyleft*, *permissive*)
    for (const incompatRule of projectEntry.incompatible_with) {
      if (incompatRule.startsWith('*') && incompatRule.endsWith('*')) {
        const wildcardKey = incompatRule
        if (COMPAT_MATRIX.wildcards[wildcardKey] && COMPAT_MATRIX.wildcards[wildcardKey].includes(normalizedDep)) {
          return {
            compatible: false,
            reason: `${normalizedDep} (${wildcardKey.replace(/\*/g, '')}) incompatible with ${normalizedProject}`,
            severity: 'ERROR',
            source: projectEntry.sources
          }
        }
      }
    }
  }

  // Check explicit compatibility
  if (projectEntry.compatible_with) {
    // Direct match
    if (projectEntry.compatible_with.includes(normalizedDep)) {
      return {
        compatible: true,
        reason: `${normalizedDep} explicitly compatible with ${normalizedProject}`,
        severity: 'PASS',
        source: projectEntry.sources
      }
    }

    // Upgrade path (LGPL→GPL, MPL→GPL)
    if (projectEntry.can_upgrade_from && projectEntry.can_upgrade_from.includes(normalizedDep)) {
      return {
        compatible: true,
        reason: `${normalizedDep} can upgrade to ${normalizedProject} (Section 3 upgrade path)`,
        severity: 'PASS',
        source: projectEntry.sources
      }
    }

    // Wildcard match (*permissive*, *copyleft*, *)
    for (const compatRule of projectEntry.compatible_with) {
      if (compatRule === '*') {
        // Universal compatibility (public domain)
        return {
          compatible: true,
          reason: `${normalizedDep} compatible with ${normalizedProject} (public domain)`,
          severity: 'PASS',
          source: projectEntry.sources
        }
      }

      if (compatRule.startsWith('*') && compatRule.endsWith('*')) {
        const wildcardKey = compatRule
        if (COMPAT_MATRIX.wildcards[wildcardKey] && COMPAT_MATRIX.wildcards[wildcardKey].includes(normalizedDep)) {
          return {
            compatible: true,
            reason: `${normalizedDep} (${wildcardKey.replace(/\*/g, '')}) compatible with ${normalizedProject}`,
            severity: 'PASS',
            source: projectEntry.sources
          }
        }
      }
    }
  }

  // No explicit rule found - conservative default
  return {
    compatible: true,  // Conservative: allow with warning
    reason: `No explicit compatibility rule for ${normalizedDep} + ${normalizedProject} - verify manually`,
    severity: 'WARNING',
    source: null
  }
}

/**
 * Check compatibility of a single (atomic) license identifier
 * Uses authoritative compatibility matrix for copyleft combinations
 *
 * @param {string} projectLicense - The project's license
 * @param {string} depLicense - Single license identifier (not expression)
 * @returns {{compatible: boolean, reason: string}} Compatibility result
 */
function checkSingleCompatibility(projectLicense, depLicense) {
  // Normalize licenses first for accurate same-license detection
  const normalizedProject = normalize(projectLicense)
  const normalizedDep = normalize(depLicense)

  // Same license is always compatible (handles GPL-3.0 vs GPL-3.0-only)
  if (areSameLicense(normalizedProject, normalizedDep)) {
    return { compatible: true, reason: `Same license (${normalizedDep})` }
  }

  // Smart copyleft detection
  const projectIsCopyleft = isCopyleft(normalizedProject)
  const depIsCopyleft = isCopyleft(normalizedDep)

  // Case 1: Permissive project + copyleft dependency = INCOMPATIBLE
  if (!projectIsCopyleft && depIsCopyleft) {
    return {
      compatible: false,
      reason: `Copyleft license ${normalizedDep} incompatible with permissive ${normalizedProject}`
    }
  }

  // Case 2: Copyleft project + permissive dependency
  // IMPORTANT: Still check matrix because some permissive licenses have
  // specific incompatibilities (e.g., Apache-2.0 + GPL-2.0 patent conflict)
  if (projectIsCopyleft && !depIsCopyleft) {
    const matrixResult = checkWithMatrix(normalizedProject, normalizedDep)
    // If matrix says incompatible, trust it (handles Apache-2.0 + GPL-2.0)
    if (!matrixResult.compatible) {
      return {
        compatible: false,
        reason: matrixResult.reason
      }
    }
    // Otherwise, permissive dep is compatible with copyleft project
    return {
      compatible: true,
      reason: 'Permissive dependency compatible with copyleft project'
    }
  }

  // Case 3: Both permissive = COMPATIBLE
  if (!projectIsCopyleft && !depIsCopyleft) {
    return {
      compatible: true,
      reason: 'Both permissive licenses'
    }
  }

  // Case 4: Both copyleft - USE MATRIX INSTEAD OF NAIVE LOGIC
  // CRITICAL FIX: This replaces the naive "different copyleft = incompatible" logic
  if (projectIsCopyleft && depIsCopyleft) {
    const matrixResult = checkWithMatrix(normalizedProject, normalizedDep)
    // Return simplified result (remove severity/source for backward compatibility)
    return {
      compatible: matrixResult.compatible,
      reason: matrixResult.reason
    }
  }

  // Fallback
  return { compatible: true, reason: 'No known incompatibility' }
}

/**
 * Recursively evaluate SPDX expression AST for compatibility
 * Handles OR (disjunctive) and AND (conjunctive) expressions
 *
 * @param {string} projectLicense - The project's license
 * @param {Object} licenseNode - AST node from spdx-expression-parse
 * @returns {{compatible: boolean, reason: string}} Compatibility result
 */
function isCompatibleRecursive(projectLicense, licenseNode) {
  // Base Case: Leaf node with 'license' property
  if (licenseNode.license) {
    return checkSingleCompatibility(projectLicense, licenseNode.license)
  }

  // Handle "OR" (Disjunctive) - User can choose either
  if (licenseNode.conjunction === 'or') {
    const left = isCompatibleRecursive(projectLicense, licenseNode.left)
    const right = isCompatibleRecursive(projectLicense, licenseNode.right)

    // If either is compatible, the whole expression is compatible
    if (left.compatible) return left
    if (right.compatible) return right

    // Both incompatible - return left's reason
    return { compatible: false, reason: left.reason }
  }

  // Handle "AND" (Conjunctive) - Must satisfy both
  if (licenseNode.conjunction === 'and') {
    const left = isCompatibleRecursive(projectLicense, licenseNode.left)
    const right = isCompatibleRecursive(projectLicense, licenseNode.right)

    // Both must be compatible
    if (!left.compatible) {
      return { compatible: false, reason: `Part of AND expression failed: ${left.reason}` }
    }
    if (!right.compatible) {
      return { compatible: false, reason: `Part of AND expression failed: ${right.reason}` }
    }

    return { compatible: true, reason: 'All licenses in AND expression are compatible' }
  }

  // Unknown structure
  return { compatible: false, reason: 'Unknown license expression structure' }
}

/**
 * Check if two licenses are compatible
 * Handles complex SPDX expressions with OR/AND
 *
 * @param {string} projectLicense - The project's license
 * @param {string} depLicense - The dependency's license (can be SPDX expression)
 * @returns {{compatible: boolean, reason: string}} Compatibility result
 */
function checkCompatibility(projectLicense, depLicense) {
  // Handle unknown licenses
  if (depLicense === 'UNKNOWN' || !depLicense) {
    return {
      compatible: false,
      reason: 'No license field found'
    }
  }

  // Handle custom licenses (WTFPL, etc.)
  const depLowerCase = depLicense.toLowerCase()
  if (CUSTOM_COMPAT[depLowerCase]) {
    if (CUSTOM_COMPAT[depLowerCase].compatibleWith === '*') {
      return { compatible: true, reason: 'Ultra-permissive license' }
    }
  }

  // Parse SPDX expression into AST
  let ast
  try {
    ast = parse(depLicense)
  } catch (error) {
    return {
      compatible: false,
      reason: `Invalid SPDX expression: ${depLicense}`
    }
  }

  // Evaluate AST recursively
  return isCompatibleRecursive(projectLicense, ast)
}

/**
 * Format compatibility result with source citations for --explain flag
 * Shows authoritative sources (FSF, Mozilla, Apache) and URLs
 *
 * @param {string} projectLicense - The project's license
 * @param {string} depLicense - The dependency's license
 * @returns {string} Formatted explanation with sources
 *
 * @example
 * explainCompatibility('GPL-3.0', 'LGPL-2.1-or-later')
 * // Returns:
 * // "✅ Compatible: LGPL-2.1-or-later can upgrade to GPL-3.0-only (Section 3 upgrade path)
 * //
 * //  Source: LGPL Section 3: Can upgrade to corresponding GPL version
 * //  URL: https://www.gnu.org/licenses/lgpl-3.0.html#section3"
 */
function explainCompatibility(projectLicense, depLicense) {
  const result = checkWithMatrix(projectLicense, depLicense)

  let explanation = ''

  // Status emoji
  if (result.compatible && result.severity === 'PASS') {
    explanation += '✅ Compatible: '
  } else if (result.compatible && result.severity === 'WARNING') {
    explanation += '⚠️  Warning: '
  } else {
    explanation += '❌ Incompatible: '
  }

  // Reason
  explanation += result.reason

  // Source citations (if available)
  if (result.source && result.source.citation) {
    explanation += '\n\n'
    explanation += `📚 Source: ${result.source.citation}`
    if (result.source.url) {
      explanation += `\n🔗 URL: ${result.source.url}`
    }
  }

  return explanation
}

module.exports = {
  checkCompatibility,
  checkSingleCompatibility,
  isCompatibleRecursive,
  isCopyleft,
  checkWithMatrix,
  explainCompatibility,
  CUSTOM_COMPAT,
  COPYLEFT_PATTERNS,
  PERMISSIVE_EXCEPTIONS,
  COMPAT_MATRIX
}
