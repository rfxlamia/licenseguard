/**
 * Unit Tests for License Detector (Jaccard Index)
 *
 * Tests:
 * 1. tokenize() function
 * 2. jaccardSimilarity() calculation
 * 3. SPDX-License-Identifier detection
 * 4. Dual license detection
 * 5. BSD-2 vs BSD-3 differentiation
 * 6. Full license text detection for each license type
 * 7. Edge cases (empty, short, unknown)
 */

const {
  detectLicenseFromText,
  tokenize,
  jaccardSimilarity,
  detectDualLicense,
  differentitateBSD,
  getAllScores
} = require('../../lib/scanner/license-detector')

describe('License Detector', () => {
  // ============================================
  // tokenize() tests - Now uses bigrams + stopwords
  // ============================================
  describe('tokenize()', () => {
    test('should generate bigrams from text', () => {
      const tokens = tokenize('permission hereby granted free charge')
      expect(tokens).toBeInstanceOf(Set)
      // Should have bigrams
      expect(tokens.has('permission hereby')).toBe(true)
      expect(tokens.has('hereby granted')).toBe(true)
      expect(tokens.has('granted free')).toBe(true)
      expect(tokens.has('free charge')).toBe(true)
    })

    test('should filter stopwords before generating bigrams', () => {
      // 'the' and 'and' are stopwords
      const tokens = tokenize('software and documentation the files')
      // Stopwords removed, so bigrams are: software documentation, documentation files
      expect(tokens.has('software documentation')).toBe(true)
      expect(tokens.has('documentation files')).toBe(true)
      // 'and' and 'the' should not appear
      expect([...tokens].every(t => !t.includes(' and '))).toBe(true)
      expect([...tokens].every(t => !t.includes(' the '))).toBe(true)
    })

    test('should add important license words as unigrams', () => {
      const tokens = tokenize('licensed under MIT license terms')
      // 'mit' is an important word, should be added as unigram
      expect(tokens.has('mit')).toBe(true)
    })

    test('should handle empty input', () => {
      expect(tokenize('')).toEqual(new Set())
      expect(tokenize(null)).toEqual(new Set())
      expect(tokenize(undefined)).toEqual(new Set())
    })
  })

  // ============================================
  // jaccardSimilarity() tests
  // ============================================
  describe('jaccardSimilarity()', () => {
    test('should return 1.0 for identical sets', () => {
      const set = new Set(['hello', 'world', 'test'])
      expect(jaccardSimilarity(set, set)).toBe(1)
    })

    test('should return 0.0 for disjoint sets', () => {
      const setA = new Set(['hello', 'world'])
      const setB = new Set(['foo', 'bar'])
      expect(jaccardSimilarity(setA, setB)).toBe(0)
    })

    test('should return correct similarity for overlapping sets', () => {
      const setA = new Set(['hello', 'world', 'test'])
      const setB = new Set(['hello', 'world', 'foo'])
      // Intersection: {hello, world} = 2
      // Union: {hello, world, test, foo} = 4
      // Jaccard = 2/4 = 0.5
      expect(jaccardSimilarity(setA, setB)).toBe(0.5)
    })

    test('should handle empty sets', () => {
      const empty = new Set()
      const nonEmpty = new Set(['hello'])
      expect(jaccardSimilarity(empty, nonEmpty)).toBe(0)
      expect(jaccardSimilarity(nonEmpty, empty)).toBe(0)
      expect(jaccardSimilarity(empty, empty)).toBe(0)
    })
  })

  // ============================================
  // SPDX-License-Identifier detection
  // ============================================
  describe('SPDX-License-Identifier detection', () => {
    test('should detect single SPDX identifier', () => {
      const text = `
        // Copyright 2023 Example Corp
        // SPDX-License-Identifier: MIT

        Some code here...
      `
      expect(detectLicenseFromText(text)).toBe('MIT')
    })

    test('should detect dual SPDX expression', () => {
      const text = `
        // SPDX-License-Identifier: MIT OR Apache-2.0

        Some code here...
      `
      expect(detectLicenseFromText(text)).toBe('MIT OR Apache-2.0')
    })

    test('should detect GPL SPDX identifier', () => {
      const text = `
        // SPDX-License-Identifier: GPL-3.0-only

        Some code here...
      `
      expect(detectLicenseFromText(text)).toBe('GPL-3.0-only')
    })
  })

  // ============================================
  // Dual license detection
  // ============================================
  describe('detectDualLicense()', () => {
    test('should detect "dual licensed under MIT and Apache"', () => {
      const text = 'This project is dual licensed under MIT and Apache 2.0'
      expect(detectDualLicense(text)).toBe('MIT OR Apache-2.0')
    })

    test('should detect "licensed under either MIT or Apache"', () => {
      const text = 'This software is licensed under either MIT or Apache'
      expect(detectDualLicense(text)).toBe('MIT OR Apache-2.0')
    })

    test('should return null for single license text', () => {
      const text = 'This software is licensed under MIT'
      expect(detectDualLicense(text)).toBeNull()
    })
  })

  // ============================================
  // BSD differentiation
  // ============================================
  describe('differentitateBSD()', () => {
    test('should detect BSD-3-Clause with endorsement clause', () => {
      const bsd3Text = `
        Redistribution and use in source and binary forms...
        Neither the name of the copyright holder may be used to endorse
        or promote products derived from this software...
      `
      expect(differentitateBSD(bsd3Text)).toBe('BSD-3-Clause')
    })

    test('should detect BSD-2-Clause without endorsement clause', () => {
      const bsd2Text = `
        Redistribution and use in source and binary forms...
        Redistributions of source code must retain...
        Redistributions in binary form must reproduce...
        THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS...
      `
      expect(differentitateBSD(bsd2Text)).toBe('BSD-2-Clause')
    })
  })

  // ============================================
  // Full license detection tests
  // ============================================
  describe('detectLicenseFromText() - Full Licenses', () => {
    test('should detect MIT license', () => {
      const mitText = `
        MIT License

        Copyright (c) 2023 Example

        Permission is hereby granted, free of charge, to any person obtaining a copy
        of this software and associated documentation files (the "Software"), to deal
        in the Software without restriction, including without limitation the rights
        to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
        copies of the Software, and to permit persons to whom the Software is
        furnished to do so, subject to the following conditions:

        The above copyright notice and this permission notice shall be included in all
        copies or substantial portions of the Software.

        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
        AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
        LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
        OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
        SOFTWARE.
      `
      expect(detectLicenseFromText(mitText)).toBe('MIT')
    })

    test('should detect Apache-2.0 license', () => {
      const apacheText = `
        Licensed under the Apache License, Version 2.0 (the "License");
        you may not use this file except in compliance with the License.
        You may obtain a copy of the License at

            http://www.apache.org/licenses/LICENSE-2.0

        Unless required by applicable law or agreed to in writing, software
        distributed under the License is distributed on an "AS IS" BASIS,
        WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
        See the License for the specific language governing permissions and
        limitations under the License.
      `
      expect(detectLicenseFromText(apacheText)).toBe('Apache-2.0')
    })

    test('should detect ISC license', () => {
      const iscText = `
        ISC License

        Copyright (c) 2023 Example

        Permission to use, copy, modify, and/or distribute this software for any
        purpose with or without fee is hereby granted, provided that the above
        copyright notice and this permission notice appear in all copies.

        THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
        WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
        MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
        ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
        WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
        ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
        OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
      `
      expect(detectLicenseFromText(iscText)).toBe('ISC')
    })

    test('should detect GPL-3.0 license', () => {
      const gpl3Text = `
        GNU GENERAL PUBLIC LICENSE
        Version 3, 29 June 2007

        This program is free software: you can redistribute it and/or modify
        it under the terms of the GNU General Public License as published by
        the Free Software Foundation, either version 3 of the License, or
        (at your option) any later version.

        This program is distributed in the hope that it will be useful,
        but WITHOUT ANY WARRANTY; without even the implied warranty of
        MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
        GNU General Public License for more details.

        You should have received a copy of the GNU General Public License
        along with this program.  If not, see <https://www.gnu.org/licenses/>.
      `
      expect(detectLicenseFromText(gpl3Text)).toBe('GPL-3.0-only')
    })

    test('should detect MPL-2.0 license', () => {
      const mplText = `
        Mozilla Public License Version 2.0

        This Source Code Form is subject to the terms of the Mozilla Public
        License, v. 2.0. If a copy of the MPL was not distributed with this
        file, You can obtain one at http://mozilla.org/MPL/2.0/.

        1. Definitions

        1.1. "Contributor" means each individual or legal entity that creates,
        contributes to the creation of, or owns Covered Software.

        1.4. "Covered Software" means Source Code Form to which the initial
        Contributor has attached the notice in Exhibit A.

        2. License Grants and Conditions

        2.1. Grants
        Each Contributor hereby grants You a world-wide, royalty-free,
        non-exclusive license.
      `
      expect(detectLicenseFromText(mplText)).toBe('MPL-2.0')
    })

    test('should detect Unlicense', () => {
      const unlicenseText = `
        This is free and unencumbered software released into the public domain.

        Anyone is free to copy, modify, publish, use, compile, sell, or
        distribute this software, either in source code form or as a compiled
        binary, for any purpose, commercial or non-commercial, and by any
        means.

        In jurisdictions that recognize copyright laws, the author or authors
        of this software dedicate any and all copyright interest in the
        software to the public domain.
      `
      expect(detectLicenseFromText(unlicenseText)).toBe('Unlicense')
    })

    test('should detect BSL-1.0 (Boost) license', () => {
      const boostText = `
        Boost Software License - Version 1.0 - August 17th, 2003

        Permission is hereby granted, free of charge, to any person or organization
        obtaining a copy of the software and accompanying documentation covered by
        this license (the "Software") to use, reproduce, display, distribute,
        execute, and transmit the Software, and to prepare derivative works of the
        Software, and to permit third-parties to whom the Software is furnished to
        do so, all subject to the following:

        The copyright notices in the Software and this entire statement, including
        the above license grant, this restriction and the following disclaimer,
        must be included in all copies of the Software, in whole or in part, and
        all derivative works of the Software, unless such copies or derivative
        works are solely in the form of machine-executable object code generated by
        a source language processor.
      `
      expect(detectLicenseFromText(boostText)).toBe('BSL-1.0')
    })
  })

  // ============================================
  // Edge cases
  // ============================================
  describe('Edge cases', () => {
    test('should return UNKNOWN for empty text', () => {
      expect(detectLicenseFromText('')).toBe('UNKNOWN')
    })

    test('should return UNKNOWN for null/undefined', () => {
      expect(detectLicenseFromText(null)).toBe('UNKNOWN')
      expect(detectLicenseFromText(undefined)).toBe('UNKNOWN')
    })

    test('should return UNKNOWN for very short text', () => {
      expect(detectLicenseFromText('MIT License')).toBe('UNKNOWN')
    })

    test('should return UNKNOWN for unrecognized license', () => {
      const customText = `
        CUSTOM PROPRIETARY LICENSE

        This software is the exclusive property of Example Corp.
        No one may use, copy, modify, or distribute this software
        without explicit written permission from Example Corp.
        All rights reserved worldwide.
      `
      expect(detectLicenseFromText(customText)).toBe('UNKNOWN')
    })

    test('should handle license with extra whitespace and formatting', () => {
      const messyMitText = `


              MIT    License


        Permission  is  hereby  granted,    free  of  charge,   to   any   person
        obtaining   a   copy   of   this   software   and   associated
        documentation  files  (the  "Software"),  to  deal  in  the  Software
        without  restriction,  including  without  limitation  the  rights
        to  use,  copy,  modify,  merge,  publish,  distribute,  sublicense,
        and/or  sell  copies  of  the  Software.

        THE  SOFTWARE  IS  PROVIDED  "AS  IS",  WITHOUT  WARRANTY  OF  ANY  KIND.

      `
      expect(detectLicenseFromText(messyMitText)).toBe('MIT')
    })
  })

  // ============================================
  // getAllScores() for debugging
  // ============================================
  describe('getAllScores()', () => {
    test('should return sorted scores for all licenses', () => {
      const mitText = `
        Permission is hereby granted, free of charge, to any person obtaining a copy
        of this software and associated documentation files (the "Software"), to deal
        in the Software without restriction, including without limitation the rights
        to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
        copies of the Software.
        THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
      `
      const scores = getAllScores(mitText)

      // Should be an array
      expect(Array.isArray(scores)).toBe(true)

      // Should be sorted by score descending
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1].score).toBeGreaterThanOrEqual(scores[i].score)
      }

      // MIT should be top or near top
      const mitScore = scores.find(s => s.licenseId === 'MIT')
      expect(mitScore).toBeDefined()
      expect(mitScore.score).toBeGreaterThan(0.5)
    })
  })
})
