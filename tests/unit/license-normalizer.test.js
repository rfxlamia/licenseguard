/**
 * Tests for License Normalizer
 * Comprehensive test coverage for SPDX normalization, license families, and ecosystem-specific variants
 */

const {
  normalize,
  getLicenseFamily,
  areSameLicense
} = require('../../lib/scanner/license-normalizer')

describe('License Normalizer', () => {
  // ================================================
  // AC #1: SPDX Normalization Works
  // ================================================

  describe('normalize()', () => {
    describe('SPDX Deprecated Identifiers (GPL/LGPL)', () => {
      it('should normalize GPL-3.0 to GPL-3.0-only', () => {
        expect(normalize('GPL-3.0')).toBe('GPL-3.0-only')
      })

      it('should normalize GPL 3.0 to GPL-3.0-only', () => {
        expect(normalize('GPL 3.0')).toBe('GPL-3.0-only')
      })

      it('should normalize GPLv3 to GPL-3.0-only', () => {
        expect(normalize('GPLv3')).toBe('GPL-3.0-only')
      })

      it('should normalize GPL-3.0.0 to GPL-3.0-only (version normalization)', () => {
        expect(normalize('GPL-3.0.0')).toBe('GPL-3.0-only')
      })

      it('should normalize GPL-2.0 to GPL-2.0-only', () => {
        expect(normalize('GPL-2.0')).toBe('GPL-2.0-only')
      })

      it('should normalize GPLv2 to GPL-2.0-only', () => {
        expect(normalize('GPLv2')).toBe('GPL-2.0-only')
      })

      it('should normalize GPL-3.0+ to GPL-3.0-or-later', () => {
        expect(normalize('GPL-3.0+')).toBe('GPL-3.0-or-later')
      })

      it('should normalize GPLv3+ to GPL-3.0-or-later', () => {
        expect(normalize('GPLv3+')).toBe('GPL-3.0-or-later')
      })

      it('should normalize LGPL-3.0 to LGPL-3.0-only', () => {
        expect(normalize('LGPL-3.0')).toBe('LGPL-3.0-only')
      })

      it('should normalize LGPL to LGPL-2.1-or-later (common Python default)', () => {
        expect(normalize('LGPL')).toBe('LGPL-2.1-or-later')
      })

      // CRITICAL BUG FIX: LGPL vs GPL regex ordering
      // LGPL contains "GPL" substring, so LGPL patterns must be checked BEFORE GPL
      it('should normalize LGPL 3 to LGPL-3.0-only (NOT GPL!)', () => {
        expect(normalize('LGPL 3')).toBe('LGPL-3.0-only')
      })

      it('should normalize LGPL 3.0 to LGPL-3.0-only (NOT GPL!)', () => {
        expect(normalize('LGPL 3.0')).toBe('LGPL-3.0-only')
      })

      it('should normalize lgpl v3 to LGPL-3.0-only (case-insensitive, NOT GPL!)', () => {
        expect(normalize('lgpl v3')).toBe('LGPL-3.0-only')
      })

      it('should normalize LGPL 2 to LGPL-2.1-only (NOT GPL-2.0!)', () => {
        expect(normalize('LGPL 2')).toBe('LGPL-2.1-only')
      })

      it('should normalize lgplv3 to LGPL-3.0-only (variant, NOT GPL!)', () => {
        expect(normalize('lgplv3')).toBe('LGPL-3.0-only')
      })

      // CRITICAL BUG FIX: AGPL vs GPL regex ordering (same issue as LGPL)
      // AGPL contains "GPL" substring, so AGPL patterns must be checked BEFORE GPL
      it('should normalize AGPL-3.0-only correctly (NOT GPL-3.0-only!)', () => {
        expect(normalize('AGPL-3.0-only')).toBe('AGPL-3.0-only')
      })

      it('should normalize AGPL-3.0 to AGPL-3.0-only (NOT GPL!)', () => {
        expect(normalize('AGPL-3.0')).toBe('AGPL-3.0-only')
      })

      it('should normalize AGPL 3 to AGPL-3.0-only (NOT GPL!)', () => {
        expect(normalize('AGPL 3')).toBe('AGPL-3.0-only')
      })

      it('should normalize AGPLv3 to AGPL-3.0-only (NOT GPLv3!)', () => {
        expect(normalize('AGPLv3')).toBe('AGPL-3.0-only')
      })

      it('should normalize AGPL-3.0+ to AGPL-3.0-or-later', () => {
        expect(normalize('AGPL-3.0+')).toBe('AGPL-3.0-or-later')
      })

      it('should normalize AGPL-3.0-or-later correctly', () => {
        expect(normalize('AGPL-3.0-or-later')).toBe('AGPL-3.0-or-later')
      })
    })

    describe('Case Normalization', () => {
      it('should normalize mit to MIT', () => {
        expect(normalize('mit')).toBe('MIT')
      })

      it('should normalize Mit to MIT', () => {
        expect(normalize('Mit')).toBe('MIT')
      })

      it('should normalize MIT License to MIT', () => {
        expect(normalize('MIT License')).toBe('MIT')
      })

      it('should normalize apache 2.0 to Apache-2.0 (case insensitive)', () => {
        expect(normalize('apache 2.0')).toBe('Apache-2.0')
      })

      it('should normalize bsd to BSD-3-Clause', () => {
        expect(normalize('bsd')).toBe('BSD-3-Clause')
      })
    })

    describe('Version Normalization', () => {
      it('should normalize Apache-2 to Apache-2.0', () => {
        expect(normalize('Apache-2')).toBe('Apache-2.0')
      })

      it('should normalize Apache 2.0 to Apache-2.0', () => {
        expect(normalize('Apache 2.0')).toBe('Apache-2.0')
      })

      it('should normalize Apache License 2.0 to Apache-2.0', () => {
        expect(normalize('Apache License 2.0')).toBe('Apache-2.0')
      })

      it('should normalize Apache License, Version 2.0 to Apache-2.0', () => {
        expect(normalize('Apache License, Version 2.0')).toBe('Apache-2.0')
      })

      it('should normalize Apache Software License to Apache-2.0 (Python Trove)', () => {
        expect(normalize('Apache Software License')).toBe('Apache-2.0')
      })

      it('should normalize ASL 2 to Apache-2.0', () => {
        expect(normalize('ASL 2')).toBe('Apache-2.0')
      })
    })

    describe('BSD Variants', () => {
      it('should normalize BSD License to BSD-3-Clause (default)', () => {
        expect(normalize('BSD License')).toBe('BSD-3-Clause')
      })

      it('should normalize BSD to BSD-3-Clause', () => {
        expect(normalize('BSD')).toBe('BSD-3-Clause')
      })

      it('should normalize BSD 3-Clause to BSD-3-Clause', () => {
        expect(normalize('BSD 3-Clause')).toBe('BSD-3-Clause')
      })

      it('should normalize 3-Clause BSD License to BSD-3-Clause', () => {
        expect(normalize('3-Clause BSD License')).toBe('BSD-3-Clause')
      })

      it('should normalize New BSD to BSD-3-Clause', () => {
        expect(normalize('New BSD')).toBe('BSD-3-Clause')
      })

      it('should normalize Modified BSD to BSD-3-Clause', () => {
        expect(normalize('Modified BSD')).toBe('BSD-3-Clause')
      })

      it('should normalize BSD 2-Clause to BSD-2-Clause', () => {
        expect(normalize('BSD 2-Clause')).toBe('BSD-2-Clause')
      })

      it('should normalize Simplified BSD to BSD-2-Clause', () => {
        expect(normalize('Simplified BSD')).toBe('BSD-2-Clause')
      })

      it('should detect full BSD license text and normalize to BSD-3-Clause', () => {
        const fullText = 'Redistribution and use in source and binary forms, with or without modification...'
        expect(normalize(fullText)).toBe('BSD-3-Clause')
      })
    })

    describe('Python Ecosystem Variants', () => {
      it('should normalize Python Software Foundation License to PSF-2.0', () => {
        expect(normalize('Python Software Foundation License')).toBe('PSF-2.0')
      })

      it('should normalize PSF to PSF-2.0', () => {
        expect(normalize('PSF')).toBe('PSF-2.0')
      })

      it('should normalize GNU General Public License (GPL) to GPL-3.0-only (default v3)', () => {
        expect(normalize('GNU General Public License (GPL)')).toBe('GPL-3.0-only')
      })

      it('should normalize GNU Library or Lesser General Public License (LGPL) to LGPL-2.1-or-later', () => {
        expect(normalize('GNU Library or Lesser General Public License (LGPL)')).toBe('LGPL-2.1-or-later')
      })
    })

    describe('MPL Variants', () => {
      it('should normalize MPL-2.0 to MPL-2.0', () => {
        expect(normalize('MPL-2.0')).toBe('MPL-2.0')
      })

      it('should normalize Mozilla Public License 2.0 to MPL-2.0', () => {
        expect(normalize('Mozilla Public License 2.0')).toBe('MPL-2.0')
      })

      it('should normalize MPL 2.0 to MPL-2.0', () => {
        expect(normalize('MPL 2.0')).toBe('MPL-2.0')
      })
    })

    describe('ISC Variants', () => {
      it('should normalize ISC to ISC', () => {
        expect(normalize('ISC')).toBe('ISC')
      })

      it('should normalize ISC License to ISC', () => {
        expect(normalize('ISC License')).toBe('ISC')
      })

      it('should normalize ISC License (ISCL) to ISC', () => {
        expect(normalize('ISC License (ISCL)')).toBe('ISC')
      })
    })

    describe('Public Domain / Ultra-Permissive', () => {
      it('should normalize Unlicense to Unlicense', () => {
        expect(normalize('Unlicense')).toBe('Unlicense')
      })

      it('should normalize Public Domain to Unlicense', () => {
        expect(normalize('Public Domain')).toBe('Unlicense')
      })

      it('should normalize CC0 to CC0-1.0', () => {
        expect(normalize('CC0')).toBe('CC0-1.0')
      })

      it('should normalize CC0-1.0 to CC0-1.0', () => {
        expect(normalize('CC0-1.0')).toBe('CC0-1.0')
      })

      it('should normalize WTFPL to WTFPL', () => {
        expect(normalize('WTFPL')).toBe('WTFPL')
      })

      it('should normalize 0BSD to 0BSD', () => {
        expect(normalize('0BSD')).toBe('0BSD')
      })
    })

    describe('Proprietary / Non-SPDX', () => {
      it('should normalize Proprietary to LicenseRef-Proprietary', () => {
        expect(normalize('Proprietary')).toBe('LicenseRef-Proprietary')
      })

      it('should normalize Other/Proprietary License to LicenseRef-Proprietary', () => {
        expect(normalize('Other/Proprietary License')).toBe('LicenseRef-Proprietary')
      })

      it('should normalize NVIDIA Proprietary Software to LicenseRef-NVIDIA-Proprietary', () => {
        expect(normalize('NVIDIA Proprietary Software')).toBe('LicenseRef-NVIDIA-Proprietary')
      })

      it('should normalize Commercial to LicenseRef-Commercial', () => {
        expect(normalize('Commercial')).toBe('LicenseRef-Commercial')
      })
    })

    describe('Other Permissive Licenses', () => {
      it('should normalize Zlib to Zlib', () => {
        expect(normalize('Zlib')).toBe('Zlib')
      })

      it('should normalize zlib License to Zlib', () => {
        expect(normalize('zlib License')).toBe('Zlib')
      })

      it('should normalize bzip2 to bzip2-1.0.6', () => {
        expect(normalize('bzip2')).toBe('bzip2-1.0.6')
      })

      it('should normalize BSL-1.0 to BSL-1.0', () => {
        expect(normalize('BSL-1.0')).toBe('BSL-1.0')
      })

      it('should normalize Boost to BSL-1.0', () => {
        expect(normalize('Boost')).toBe('BSL-1.0')
      })
    })

    describe('UNKNOWN Cases', () => {
      it('should return UNKNOWN for empty string', () => {
        expect(normalize('')).toBe('UNKNOWN')
      })

      it('should return UNKNOWN for null', () => {
        expect(normalize(null)).toBe('UNKNOWN')
      })

      it('should return UNKNOWN for undefined', () => {
        expect(normalize(undefined)).toBe('UNKNOWN')
      })

      it('should return UNKNOWN for "none"', () => {
        expect(normalize('none')).toBe('UNKNOWN')
      })

      it('should return UNKNOWN for "NONE"', () => {
        expect(normalize('NONE')).toBe('UNKNOWN')
      })

      it('should return UNKNOWN for "UNKNOWN"', () => {
        expect(normalize('UNKNOWN')).toBe('UNKNOWN')
      })
    })

    describe('Whitespace Handling', () => {
      it('should normalize "  MIT  " to MIT (trim)', () => {
        expect(normalize('  MIT  ')).toBe('MIT')
      })

      it('should normalize "Apache   2.0" to Apache-2.0 (multiple spaces)', () => {
        expect(normalize('Apache   2.0')).toBe('Apache-2.0')
      })
    })

    describe('Already Valid SPDX', () => {
      it('should keep GPL-3.0-only as is (canonical form)', () => {
        expect(normalize('GPL-3.0-only')).toBe('GPL-3.0-only')
      })

      it('should keep Apache-2.0 as is', () => {
        expect(normalize('Apache-2.0')).toBe('Apache-2.0')
      })

      it('should keep BSD-3-Clause as is', () => {
        expect(normalize('BSD-3-Clause')).toBe('BSD-3-Clause')
      })

      it('should return unmapped valid SPDX as-is (e.g., EPL-2.0)', () => {
        expect(normalize('EPL-2.0')).toBe('EPL-2.0')
      })
    })
  })

  // ================================================
  // License Family Detection
  // ================================================

  describe('getLicenseFamily()', () => {
    it('should return GPL3 for GPL-3.0-only', () => {
      expect(getLicenseFamily('GPL-3.0-only')).toBe('GPL3')
    })

    it('should return GPL3-or-later for GPL-3.0-or-later', () => {
      expect(getLicenseFamily('GPL-3.0-or-later')).toBe('GPL3-or-later')
    })

    it('should return GPL2 for GPL-2.0-only', () => {
      expect(getLicenseFamily('GPL-2.0-only')).toBe('GPL2')
    })

    it('should return LGPL for LGPL-2.1-only', () => {
      expect(getLicenseFamily('LGPL-2.1-only')).toBe('LGPL')
    })

    it('should return LGPL-or-later for LGPL-2.1-or-later', () => {
      expect(getLicenseFamily('LGPL-2.1-or-later')).toBe('LGPL-or-later')
    })

    it('should return LGPL3 for LGPL-3.0-only', () => {
      expect(getLicenseFamily('LGPL-3.0-only')).toBe('LGPL3')
    })

    it('should return MPL for MPL-2.0', () => {
      expect(getLicenseFamily('MPL-2.0')).toBe('MPL')
    })

    it('should return Apache for Apache-2.0', () => {
      expect(getLicenseFamily('Apache-2.0')).toBe('Apache')
    })

    it('should return MIT for MIT', () => {
      expect(getLicenseFamily('MIT')).toBe('MIT')
    })

    it('should return BSD for BSD-3-Clause', () => {
      expect(getLicenseFamily('BSD-3-Clause')).toBe('BSD')
    })

    it('should return BSD for BSD-2-Clause', () => {
      expect(getLicenseFamily('BSD-2-Clause')).toBe('BSD')
    })

    it('should return ISC for ISC', () => {
      expect(getLicenseFamily('ISC')).toBe('ISC')
    })

    it('should return Public-Domain for Unlicense', () => {
      expect(getLicenseFamily('Unlicense')).toBe('Public-Domain')
    })

    it('should return Public-Domain for CC0-1.0', () => {
      expect(getLicenseFamily('CC0-1.0')).toBe('Public-Domain')
    })

    it('should return Public-Domain for WTFPL', () => {
      expect(getLicenseFamily('WTFPL')).toBe('Public-Domain')
    })

    it('should return Permissive for Zlib', () => {
      expect(getLicenseFamily('Zlib')).toBe('Permissive')
    })

    it('should return Permissive for BSL-1.0', () => {
      expect(getLicenseFamily('BSL-1.0')).toBe('Permissive')
    })

    it('should return Unknown for unknown licenses', () => {
      expect(getLicenseFamily('SomeWeirdLicense-1.0')).toBe('Unknown')
    })

    it('should return Unknown for UNKNOWN', () => {
      expect(getLicenseFamily('UNKNOWN')).toBe('Unknown')
    })

    it('should normalize before family lookup (GPL-3.0 → GPL3)', () => {
      expect(getLicenseFamily('GPL-3.0')).toBe('GPL3')  // GPL-3.0 normalizes to GPL-3.0-only
    })

    it('should normalize before family lookup (mit → MIT)', () => {
      expect(getLicenseFamily('mit')).toBe('MIT')
    })
  })

  // ================================================
  // Same License Detection (Critical for AC#1)
  // ================================================

  describe('areSameLicense()', () => {
    it('should recognize GPL-3.0 and GPL-3.0-only as same license (AC#1)', () => {
      expect(areSameLicense('GPL-3.0', 'GPL-3.0-only')).toBe(true)
    })

    it('should recognize mit and MIT as same license (AC#1)', () => {
      expect(areSameLicense('mit', 'MIT')).toBe(true)
    })

    it('should recognize MIT and MIT License as same license', () => {
      expect(areSameLicense('MIT', 'MIT License')).toBe(true)
    })

    it('should recognize Apache-2 and Apache-2.0 as same license', () => {
      expect(areSameLicense('Apache-2', 'Apache-2.0')).toBe(true)
    })

    it('should recognize GPL 3.0 and GPL-3.0-only as same license', () => {
      expect(areSameLicense('GPL 3.0', 'GPL-3.0-only')).toBe(true)
    })

    it('should recognize GPLv3 and GPL-3.0-only as same license', () => {
      expect(areSameLicense('GPLv3', 'GPL-3.0-only')).toBe(true)
    })

    it('should return false for different licenses (MIT vs Apache-2.0)', () => {
      expect(areSameLicense('MIT', 'Apache-2.0')).toBe(false)
    })

    it('should return false for different GPL versions (GPL-2.0-only vs GPL-3.0-only)', () => {
      expect(areSameLicense('GPL-2.0-only', 'GPL-3.0-only')).toBe(false)
    })

    it('should return false for GPL-3.0-only vs GPL-3.0-or-later (different suffixes)', () => {
      expect(areSameLicense('GPL-3.0-only', 'GPL-3.0-or-later')).toBe(false)
    })
  })
})
