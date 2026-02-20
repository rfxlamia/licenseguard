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

const { isGitRepo, initGitRepo, installHooks, isEsmProject, generatePostCheckoutScript, generatePreCommitScript, generatePostCheckoutScriptEsm, generatePreCommitScriptEsm } = require('../../lib/utils/git-helpers')

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

  describe('isEsmProject', () => {
    let readFileSyncSpy

    afterEach(() => {
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('returns true when package.json has "type": "module"', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return true
        return false
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ type: 'module' })
      )

      const result = isEsmProject()

      expect(result).toBe(true)
    })

    it('returns false when package.json has no type field', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return true
        return false
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ name: 'test' })
      )

      const result = isEsmProject()

      expect(result).toBe(false)
    })

    it('returns false when package.json has "type": "commonjs"', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return true
        return false
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({ type: 'commonjs' })
      )

      const result = isEsmProject()

      expect(result).toBe(false)
    })

    it('returns false when no package.json exists', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(false)

      const result = isEsmProject()

      expect(result).toBe(false)
    })

    it('returns false when readFileSync throws error', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return true
        return false
      })
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw new Error('Permission denied')
      })

      const result = isEsmProject()

      expect(result).toBe(false)
    })
  })

  describe('installHooks ESM support', () => {
    beforeEach(() => {
      mkdirSyncSpy = jest.spyOn(fs, 'mkdirSync').mockImplementation(() => {})
      writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {})
      chmodSyncSpy = jest.spyOn(fs, 'chmodSync').mockImplementation(() => {})
    })

    it('generates ESM hook when project is ESM', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return true
        if (filePath === '.git/hooks') return true
        if (filePath === path.join('.git', 'hooks', 'post-checkout')) return false
        if (filePath === path.join('.git', 'hooks', 'pre-commit')) return false
        return false
      })
      const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return JSON.stringify({ type: 'module' })
        return ''
      })

      const result = installHooks()

      expect(result).toBe(true)

      // Check that post-checkout hook uses ESM syntax
      const postCheckoutCall = writeFileSyncSpy.mock.calls.find(
        call => call[0] === path.join('.git', 'hooks', 'post-checkout')
      )
      const postCheckoutHook = postCheckoutCall[1]
      expect(postCheckoutHook).toContain('import')
      expect(postCheckoutHook).not.toContain('require(')

      // Check that pre-commit hook uses ESM syntax
      const preCommitCall = writeFileSyncSpy.mock.calls.find(
        call => call[0] === path.join('.git', 'hooks', 'pre-commit')
      )
      const preCommitHook = preCommitCall[1]
      expect(preCommitHook).toContain('import')
      expect(preCommitHook).not.toContain('require(')

      readFileSyncSpy.mockRestore()
    })

    it('generates CJS hook when project is CJS', () => {
      existsSyncSpy = jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return true
        if (filePath === '.git/hooks') return true
        if (filePath === path.join('.git', 'hooks', 'post-checkout')) return false
        if (filePath === path.join('.git', 'hooks', 'pre-commit')) return false
        return false
      })
      const readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
        if (filePath === 'package.json') return JSON.stringify({ name: 'test' })
        return ''
      })

      const result = installHooks()

      expect(result).toBe(true)

      // Check that post-checkout hook uses CJS syntax
      const postCheckoutCall = writeFileSyncSpy.mock.calls.find(
        call => call[0] === path.join('.git', 'hooks', 'post-checkout')
      )
      const postCheckoutHook = postCheckoutCall[1]
      expect(postCheckoutHook).toContain('require(')

      // Check that pre-commit hook uses CJS syntax
      const preCommitCall = writeFileSyncSpy.mock.calls.find(
        call => call[0] === path.join('.git', 'hooks', 'pre-commit')
      )
      const preCommitHook = preCommitCall[1]
      expect(preCommitHook).toContain('require(')

      readFileSyncSpy.mockRestore()
    })
  })

  describe('generatePostCheckoutScript', () => {
    it('returns CJS script with require', () => {
      const script = generatePostCheckoutScript()
      expect(script).toContain('require(')
      expect(script).not.toContain('import')
    })
  })

  describe('generatePreCommitScript', () => {
    it('returns CJS script with require', () => {
      const script = generatePreCommitScript()
      expect(script).toContain('require(')
      expect(script).not.toContain('import')
    })
  })

  describe('generatePostCheckoutScriptEsm', () => {
    it('returns ESM script with import', () => {
      const script = generatePostCheckoutScriptEsm()
      expect(script).toContain('import')
      expect(script).not.toContain('require(')
      expect(script).toContain('fileURLToPath')
      expect(script).toContain('import.meta.url')
    })
  })

  describe('generatePreCommitScriptEsm', () => {
    it('returns ESM script with import', () => {
      const script = generatePreCommitScriptEsm()
      expect(script).toContain('import')
      expect(script).not.toContain('require(')
      expect(script).toContain('fileURLToPath')
      expect(script).toContain('import.meta.url')
    })
  })
})
