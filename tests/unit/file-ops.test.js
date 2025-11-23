const fs = require('fs')

// Mock inquirer
jest.mock('inquirer', () => ({
  prompt: jest.fn(),
}))

// Mock chalk
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
}))

const inquirer = require('inquirer')
const { writeLicenseFile, writeConfig } = require('../../lib/utils/file-ops')

describe('file-ops', () => {
  let writeFileSyncSpy
  let readFileSyncSpy
  let existsSyncSpy
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks()

    // Suppress console output in tests
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore all spies
    if (writeFileSyncSpy) writeFileSyncSpy.mockRestore()
    if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    if (existsSyncSpy) existsSyncSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('writeLicenseFile', () => {
    it('should create LICENSE file when it does not exist', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {})

      const content = 'MIT License\n\nCopyright (c) 2025 Test'
      const result = await writeLicenseFile(content)

      expect(result).toBe(true)
      expect(existsSyncSpy).toHaveBeenCalledWith('LICENSE')
      expect(writeFileSyncSpy).toHaveBeenCalledWith('LICENSE', content, 'utf8')
      expect(inquirer.prompt).not.toHaveBeenCalled()
    })

    it('should prompt for overwrite when LICENSE exists and user accepts', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {})
      inquirer.prompt.mockResolvedValue({ overwrite: true })

      const newContent = 'New license content'
      const result = await writeLicenseFile(newContent)

      expect(result).toBe(true)
      expect(inquirer.prompt).toHaveBeenCalled()
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        'LICENSE',
        newContent,
        'utf8'
      )
    })

    it('should not overwrite when user declines', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {})
      inquirer.prompt.mockResolvedValue({ overwrite: false })

      const newContent = 'New license content'
      const result = await writeLicenseFile(newContent)

      expect(result).toBe(false)
      expect(inquirer.prompt).toHaveBeenCalled()
      expect(writeFileSyncSpy).not.toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Keeping existing LICENSE file')
      )
    })

    it('should throw error when write fails', async () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {
          throw new Error('EACCES: permission denied')
        })

      const content = 'Test content'

      await expect(writeLicenseFile(content)).rejects.toThrow('EACCES')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
  })

  describe('writeConfig', () => {
    it('should create .licenseguardrc with correct JSON format', () => {
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {})

      const config = {
        license: 'mit',
        owner: 'Test User',
        year: '2025',
        url: 'https://github.com/test/repo',
      }

      const result = writeConfig(config)

      expect(result).toBe(true)
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        '.licenseguardrc',
        JSON.stringify(config, null, 2),
        'utf8'
      )
    })

    it('should format JSON with 2-space indentation', () => {
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {})

      const config = {
        license: 'apache2_0',
        owner: 'Apache Corp',
        year: '2025',
        url: '',
      }

      writeConfig(config)

      const expectedContent = JSON.stringify(config, null, 2)
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        '.licenseguardrc',
        expectedContent,
        'utf8'
      )
    })

    it('should handle empty URL field', () => {
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {})

      const config = {
        license: 'mit',
        owner: 'User',
        year: '2024',
        url: '',
      }

      writeConfig(config)

      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        '.licenseguardrc',
        JSON.stringify(config, null, 2),
        'utf8'
      )
    })

    it('should throw error when write fails', () => {
      writeFileSyncSpy = jest
        .spyOn(fs, 'writeFileSync')
        .mockImplementation(() => {
          throw new Error('ENOSPC: no space left on device')
        })

      const config = { license: 'mit', owner: 'User', year: '2025', url: '' }

      expect(() => writeConfig(config)).toThrow('ENOSPC')
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    // Story 2.4: scanResult handling tests
    describe('scanResult handling (v2.0)', () => {
      it('should write config with scanResult field', () => {
        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        writeFileSyncSpy = jest
          .spyOn(fs, 'writeFileSync')
          .mockImplementation(() => {})

        const config = {
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: 'https://github.com/test/repo',
          scanResult: {
            timestamp: '2025-11-18T10:30:00.000Z',
            totalDependencies: 150,
            compatible: 147,
            incompatible: 2,
            unknown: 1,
            issues: [
              {
                package: 'some-gpl-lib@2.0.0',
                license: 'GPL-3.0',
                type: 'conflict',
                reason: 'Copyleft incompatible with MIT',
                location: 'node_modules/some-gpl-lib/package.json',
              },
            ],
          },
        }

        const result = writeConfig(config)

        expect(result).toBe(true)
        expect(writeFileSyncSpy).toHaveBeenCalledWith(
          '.licenseguardrc',
          JSON.stringify(config, null, 2),
          'utf8'
        )
      })

      it('should write config without scanResult field', () => {
        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)
        writeFileSyncSpy = jest
          .spyOn(fs, 'writeFileSync')
          .mockImplementation(() => {})

        const config = {
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        }

        const result = writeConfig(config)

        expect(result).toBe(true)
        const writtenContent = writeFileSyncSpy.mock.calls[0][1]
        const writtenConfig = JSON.parse(writtenContent)

        expect(writtenConfig).not.toHaveProperty('scanResult')
      })

      it('should preserve existing fields when updating with scanResult', () => {
        const existingConfig = {
          license: 'mit',
          owner: 'Original Owner',
          year: '2024',
          url: 'https://github.com/original/repo',
        }

        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        readFileSyncSpy = jest
          .spyOn(fs, 'readFileSync')
          .mockReturnValue(JSON.stringify(existingConfig))
        writeFileSyncSpy = jest
          .spyOn(fs, 'writeFileSync')
          .mockImplementation(() => {})

        const newConfig = {
          scanResult: {
            timestamp: '2025-11-18T10:30:00.000Z',
            totalDependencies: 10,
            compatible: 10,
            incompatible: 0,
            unknown: 0,
            issues: [],
          },
        }

        const result = writeConfig(newConfig)

        expect(result).toBe(true)
        const writtenContent = writeFileSyncSpy.mock.calls[0][1]
        const writtenConfig = JSON.parse(writtenContent)

        // Should have all original fields plus scanResult
        expect(writtenConfig.license).toBe('mit')
        expect(writtenConfig.owner).toBe('Original Owner')
        expect(writtenConfig.year).toBe('2024')
        expect(writtenConfig.url).toBe('https://github.com/original/repo')
        expect(writtenConfig.scanResult).toEqual(newConfig.scanResult)
      })

      it('should overwrite existing scanResult on re-run', () => {
        const existingConfig = {
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
          scanResult: {
            timestamp: '2025-11-17T10:00:00.000Z',
            totalDependencies: 100,
            compatible: 95,
            incompatible: 5,
            unknown: 0,
            issues: [{ package: 'old-conflict@1.0.0' }],
          },
        }

        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        readFileSyncSpy = jest
          .spyOn(fs, 'readFileSync')
          .mockReturnValue(JSON.stringify(existingConfig))
        writeFileSyncSpy = jest
          .spyOn(fs, 'writeFileSync')
          .mockImplementation(() => {})

        const newScanResult = {
          timestamp: '2025-11-18T10:30:00.000Z',
          totalDependencies: 150,
          compatible: 150,
          incompatible: 0,
          unknown: 0,
          issues: [],
        }

        const result = writeConfig({ scanResult: newScanResult })

        expect(result).toBe(true)
        const writtenContent = writeFileSyncSpy.mock.calls[0][1]
        const writtenConfig = JSON.parse(writtenContent)

        // scanResult should be replaced with new scan, not old one
        expect(writtenConfig.scanResult.timestamp).toBe(
          '2025-11-18T10:30:00.000Z'
        )
        expect(writtenConfig.scanResult.totalDependencies).toBe(150)
        expect(writtenConfig.scanResult.incompatible).toBe(0)
        expect(writtenConfig.scanResult.issues).toEqual([])
      })

      it('should handle malformed existing .licenseguardrc gracefully', () => {
        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)
        readFileSyncSpy = jest
          .spyOn(fs, 'readFileSync')
          .mockReturnValue('{ invalid json }')
        writeFileSyncSpy = jest
          .spyOn(fs, 'writeFileSync')
          .mockImplementation(() => {})

        const config = {
          license: 'mit',
          owner: 'Test User',
          year: '2025',
          url: '',
        }

        const result = writeConfig(config)

        expect(result).toBe(true)
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('malformed')
        )
        expect(writeFileSyncSpy).toHaveBeenCalledWith(
          '.licenseguardrc',
          JSON.stringify(config, null, 2),
          'utf8'
        )
      })
    })
  })
})
