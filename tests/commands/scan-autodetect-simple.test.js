/**
 * Simple Auto-Detect Tests
 * Tests the helper functions without file system mocking
 */

const { isValidLicense } = require('../../lib/commands/scan')

describe('isValidLicense', () => {
  test('returns false for null', () => {
    expect(isValidLicense(null)).toBe(false)
  })

  test('returns false for empty string', () => {
    expect(isValidLicense('')).toBe(false)
    expect(isValidLicense('   ')).toBe(false)
  })

  test('returns false for UNLICENSED', () => {
    expect(isValidLicense('UNLICENSED')).toBe(false)
  })

  test('returns true for valid licenses', () => {
    expect(isValidLicense('MIT')).toBe(true)
    expect(isValidLicense('Apache-2.0')).toBe(true)
    expect(isValidLicense('GPL-3.0')).toBe(true)
    expect(isValidLicense('BSD-3-Clause')).toBe(true)
  })
})
