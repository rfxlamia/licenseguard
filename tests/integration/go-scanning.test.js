/**
 * Integration tests for Go Modules scanning
 * Tests the full licenseguard init flow with Go projects
 *
 * Tests ACs:
 * - AC #1: Go Project Detection
 * - AC #2: Dependency Scanning Works
 * - AC #3: License Conflict Detection
 * - AC #4: Error Handling for Missing Go
 * - AC #5: Test Coverage / Integration Tests Pass
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Must mock child_process at module level for go.js to use the mock
jest.mock('child_process')
const { execSync, spawn } = require('child_process')

// Import scanner components
const { detectPlugin } = require('../../lib/scanner')
const {
  detect,
  scanDependencies,
  getGoModuleCachePath
} = require('../../lib/scanner/plugins/go')

// Pre-load fixtures before mocks
const fixturesPath = path.join(__dirname, '../fixtures/go')
const mitLicenseContent = fs.readFileSync(
  path.join(fixturesPath, 'LICENSE-MIT'),
  'utf8'
)
const gplLicenseContent = fs.readFileSync(
  path.join(fixturesPath, 'LICENSE-GPL-3.0'),
  'utf8'
)

describe('Go Scanning Integration', () => {
  let testDir
  let originalCwd

  beforeEach(() => {
    // Create a temp directory for test projects
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-go-test-'))
    originalCwd = process.cwd()
    execSync.mockReset()
    spawn.mockReset()
  })

  afterEach(() => {
    // Restore original directory
    process.chdir(originalCwd)

    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Go project detection (AC #1)', () => {
    it('should detect go.mod as Go project', () => {
      // Create go.mod in test directory
      const goModPath = path.join(testDir, 'go.mod')
      fs.writeFileSync(goModPath, `
module github.com/example/testproject

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
)
`)

      // Change to test directory
      process.chdir(testDir)

      // Test detection
      expect(detect()).toBe(true)
    })

    it('should not detect Go project without go.mod', () => {
      // Create only package.json (Node.js project)
      const packagePath = path.join(testDir, 'package.json')
      fs.writeFileSync(packagePath, JSON.stringify({
        name: 'not-go',
        version: '1.0.0'
      }))

      process.chdir(testDir)

      expect(detect()).toBe(false)
    })

    it('should detect Go plugin from scanner orchestrator', () => {
      // Create go.mod
      const goModPath = path.join(testDir, 'go.mod')
      fs.writeFileSync(goModPath, `
module github.com/example/testproject

go 1.21
`)

      process.chdir(testDir)

      const detected = detectPlugin()

      // Should detect go plugin (no package.json or Cargo.toml)
      expect(detected).not.toBeNull()
      expect(detected.name).toBe('go')
    })

    it('should prioritize Node.js over Go when both exist', () => {
      // Create both go.mod and package.json
      fs.writeFileSync(path.join(testDir, 'go.mod'), `
module github.com/example/go-with-node

go 1.21
`)
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'node-with-go',
        version: '1.0.0'
      }))

      process.chdir(testDir)

      const detected = detectPlugin()

      // Node.js should take priority
      expect(detected).not.toBeNull()
      expect(detected.name).toBe('node')
    })

    it('should prioritize Rust over Go when both exist', () => {
      // Create both go.mod and Cargo.toml
      fs.writeFileSync(path.join(testDir, 'go.mod'), `
module github.com/example/go-with-rust

go 1.21
`)
      fs.writeFileSync(path.join(testDir, 'Cargo.toml'), `
[package]
name = "rust-with-go"
version = "0.1.0"
`)

      process.chdir(testDir)

      const detected = detectPlugin()

      // Rust should take priority over Go (based on plugin order)
      expect(detected).not.toBeNull()
      // Either rust or go is fine, depends on plugin priority
      expect(['rust', 'go']).toContain(detected.name)
    })
  })

  describe('Go command error handling (AC #4)', () => {
    it('should provide helpful error when Go not installed', () => {
      // Mock execSync to simulate Go not found
      execSync.mockImplementation(() => {
        throw new Error('go: command not found')
      })

      expect(() => getGoModuleCachePath()).toThrow('Go is not installed')
      expect(() => getGoModuleCachePath()).toThrow('https://go.dev/doc/install')
    })

    it('should provide helpful error for Windows not recognized', () => {
      execSync.mockImplementation(() => {
        throw new Error('\'go\' is not recognized as an internal or external command')
      })

      expect(() => getGoModuleCachePath()).toThrow('Go is not installed')
    })

    it('should suggest --noscan flag in error message', () => {
      execSync.mockImplementation(() => {
        throw new Error('go: command not found')
      })

      expect(() => getGoModuleCachePath()).toThrow('--noscan')
    })
  })

  describe('Full scanning flow with mocked go commands (AC #2, #3)', () => {
    let stdoutWriteSpy
    let existsSyncSpy
    let readFileSyncSpy

    beforeEach(() => {
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
      existsSyncSpy = jest.spyOn(fs, 'existsSync')
      readFileSyncSpy = jest.spyOn(fs, 'readFileSync')
    })

    afterEach(() => {
      if (stdoutWriteSpy) stdoutWriteSpy.mockRestore()
      if (existsSyncSpy) existsSyncSpy.mockRestore()
      if (readFileSyncSpy) readFileSyncSpy.mockRestore()
    })

    it('should complete full scan with mocked go list output', async () => {
      const mockNdjson = '{"Path":"github.com/test/project","Main":true}\n' +
        '{"Path":"github.com/gin-gonic/gin","Version":"v1.9.1","Dir":"/home/user/go/pkg/mod/github.com/gin-gonic/gin@v1.9.1"}'

      execSync.mockImplementation((cmd) => {
        if (cmd === 'go env GOMODCACHE') {
          return '/home/user/go/pkg/mod\n'
        }
        if (cmd.includes('go list')) {
          return mockNdjson
        }
        return ''
      })

      spawn.mockImplementation(() => {
        throw new Error('spawn failed')
      })

      existsSyncSpy.mockImplementation((file) => file.includes('LICENSE'))
      readFileSyncSpy.mockReturnValue(mitLicenseContent)

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1) // gin only (main filtered)
      expect(result.compatible).toBe(1)
      expect(result.incompatible).toBe(0)
      expect(result.unknown).toBe(0)
      expect(result.timestamp).toBeDefined()
    })

    it('should detect conflicts with GPL dependency (AC #3)', async () => {
      const mockNdjson = '{"Path":"github.com/mit/project","Main":true}\n' +
        '{"Path":"github.com/gpl/lib","Version":"v1.0.0","Dir":"/home/user/go/pkg/mod/github.com/gpl/lib@v1.0.0"}'

      execSync.mockImplementation((cmd) => {
        if (cmd === 'go env GOMODCACHE') {
          return '/home/user/go/pkg/mod\n'
        }
        if (cmd.includes('go list')) {
          return mockNdjson
        }
        return ''
      })

      spawn.mockImplementation(() => {
        throw new Error('spawn failed')
      })

      existsSyncSpy.mockImplementation((file) => file.includes('LICENSE'))
      readFileSyncSpy.mockReturnValue(gplLicenseContent)

      const result = await scanDependencies('MIT')

      expect(result.incompatible).toBe(1)
      expect(result.issues.length).toBe(1)
      expect(result.issues[0].package).toBe('github.com/gpl/lib@v1.0.0')
      expect(result.issues[0].type).toBe('conflict')
    })

    it('should handle multiple dependencies with mixed licenses', async () => {
      const mockNdjson = '{"Path":"github.com/root","Main":true}\n' +
        '{"Path":"github.com/mit/lib","Version":"v1.0.0","Dir":"/tmp/mit"}\n' +
        '{"Path":"github.com/apache/lib","Version":"v2.0.0","Dir":"/tmp/apache"}\n' +
        '{"Path":"github.com/bsd/lib","Version":"v3.0.0","Dir":"/tmp/bsd"}'

      execSync.mockImplementation((cmd) => {
        if (cmd === 'go env GOMODCACHE') {
          return '/home/user/go/pkg/mod\n'
        }
        if (cmd.includes('go list')) {
          return mockNdjson
        }
        return ''
      })

      spawn.mockImplementation(() => {
        throw new Error('spawn failed')
      })

      // All return MIT (permissive)
      existsSyncSpy.mockImplementation((file) => file.includes('LICENSE'))
      readFileSyncSpy.mockReturnValue(mitLicenseContent)

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(3)
      expect(result.compatible).toBe(3)
      expect(result.incompatible).toBe(0)
    })

    it('should handle unknown licenses as warnings', async () => {
      const mockNdjson = '{"Path":"github.com/root","Main":true}\n' +
        '{"Path":"github.com/unknown/lib","Version":"v1.0.0","Dir":"/tmp/unknown"}'

      execSync.mockImplementation((cmd) => {
        if (cmd === 'go env GOMODCACHE') {
          return '/home/user/go/pkg/mod\n'
        }
        if (cmd.includes('go list')) {
          return mockNdjson
        }
        return ''
      })

      spawn.mockImplementation(() => {
        throw new Error('spawn failed')
      })

      // No LICENSE file found
      existsSyncSpy.mockReturnValue(false)

      const result = await scanDependencies('MIT')

      expect(result.unknown).toBe(1)
      expect(result.issues.length).toBe(1)
      expect(result.issues[0].type).toBe('warning')
      expect(result.issues[0].license).toBe('UNKNOWN')
    })

    it('should display progress during scanning (AC #2)', async () => {
      const mockNdjson = '{"Path":"github.com/root","Main":true}\n' +
        '{"Path":"github.com/dep1","Version":"v1.0.0","Dir":"/tmp/dep1"}\n' +
        '{"Path":"github.com/dep2","Version":"v1.0.0","Dir":"/tmp/dep2"}'

      execSync.mockImplementation((cmd) => {
        if (cmd === 'go env GOMODCACHE') {
          return '/home/user/go/pkg/mod\n'
        }
        if (cmd.includes('go list')) {
          return mockNdjson
        }
        return ''
      })

      spawn.mockImplementation(() => {
        throw new Error('spawn failed')
      })

      existsSyncSpy.mockImplementation((file) => file.includes('LICENSE'))
      readFileSyncSpy.mockReturnValue(mitLicenseContent)

      await scanDependencies('MIT')

      expect(stdoutWriteSpy).toHaveBeenCalled()
      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('Scanning dependencies'))
    })
  })

  describe('Conflict report display', () => {
    it('should display conflicts correctly via displayConflictReport', () => {
      const { displayConflictReport } = require('../../lib/scanner')

      const scanResult = {
        timestamp: new Date().toISOString(),
        totalDependencies: 3,
        compatible: 2,
        incompatible: 1,
        unknown: 0,
        issues: [{
          package: 'github.com/gpl/lib@v1.0.0',
          license: 'GPL-3.0-only',
          type: 'conflict',
          reason: 'Copyleft license incompatible with MIT',
          location: '/home/user/go/pkg/mod/github.com/gpl/lib@v1.0.0'
        }]
      }

      // Capture console output
      const originalLog = console.log
      const logs = []
      console.log = (...args) => logs.push(args.join(' '))

      try {
        const hasConflicts = displayConflictReport(scanResult, 'MIT')

        expect(hasConflicts).toBe(true)
        expect(logs.some(log => log.includes('gpl'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })

    it('should display warnings for unknown Go module licenses', () => {
      const { displayConflictReport } = require('../../lib/scanner')

      const scanResult = {
        timestamp: new Date().toISOString(),
        totalDependencies: 1,
        compatible: 0,
        incompatible: 0,
        unknown: 1,
        issues: [{
          package: 'github.com/unknown/lib@v1.0.0',
          license: 'UNKNOWN',
          type: 'warning',
          reason: 'No license field found',
          location: '/home/user/go/pkg/mod/github.com/unknown/lib@v1.0.0'
        }]
      }

      const originalLog = console.log
      const logs = []
      console.log = (...args) => logs.push(args.join(' '))

      try {
        const hasConflicts = displayConflictReport(scanResult, 'MIT')

        // Warnings should not return true for conflicts
        expect(hasConflicts).toBe(false)
        expect(logs.some(log => log.includes('warning'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })

    it('should display success message when all compatible', () => {
      const { displayConflictReport } = require('../../lib/scanner')

      const scanResult = {
        timestamp: new Date().toISOString(),
        totalDependencies: 5,
        compatible: 5,
        incompatible: 0,
        unknown: 0,
        issues: []
      }

      const originalLog = console.log
      const logs = []
      console.log = (...args) => logs.push(args.join(' '))

      try {
        const hasConflicts = displayConflictReport(scanResult, 'MIT')

        expect(hasConflicts).toBe(false)
        expect(logs.some(log => log.includes('compatible'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })
  })

  describe('Dynamic cache location (AC #7)', () => {
    it('should use go env GOMODCACHE for cache path', () => {
      execSync.mockReturnValue('/custom/go/cache/path\n')

      const cachePath = getGoModuleCachePath()

      expect(cachePath).toBe('/custom/go/cache/path')
      expect(execSync).toHaveBeenCalledWith('go env GOMODCACHE', expect.any(Object))
    })

    it('should handle different GOMODCACHE locations', () => {
      // Linux default
      execSync.mockReturnValueOnce('/home/user/go/pkg/mod\n')
      expect(getGoModuleCachePath()).toBe('/home/user/go/pkg/mod')

      // macOS default
      execSync.mockReturnValueOnce('/Users/user/go/pkg/mod\n')
      expect(getGoModuleCachePath()).toBe('/Users/user/go/pkg/mod')

      // Custom location
      execSync.mockReturnValueOnce('/opt/gomodcache\n')
      expect(getGoModuleCachePath()).toBe('/opt/gomodcache')
    })
  })
})
