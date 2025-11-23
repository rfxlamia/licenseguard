const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Mock chalk
jest.mock('chalk', () => ({
  yellow: jest.fn((str) => str),
  blue: jest.fn((str) => str),
  green: jest.fn((str) => str),
  red: jest.fn((str) => str),
  gray: jest.fn((str) => str),
}))

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

const { isGitRepo, initGitRepo, installHooks } = require('../../lib/utils/git-helpers')

describe('git-helpers', () => {
  let existsSyncSpy
  let writeFileSyncSpy
  let chmodSyncSpy
  let mkdirSyncSpy
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    if (existsSyncSpy) existsSyncSpy.mockRestore()
    if (writeFileSyncSpy) writeFileSyncSpy.mockRestore()
    if (chmodSyncSpy) chmodSyncSpy.mockRestore()
    if (mkdirSyncSpy) mkdirSyncSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('isGitRepo', () => {
    it('should return true when .git directory exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      const result = isGitRepo()

      expect(result).toBe(true)
      expect(existsSyncSpy).toHaveBeenCalledWith('.git')
    })

    it('should return false when .git directory does not exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const result = isGitRepo()

      expect(result).toBe(false)
      expect(existsSyncSpy).toHaveBeenCalledWith('.git')
    })

    it('should return false and not throw when existsSync throws error', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = isGitRepo()

      expect(result).toBe(false)
    })

    it('should not throw errors', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true)

      expect(() => isGitRepo()).not.toThrow()
    })
  })

  describe('initGitRepo', () => {
    it('should return true when git init succeeds', () => {
      execSync.mockImplementation(() => {})

      const result = initGitRepo()

      expect(result).toBe(true)
      expect(execSync).toHaveBeenCalledWith('git init', { stdio: 'inherit' })
    })

    it('should return false when git init fails', () => {
      execSync.mockImplementation(() => {
        throw new Error('git not found')
      })

      const result = initGitRepo()

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalled()
    })

    it('should not throw errors on failure', () => {
      execSync.mockImplementation(() => {
        throw new Error('git not found')
      })

      expect(() => initGitRepo()).not.toThrow()
    })
  })

  describe('installHooks', () => {
    beforeEach(() => {
      mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {})
      writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
      chmodSyncSpy = jest.spyOn(fs, 'chmodSync').mockImplementation(() => {})
    })

    it('should install hooks when no conflicts exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        if (filePath === path.join('.git', 'hooks', 'post-checkout')) return false
        if (filePath === path.join('.git', 'hooks', 'pre-commit')) return false
        return false
      })

      const result = installHooks()

      expect(result).toBe(true)
      expect(writeFileSyncSpy).toHaveBeenCalledTimes(2)
      expect(chmodSyncSpy).toHaveBeenCalledTimes(2)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Git hooks installed'))
    })

    it('should create hooks directory if it does not exist', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return false
        return false
      })

      installHooks()

      expect(mkdirSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks'),
        { recursive: true }
      )
    })

    it('should create variant when existing pre-commit hook exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        if (filePath === path.join('.git', 'hooks', 'pre-commit')) return true
        if (filePath === path.join('.git', 'hooks', 'post-checkout')) return false
        return false
      })

      const result = installHooks()

      expect(result).toBe(true)
      // Should create licenseguard-pre-commit variant
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'licenseguard-pre-commit'),
        expect.any(String),
        'utf8'
      )
      // Should still create post-checkout normally
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'post-checkout'),
        expect.any(String),
        'utf8'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Existing pre-commit hook detected'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('licenseguard-pre-commit'))
    })

    it('should create variant when existing post-checkout hook exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        if (filePath === path.join('.git', 'hooks', 'post-checkout')) return true
        if (filePath === path.join('.git', 'hooks', 'pre-commit')) return false
        return false
      })

      const result = installHooks()

      expect(result).toBe(true)
      // Should create licenseguard-post-checkout variant
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'licenseguard-post-checkout'),
        expect.any(String),
        'utf8'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Existing post-checkout hook detected'))
    })

    it('should handle both hooks having conflicts', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        if (filePath === path.join('.git', 'hooks', 'post-checkout')) return true
        if (filePath === path.join('.git', 'hooks', 'pre-commit')) return true
        return false
      })

      const result = installHooks()

      expect(result).toBe(true)
      // Should create both variants
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'licenseguard-post-checkout'),
        expect.any(String),
        'utf8'
      )
      expect(writeFileSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'licenseguard-pre-commit'),
        expect.any(String),
        'utf8'
      )
    })

    it('should make hooks executable', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        return false
      })

      installHooks()

      expect(chmodSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'post-checkout'),
        0o755
      )
      expect(chmodSyncSpy).toHaveBeenCalledWith(
        path.join('.git', 'hooks', 'pre-commit'),
        0o755
      )
    })

    it('should include Node.js shebang in hook scripts', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        return false
      })

      installHooks()

      const writeCall = writeFileSyncSpy.mock.calls[0]
      const hookContent = writeCall[1]
      expect(hookContent).toContain('#!/usr/bin/env node')
    })

    it('should return false when file write fails', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        return false
      })
      writeFileSyncSpy.mockImplementation(() => {
        throw new Error('EACCES: permission denied')
      })

      const result = installHooks()

      expect(result).toBe(false)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to install git hooks'),
        expect.any(String)
      )
    })

    it('should not throw errors on failure', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      expect(() => installHooks()).not.toThrow()
    })

    it('should handle chmod errors gracefully (Windows compatibility)', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === '.git/hooks') return true
        return false
      })
      chmodSyncSpy.mockImplementation(() => {
        throw new Error('ENOTSUP: operation not supported')
      })

      const result = installHooks()

      // Should still succeed even if chmod fails (Windows)
      expect(result).toBe(true)
    })
  })
})
