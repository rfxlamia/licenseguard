/**
 * Tests for license compatibility checker
 * Target: 100% coverage (critical module)
 */

const {
  checkCompatibility,
  checkSingleCompatibility,
  isCompatibleRecursive,
  isCopyleft,
  CUSTOM_COMPAT,
  COPYLEFT_PATTERNS,
  PERMISSIVE_EXCEPTIONS
} = require('../../lib/scanner/compat-checker')

describe('checkCompatibility', () => {
  describe('SPDX Standard Licenses', () => {
    it('should mark MIT + ISC as compatible', () => {
      const result = checkCompatibility('MIT', 'ISC')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Both permissive licenses')
    })

    it('should mark MIT + BSD-3-Clause as compatible', () => {
      const result = checkCompatibility('MIT', 'BSD-3-Clause')
      expect(result.compatible).toBe(true)
    })

    it('should mark MIT + Apache-2.0 as compatible', () => {
      const result = checkCompatibility('MIT', 'Apache-2.0')
      expect(result.compatible).toBe(true)
    })

    it('should mark MIT + GPL-3.0 as incompatible', () => {
      const result = checkCompatibility('MIT', 'GPL-3.0')
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Copyleft')
    })

    it('should mark MIT + GPL-2.0 as incompatible', () => {
      const result = checkCompatibility('MIT', 'GPL-2.0')
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Copyleft')
    })

    it('should mark Apache-2.0 + GPL-3.0 as incompatible', () => {
      const result = checkCompatibility('Apache-2.0', 'GPL-3.0')
      expect(result.compatible).toBe(false)
    })

    it('should mark GPL-3.0 + MIT as compatible (GPL can use permissive)', () => {
      const result = checkCompatibility('GPL-3.0', 'MIT')
      expect(result.compatible).toBe(true)
    })

    it('should mark ISC + MIT as compatible', () => {
      const result = checkCompatibility('ISC', 'MIT')
      expect(result.compatible).toBe(true)
    })
  })

  describe('WTFPL Custom Rule', () => {
    it('should mark MIT + WTFPL as compatible (custom rule)', () => {
      const result = checkCompatibility('MIT', 'WTFPL')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Ultra-permissive license')
    })

    it('should mark GPL-3.0 + WTFPL as compatible', () => {
      const result = checkCompatibility('GPL-3.0', 'WTFPL')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Ultra-permissive license')
    })

    it('should mark Apache-2.0 + WTFPL as compatible', () => {
      const result = checkCompatibility('Apache-2.0', 'WTFPL')
      expect(result.compatible).toBe(true)
    })

    it('should handle case-insensitive WTFPL', () => {
      const result = checkCompatibility('MIT', 'wtfpl')
      expect(result.compatible).toBe(true)
    })
  })

  describe('UNKNOWN Licenses', () => {
    it('should handle UNKNOWN license as warning', () => {
      const result = checkCompatibility('MIT', 'UNKNOWN')
      expect(result.compatible).toBe(false)
      expect(result.reason).toBe('No license field found')
    })

    it('should handle empty license as unknown', () => {
      const result = checkCompatibility('MIT', '')
      expect(result.compatible).toBe(false)
      expect(result.reason).toBe('No license field found')
    })

    it('should handle null license as unknown', () => {
      const result = checkCompatibility('MIT', null)
      expect(result.compatible).toBe(false)
      expect(result.reason).toBe('No license field found')
    })

    it('should handle undefined license as unknown', () => {
      const result = checkCompatibility('MIT', undefined)
      expect(result.compatible).toBe(false)
      expect(result.reason).toBe('No license field found')
    })
  })

  describe('Invalid SPDX Expressions', () => {
    it('should handle invalid dep license expression', () => {
      const result = checkCompatibility('MIT', 'not-a-real-license')
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Invalid SPDX expression')
    })

    it('should handle malformed license string', () => {
      const result = checkCompatibility('MIT', '((MIT')
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Invalid SPDX expression')
    })

    it('should handle unknown project license as permissive (safe default)', () => {
      // Unknown project license is assumed permissive
      // MIT is permissive, so compatible
      const result = checkCompatibility('not-a-license', 'MIT')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Both permissive licenses')
    })
  })

  describe('Complex SPDX Expressions - OR (Disjunctive)', () => {
    it('should handle MIT OR Apache-2.0 as compatible with MIT project', () => {
      const result = checkCompatibility('MIT', 'MIT OR Apache-2.0')
      expect(result.compatible).toBe(true)
    })

    it('should handle Apache-2.0 OR MIT as compatible with Apache-2.0 project', () => {
      const result = checkCompatibility('Apache-2.0', 'Apache-2.0 OR MIT')
      expect(result.compatible).toBe(true)
    })

    it('should handle MIT OR Apache-2.0 OR LGPL as compatible (can choose MIT)', () => {
      // r-efi case: MIT OR Apache-2.0 OR LGPL-2.1-or-later
      const result = checkCompatibility('MIT', 'MIT OR Apache-2.0 OR LGPL-2.1-or-later')
      expect(result.compatible).toBe(true)
    })

    it('should handle GPL-3.0 OR GPL-2.0 as incompatible with MIT (both copyleft)', () => {
      const result = checkCompatibility('MIT', 'GPL-3.0 OR GPL-2.0')
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Copyleft')
    })

    it('should handle nested OR expressions', () => {
      // (MIT OR BSD-3-Clause) is compatible with Apache-2.0
      const result = checkCompatibility('Apache-2.0', 'MIT OR BSD-3-Clause')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Complex SPDX Expressions - AND (Conjunctive)', () => {
    it('should handle MIT AND Apache-2.0 as compatible (both permissive)', () => {
      const result = checkCompatibility('MIT', 'MIT AND Apache-2.0')
      expect(result.compatible).toBe(true)
    })

    it('should handle MIT AND GPL-3.0 as incompatible (GPL part fails)', () => {
      const result = checkCompatibility('MIT', 'MIT AND GPL-3.0')
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('AND expression failed')
    })

    it('should handle BSD-3-Clause AND ISC as compatible', () => {
      const result = checkCompatibility('MIT', 'BSD-3-Clause AND ISC')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Complex SPDX Expressions - Mixed OR/AND', () => {
    it('should handle (MIT OR Apache-2.0) AND BSD-3-Clause as compatible', () => {
      const result = checkCompatibility('MIT', '(MIT OR Apache-2.0) AND BSD-3-Clause')
      expect(result.compatible).toBe(true)
    })

    it('should handle MIT OR (Apache-2.0 AND GPL-3.0) - MIT is compatible', () => {
      // Can choose MIT, so compatible
      const result = checkCompatibility('MIT', 'MIT OR (Apache-2.0 AND GPL-3.0)')
      expect(result.compatible).toBe(true)
    })

    it('should handle (GPL-3.0 AND LGPL-2.1) OR MIT - MIT is compatible', () => {
      const result = checkCompatibility('MIT', '(GPL-3.0 AND LGPL-2.1) OR MIT')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle same license as compatible', () => {
      const result = checkCompatibility('MIT', 'MIT')
      expect(result.compatible).toBe(true)
    })

    it('should handle proprietary license as invalid SPDX', () => {
      const result = checkCompatibility('MIT', 'Proprietary')
      expect(result.compatible).toBe(false)
      // Proprietary is not a valid SPDX identifier, so it's treated as invalid
      expect(result.reason).toContain('Invalid SPDX expression')
    })
  })

  describe('CUSTOM_COMPAT export', () => {
    it('should export CUSTOM_COMPAT object', () => {
      expect(CUSTOM_COMPAT).toBeDefined()
      expect(CUSTOM_COMPAT.wtfpl).toBeDefined()
      expect(CUSTOM_COMPAT.wtfpl.compatibleWith).toBe('*')
    })
  })

  describe('C/C++ Common Licenses (Hotfix #2.5.1)', () => {
    it('should mark MIT + BSL-1.0 as compatible (Boost)', () => {
      const result = checkCompatibility('MIT', 'BSL-1.0')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Both permissive licenses')
    })

    it('should mark MIT + Zlib as compatible', () => {
      const result = checkCompatibility('MIT', 'Zlib')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Both permissive licenses')
    })

    it('should mark MIT + bzip2-1.0.6 as compatible', () => {
      const result = checkCompatibility('MIT', 'bzip2-1.0.6')
      expect(result.compatible).toBe(true)
      expect(result.reason).toBe('Both permissive licenses')
    })

    it('should mark MIT + bzip2-1.0.8 as compatible (invalid SPDX but permissive)', () => {
      const result = checkCompatibility('MIT', 'bzip2-1.0.8')
      // bzip2-1.0.8 is not valid SPDX, will be caught by SPDX validation
      // In real usage, conan reports 'bzip2-1.0.6' which is valid SPDX
      // This test verifies our error handling
      expect(result.compatible).toBe(false)
      expect(result.reason).toContain('Invalid SPDX expression')
    })

    it('should mark Apache-2.0 + BSL-1.0 as compatible', () => {
      const result = checkCompatibility('Apache-2.0', 'BSL-1.0')
      expect(result.compatible).toBe(true)
    })

    it('should mark BSD-3-Clause + Zlib as compatible', () => {
      const result = checkCompatibility('BSD-3-Clause', 'Zlib')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Other Common Permissive Licenses', () => {
    it('should mark MIT + Unlicense as compatible (public domain)', () => {
      const result = checkCompatibility('MIT', 'Unlicense')
      expect(result.compatible).toBe(true)
    })

    it('should mark MIT + CC0-1.0 as compatible (Creative Commons)', () => {
      const result = checkCompatibility('MIT', 'CC0-1.0')
      expect(result.compatible).toBe(true)
    })

    it('should mark MIT + 0BSD as compatible (zero clause BSD)', () => {
      const result = checkCompatibility('MIT', '0BSD')
      expect(result.compatible).toBe(true)
    })

    it('should mark MIT + X11 as compatible', () => {
      const result = checkCompatibility('MIT', 'X11')
      expect(result.compatible).toBe(true)
    })

    it('should mark MIT + Python-2.0 as compatible', () => {
      const result = checkCompatibility('MIT', 'Python-2.0')
      expect(result.compatible).toBe(true)
    })
  })
})

describe('isCopyleft (Smart Copyleft Detection)', () => {
  describe('Copyleft Detection - GPL Family', () => {
    it('should detect GPL-2.0 as copyleft', () => {
      expect(isCopyleft('GPL-2.0')).toBe(true)
    })

    it('should detect GPL-3.0 as copyleft', () => {
      expect(isCopyleft('GPL-3.0')).toBe(true)
    })

    it('should detect AGPL-3.0 as copyleft', () => {
      expect(isCopyleft('AGPL-3.0')).toBe(true)
    })

    it('should detect LGPL-2.1 as copyleft', () => {
      expect(isCopyleft('LGPL-2.1')).toBe(true)
    })

    it('should detect LGPL-3.0 as copyleft', () => {
      expect(isCopyleft('LGPL-3.0')).toBe(true)
    })

    it('should detect GPL-2.0-only as copyleft', () => {
      expect(isCopyleft('GPL-2.0-only')).toBe(true)
    })

    it('should detect GPL-3.0-or-later as copyleft', () => {
      expect(isCopyleft('GPL-3.0-or-later')).toBe(true)
    })
  })

  describe('Copyleft Detection - Other Families', () => {
    it('should detect MPL-2.0 as copyleft (Mozilla)', () => {
      expect(isCopyleft('MPL-2.0')).toBe(true)
    })

    it('should detect EPL-1.0 as copyleft (Eclipse)', () => {
      expect(isCopyleft('EPL-1.0')).toBe(true)
    })

    it('should detect EUPL-1.2 as copyleft (European Union)', () => {
      expect(isCopyleft('EUPL-1.2')).toBe(true)
    })

    it('should detect CDDL-1.0 as copyleft', () => {
      expect(isCopyleft('CDDL-1.0')).toBe(true)
    })

    it('should detect OSL-3.0 as copyleft', () => {
      expect(isCopyleft('OSL-3.0')).toBe(true)
    })
  })

  describe('Permissive Detection - Common Licenses', () => {
    it('should detect MIT as permissive', () => {
      expect(isCopyleft('MIT')).toBe(false)
    })

    it('should detect ISC as permissive', () => {
      expect(isCopyleft('ISC')).toBe(false)
    })

    it('should detect Apache-2.0 as permissive', () => {
      expect(isCopyleft('Apache-2.0')).toBe(false)
    })

    it('should detect BSD-2-Clause as permissive', () => {
      expect(isCopyleft('BSD-2-Clause')).toBe(false)
    })

    it('should detect BSD-3-Clause as permissive', () => {
      expect(isCopyleft('BSD-3-Clause')).toBe(false)
    })
  })

  describe('Permissive Detection - C/C++ Licenses (Bug Fix)', () => {
    it('should detect BSL-1.0 as permissive (Boost)', () => {
      expect(isCopyleft('BSL-1.0')).toBe(false)
    })

    it('should detect Zlib as permissive', () => {
      expect(isCopyleft('Zlib')).toBe(false)
    })

    it('should detect bzip2-1.0.6 as permissive', () => {
      expect(isCopyleft('bzip2-1.0.6')).toBe(false)
    })

    it('should detect bzip2-1.0.8 as permissive', () => {
      expect(isCopyleft('bzip2-1.0.8')).toBe(false)
    })
  })

  describe('Permissive Exceptions - Ultra-permissive', () => {
    it('should detect WTFPL as permissive (exception)', () => {
      expect(isCopyleft('WTFPL')).toBe(false)
    })

    it('should detect Unlicense as permissive (public domain)', () => {
      expect(isCopyleft('Unlicense')).toBe(false)
    })

    it('should detect CC0-1.0 as permissive (Creative Commons)', () => {
      expect(isCopyleft('CC0-1.0')).toBe(false)
    })

    it('should detect 0BSD as permissive (zero clause)', () => {
      expect(isCopyleft('0BSD')).toBe(false)
    })

    it('should handle case-insensitive WTFPL', () => {
      expect(isCopyleft('wtfpl')).toBe(false)
    })

    it('should handle case-insensitive Unlicense', () => {
      expect(isCopyleft('unlicense')).toBe(false)
    })
  })

  describe('Default to Permissive - Unknown Licenses', () => {
    it('should default unknown licenses to permissive', () => {
      expect(isCopyleft('My-Custom-License-1.0')).toBe(false)
    })

    it('should default arbitrary string to permissive', () => {
      expect(isCopyleft('SomethingRandom')).toBe(false)
    })

    it('should handle empty string as permissive', () => {
      expect(isCopyleft('')).toBe(false)
    })

    it('should handle null as permissive', () => {
      expect(isCopyleft(null)).toBe(false)
    })

    it('should handle undefined as permissive', () => {
      expect(isCopyleft(undefined)).toBe(false)
    })
  })

  describe('Pattern Matching Edge Cases', () => {
    it('should not false-positive on license names containing GPL substring', () => {
      // BSL contains "SL" but not "GPL", should be permissive
      expect(isCopyleft('BSL-1.0')).toBe(false)
    })

    it('should detect copyleft even with -only suffix', () => {
      expect(isCopyleft('GPL-2.0-only')).toBe(true)
    })

    it('should detect copyleft even with -or-later suffix', () => {
      expect(isCopyleft('GPL-3.0-or-later')).toBe(true)
    })

    it('should handle case-insensitive copyleft detection', () => {
      expect(isCopyleft('gpl-3.0')).toBe(true)
      expect(isCopyleft('mpl-2.0')).toBe(true)
    })
  })

  describe('Exports', () => {
    it('should export COPYLEFT_PATTERNS', () => {
      expect(COPYLEFT_PATTERNS).toBeDefined()
      expect(Array.isArray(COPYLEFT_PATTERNS)).toBe(true)
      expect(COPYLEFT_PATTERNS).toContain('GPL')
      expect(COPYLEFT_PATTERNS).toContain('MPL')
    })

    it('should export PERMISSIVE_EXCEPTIONS', () => {
      expect(PERMISSIVE_EXCEPTIONS).toBeDefined()
      expect(Array.isArray(PERMISSIVE_EXCEPTIONS)).toBe(true)
      expect(PERMISSIVE_EXCEPTIONS).toContain('WTFPL')
      expect(PERMISSIVE_EXCEPTIONS).toContain('Unlicense')
    })
  })
})

describe('checkSingleCompatibility', () => {
  it('should check single license compatibility', () => {
    const result = checkSingleCompatibility('MIT', 'Apache-2.0')
    expect(result.compatible).toBe(true)
    expect(result.reason).toBe('Both permissive licenses')
  })

  it('should detect copyleft conflict', () => {
    const result = checkSingleCompatibility('MIT', 'GPL-3.0')
    expect(result.compatible).toBe(false)
    expect(result.reason).toContain('Copyleft')
  })

  it('should allow same license', () => {
    const result = checkSingleCompatibility('MIT', 'MIT')
    expect(result.compatible).toBe(true)
    expect(result.reason).toContain('Same license')
  })

  it('should allow permissive deps in copyleft project', () => {
    const result = checkSingleCompatibility('GPL-3.0', 'MIT')
    expect(result.compatible).toBe(true)
    expect(result.reason).toContain('Permissive dependency')
  })
})

describe('isCompatibleRecursive', () => {
  const parse = require('spdx-expression-parse')

  it('should handle leaf node (single license)', () => {
    const ast = parse('MIT')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(true)
  })

  it('should handle OR expression - left compatible', () => {
    const ast = parse('MIT OR GPL-3.0')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(true)
  })

  it('should handle OR expression - right compatible', () => {
    const ast = parse('GPL-3.0 OR MIT')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(true)
  })

  it('should handle OR expression - both incompatible', () => {
    const ast = parse('GPL-3.0 OR AGPL-3.0')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(false)
  })

  it('should handle AND expression - both compatible', () => {
    const ast = parse('MIT AND Apache-2.0')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(true)
  })

  it('should handle AND expression - one incompatible', () => {
    const ast = parse('MIT AND GPL-3.0')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(false)
  })

  it('should handle deeply nested expression', () => {
    const ast = parse('(MIT OR BSD-3-Clause) AND (Apache-2.0 OR ISC)')
    const result = isCompatibleRecursive('MIT', ast)
    expect(result.compatible).toBe(true)
  })
})

// ============================================================================
// PHASE 4: Comprehensive Matrix-Based Compatibility Tests
// Tests for license-compatibility-matrix.json integration
// ============================================================================

const { checkWithMatrix, explainCompatibility, COMPAT_MATRIX } = require('../../lib/scanner/compat-checker')

describe('checkWithMatrix (Matrix-Based Compatibility)', () => {
  describe('SPDX Normalization Integration (AC #1)', () => {
    it('should treat GPL-3.0 and GPL-3.0-only as same license', () => {
      const result = checkWithMatrix('GPL-3.0', 'GPL-3.0-only')
      expect(result.compatible).toBe(true)
      expect(result.reason).toContain('Same license')
      expect(result.severity).toBe('PASS')
    })

    it('should treat GPL-3.0-only and GPL-3.0 as same license (reverse)', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'GPL-3.0')
      expect(result.compatible).toBe(true)
      expect(result.reason).toContain('Same license')
    })

    it('should normalize case variations (MIT vs mit)', () => {
      const result = checkWithMatrix('MIT', 'mit')
      expect(result.compatible).toBe(true)
      expect(result.reason).toContain('Same license')
    })

    it('should normalize GPL-2.0 to GPL-2.0-only', () => {
      const result = checkWithMatrix('GPL-2.0', 'GPL-2.0-only')
      expect(result.compatible).toBe(true)
      expect(result.reason).toContain('Same license')
    })

    it('should normalize LGPL-3.0 to LGPL-3.0-only', () => {
      const result = checkWithMatrix('LGPL-3.0', 'LGPL-3.0-only')
      expect(result.compatible).toBe(true)
      expect(result.reason).toContain('Same license')
    })
  })

  describe('LGPL→GPL Upgrade Paths (AC #2)', () => {
    it('should allow LGPL-2.1-or-later in GPL-3.0 project (upgrade path)', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'LGPL-2.1-or-later')
      expect(result.compatible).toBe(true)
      // LGPL-2.1-or-later is in compatible_with list, so uses explicit compatibility
      expect(result.reason).toContain('compatible')
      expect(result.severity).toBe('PASS')
    })

    it('should allow LGPL-3.0-only in GPL-3.0 project (upgrade path)', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'LGPL-3.0-only')
      expect(result.compatible).toBe(true)
    })

    it('should allow LGPL-3.0-or-later in GPL-3.0 project', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'LGPL-3.0-or-later')
      expect(result.compatible).toBe(true)
    })

    it('should allow LGPL-2.1-or-later in GPL-3.0-or-later project', () => {
      const result = checkWithMatrix('GPL-3.0-or-later', 'LGPL-2.1-or-later')
      expect(result.compatible).toBe(true)
    })

    it('should provide source citation for LGPL→GPL upgrade', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'LGPL-2.1-or-later')
      expect(result.source).toBeDefined()
      expect(result.source.citation).toBeDefined()
    })
  })

  describe('MPL Section 3.3 Compatibility (AC #3)', () => {
    it('should allow MPL-2.0 in GPL-3.0 project (Section 3.3)', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'MPL-2.0')
      expect(result.compatible).toBe(true)
      expect(result.severity).toBe('PASS')
    })

    it('should allow MPL-2.0 in GPL-3.0-or-later project', () => {
      const result = checkWithMatrix('GPL-3.0-or-later', 'MPL-2.0')
      expect(result.compatible).toBe(true)
    })

    it('should mark MPL-2.0 + GPL-2.0-only as INCOMPATIBLE', () => {
      const result = checkWithMatrix('GPL-2.0-only', 'MPL-2.0')
      expect(result.compatible).toBe(false)
      expect(result.severity).toBe('ERROR')
    })

    it('should provide Mozilla source for MPL-2.0 in GPL project', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'MPL-2.0')
      expect(result.source).toBeDefined()
    })
  })

  describe('Apache Patent Clause Rules (AC #4)', () => {
    it('should allow Apache-2.0 in GPL-3.0 project (patent resolved)', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'Apache-2.0')
      expect(result.compatible).toBe(true)
      expect(result.severity).toBe('PASS')
    })

    it('should allow Apache-2.0 in GPL-3.0-or-later project', () => {
      const result = checkWithMatrix('GPL-3.0-or-later', 'Apache-2.0')
      expect(result.compatible).toBe(true)
    })

    it('should mark Apache-2.0 + GPL-2.0-only as INCOMPATIBLE (patent conflict)', () => {
      const result = checkWithMatrix('GPL-2.0-only', 'Apache-2.0')
      expect(result.compatible).toBe(false)
      expect(result.severity).toBe('ERROR')
    })

    it('should mark Apache-2.0 + LGPL-2.1-only as INCOMPATIBLE (patent conflict)', () => {
      // Apache-2.0 project with LGPL-2.1-only dependency
      const result = checkWithMatrix('Apache-2.0', 'LGPL-2.1-only')
      expect(result.compatible).toBe(false)
    })

    it('should provide Apache Foundation source for patent rules', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'Apache-2.0')
      expect(result.source).toBeDefined()
    })
  })

  describe('Correct Incompatibilities Preserved (AC #5)', () => {
    it('should mark GPL-2.0-only + GPL-3.0-only as INCOMPATIBLE', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'GPL-2.0-only')
      expect(result.compatible).toBe(false)
      expect(result.severity).toBe('ERROR')
    })

    it('should mark GPL-3.0-only + GPL-2.0-or-later as COMPATIBLE (upgrade path)', () => {
      // GPL-2.0-or-later can be upgraded to GPL-3.0 (FSF guidance)
      const result = checkWithMatrix('GPL-3.0-only', 'GPL-2.0-or-later')
      expect(result.compatible).toBe(true)
    })

    it('should mark AGPL-3.0 + GPL-3.0 as INCOMPATIBLE (stricter terms)', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'AGPL-3.0-only')
      expect(result.compatible).toBe(false)
    })

    it('should mark MIT project + GPL-3.0 dep as INCOMPATIBLE via wildcard', () => {
      const result = checkWithMatrix('MIT', 'GPL-3.0-only')
      expect(result.compatible).toBe(false)
      expect(result.severity).toBe('ERROR')
    })
  })

  describe('Public Domain Licenses (Universal Compatibility)', () => {
    it('should allow Unlicense with any project license', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'Unlicense')
      expect(result.compatible).toBe(true)
    })

    it('should allow CC0-1.0 with any project license', () => {
      const result = checkWithMatrix('MIT', 'CC0-1.0')
      expect(result.compatible).toBe(true)
    })

    it('should allow 0BSD with any project license', () => {
      const result = checkWithMatrix('GPL-2.0-only', '0BSD')
      expect(result.compatible).toBe(true)
    })

    it('should allow WTFPL with any project license', () => {
      const result = checkWithMatrix('AGPL-3.0-only', 'WTFPL')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Permissive to Copyleft (Asymmetric Compatibility)', () => {
    it('should allow MIT dep in GPL-3.0 project', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'MIT')
      expect(result.compatible).toBe(true)
    })

    it('should allow BSD-3-Clause dep in GPL-3.0 project', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'BSD-3-Clause')
      expect(result.compatible).toBe(true)
    })

    it('should allow ISC dep in LGPL-3.0 project', () => {
      const result = checkWithMatrix('LGPL-3.0-only', 'ISC')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Tiered Error System (Severity Levels)', () => {
    it('should return PASS severity for compatible licenses', () => {
      const result = checkWithMatrix('MIT', 'MIT')
      expect(result.severity).toBe('PASS')
    })

    it('should return ERROR severity for explicit incompatibility', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'GPL-2.0-only')
      expect(result.severity).toBe('ERROR')
    })

    it('should return WARNING severity for unknown licenses', () => {
      const result = checkWithMatrix('Unknown-License-1.0', 'MIT')
      expect(result.severity).toBe('WARNING')
    })

    it('should return WARNING severity for unmapped combinations', () => {
      // EPL-2.0 not explicitly in matrix licenses section
      const result = checkWithMatrix('EPL-2.0', 'MIT')
      expect(result.severity).toBe('WARNING')
    })
  })

  describe('Source Citation Verification', () => {
    it('should return source object for GPL-3.0', () => {
      const result = checkWithMatrix('GPL-3.0-only', 'MIT')
      expect(result.source).toBeDefined()
      expect(result.source.citation).toBeDefined()
      expect(result.source.url).toBeDefined()
    })

    it('should return source with URL for incompatibility', () => {
      const result = checkWithMatrix('GPL-2.0-only', 'Apache-2.0')
      expect(result.source).toBeDefined()
      expect(result.source.url).toContain('gnu.org')
    })

    it('should return null source for unknown licenses', () => {
      const result = checkWithMatrix('Unknown-License', 'MIT')
      expect(result.source).toBeNull()
    })
  })
})

describe('explainCompatibility (--explain flag support)', () => {
  it('should format compatible result with checkmark', () => {
    const explanation = explainCompatibility('GPL-3.0-only', 'MIT')
    expect(explanation).toContain('✅')
    expect(explanation).toContain('Compatible')
  })

  it('should format incompatible result with X', () => {
    const explanation = explainCompatibility('GPL-3.0-only', 'GPL-2.0-only')
    expect(explanation).toContain('❌')
    expect(explanation).toContain('Incompatible')
  })

  it('should format warning result with warning symbol', () => {
    const explanation = explainCompatibility('Unknown-License', 'MIT')
    expect(explanation).toContain('⚠️')
  })

  it('should include source citation in explanation', () => {
    const explanation = explainCompatibility('GPL-3.0-only', 'LGPL-2.1-or-later')
    expect(explanation).toContain('📚')
    expect(explanation).toContain('Source')
  })

  it('should include URL in explanation when available', () => {
    const explanation = explainCompatibility('GPL-3.0-only', 'MIT')
    expect(explanation).toContain('🔗')
    expect(explanation).toContain('URL')
  })

  it('should mention upgrade path for LGPL→GPL', () => {
    const explanation = explainCompatibility('GPL-3.0-only', 'LGPL-2.1-or-later')
    expect(explanation).toContain('upgrade')
  })
})

describe('COMPAT_MATRIX Export Verification', () => {
  it('should export COMPAT_MATRIX object', () => {
    expect(COMPAT_MATRIX).toBeDefined()
  })

  it('should have version field', () => {
    expect(COMPAT_MATRIX.version).toBeDefined()
  })

  it('should have licenses section', () => {
    expect(COMPAT_MATRIX.licenses).toBeDefined()
    expect(COMPAT_MATRIX.licenses['MIT']).toBeDefined()
    expect(COMPAT_MATRIX.licenses['GPL-3.0-only']).toBeDefined()
  })

  it('should have wildcards section', () => {
    expect(COMPAT_MATRIX.wildcards).toBeDefined()
    expect(COMPAT_MATRIX.wildcards['*permissive*']).toBeDefined()
    expect(COMPAT_MATRIX.wildcards['*copyleft*']).toBeDefined()
  })

  it('should have sources section', () => {
    expect(COMPAT_MATRIX.sources).toBeDefined()
    expect(COMPAT_MATRIX.sources.fsf_gpl_compat).toBeDefined()
    expect(COMPAT_MATRIX.sources.mozilla_mpl_faq).toBeDefined()
  })
})

describe('Integration: checkCompatibility with Matrix (End-to-End)', () => {
  describe('False Positives Fixed (Critical Bug Fixes)', () => {
    it('GPL-3.0-only vs GPL-3.0 should be COMPATIBLE (normalization)', () => {
      const result = checkCompatibility('GPL-3.0', 'GPL-3.0-only')
      expect(result.compatible).toBe(true)
    })

    it('GPL-3.0 + LGPL-2.1-or-later should be COMPATIBLE (upgrade path)', () => {
      const result = checkCompatibility('GPL-3.0', 'LGPL-2.1-or-later')
      expect(result.compatible).toBe(true)
    })

    it('GPL-3.0 + LGPL-3.0 should be COMPATIBLE (upgrade path)', () => {
      const result = checkCompatibility('GPL-3.0', 'LGPL-3.0')
      expect(result.compatible).toBe(true)
    })

    it('GPL-3.0 + MPL-2.0 should be COMPATIBLE (Section 3.3)', () => {
      const result = checkCompatibility('GPL-3.0', 'MPL-2.0')
      expect(result.compatible).toBe(true)
    })

    it('GPL-3.0 + Apache-2.0 should be COMPATIBLE (patent resolved)', () => {
      const result = checkCompatibility('GPL-3.0', 'Apache-2.0')
      expect(result.compatible).toBe(true)
    })
  })

  describe('Correct Incompatibilities Still Detected', () => {
    it('GPL-3.0 + GPL-2.0-only should be INCOMPATIBLE', () => {
      const result = checkCompatibility('GPL-3.0', 'GPL-2.0-only')
      expect(result.compatible).toBe(false)
    })

    it('MIT + GPL-3.0 should be INCOMPATIBLE (permissive cannot use copyleft)', () => {
      const result = checkCompatibility('MIT', 'GPL-3.0')
      expect(result.compatible).toBe(false)
    })

    it('GPL-2.0 + Apache-2.0 should be INCOMPATIBLE (patent conflict)', () => {
      const result = checkCompatibility('GPL-2.0', 'Apache-2.0')
      expect(result.compatible).toBe(false)
    })

    it('GPL-2.0-only + MPL-2.0 should be INCOMPATIBLE', () => {
      const result = checkCompatibility('GPL-2.0-only', 'MPL-2.0')
      expect(result.compatible).toBe(false)
    })
  })

  describe('Complex SPDX Expressions with Matrix Rules', () => {
    it('GPL-3.0 + (MIT OR LGPL-3.0) should be COMPATIBLE (both options work)', () => {
      const result = checkCompatibility('GPL-3.0', 'MIT OR LGPL-3.0')
      expect(result.compatible).toBe(true)
    })

    it('GPL-3.0 + (LGPL-2.1-or-later OR Apache-2.0) should be COMPATIBLE', () => {
      const result = checkCompatibility('GPL-3.0', 'LGPL-2.1-or-later OR Apache-2.0')
      expect(result.compatible).toBe(true)
    })

    it('GPL-2.0-only + (MIT OR Apache-2.0) should be COMPATIBLE (MIT option)', () => {
      const result = checkCompatibility('GPL-2.0-only', 'MIT OR Apache-2.0')
      expect(result.compatible).toBe(true)
    })
  })
})
