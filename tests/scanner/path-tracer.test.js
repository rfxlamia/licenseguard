const { execFileSync, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const {
  traceDependencyPath,
  formatPathChain,
  clearCache
} = require('../../lib/scanner/path-tracer')

// Mock child_process
jest.mock('child_process')
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')

describe('Path Tracer - npm explain Adapter', () => {
  beforeEach(() => {
    // Clear cache before each test
    clearCache()
    // Clear all mocks
    jest.resetAllMocks()
    Object.defineProperty(process, 'platform', { ...platformDescriptor, value: 'linux', writable: true })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(process, 'platform', platformDescriptor)
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

      execFileSync.mockReturnValue(mockOutput)

      const result = traceDependencyPath('liburing', '/path/to/project')

      expect(execFileSync).toHaveBeenCalledWith(
        'npm',
        ['explain', 'liburing', '--json'],
        expect.objectContaining({
          cwd: '/path/to/project',
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000,
          shell: false
        })
      )

      expect(result).toBe('app → folly → liburing')
    })

    test.each([
      'chalk@4.1.2',
      '@babel/core',
      '@babel/core@7.0.0',
      'not-a-real-package; printf verified; #',
      'package with spaces',
      'package"quoted\'name',
      'package | printf verified',
      'package`printf verified`',
      'package$(printf verified)'
    ])('passes %s as one literal argument without a shell', (packageName) => {
      execFileSync.mockReturnValue(JSON.stringify([{ path: 'app > dependency' }]))

      const result = traceDependencyPath(packageName, '/path/to/project')

      expect(execFileSync).toHaveBeenCalledWith(
        'npm',
        ['explain', packageName, '--json'],
        expect.objectContaining({ shell: false })
      )
      expect(execSync).not.toHaveBeenCalled()
      expect(result).toBe('app → dependency')
    })

    test('launches the npm JavaScript CLI through Node on Windows', () => {
      jest.replaceProperty(process, 'platform', 'win32')
      jest.replaceProperty(process, 'env', { PATH: '' })
      const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
      jest.spyOn(fs, 'existsSync').mockImplementation((file) => file === npmCli)
      execFileSync.mockReturnValue(JSON.stringify([{ path: 'app > chalk' }]))

      const result = traceDependencyPath('chalk; printf verified', '/path/to/project')

      expect(execFileSync).toHaveBeenCalledWith(
        process.execPath,
        [npmCli, 'explain', 'chalk; printf verified', '--json'],
        expect.objectContaining({ shell: false, cwd: '/path/to/project', timeout: 5000 })
      )
      expect(execSync).not.toHaveBeenCalled()
      expect(result).toBe('app → chalk')
    })

    test('finds npm alongside its Windows PATH wrapper', () => {
      jest.replaceProperty(process, 'platform', 'win32')
      jest.replaceProperty(process, 'env', { Path: ['other-directory', 'npm-directory'].join(path.delimiter) })
      const npmCli = path.resolve('npm-directory', 'node_modules', 'npm', 'bin', 'npm-cli.js')
      jest.spyOn(fs, 'existsSync').mockImplementation((file) => file === npmCli)
      execFileSync.mockReturnValue(JSON.stringify([{ path: 'app > chalk' }]))

      expect(traceDependencyPath('chalk', '/path/to/project')).toBe('app → chalk')
      expect(execFileSync).toHaveBeenCalledWith(
        process.execPath,
        [npmCli, 'explain', 'chalk', '--json'],
        expect.objectContaining({ shell: false })
      )
    })

    test('returns null without a shell fallback when the Windows npm CLI is missing', () => {
      jest.replaceProperty(process, 'platform', 'win32')
      jest.replaceProperty(process, 'env', { PATH: '' })
      jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      expect(traceDependencyPath('chalk', '/path/to/project')).toBeNull()
      expect(execFileSync).not.toHaveBeenCalled()
      expect(execSync).not.toHaveBeenCalled()
    })

    test('returns null when npm explain returns empty array', () => {
      execFileSync.mockReturnValue(JSON.stringify([]))

      const result = traceDependencyPath('unknown-package', '/path/to/project')

      expect(result).toBeNull()
    })

    test('returns null when npm explain fails', () => {
      execFileSync.mockImplementation(() => {
        throw new Error('npm not found')
      })

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('returns null when JSON parsing fails', () => {
      execFileSync.mockReturnValue('invalid json')

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('uses first path when multiple paths returned', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > react > chalk' },
        { path: 'app > vue > chalk' }
      ])

      execFileSync.mockReturnValue(mockOutput)

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBe('app → react → chalk')
    })

    test('caches results to avoid duplicate subprocess calls', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > folly > liburing' }
      ])

      execFileSync.mockReturnValue(mockOutput)

      // First call - should execute npm explain
      const result1 = traceDependencyPath('liburing', '/path/to/project')
      expect(execFileSync).toHaveBeenCalledTimes(1)
      expect(result1).toBe('app → folly → liburing')

      // Second call - should use cache
      const result2 = traceDependencyPath('liburing', '/path/to/project')
      expect(execFileSync).toHaveBeenCalledTimes(1) // Still 1, not called again
      expect(result2).toBe('app → folly → liburing')
    })

    test('different packages get different cache entries', () => {
      execFileSync.mockImplementation((_file, args) => {
        if (args[1] === 'chalk') {
          return JSON.stringify([{ path: 'app > react > chalk' }])
        }
        if (args[1] === 'commander') {
          return JSON.stringify([{ path: 'app > commander' }])
        }
        return JSON.stringify([])
      })

      const result1 = traceDependencyPath('chalk', '/path/to/project')
      const result2 = traceDependencyPath('commander', '/path/to/project')

      expect(result1).toBe('app → react → chalk')
      expect(result2).toBe('app → commander')
      expect(execFileSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('clearCache', () => {
    test('clears the cache', () => {
      const mockOutput = JSON.stringify([
        { path: 'app > chalk' }
      ])

      execFileSync.mockReturnValue(mockOutput)

      // First call - populate cache
      traceDependencyPath('chalk', '/path/to/project')
      expect(execFileSync).toHaveBeenCalledTimes(1)

      // Clear cache
      clearCache()

      // Second call - should execute again (not cached)
      traceDependencyPath('chalk', '/path/to/project')
      expect(execFileSync).toHaveBeenCalledTimes(2)
    })
  })

  describe('error handling', () => {
    test('handles ENOENT error (npm not in PATH)', () => {
      const error = new Error('spawn npm ENOENT')
      error.code = 'ENOENT'
      execFileSync.mockImplementation(() => { throw error })

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('handles timeout error', () => {
      const error = new Error('Command timed out')
      error.killed = true
      execFileSync.mockImplementation(() => { throw error })

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })

    test('handles npm explain returning null', () => {
      execFileSync.mockReturnValue('null')

      const result = traceDependencyPath('chalk', '/path/to/project')

      expect(result).toBeNull()
    })
  })
})
