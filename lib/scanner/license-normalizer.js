/**
 * License Normalizer
 * Normalizes license identifiers to canonical SPDX form
 * Handles ecosystem-specific variants (Python, Rust, C++, npm)
 *
 * This centralizes license normalization logic that was previously scattered
 * across ecosystem plugins, making it reusable and consistent.
 */

/**
 * Common license format variations → Canonical SPDX identifiers
 * Covers Python, Rust, C++, and npm ecosystem quirks
 *
 * Sources:
 * - Python: Trove Classifiers + pip show metadata
 * - Rust: Cargo.toml license field patterns
 * - C++: Conan license field + package.json variants
 * - npm: package.json license field
 */
const LICENSE_NORMALIZATIONS = {
  // ============================================
  // Apache variants
  // ============================================
  'Apache 2.0': 'Apache-2.0',
  'Apache License 2.0': 'Apache-2.0',
  'Apache License, Version 2.0': 'Apache-2.0',
  'Apache Software License': 'Apache-2.0',  // Python Trove Classifier
  'ASL 2': 'Apache-2.0',
  'Apache-2': 'Apache-2.0',  // Rust/C++ shorthand

  // ============================================
  // BSD variants (most common in Python/C++)
  // ============================================
  'BSD License': 'BSD-3-Clause',  // Default to 3-Clause (most common)
  'BSD': 'BSD-3-Clause',
  'BSD 3-Clause': 'BSD-3-Clause',
  'BSD 3 Clause': 'BSD-3-Clause',
  '3-Clause BSD License': 'BSD-3-Clause',
  'New BSD': 'BSD-3-Clause',
  'Modified BSD': 'BSD-3-Clause',
  'BSD 2-Clause': 'BSD-2-Clause',
  'Simplified BSD': 'BSD-2-Clause',
  'FreeBSD': 'BSD-2-Clause',

  // ============================================
  // MIT variants
  // ============================================
  'MIT': 'MIT',
  'MIT License': 'MIT',
  'mit': 'MIT',
  'Mit': 'MIT',

  // ============================================
  // GPL variants (SPDX 3.0 normalization)
  // ============================================
  // CRITICAL: GPL-3.0 is deprecated in SPDX 3.0 → GPL-3.0-only
  'GPL-3.0': 'GPL-3.0-only',
  'GPL 3.0': 'GPL-3.0-only',
  'GPLv3': 'GPL-3.0-only',
  'GPL-3.0.0': 'GPL-3.0-only',
  'GNU General Public License v3.0': 'GPL-3.0-only',
  'GNU General Public License (GPL)': 'GPL-3.0-only',  // Default to v3

  'GPL-2.0': 'GPL-2.0-only',
  'GPL 2.0': 'GPL-2.0-only',
  'GPLv2': 'GPL-2.0-only',
  'GPL-2.0.0': 'GPL-2.0-only',
  'GNU General Public License v2.0': 'GPL-2.0-only',

  // GPL "or-later" variants
  'GPL-3.0+': 'GPL-3.0-or-later',
  'GPL-3.0-or-later': 'GPL-3.0-or-later',
  'GPLv3+': 'GPL-3.0-or-later',

  'GPL-2.0+': 'GPL-2.0-or-later',
  'GPL-2.0-or-later': 'GPL-2.0-or-later',
  'GPLv2+': 'GPL-2.0-or-later',

  // ============================================
  // LGPL variants
  // ============================================
  'GNU Library or Lesser General Public License (LGPL)': 'LGPL-2.1-or-later',
  'LGPL': 'LGPL-2.1-or-later',  // Default to 2.1-or-later (most permissive)
  'LGPLv3': 'LGPL-3.0-only',
  'LGPL-3.0': 'LGPL-3.0-only',
  'LGPL-3.0-only': 'LGPL-3.0-only',
  'LGPL-3.0-or-later': 'LGPL-3.0-or-later',
  'LGPLv2': 'LGPL-2.1-only',
  'LGPL-2.1': 'LGPL-2.1-only',
  'LGPL-2.1-only': 'LGPL-2.1-only',
  'LGPL-2.1-or-later': 'LGPL-2.1-or-later',
  'LGPL-2.0-only': 'LGPL-2.0-only',
  'LGPL-2.0-or-later': 'LGPL-2.0-or-later',

  // ============================================
  // ISC variants
  // ============================================
  'ISC': 'ISC',
  'ISC License': 'ISC',
  'ISC License (ISCL)': 'ISC',

  // ============================================
  // MPL variants
  // ============================================
  'MPL-2.0': 'MPL-2.0',
  'Mozilla Public License 2.0': 'MPL-2.0',
  'Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
  'MPL 2.0': 'MPL-2.0',

  // ============================================
  // Python Software Foundation
  // ============================================
  'Python Software Foundation License': 'PSF-2.0',
  'PSF': 'PSF-2.0',

  // ============================================
  // Public Domain / Ultra-Permissive
  // ============================================
  'Unlicense': 'Unlicense',
  'Public Domain': 'Unlicense',  // Map to Unlicense (closest SPDX)
  'CC0-1.0': 'CC0-1.0',
  'CC0': 'CC0-1.0',
  'WTFPL': 'WTFPL',
  '0BSD': '0BSD',

  // ============================================
  // Zlib / bzip2 (permissive)
  // ============================================
  'Zlib': 'Zlib',
  'zlib License': 'Zlib',
  'bzip2-1.0.6': 'bzip2-1.0.6',
  'bzip2': 'bzip2-1.0.6',

  // ============================================
  // Boost Software License
  // ============================================
  'BSL-1.0': 'BSL-1.0',
  'Boost Software License 1.0': 'BSL-1.0',
  'Boost': 'BSL-1.0',

  // ============================================
  // Proprietary / Non-SPDX
  // ============================================
  'Other/Proprietary License': 'LicenseRef-Proprietary',
  'NVIDIA Proprietary Software': 'LicenseRef-NVIDIA-Proprietary',
  'Proprietary': 'LicenseRef-Proprietary',
  'Commercial': 'LicenseRef-Commercial'
}

/**
 * License family classifications
 * Used for upgrade path detection (e.g., LGPL can upgrade to GPL)
 */
const LICENSE_FAMILIES = {
  // GPL Family (Strong Copyleft)
  'GPL-2.0-only': 'GPL2',
  'GPL-2.0-or-later': 'GPL2-or-later',
  'GPL-3.0-only': 'GPL3',
  'GPL-3.0-or-later': 'GPL3-or-later',

  // LGPL Family (Weak Copyleft - can upgrade to GPL)
  'LGPL-2.1-only': 'LGPL',
  'LGPL-2.1-or-later': 'LGPL-or-later',
  'LGPL-3.0-only': 'LGPL3',
  'LGPL-3.0-or-later': 'LGPL3-or-later',
  'LGPL-2.0-only': 'LGPL',
  'LGPL-2.0-or-later': 'LGPL-or-later',

  // AGPL Family (Network Copyleft)
  'AGPL-3.0-only': 'AGPL3',
  'AGPL-3.0-or-later': 'AGPL3-or-later',

  // MPL Family (Weak Copyleft - Section 3.3 allows GPL combination)
  'MPL-2.0': 'MPL',
  'MPL-1.1': 'MPL',

  // Apache Family (Permissive with Patent Grant)
  'Apache-2.0': 'Apache',
  'Apache-1.1': 'Apache',

  // MIT Family (Permissive)
  'MIT': 'MIT',

  // BSD Family (Permissive)
  'BSD-3-Clause': 'BSD',
  'BSD-2-Clause': 'BSD',
  'BSD-1-Clause': 'BSD',
  '0BSD': 'BSD',

  // ISC Family (Permissive)
  'ISC': 'ISC',

  // Public Domain
  'Unlicense': 'Public-Domain',
  'CC0-1.0': 'Public-Domain',
  'WTFPL': 'Public-Domain',

  // Other Permissive
  'Zlib': 'Permissive',
  'bzip2-1.0.6': 'Permissive',
  'BSL-1.0': 'Permissive',
  'PSF-2.0': 'Permissive'
}

/**
 * Normalize license identifier to canonical SPDX form
 *
 * Algorithm:
 * 1. Handle UNKNOWN/empty cases
 * 2. Clean whitespace
 * 3. Exact match in normalization table
 * 4. Case-insensitive match
 * 5. Regex pattern matching (flexible)
 * 6. Return as-is if already valid SPDX
 *
 * @param {string} license - License string from ecosystem metadata
 * @returns {string} Canonical SPDX identifier or UNKNOWN
 *
 * @example
 * normalize('GPL-3.0') // → 'GPL-3.0-only'
 * normalize('mit') // → 'MIT'
 * normalize('Apache 2.0') // → 'Apache-2.0'
 * normalize('') // → 'UNKNOWN'
 */
function normalize(license) {
  if (!license || license === '' || /^none$/i.test(license) || license === 'UNKNOWN') {
    return 'UNKNOWN'
  }

  // Clean: trim, normalize whitespace
  const cleaned = license.trim().replace(/\s+/g, ' ')

  // Exact match (fast path)
  if (LICENSE_NORMALIZATIONS[cleaned]) {
    return LICENSE_NORMALIZATIONS[cleaned]
  }

  // Case-insensitive match
  const lower = cleaned.toLowerCase()
  for (const [key, value] of Object.entries(LICENSE_NORMALIZATIONS)) {
    if (key.toLowerCase() === lower) {
      return value
    }
  }

  // ============================================
  // Regex pattern matching (flexible normalization)
  // ============================================
  // CRITICAL: Order matters! Check more specific patterns first
  // LGPL must be checked BEFORE GPL (LGPL contains "GPL" substring)

  // Apache
  if (/Apache.*2(\.0)?/i.test(cleaned)) return 'Apache-2.0'
  if (/^ASL\s*2/i.test(cleaned)) return 'Apache-2.0'

  // BSD (including full license text detection)
  if (/BSD.*3.*Clause/i.test(cleaned)) return 'BSD-3-Clause'
  if (/BSD.*2.*Clause/i.test(cleaned)) return 'BSD-2-Clause'
  if (/^BSD$/i.test(cleaned)) return 'BSD-3-Clause'
  // Detect full BSD license text (starts with "Redistribution and use")
  if (/Redistribution and use in source and binary forms/i.test(cleaned)) {
    return 'BSD-3-Clause'  // Assume 3-Clause if full text
  }

  // LGPL (CHECK BEFORE GPL - more specific pattern)
  // CRITICAL: LGPL contains "GPL" substring, so must be checked first
  if (/LGPL.*v?3/i.test(cleaned)) {
    if (/\+|or.*later/i.test(cleaned)) return 'LGPL-3.0-or-later'
    return 'LGPL-3.0-only'
  }
  if (/LGPL.*v?2/i.test(cleaned)) {
    if (/\+|or.*later/i.test(cleaned)) return 'LGPL-2.1-or-later'
    return 'LGPL-2.1-only'
  }

  // AGPL (CHECK BEFORE GPL - AGPL contains "GPL" substring)
  // CRITICAL: AGPL-3.0-only matches /GPL.*v?3/ if not checked first
  if (/AGPL.*v?3/i.test(cleaned)) {
    if (/\+|or.*later/i.test(cleaned)) return 'AGPL-3.0-or-later'
    return 'AGPL-3.0-only'
  }

  // GPL (CHECK AFTER LGPL AND AGPL - less specific pattern)
  if (/GPL.*v?3/i.test(cleaned)) {
    if (/\+|or.*later/i.test(cleaned)) return 'GPL-3.0-or-later'
    return 'GPL-3.0-only'
  }
  if (/GPL.*v?2/i.test(cleaned)) {
    if (/\+|or.*later/i.test(cleaned)) return 'GPL-2.0-or-later'
    return 'GPL-2.0-only'
  }

  // PSF
  if (/Python Software Foundation/i.test(cleaned)) return 'PSF-2.0'

  // ISC
  if (/ISC.*License/i.test(cleaned)) return 'ISC'

  // MPL
  if (/Mozilla Public License.*2/i.test(cleaned)) return 'MPL-2.0'

  // Proprietary
  if (/proprietary/i.test(cleaned)) return 'LicenseRef-Proprietary'
  if (/NVIDIA.*Proprietary/i.test(cleaned)) return 'LicenseRef-NVIDIA-Proprietary'
  if (/commercial/i.test(cleaned)) return 'LicenseRef-Commercial'

  // Return as-is if no match (might be valid SPDX already)
  return cleaned
}

/**
 * Get license family for compatibility upgrade path detection
 *
 * @param {string} license - Normalized SPDX identifier
 * @returns {string} License family (GPL3, LGPL, MIT, BSD, Apache, etc.) or 'Unknown'
 *
 * @example
 * getLicenseFamily('GPL-3.0-only') // → 'GPL3'
 * getLicenseFamily('LGPL-2.1-or-later') // → 'LGPL-or-later'
 * getLicenseFamily('MIT') // → 'MIT'
 */
function getLicenseFamily(license) {
  if (!license || license === 'UNKNOWN') {
    return 'Unknown'
  }

  // Normalize first to ensure consistent lookup
  const normalized = normalize(license)

  return LICENSE_FAMILIES[normalized] || 'Unknown'
}

/**
 * Check if two licenses are the same after normalization
 * Handles SPDX deprecated identifiers (GPL-3.0 vs GPL-3.0-only)
 *
 * @param {string} license1 - First license identifier
 * @param {string} license2 - Second license identifier
 * @returns {boolean} True if same license after normalization
 *
 * @example
 * areSameLicense('GPL-3.0', 'GPL-3.0-only') // → true
 * areSameLicense('mit', 'MIT') // → true
 * areSameLicense('MIT', 'Apache-2.0') // → false
 */
function areSameLicense(license1, license2) {
  return normalize(license1) === normalize(license2)
}

module.exports = {
  normalize,
  getLicenseFamily,
  areSameLicense,
  // Export for testing
  LICENSE_NORMALIZATIONS,
  LICENSE_FAMILIES
}
