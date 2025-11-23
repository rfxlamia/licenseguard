/**
 * License Mapper - Convert internal license format to SPDX identifier
 *
 * Centralized mapping to avoid duplication across init.js and init-fast.js
 */

const LICENSE_TO_SPDX = {
  'mit': 'MIT',
  'apache2_0': 'Apache-2.0',
  'gpl3_0': 'GPL-3.0',
  'bsd3clause': 'BSD-3-Clause',
  'isc': 'ISC',
  'wtfpl': 'WTFPL'
}

/**
 * Convert internal license key to SPDX identifier
 * @param {string} internalLicense - Internal license key (e.g., 'mit', 'apache2_0')
 * @returns {string} SPDX identifier (e.g., 'MIT', 'Apache-2.0')
 */
function toSPDX(internalLicense) {
  return LICENSE_TO_SPDX[internalLicense] || internalLicense.toUpperCase()
}

module.exports = {
  LICENSE_TO_SPDX,
  toSPDX
}
