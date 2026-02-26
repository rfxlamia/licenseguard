#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const os = require('os')
const { execSync } = require('child_process')

/**
 * Setup global git hooks for automatic license notifications
 * Runs automatically after npm install -g licenseguard-cli
 */

const homeDir = os.homedir()
const templateDir = path.join(homeDir, '.git-templates')
const hooksDir = path.join(templateDir, 'hooks')

// Self-contained hook scripts (only needs Node.js, not licenseguard)

// ESM hook generators
function generatePostCheckoutHookEsm() {
  return `#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

try {
  const configPath = path.join(process.cwd(), '.licenseguardrc')
  if (!fs.existsSync(configPath)) process.exit(0)

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const blue = '\\x1b[34m'
  const reset = '\\x1b[0m'

  console.log(\`\${blue}📜 This project uses \${config.license.toUpperCase()} License by \${config.owner}\${reset}\`)
} catch (e) {
  // Silent fail - never block git
}
process.exit(0)
`
}

function generatePreCommitHookEsm() {
  return `#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

try {
  const configPath = path.join(process.cwd(), '.licenseguardrc')
  if (!fs.existsSync(configPath)) process.exit(0)

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const blue = '\\x1b[34m'
  const reset = '\\x1b[0m'

  console.log(\`\${blue}ℹ️  Reminder: This project is licensed under \${config.license.toUpperCase()}\${reset}\`)
} catch (e) {
  // Silent fail - never block git
}
process.exit(0)
`
}

function setupGlobalHooks() {
  try {
    // Only setup global hooks when installed globally
    // Check if we're in a global npm directory
    const isGlobalInstall =
      process.env.npm_config_global === 'true' ||
      __dirname.includes('npm-global') ||
      __dirname.includes('/usr/lib/node_modules') ||
      __dirname.includes('/usr/local/lib/node_modules')

    if (!isGlobalInstall) {
      // Local install, skip global hooks setup
      return
    }

    // Always use ESM for global hooks - ESM works in both ESM and CJS projects
    // CJS hooks fail in ESM projects, but ESM hooks work everywhere
    const postCheckoutHook = generatePostCheckoutHookEsm()
    const preCommitHook = generatePreCommitHookEsm()

    // Create template directories
    if (!fs.existsSync(hooksDir)) {
      fs.mkdirSync(hooksDir, { recursive: true })
    }

    // Write hook files
    const hooks = [
      { name: 'post-checkout', script: postCheckoutHook },
      { name: 'pre-commit', script: preCommitHook },
    ]

    for (const hook of hooks) {
      const hookPath = path.join(hooksDir, hook.name)

      // Check for existing hooks
      if (fs.existsSync(hookPath)) {
        const existing = fs.readFileSync(hookPath, 'utf8')
        if (!existing.includes('.licenseguardrc')) {
          // Not our hook, create variant
          const variantPath = path.join(hooksDir, `licenseguard-${hook.name}`)
          fs.writeFileSync(variantPath, hook.script, 'utf8')
          fs.chmodSync(variantPath, 0o755)
          console.log(`⚠️  Existing ${hook.name} found, created licenseguard-${hook.name}`)
        }
        // Our hook already exists, skip
      } else {
        fs.writeFileSync(hookPath, hook.script, 'utf8')
        fs.chmodSync(hookPath, 0o755)
      }
    }

    // Configure git to use template directory
    execSync(`git config --global init.templateDir "${templateDir}"`, {
      stdio: 'pipe',
    })

    console.log('✓ LicenseGuard global hooks installed')
    console.log(`  Template directory: ${templateDir}`)
    console.log('  Now every git clone/init will check for .licenseguardrc')
  } catch (error) {
    // Don't fail installation if hooks setup fails
    console.log('⚠️  Could not setup global hooks:', error.message)
    console.log('  LicenseGuard still works, run licenseguard --setup manually')
  }
}

setupGlobalHooks()
