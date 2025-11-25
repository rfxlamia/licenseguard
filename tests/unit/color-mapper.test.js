const {
  getColor,
  getEmoji,
  colorize,
  colorizeWithEmoji,
  LICENSE_COLORS,
  EMOJI_INDICATORS
} = require('../../lib/scanner/color-mapper')
const chalk = require('chalk')

describe('Color Mapper', () => {
  describe('getColor', () => {
    test('maps MIT to green', () => {
      expect(getColor('MIT')).toBe('green')
    })

    test('maps Apache-2.0 to green', () => {
      expect(getColor('Apache-2.0')).toBe('green')
    })

    test('maps BSD-2-Clause to green', () => {
      expect(getColor('BSD-2-Clause')).toBe('green')
    })

    test('maps BSD-3-Clause to green', () => {
      expect(getColor('BSD-3-Clause')).toBe('green')
    })

    test('maps ISC to green', () => {
      expect(getColor('ISC')).toBe('green')
    })

    test('maps GPL-2.0 to red', () => {
      expect(getColor('GPL-2.0')).toBe('red')
    })

    test('maps GPL-3.0 to red', () => {
      expect(getColor('GPL-3.0')).toBe('red')
    })

    test('maps AGPL-3.0 to red', () => {
      expect(getColor('AGPL-3.0')).toBe('red')
    })

    test('maps MPL-2.0 to yellow', () => {
      expect(getColor('MPL-2.0')).toBe('yellow')
    })

    test('maps LGPL-2.1 to yellow', () => {
      expect(getColor('LGPL-2.1')).toBe('yellow')
    })

    test('maps LGPL-3.0 to yellow', () => {
      expect(getColor('LGPL-3.0')).toBe('yellow')
    })

    test('maps UNKNOWN to gray', () => {
      expect(getColor('UNKNOWN')).toBe('gray')
    })

    test('maps unrecognized license to gray (default)', () => {
      expect(getColor('SomeFancyLicense')).toBe('gray')
    })
  })

  describe('getEmoji', () => {
    test('returns green circle for MIT', () => {
      expect(getEmoji('MIT')).toBe('🟢')
    })

    test('returns warning for MPL-2.0', () => {
      expect(getEmoji('MPL-2.0')).toBe('⚠️')
    })

    test('returns red X for GPL-3.0', () => {
      expect(getEmoji('GPL-3.0')).toBe('❌')
    })

    test('returns question mark for UNKNOWN', () => {
      expect(getEmoji('UNKNOWN')).toBe('❔')
    })

    test('returns question mark for unrecognized license', () => {
      expect(getEmoji('RandomLicense')).toBe('❔')
    })
  })

  describe('colorize', () => {
    test('applies green color for MIT', () => {
      const result = colorize('MIT', 'permissive')
      expect(result).toBe(chalk.green('permissive'))
    })

    test('applies red color for GPL-3.0', () => {
      const result = colorize('GPL-3.0', 'copyleft')
      expect(result).toBe(chalk.red('copyleft'))
    })

    test('applies yellow color for MPL-2.0', () => {
      const result = colorize('MPL-2.0', 'weak copyleft')
      expect(result).toBe(chalk.yellow('weak copyleft'))
    })

    test('applies gray color for UNKNOWN', () => {
      const result = colorize('UNKNOWN', 'needs review')
      expect(result).toBe(chalk.gray('needs review'))
    })

    test('applies gray color for unrecognized license', () => {
      const result = colorize('CustomLicense', 'unknown')
      expect(result).toBe(chalk.gray('unknown'))
    })

    test('preserves text content when colorizing', () => {
      const text = 'Test License Text'
      const result = colorize('MIT', text)
      // Strip ANSI codes to verify content
      // eslint-disable-next-line no-control-regex
      const stripped = result.replace(/\x1b\[[0-9;]*m/g, '')
      expect(stripped).toBe(text)
    })
  })

  describe('colorizeWithEmoji', () => {
    test('adds green circle emoji for MIT', () => {
      const result = colorizeWithEmoji('MIT', 'permissive')
      expect(result).toContain('🟢')
      expect(result).toContain('permissive')
    })

    test('adds warning emoji for MPL-2.0', () => {
      const result = colorizeWithEmoji('MPL-2.0', 'weak copyleft')
      expect(result).toContain('⚠️')
      expect(result).toContain('weak copyleft')
    })

    test('adds red X emoji for GPL-3.0', () => {
      const result = colorizeWithEmoji('GPL-3.0', 'copyleft')
      expect(result).toContain('❌')
      expect(result).toContain('copyleft')
    })

    test('adds question mark emoji for UNKNOWN', () => {
      const result = colorizeWithEmoji('UNKNOWN', 'needs review')
      expect(result).toContain('❔')
      expect(result).toContain('needs review')
    })

    test('formats as "emoji colorized-text"', () => {
      const result = colorizeWithEmoji('MIT', 'test')
      // Should start with emoji followed by space
      expect(result).toMatch(/^🟢 /)
    })
  })

  describe('LICENSE_COLORS mapping', () => {
    test('contains all expected permissive licenses', () => {
      expect(LICENSE_COLORS['MIT']).toBe('green')
      expect(LICENSE_COLORS['Apache-2.0']).toBe('green')
      expect(LICENSE_COLORS['BSD-2-Clause']).toBe('green')
      expect(LICENSE_COLORS['BSD-3-Clause']).toBe('green')
      expect(LICENSE_COLORS['ISC']).toBe('green')
    })

    test('contains all expected weak copyleft licenses', () => {
      expect(LICENSE_COLORS['MPL-2.0']).toBe('yellow')
      expect(LICENSE_COLORS['LGPL-2.1']).toBe('yellow')
      expect(LICENSE_COLORS['LGPL-3.0']).toBe('yellow')
    })

    test('contains all expected strong copyleft licenses', () => {
      expect(LICENSE_COLORS['GPL-2.0']).toBe('red')
      expect(LICENSE_COLORS['GPL-3.0']).toBe('red')
      expect(LICENSE_COLORS['AGPL-3.0']).toBe('red')
    })

    test('contains UNKNOWN mapping', () => {
      expect(LICENSE_COLORS['UNKNOWN']).toBe('gray')
    })
  })

  describe('EMOJI_INDICATORS mapping', () => {
    test('maps colors to appropriate emojis', () => {
      expect(EMOJI_INDICATORS.green).toBe('🟢')
      expect(EMOJI_INDICATORS.yellow).toBe('⚠️')
      expect(EMOJI_INDICATORS.red).toBe('❌')
      expect(EMOJI_INDICATORS.gray).toBe('❔')
    })
  })
})
