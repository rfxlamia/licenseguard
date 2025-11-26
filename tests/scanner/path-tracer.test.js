const { execSync } = require('child_process')
const {
  traceDependencyPath,
  formatPathChain,
  clearCache
} = require('../../lib/scanner/path-tracer')

// Mock child_process
jest.mock('child_process')

describe('Path Tracer - npm explain Adapter', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache()
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('formatPathChain', () => {
    test('converts npm explain path format to display format', () => {
      const pathData = {
        path: 'app > folly > liburing'
      }

      const result = formatPathChain(pathData)
      expect(result).toBe('app → folly → liburing')
    })

    test('handles single-level path', () => {
      const pathData = {
        path: 'app > chalk'
      }

      const result = formatPathChain(pathData)
      expect(result).toBe('app → chalk')
    })

    test('handles multi-level path', () => {
      const pathData = {
        path: 'app > react > @babel/core > chalk > ansi-styles'
      }

      const result = formatPathChain(pathData)
      expect(result).toBe('app → react → @babel/core → chalk → ansi-styles')
    })

    test('returns null when pathData is null', () => {
      const result = formatPathChain(null)
      expect(result).toBeNull()
    })

    test('returns null when path field missing', () => {
      const pathData = { name: 'chalk' }
      const result = formatPathChain(pathData)
      expect(result).toBeNull()
    })
  })

  describe('traceDependencyPath', () => {
    test('executes npm explain and parses JSON output', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > folly > liburing' }
      ])

      execSync.mockReturnValue(mockOutput)

      const result = traceDependencyPath('liburing', '/path/to/project')

      expect(execSync).toHaveBeenCalledWith(
        'npm explain liburing --json',
        expect.objectContaining({
          cwd: '/path/to/project',
          encoding: 'utf8',
          timeout: 5000
        })
      )

      expect(result).toBe('app → folly → liburing')
    })

    test('returns null when npm explain returns empty array', () => {
      execSync.mockReturnValue(JSON.stringify([]))

      const result = traceDependencyPath('unknown-package', '/path/to/project')

      expect(result).toBeNull()
    })

    test('returns null when npm explain fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('npm not found')
      })

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('returns null when JSON parsing fails', () => {
      execSync.mockReturnValue('invalid json')

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('uses first path when multiple paths returned', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > react > chalk' },
        { path: 'app > vue > chalk' }
      ])

      execSync.mockReturnValue(mockOutput)

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBe('app → react → chalk')
    })

    test('caches results to avoid duplicate subprocess calls', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > folly > liburing' }
      ])

      execSync.mockReturnValue(mockOutput)

      // First call - should execute npm explain
      const result1 = traceDependencyPath('liburing', '/path/to/project')
      expect(execSync).toHaveBeenCalledTimes(1)
      expect(result1).toBe('app → folly → liburing')

      // Second call - should use cache
      const result2 = traceDependencyPath('liburing', '/path/to/project')
      expect(execSync).toHaveBeenCalledTimes(1) // Still 1, not called again
      expect(result2).toBe('app → folly → liburing')
    })

    test('different packages get different cache entries', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('chalk')) {
          return JSON.stringify([{ path: 'app > react > chalk' }])
        }
        if (cmd.includes('commander')) {
          return JSON.stringify([{ path: 'app > commander' }])
        }
        return JSON.stringify([])
      })

      const result1 = traceDependencyPath('chalk', '/path/to/project')
      const result2 = traceDependencyPath('commander', '/path/to/project')

      expect(result1).toBe('app → react → chalk')
      expect(result2).toBe('app → commander')
      expect(execSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearCache', () => {
    test('clears the cache', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > chalk' }
      ])

      execSync.mockReturnValue(mockOutput)

      // First call - populate cache
      traceDependencyPath('chalk', '/path/to/project')
      expect(execSync).toHaveBeenCalledTimes(1)

      // Clear cache
      clearCache()

      // Second call - should execute again (not cached)
      traceDependencyPath('chalk', '/path/to/project')
      expect(execSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    test('handles ENOENT error (npm not in PATH)', () => {
      const error = new Error('spawn npm ENOENT')
      error.code = 'ENOENT'
      execSync.mockImplementation(() => { throw error })

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('handles timeout error', () => {
      const error = new Error('Command timed out')
      error.killed = true
      execSync.mockImplementation(() => { throw error })

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('handles npm explain returning null', () => {
      execSync.mockReturnValue('null')

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })
  })
})
