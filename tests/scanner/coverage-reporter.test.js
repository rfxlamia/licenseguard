const { calculateCoverage, displayCoverage, getCoverageEmoji } = require('../../lib/scanner/coverage-reporter')

describe('Coverage Reporter', () => {
  describe('calculateCoverage', () => {
    test('calculates 100% coverage when all packages identified', () => {
      const scanResults = {
        packages: [
          { name: 'chalk', license: 'MIT' },
          { name: 'commander', license: 'MIT' },
        ],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(2)
      expect(coverage.identified).toBe(2)
      expect(coverage.unknown).toBe(0)
      expect(coverage.percentage).toBe(100.0)
    })

    test('calculates 66.7% coverage when 1 of 3 packages unknown', () => {
      const scanResults = {
        packages: [
          { name: 'chalk', license: 'MIT' },
          { name: 'commander', license: 'MIT' },
          { name: 'unknown-lib', license: 'UNKNOWN' },
        ],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(3)
      expect(coverage.identified).toBe(2)
      expect(coverage.unknown).toBe(1)
      expect(coverage.percentage).toBe(66.7)
    })

    test('calculates 0% coverage when all packages unknown', () => {
      const scanResults = {
        packages: [
          { name: 'unknown-1', license: 'UNKNOWN' },
          { name: 'unknown-2', license: 'UNKNOWN' },
        ],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(2)
      expect(coverage.identified).toBe(0)
      expect(coverage.unknown).toBe(2)
      expect(coverage.percentage).toBe(0.0)
    })

    test('calculates 50% coverage correctly', () => {
      const scanResults = {
        packages: [
          { name: 'chalk', license: 'MIT' },
          { name: 'unknown-lib', license: 'UNKNOWN' },
        ],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(2)
      expect(coverage.identified).toBe(1)
      expect(coverage.unknown).toBe(1)
      expect(coverage.percentage).toBe(50.0)
    })

    test('handles empty package list', () => {
      const scanResults = {
        packages: [],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(0)
      expect(coverage.identified).toBe(0)
      expect(coverage.unknown).toBe(0)
      expect(coverage.percentage).toBe(0.0)
    })

    test('calculates percentage to 1 decimal place', () => {
      const scanResults = {
        packages: [
          { name: 'pkg1', license: 'MIT' },
          { name: 'pkg2', license: 'MIT' },
          { name: 'unknown', license: 'UNKNOWN' },
        ],
      }

      const coverage = calculateCoverage(scanResults)
      // 2/3 = 66.666... should round to 66.7
      expect(coverage.percentage).toBe(66.7)
      expect(typeof coverage.percentage).toBe('number')
    })

    test('handles null scanResults gracefully', () => {
      const coverage = calculateCoverage(null)
      expect(coverage.total).toBe(0)
      expect(coverage.identified).toBe(0)
      expect(coverage.unknown).toBe(0)
      expect(coverage.percentage).toBe(0.0)
    })

    test('handles undefined scanResults gracefully', () => {
      const coverage = calculateCoverage(undefined)
      expect(coverage.total).toBe(0)
      expect(coverage.identified).toBe(0)
      expect(coverage.unknown).toBe(0)
      expect(coverage.percentage).toBe(0.0)
    })

    test('handles scanResults without packages property', () => {
      const scanResults = { incompatible: 0 }
      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(0)
      expect(coverage.identified).toBe(0)
      expect(coverage.unknown).toBe(0)
      expect(coverage.percentage).toBe(0.0)
    })

    test('calculates coverage with new format (totalDependencies)', () => {
      const scanResults = {
        totalDependencies: 100,
        compatible: 90,
        incompatible: 5,
        unknown: 5,
        issues: [],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(100)
      expect(coverage.identified).toBe(95) // 100 - 5 unknown
      expect(coverage.unknown).toBe(5)
      expect(coverage.percentage).toBe(95.0)
    })

    test('calculates coverage with new format (all identified)', () => {
      const scanResults = {
        totalDependencies: 5,
        compatible: 5,
        incompatible: 0,
        unknown: 0,
        issues: [],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(5)
      expect(coverage.identified).toBe(5)
      expect(coverage.unknown).toBe(0)
      expect(coverage.percentage).toBe(100.0)
    })

    test('calculates coverage with new format (some unknown)', () => {
      const scanResults = {
        totalDependencies: 10,
        compatible: 6,
        incompatible: 1,
        unknown: 3,
        issues: [],
      }

      const coverage = calculateCoverage(scanResults)
      expect(coverage.total).toBe(10)
      expect(coverage.identified).toBe(7) // 10 - 3 unknown
      expect(coverage.unknown).toBe(3)
      expect(coverage.percentage).toBe(70.0)
    })
  })

  describe('getCoverageEmoji', () => {
    test('returns ✅ for 90%+ coverage', () => {
      expect(getCoverageEmoji(100)).toBe('✅')
      expect(getCoverageEmoji(95)).toBe('✅')
      expect(getCoverageEmoji(90)).toBe('✅')
    })

    test('returns ⚠️ for 70-89% coverage', () => {
      expect(getCoverageEmoji(89)).toBe('⚠️')
      expect(getCoverageEmoji(89.9)).toBe('⚠️')
      expect(getCoverageEmoji(80)).toBe('⚠️')
      expect(getCoverageEmoji(70)).toBe('⚠️')
    })

    test('returns ❌ for <70% coverage', () => {
      expect(getCoverageEmoji(69)).toBe('❌')
      expect(getCoverageEmoji(69.9)).toBe('❌')
      expect(getCoverageEmoji(50)).toBe('❌')
      expect(getCoverageEmoji(0)).toBe('❌')
    })
  })

  describe('displayCoverage', () => {
    let consoleLogSpy

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    })

    afterEach(() => {
      consoleLogSpy.mockRestore()
    })

    test('displays coverage with correct emoji for high coverage (90%+)', () => {
      const coverage = {
        total: 100,
        identified: 95,
        unknown: 5,
        percentage: 95.0,
      }

      displayCoverage(coverage)

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('📊 Scan Coverage:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✅ 95/100 packages identified (95%)'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  5 packages with unknown licenses'))
      // High coverage (95%) should NOT show tip
      const tipCalls = consoleLogSpy.mock.calls.filter(call => call[0].includes('💡 Tip'))
      expect(tipCalls.length).toBe(0)
    })

    test('displays coverage with ⚠️ for medium coverage (70-89%)', () => {
      const coverage = {
        total: 100,
        identified: 85,
        unknown: 15,
        percentage: 85.0,
      }

      displayCoverage(coverage)

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️ 85/100 packages identified (85%)'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  15 packages with unknown licenses'))
      // Coverage 85% is >= 80%, so NO tip
      const tipCalls = consoleLogSpy.mock.calls.filter(call => call[0].includes('💡 Tip'))
      expect(tipCalls.length).toBe(0)
    })

    test('displays coverage with ❌ for low coverage (<70%)', () => {
      const coverage = {
        total: 100,
        identified: 60,
        unknown: 40,
        percentage: 60.0,
      }

      displayCoverage(coverage)

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('❌ 60/100 packages identified (60%)'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  40 packages with unknown licenses'))
      // Coverage 60% is < 80%, so tip SHOULD appear
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('💡 Tip: Some packages may need manual LICENSE file inspection'))
    })

    test('displays tip when coverage below 80%', () => {
      const coverage = {
        total: 100,
        identified: 70,
        unknown: 30,
        percentage: 70.0,
      }

      displayCoverage(coverage)

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('💡 Tip: Some packages may need manual LICENSE file inspection'))
    })

    test('does not display tip when coverage >= 80%', () => {
      const coverage = {
        total: 100,
        identified: 85,
        unknown: 15,
        percentage: 85.0,
      }

      displayCoverage(coverage)

      const tipCall = consoleLogSpy.mock.calls.find(call => call[0].includes('💡 Tip'))
      expect(tipCall).toBeUndefined()
    })

    test('does not display unknown warning when unknown = 0', () => {
      const coverage = {
        total: 100,
        identified: 100,
        unknown: 0,
        percentage: 100.0,
      }

      displayCoverage(coverage)

      const unknownCall = consoleLogSpy.mock.calls.find(call => call[0].includes('packages with unknown licenses'))
      expect(unknownCall).toBeUndefined()
    })

    test('displays header with blue chalk styling', () => {
      const coverage = {
        total: 10,
        identified: 10,
        unknown: 0,
        percentage: 100.0,
      }

      displayCoverage(coverage)

      // First call should be the header
      expect(consoleLogSpy).toHaveBeenNthCalledWith(1, expect.stringContaining('📊 Scan Coverage:'))
    })

    test('handles edge case: exactly 80% coverage (should NOT show tip)', () => {
      const coverage = {
        total: 100,
        identified: 80,
        unknown: 20,
        percentage: 80.0,
      }

      displayCoverage(coverage)

      const tipCall = consoleLogSpy.mock.calls.find(call => call[0].includes('💡 Tip'))
      expect(tipCall).toBeUndefined()
    })

    test('handles edge case: 79.9% coverage (should show tip)', () => {
      const coverage = {
        total: 1000,
        identified: 799,
        unknown: 201,
        percentage: 79.9,
      }

      displayCoverage(coverage)

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('💡 Tip: Some packages may need manual LICENSE file inspection'))
    })

    test('formats percentage with 1 decimal place in output', () => {
      const coverage = {
        total: 3,
        identified: 2,
        unknown: 1,
        percentage: 66.7,
      }

      displayCoverage(coverage)

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('(66.7%)'))
    })
  })
})
