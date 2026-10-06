const fs = require('fs')
const os = require('os')
const path = require('path')
const { traceDependencyPath, clearCache } = require('../../lib/scanner/path-tracer')

// This payload uses POSIX shell syntax; literal-argument unit tests run on all OSes.
const testPosix = process.platform === 'win32' ? test.skip : test

describe('Dependency path tracing security', () => {
  testPosix('does not execute commands embedded in a package identifier', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'licenseguard-path-security-'))
    const marker = path.join(directory, 'marker')
    const quotedMarker = '\'' + marker.replace(/'/g, '\'\\\'\'') + '\''
    const packageName = `not-a-real-package; printf verified > ${quotedMarker}; #`
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})

    try {
      clearCache()
      const result = traceDependencyPath(packageName, directory)

      expect(fs.existsSync(marker)).toBe(false)
      expect(result).toBeNull()
      expect(logSpy).toHaveBeenCalled()
    } finally {
      clearCache()
      logSpy.mockRestore()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  })
})
