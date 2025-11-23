const { generateLicense, LICENSE_TEMPLATES } = require('../../lib/templates')

describe('generateLicense', () => {
  describe('MIT license', () => {
    it('should generate MIT license with correct substitutions', () => {
      const result = generateLicense(
        'mit',
        'John Doe',
        '2025',
        'https://github.com/user/repo'
      )

      expect(result).toContain('MIT License')
      expect(result).toContain('Copyright (c) 2025 John Doe')
      expect(result).toContain('https://github.com/user/repo')
    })

    it('should handle missing URL gracefully', () => {
      const result = generateLicense('mit', 'Jane Smith', '2024', '')

      expect(result).toContain('Copyright (c) 2024 Jane Smith')
      expect(result).not.toContain('{{url}}')
    })
  })

  describe('Apache 2.0 license', () => {
    it('should generate Apache 2.0 license with correct substitutions', () => {
      const result = generateLicense('apache2_0', 'Apache Corp', '2025', '')

      expect(result).toContain('Apache License')
      expect(result).toContain('Version 2.0, January 2004')
      expect(result).toContain('Copyright 2025 Apache Corp')
    })
  })

  describe('GPL 3.0 license', () => {
    it('should generate GPL 3.0 license with correct substitutions', () => {
      const result = generateLicense('gpl3_0', 'GNU User', '2025', '')

      expect(result).toContain('GNU GENERAL PUBLIC LICENSE')
      expect(result).toContain('Version 3, 29 June 2007')
      // User copyright appears in "How to Apply" section at end
      expect(result).toContain('Copyright (C) 2025  GNU User')
      // Full license text should include these sections
      expect(result).toContain('END OF TERMS AND CONDITIONS')
      expect(result).toContain('How to Apply These Terms to Your New Programs')
    })
  })

  describe('BSD 3-Clause license', () => {
    it('should generate BSD 3-Clause license with correct substitutions', () => {
      const result = generateLicense('bsd3clause', 'BSD Corp', '2025', '')

      expect(result).toContain('BSD 3-Clause License')
      expect(result).toContain('Copyright (c) 2025, BSD Corp')
    })
  })

  describe('ISC license', () => {
    it('should generate ISC license with correct substitutions', () => {
      const result = generateLicense('isc', 'ISC Author', '2025', '')

      expect(result).toContain('Copyright (c) 2025 ISC Author')
      expect(result).toContain('Permission to use, copy, modify')
    })
  })

  describe('WTFPL license', () => {
    it('should generate WTFPL license with correct substitutions', () => {
      const result = generateLicense('wtfpl', 'Free Dev', '2025', '')

      expect(result).toContain('DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE')
      expect(result).toContain('Copyright (C) 2025 Free Dev')
    })
  })

  describe('Error handling', () => {
    it('should throw error for unknown license type', () => {
      expect(() => {
        generateLicense('unknown', 'User', '2025', '')
      }).toThrow('Unknown license type: unknown')
    })

    it('should list all available licenses in error message', () => {
      try {
        generateLicense('invalid', 'User', '2025', '')
      } catch (err) {
        expect(err.message).toContain('mit')
        expect(err.message).toContain('apache2_0')
        expect(err.message).toContain('gpl3_0')
        expect(err.message).toContain('bsd3clause')
        expect(err.message).toContain('isc')
        expect(err.message).toContain('wtfpl')
      }
    })
  })

  describe('Special characters handling', () => {
    it('should handle special characters in owner name', () => {
      const result1 = generateLicense('mit', 'O\'Brien', '2025', '')
      expect(result1).toContain('O\'Brien')

      const result2 = generateLicense('mit', 'Müller & Co.', '2025', '')
      expect(result2).toContain('Müller & Co.')
    })

    it('should handle quotes in owner name', () => {
      const result = generateLicense('mit', 'John "Johnny" Doe', '2025', '')
      expect(result).toContain('John "Johnny" Doe')
    })
  })

  describe('LICENSE_TEMPLATES object', () => {
    it('should contain all 6 license types', () => {
      const expectedLicenses = [
        'mit',
        'apache2_0',
        'gpl3_0',
        'bsd3clause',
        'isc',
        'wtfpl',
      ]

      expectedLicenses.forEach((license) => {
        expect(LICENSE_TEMPLATES).toHaveProperty(license)
        expect(typeof LICENSE_TEMPLATES[license]).toBe('string')
        expect(LICENSE_TEMPLATES[license].length).toBeGreaterThan(0)
      })
    })
  })
})
