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

  const incompatibleSource = projectEntry.sources &&
    (!projectEntry.sources.incompatible_dependencies ||
      projectEntry.sources.incompatible_dependencies.includes(normalizedDep))
    ? projectEntry.sources
    : null

  // Check explicit incompatibility first
  if (projectEntry.incompatible_with) {
    // Direct match
    if (projectEntry.incompatible_with.includes(normalizedDep)) {
      return {
        compatible: false,
        reason: `${normalizedDep} explicitly incompatible with ${normalizedProject}`,
        severity: 'ERROR',
        source: incompatibleSource
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
            source: incompatibleSource
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
 * Evaluate one license under the policy that preserves the project's license.
 * All decision metadata stays together, including on paths that bypass the matrix.
 * @returns {{compatible: boolean, reason: string, severity: string, source: object|null}}
 */
function evaluateSingleCompatibility(projectLicense, depLicense) {
  const normalizedProject = normalize(projectLicense)
  const normalizedDep = normalize(depLicense)

  if (areSameLicense(normalizedProject, normalizedDep)) {
    return {
      compatible: true,
      reason: `Same license (${normalizedDep})`,
      severity: 'PASS',
      source: null
    }
  }

  const projectIsCopyleft = isCopyleft(normalizedProject)
  const depIsCopyleft = isCopyleft(normalizedDep)
  const matrixResult = checkWithMatrix(normalizedProject, normalizedDep)
  const projectEntry = COMPAT_MATRIX.licenses[normalizedProject]

  // This policy is directional: retaining a permissive project license blocks copyleft.
  if (!projectIsCopyleft && depIsCopyleft) {
    return {
      compatible: false,
      reason: `Copyleft license ${normalizedDep} incompatible with permissive ${normalizedProject}`,
      severity: 'ERROR',
      // Explicit source scope prevents citing a GPL rule for unrelated license families.
      source: !matrixResult.compatible && projectEntry && projectEntry.sources &&
        projectEntry.sources.incompatible_dependencies &&
        projectEntry.sources.incompatible_dependencies.includes(normalizedDep)
        ? matrixResult.source
        : null
    }
  }

  if (projectIsCopyleft && !depIsCopyleft) {
    if (!matrixResult.compatible) return matrixResult
    const dependencyEntry = COMPAT_MATRIX.licenses[normalizedDep]
    const sourceSupportsRule = matrixResult.severity === 'PASS' && dependencyEntry && (
      dependencyEntry.type === 'permissive' || dependencyEntry.type === 'public-domain' ||
      (dependencyEntry.sources && dependencyEntry.sources.compatible_projects &&
        dependencyEntry.sources.compatible_projects.includes(normalizedProject))
    )
    const overrideSource = matrixResult.severity === 'PASS' && dependencyEntry &&
      dependencyEntry.compatibility_sources && dependencyEntry.compatibility_sources[normalizedProject]
    const reason = 'Permissive dependency compatible with copyleft project'
    return {
      ...matrixResult,
      reason: matrixResult.severity === 'WARNING' ? `${reason} (${matrixResult.reason})` : reason,
      // Cite the accepted dependency's terms, rather than unrelated project-row rules.
      source: overrideSource || (sourceSupportsRule ? dependencyEntry.sources : null)
    }
  }

  if (!projectIsCopyleft && !depIsCopyleft) {
    return {
      compatible: true,
      reason: matrixResult.severity === 'WARNING'
        ? `Both permissive licenses (${matrixResult.reason})`
        : 'Both permissive licenses',
      severity: matrixResult.severity === 'WARNING' ? 'WARNING' : 'PASS',
      source: null
    }
  }

  return matrixResult
}

/** Evaluate SPDX branches without discarding the deciding branch's metadata. */
function evaluateRecursive(projectLicense, licenseNode) {
  if (licenseNode.license) {
    return evaluateSingleCompatibility(projectLicense, licenseNode.license)
  }

  if (licenseNode.conjunction === 'or') {
    const left = evaluateRecursive(projectLicense, licenseNode.left)
    const right = evaluateRecursive(projectLicense, licenseNode.right)
    if (left.compatible) return left
    if (right.compatible) return right
    return left
  }

  if (licenseNode.conjunction === 'and') {
    const left = evaluateRecursive(projectLicense, licenseNode.left)
    const right = evaluateRecursive(projectLicense, licenseNode.right)
    const failed = !left.compatible ? left : !right.compatible ? right : null
    if (failed) {
      return { ...failed, reason: `Part of AND expression failed: ${failed.reason}` }
    }
    const warningReasons = [left, right].filter(result => result.severity === 'WARNING').map(result => result.reason)
    return {
      compatible: true,
      reason: 'All licenses in AND expression are compatible' +
        (warningReasons.length ? ` (${warningReasons.join('; ')})` : ''),
      severity: left.severity === 'WARNING' || right.severity === 'WARNING' ? 'WARNING' : 'PASS',
      source: null
    }
  }

  return {
    compatible: false,
    reason: 'Unknown license expression structure',
    severity: 'ERROR',
    source: null
  }
}

/**
 * Shared policy evaluation for scans and explanations.
 * Parse the full SPDX expression before normalizing individual leaf identifiers.
 * @returns {{compatible: boolean, reason: string, severity: string, source: object|null}}
 */
function evaluateCompatibility(projectLicense, depLicense) {
  if (typeof depLicense !== 'string' || depLicense === 'UNKNOWN' || !depLicense) {
    return { compatible: false, reason: 'No license field found', severity: 'ERROR', source: null }
  }

  const depLowerCase = depLicense.toLowerCase()
  if (CUSTOM_COMPAT[depLowerCase] && CUSTOM_COMPAT[depLowerCase].compatibleWith === '*') {
    return { compatible: true, reason: 'Ultra-permissive license', severity: 'PASS', source: null }
  }

  let ast
  try {
    ast = parse(depLicense)
  } catch (error) {
    return {
      compatible: false,
      reason: `Invalid SPDX expression: ${depLicense}`,
      severity: 'ERROR',
      source: null
    }
  }

  return evaluateRecursive(projectLicense, ast)
}

/** Check an atomic identifier; retain the historical public return shape. */
function checkSingleCompatibility(projectLicense, depLicense) {
  const { compatible, reason } = evaluateSingleCompatibility(projectLicense, depLicense)
  return { compatible, reason }
}

/** Check an SPDX AST; retain the historical public return shape. */
function isCompatibleRecursive(projectLicense, licenseNode) {
  const { compatible, reason } = evaluateRecursive(projectLicense, licenseNode)
  return { compatible, reason }
}

/** Check a dependency's SPDX expression; retain the historical public return shape. */
function checkCompatibility(projectLicense, depLicense) {
  const { compatible, reason } = evaluateCompatibility(projectLicense, depLicense)
  return { compatible, reason }
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
  const result = evaluateCompatibility(projectLicense, depLicense)

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
