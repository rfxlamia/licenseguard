/**
 * Integration tests for Rust Cargo scanning
 * Tests the full licenseguard init flow with Rust projects
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// Must mock child_process at module level for rust.js to use the mock
jest.mock('child_process')
const { execSync } = require('child_process')

// Import scanner components
const { detectPlugin } = require('../../lib/scanner')
const { detect, scanDependencies, getCargoMetadata } = require('../../lib/scanner/plugins/rust')

describe('Rust Scanning Integration', () => {
  let testDir
  let originalCwd

  beforeEach(() => {
    // Create a temp directory for test projects
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-rust-test-'))
    originalCwd = process.cwd()
    execSync.mockReset()
  })

  afterEach(() => {
    // Restore original directory
    process.chdir(originalCwd)

    // Clean up test directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('Rust project detection', () => {
    it('should detect Cargo.toml as Rust project', () => {
      // Create Cargo.toml in test directory
      const cargoPath = path.join(testDir, 'Cargo.toml')
      fs.writeFileSync(cargoPath, `
[package]
name = "test-project"
version = "0.1.0"
edition = "2021"
license = "MIT"

[dependencies]
`)

      // Change to test directory
      process.chdir(testDir)

      // Test detection
      expect(detect()).toBe(true)
    })

    it('should not detect Rust project without Cargo.toml', () => {
      // Create only package.json (Node.js project)
      const packagePath = path.join(testDir, 'package.json')
      fs.writeFileSync(packagePath, JSON.stringify({
        name: 'not-rust',
        version: '1.0.0'
      }))

      process.chdir(testDir)

      expect(detect()).toBe(false)
    })

    it('should detect Rust plugin from scanner orchestrator', () => {
      // Create Cargo.toml
      const cargoPath = path.join(testDir, 'Cargo.toml')
      fs.writeFileSync(cargoPath, `
[package]
name = "test-project"
version = "0.1.0"
edition = "2021"
`)

      process.chdir(testDir)

      const detected = detectPlugin()

      // Should detect rust plugin (no package.json or conanfile)
      expect(detected).not.toBeNull()
      expect(detected.name).toBe('rust')
    })

    it('should prioritize Node.js over Rust when both exist', () => {
      // Create both Cargo.toml and package.json
      fs.writeFileSync(path.join(testDir, 'Cargo.toml'), `
[package]
name = "rust-with-node"
version = "0.1.0"
`)
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({
        name: 'node-with-rust',
        version: '1.0.0'
      }))

      process.chdir(testDir)

      const detected = detectPlugin()

      // Node.js should take priority
      expect(detected).not.toBeNull()
      expect(detected.name).toBe('node')
    })
  })

  describe('Cargo metadata error handling', () => {
    it('should provide helpful error when Cargo not installed', () => {
      // Mock execSync to simulate Cargo not found
      execSync.mockImplementation(() => {
        throw new Error('cargo: command not found')
      })

      expect(() => getCargoMetadata()).toThrow('Cargo not installed')
      expect(() => getCargoMetadata()).toThrow('https://rustup.rs')
    })

    it('should provide helpful error for Windows not recognized', () => {
      execSync.mockImplementation(() => {
        throw new Error('\'cargo\' is not recognized as an internal or external command')
      })

      expect(() => getCargoMetadata()).toThrow('Cargo not installed')
    })
  })

  describe('Full scanning flow (with mocked cargo)', () => {
    let stdoutWriteSpy

    beforeEach(() => {
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {})
    })

    afterEach(() => {
      if (stdoutWriteSpy) stdoutWriteSpy.mockRestore()
    })

    it('should complete full scan with mocked cargo metadata', async () => {
      const mockMetadata = {
        packages: [
          {
            name: 'test-project',
            version: '0.1.0',
            id: 'test-project 0.1.0 (path)',
            license: 'MIT',
            source: null
          },
          {
            name: 'serde',
            version: '1.0.193',
            id: 'serde 1.0.193 (registry)',
            license: 'MIT OR Apache-2.0',
            source: 'registry',
            manifest_path: '/path/to/serde/Cargo.toml'
          }
        ],
        resolve: { root: 'test-project 0.1.0 (path)' }
      }

      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(1) // serde only (root filtered)
      expect(result.compatible).toBe(1)
      expect(result.incompatible).toBe(0)
      expect(result.unknown).toBe(0)
      expect(result.timestamp).toBeDefined()
    })

    it('should detect conflicts with GPL dependency', async () => {
      const mockMetadata = {
        packages: [
          {
            name: 'mit-project',
            version: '0.1.0',
            id: 'mit-project 0.1.0 (path)',
            license: 'MIT',
            source: null
          },
          {
            name: 'gpl-crate',
            version: '1.0.0',
            id: 'gpl-crate 1.0.0 (registry)',
            license: 'GPL-3.0',
            source: 'registry',
            manifest_path: '/path/to/gpl-crate/Cargo.toml'
          }
        ],
        resolve: { root: 'mit-project 0.1.0 (path)' }
      }

      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      const result = await scanDependencies('MIT')

      expect(result.incompatible).toBe(1)
      expect(result.issues.length).toBe(1)
      expect(result.issues[0].package).toBe('gpl-crate@1.0.0')
      expect(result.issues[0].type).toBe('conflict')
    })

    it('should handle multiple dependencies with mixed licenses', async () => {
      const mockMetadata = {
        packages: [
          { name: 'root', id: 'root 0.1.0', source: null },
          { name: 'mit-lib', version: '1.0.0', id: 'mit-lib 1.0.0', license: 'MIT', source: 'registry', manifest_path: '/path/1' },
          { name: 'apache-lib', version: '2.0.0', id: 'apache-lib 2.0.0', license: 'Apache-2.0', source: 'registry', manifest_path: '/path/2' },
          { name: 'bsd-lib', version: '3.0.0', id: 'bsd-lib 3.0.0', license: 'BSD-3-Clause', source: 'registry', manifest_path: '/path/3' }
        ],
        resolve: { root: 'root 0.1.0' }
      }

      execSync.mockReturnValue(JSON.stringify(mockMetadata))

      const result = await scanDependencies('MIT')

      expect(result.totalDependencies).toBe(3)
      expect(result.compatible).toBe(3)
      expect(result.incompatible).toBe(0)
    })
  })

  describe('Conflict report display', () => {
    it('should display conflicts correctly via displayConflictReport', async () => {
      const { displayConflictReport } = require('../../lib/scanner')

      const scanResult = {
        timestamp: new Date().toISOString(),
        totalDependencies: 3,
        compatible: 2,
        incompatible: 1,
        unknown: 0,
        issues: [{
          package: 'gpl-crate@1.0.0',
          license: 'GPL-3.0',
          type: 'conflict',
          reason: 'Copyleft license incompatible with MIT',
          location: '/path/Cargo.toml'
        }]
      }

      // Capture console output
      const originalLog = console.log
      const logs = []
      console.log = (...args) => logs.push(args.join(' '))

      try {
        const hasConflicts = await displayConflictReport(scanResult, 'MIT')

        expect(hasConflicts).toBe(true)
        expect(logs.some(log => log.includes('gpl-crate'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })

    it('should display warnings for unknown licenses', async () => {
      const { displayConflictReport } = require('../../lib/scanner')

      const scanResult = {
        timestamp: new Date().toISOString(),
        totalDependencies: 1,
        compatible: 0,
        incompatible: 0,
        unknown: 1,
        issues: [{
          package: 'unknown-crate@1.0.0',
          license: 'UNKNOWN',
          type: 'warning',
          reason: 'No license field found',
          location: '/path/Cargo.toml'
        }]
      }

      const originalLog = console.log
      const logs = []
      console.log = (...args) => logs.push(args.join(' '))

      try {
        const hasConflicts = await displayConflictReport(scanResult, 'MIT')

        // Warnings should not return true for conflicts
        expect(hasConflicts).toBe(false)
        expect(logs.some(log => log.includes('warning'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })

    it('should display success message when all compatible', async () => {
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
        const hasConflicts = await displayConflictReport(scanResult, 'MIT')

        expect(hasConflicts).toBe(false)
        expect(logs.some(log => log.includes('compatible'))).toBe(true)
      } finally {
        console.log = originalLog
      }
    })
  })
})
