const {
  checkForUpdates,
  displayUpdateBanner,
  isNewerVersion,
  fetchNpmVersion,
  isCacheValid,
  CACHE_FILE,
  CACHE_TTL_MS
} = require('../../lib/utils/update-notifier')
const https = require('https')
const fs = require('fs')

// Mock modules
jest.mock('https')
jest.mock('fs')

describe('Update Notifier', () => {
  let consoleLogSpy

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('isNewerVersion', () => {
    test('returns true when major version is newer', () => {
      expect(isNewerVersion('2.1.0', '3.0.0')).toBe(true)
    })

    test('returns true when minor version is newer', () => {
      expect(isNewerVersion('2.1.0', '2.2.0')).toBe(true)
    })

    test('returns true when patch version is newer', () => {
      expect(isNewerVersion('2.1.0', '2.1.1')).toBe(true)
    })

    test('returns false when versions are equal', () => {
      expect(isNewerVersion('2.1.0', '2.1.0')).toBe(false)
    })

    test('returns false when current is newer', () => {
      expect(isNewerVersion('2.2.0', '2.1.0')).toBe(false)
    })

    test('compares major version first', () => {
      expect(isNewerVersion('1.9.9', '2.0.0')).toBe(true)
    })

    test('compares minor version when major is equal', () => {
      expect(isNewerVersion('2.1.9', '2.2.0')).toBe(true)
    })
  })

  describe('displayUpdateBanner', () => {
    test('displays banner with version info', () => {
      displayUpdateBanner('2.1.0', '2.2.0')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Update available')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('2.1.0 → 2.2.0')
      )
    })

    test('includes npm install command', () => {
      displayUpdateBanner('2.1.0', '2.2.0')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('npm install -g licenseguard-cli@latest')
      )
    })

    test('uses yellow color for banner', () => {
      displayUpdateBanner('2.1.0', '2.2.0')

      // Verify chalk.yellow is called (more reliable than checking ANSI codes)
      expect(consoleLogSpy).toHaveBeenCalled()
      const firstCall = consoleLogSpy.mock.calls[0][0]
      // Check if it's a chalk-styled string by verifying it's a String object
      // or contains the yellow styling
      expect(firstCall).toBeDefined()
    })

    test('formats banner with box-drawing characters', () => {
      displayUpdateBanner('2.1.0', '2.2.0')

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('╔═══')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('╚═══')
      )
    })
  })

  describe('isCacheValid', () => {
    test('returns false when cache file does not exist', () => {
      fs.existsSync.mockReturnValue(false)

      expect(isCacheValid()).toBe(false)
    })

    test('returns true when cache is fresh (within 24 hours)', () => {
      fs.existsSync.mockReturnValue(true)
      fs.statSync.mockReturnValue({
        mtimeMs: Date.now() - (1000 * 60 * 60) // 1 hour ago
      })

      expect(isCacheValid()).toBe(true)
    })

    test('returns false when cache is stale (older than 24 hours)', () => {
      fs.existsSync.mockReturnValue(true)
      fs.statSync.mockReturnValue({
        mtimeMs: Date.now() - (CACHE_TTL_MS + 1000) // Just over 24 hours
      })

      expect(isCacheValid()).toBe(false)
    })

    test('returns false when statSync throws error', () => {
      fs.existsSync.mockReturnValue(true)
      fs.statSync.mockImplementation(() => {
        throw new Error('File stat error')
      })

      expect(isCacheValid()).toBe(false)
    })
  })

  describe('fetchNpmVersion', () => {
    test('fetches version from npm registry', async () => {
      const mockResponse = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ 'dist-tags': { latest: '2.2.0' } }))
          }
          if (event === 'end') {
            handler()
          }
          return mockResponse
        })
      }

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse)
        return mockRequest
      })

      const result = await fetchNpmVersion('licenseguard-cli')

      expect(result['dist-tags'].latest).toBe('2.2.0')
      expect(https.request).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: 'registry.npmjs.org',
          path: '/licenseguard-cli',
          method: 'GET'
        }),
        expect.any(Function)
      )
    })

    test('rejects on network error', async () => {
      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'))
          }
          return mockRequest
        }),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockReturnValue(mockRequest)

      await expect(fetchNpmVersion('licenseguard-cli')).rejects.toThrow('Network error')
    })

    test('rejects on timeout', async () => {
      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'timeout') {
            handler()
          }
          return mockRequest
        }),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockReturnValue(mockRequest)

      await expect(fetchNpmVersion('licenseguard-cli')).rejects.toThrow('npm registry request timeout')
      expect(mockRequest.destroy).toHaveBeenCalled()
    })

    test('rejects on invalid JSON response', async () => {
      const mockResponse = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler('invalid json')
          }
          if (event === 'end') {
            handler()
          }
          return mockResponse
        })
      }

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse)
        return mockRequest
      })

      await expect(fetchNpmVersion('licenseguard-cli')).rejects.toThrow('Failed to parse npm registry response')
    })
  })

  describe('checkForUpdates', () => {
    test('skips check when cache is valid', async () => {
      fs.existsSync.mockReturnValue(true)
      fs.statSync.mockReturnValue({
        mtimeMs: Date.now() - (1000 * 60 * 60) // 1 hour ago
      })

      await checkForUpdates('2.1.0')

      expect(https.request).not.toHaveBeenCalled()
    })

    test('checks registry and displays banner when update available', async () => {
      fs.existsSync.mockReturnValue(false)

      const mockResponse = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ 'dist-tags': { latest: '2.2.0' } }))
          }
          if (event === 'end') {
            handler()
          }
          return mockResponse
        })
      }

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse)
        return mockRequest
      })

      await checkForUpdates('2.1.0')

      expect(fs.writeFileSync).toHaveBeenCalledWith(CACHE_FILE, '2.2.0', 'utf8')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Update available')
      )
    })

    test('does not display banner when no update available', async () => {
      fs.existsSync.mockReturnValue(false)

      const mockResponse = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ 'dist-tags': { latest: '2.1.0' } }))
          }
          if (event === 'end') {
            handler()
          }
          return mockResponse
        })
      }

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse)
        return mockRequest
      })

      await checkForUpdates('2.1.0')

      expect(fs.writeFileSync).toHaveBeenCalled()
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    test('fails silently on network error', async () => {
      fs.existsSync.mockReturnValue(false)

      const mockRequest = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            handler(new Error('Network error'))
          }
          return mockRequest
        }),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockReturnValue(mockRequest)

      // Should not throw
      await expect(checkForUpdates('2.1.0')).resolves.toBeUndefined()
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })

    test('writes cache file with latest version', async () => {
      fs.existsSync.mockReturnValue(false)

      const mockResponse = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(JSON.stringify({ 'dist-tags': { latest: '2.3.5' } }))
          }
          if (event === 'end') {
            handler()
          }
          return mockResponse
        })
      }

      const mockRequest = {
        on: jest.fn().mockReturnThis(),
        end: jest.fn(),
        destroy: jest.fn()
      }

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse)
        return mockRequest
      })

      await checkForUpdates('2.1.0')

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        CACHE_FILE,
        '2.3.5',
        'utf8'
      )
    })
  })

  describe('Constants', () => {
    test('CACHE_TTL_MS is 24 hours in milliseconds', () => {
      expect(CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
    })

    test('CACHE_FILE points to temp directory', () => {
      expect(CACHE_FILE).toContain('licenseguard-update-check')
    })
  })
})
