#!/usr/bin/env node

/**
 * E2E Test Runner - Node.js Version
 * Provides a more advanced test runner with better cross-platform support
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import http from 'http'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '..')

// Configuration
const CONFIG = {
  backendUrlDocker: 'http://localhost:8081', // Docker maps container 8080 -> host 8081
  backendUrlLocal: 'http://localhost:8080',   // Local cargo run uses 8080
  frontendUrl: 'http://localhost:5173',
  backendHealthEndpointDocker: 'http://localhost:8081/api/health',
  backendHealthEndpointLocal: 'http://localhost:8080/api/health',
  maxWaitTime: 120000, // milliseconds
  checkInterval: 2000, // milliseconds
}

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function info(message) {
  log(`ℹ ${message}`, 'blue')
}

function success(message) {
  log(`✓ ${message}`, 'green')
}

function warning(message) {
  log(`⚠ ${message}`, 'yellow')
}

function error(message) {
  log(`✗ ${message}`, 'red')
}

function header(title) {
  console.log('')
  log('═══════════════════════════════════════════════════════════', 'blue')
  log(`  ${title}`, 'blue')
  log('═══════════════════════════════════════════════════════════', 'blue')
  console.log('')
}

// Check if service is accessible
async function checkService(url, serviceName) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(5000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// Wait for service to be ready
async function waitForService(url, serviceName) {
  info(`Waiting for ${serviceName} to be ready...`)
  const startTime = Date.now()

  while (Date.now() - startTime < CONFIG.maxWaitTime) {
    if (await checkService(url, serviceName)) {
      success(`${serviceName} is ready!`)
      return true
    }
    process.stdout.write('.')
    await new Promise((resolve) => setTimeout(resolve, CONFIG.checkInterval))
  }

  console.log('')
  error(`${serviceName} failed to start within ${CONFIG.maxWaitTime / 1000} seconds`)
  return false
}

// Check which backend is running (Docker or local)
async function checkBackendRunning() {
  if (await checkService(CONFIG.backendHealthEndpointDocker, 'Backend')) {
    return 'docker'
  } else if (await checkService(CONFIG.backendHealthEndpointLocal, 'Backend')) {
    return 'local'
  } else {
    return 'none'
  }
}

// Check if Docker services are running
async function checkDockerServices() {
  info('Checking Docker services...')

  let composeCommand = 'docker compose'
  try {
    await execAsync('docker compose version')
  } catch {
    try {
      await execAsync('docker-compose version')
      composeCommand = 'docker-compose'
    } catch {
      warning('Docker Compose not found')
      return false
    }
  }

  try {
    const { stdout } = await execAsync(`${composeCommand} ps --format json`, {
      cwd: ROOT_DIR,
    })

    const services = JSON.parse(`[${stdout.trim().split('\n').filter(Boolean).join(',')}]`)
    const backendRunning = services.some((s) => 
      s.Service === 'backend' && (s.State === 'running' || s.State === 'healthy')
    )
    const postgresRunning = services.some((s) => 
      s.Service === 'postgres' && (s.State === 'running' || s.State === 'healthy')
    )
    const minioRunning = services.some((s) => 
      s.Service === 'minio' && (s.State === 'running' || s.State === 'healthy')
    )

    if (backendRunning) {
      success('Backend container is running')
    } else {
      warning('Backend container is not running')
    }

    if (postgresRunning) {
      success('PostgreSQL container is running')
    } else {
      warning('PostgreSQL container is not running')
    }

    if (minioRunning) {
      success('MinIO container is running')
    } else {
      warning('MinIO container is not running')
    }

    return backendRunning && postgresRunning && minioRunning
  } catch (err) {
    warning('Could not check Docker services (Docker may not be installed)')
    return false
  }
}

// Start Docker services
async function startDockerServices() {
  header('Starting Docker Services')

  let composeCommand = 'docker compose'
  try {
    await execAsync('docker compose version')
  } catch {
    try {
      await execAsync('docker-compose version')
      composeCommand = 'docker-compose'
    } catch {
      error('Docker Compose is not installed. Please install Docker to run tests.')
      return false
    }
  }

  try {
    info(`Starting services with ${composeCommand}...`)
    await execAsync(`${composeCommand} up -d postgres minio minio-init backend`, {
      cwd: ROOT_DIR,
    })

    info('Waiting for services to be healthy...')
    const startTime = Date.now()
    const maxWait = 180000 // 3 minutes

    while (Date.now() - startTime < maxWait) {
      try {
        const { stdout } = await execAsync(`${composeCommand} ps --format json`, {
          cwd: ROOT_DIR,
        })
        const services = JSON.parse(`[${stdout.trim().split('\n').filter(Boolean).join(',')}]`)
        
        const postgresHealthy = services.some((s) => 
          s.Service === 'postgres' && (s.Health === 'healthy' || s.State === 'running')
        )
        const minioHealthy = services.some((s) => 
          s.Service === 'minio' && (s.Health === 'healthy' || s.State === 'running')
        )
        const backendHealthy = await checkService(CONFIG.backendHealthEndpointDocker, 'Backend')

        if (postgresHealthy && minioHealthy && backendHealthy) {
          success('Docker services are ready!')
          return true
        }
      } catch {
        // Continue waiting
      }

      process.stdout.write('.')
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    console.log('')
    warning('Some services may not be fully ready yet, but continuing...')
    return true
  } catch (err) {
    error('Failed to start Docker services')
    console.error(err.message)
    return false
  }
}

// Start backend (prefer Docker, fallback to local)
async function startBackend() {
  header('Starting Backend')

  // Check if Docker backend is already running
  if (await checkService(CONFIG.backendHealthEndpointDocker, 'Backend')) {
    success('Backend is already running in Docker')
    return null
  }

  // Try to start Docker backend first
  let composeCommand = null
  try {
    await execAsync('docker compose version')
    composeCommand = 'docker compose'
  } catch {
    try {
      await execAsync('docker-compose version')
      composeCommand = 'docker-compose'
    } catch {
      // Docker Compose not available, will fallback to local
    }
  }

  if (composeCommand) {
    info(`Starting backend container with ${composeCommand}...`)
    try {
      await execAsync(`${composeCommand} up -d backend`, {
        cwd: ROOT_DIR,
      })

      // Wait for Docker backend to be ready
      if (await waitForService(CONFIG.backendHealthEndpointDocker, 'Backend (Docker)')) {
        success('Backend started in Docker')
        return null
      } else {
        warning('Docker backend failed to start, trying local backend...')
      }
    } catch (err) {
      warning('Failed to start Docker backend, trying local backend...')
    }
  }

  // Fallback to local backend
  info('Starting backend server locally...')
  const backendDir = join(ROOT_DIR, 'backend')

  // Check if cargo exists
  try {
    await execAsync('which cargo')
  } catch {
    error('Cargo (Rust) is not installed. Please install Rust to run the backend locally.')
    process.exit(1)
  }

  // Start backend
  const backendProcess = spawn('cargo', ['run'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  })

  backendProcess.stdout.on('data', (data) => {
    // Optionally log backend output
    // process.stdout.write(data)
  })

  backendProcess.stderr.on('data', (data) => {
    // Optionally log backend errors
    // process.stderr.write(data)
  })

  // Wait for local backend to be ready
  if (await waitForService(CONFIG.backendHealthEndpointLocal, 'Backend (Local)')) {
    success(`Backend started locally (PID: ${backendProcess.pid})`)
    return backendProcess
  } else {
    backendProcess.kill()
    error('Backend failed to start')
    process.exit(1)
  }
}

// Stop backend
async function stopBackend(backendProcess) {
  if (backendProcess) {
    info(`Stopping backend (PID: ${backendProcess.pid})...`)
    backendProcess.kill()
    success('Backend stopped')
  }
}

// Run Playwright tests
async function runTests(options = {}) {
  header('Running E2E Tests')

  const frontendDir = join(ROOT_DIR, 'frontend')
  const { testFile, headed, uiMode } = options

  let testCmd = 'npm run test:e2e'

  if (uiMode) {
    testCmd = 'npm run test:e2e:ui'
  } else if (headed) {
    testCmd = 'npm run test:e2e:headed'
  }

  if (testFile) {
    testCmd = `npx playwright test ${testFile}`
    if (headed) testCmd += ' --headed'
    if (uiMode) testCmd += ' --ui'
  }

  info(`Running: ${testCmd}`)
  console.log('')

  try {
    const { stdout, stderr } = await execAsync(testCmd, {
      cwd: frontendDir,
      stdio: 'inherit',
    })
    return 0
  } catch (err) {
    return err.code || 1
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options = {
    skipSetup: false,
    testFile: null,
    headed: false,
    uiMode: false,
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--skip-setup':
        options.skipSetup = true
        break
      case '--file':
        options.testFile = args[++i]
        break
      case '--headed':
        options.headed = true
        break
      case '--ui':
        options.uiMode = true
        break
      case '--help':
        options.help = true
        break
      default:
        error(`Unknown option: ${args[i]}`)
        console.log('Use --help for usage information')
        process.exit(1)
    }
  }

  return options
}

// Print help message
function printHelp() {
  console.log('Usage: node run-e2e-tests.js [OPTIONS]')
  console.log('')
  console.log('Options:')
  console.log('  --skip-setup    Skip starting services (assume they\'re already running)')
  console.log('  --file FILE      Run specific test file')
  console.log('  --headed         Run tests in headed mode (show browser)')
  console.log('  --ui             Run tests in UI mode (interactive)')
  console.log('  --help           Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  node run-e2e-tests.js')
  console.log('  node run-e2e-tests.js --file multi-presenter.spec.ts')
  console.log('  node run-e2e-tests.js --headed --ui')
}

// Main function
async function main() {
  header('E2E Test Runner')

  const options = parseArgs()

  if (options.help) {
    printHelp()
    process.exit(0)
  }

  let backendProcess = null

  try {
    // Setup phase
    if (!options.skipSetup) {
      // Check Docker services
      const dockerRunning = await checkDockerServices()
      if (!dockerRunning) {
        // In non-interactive mode, try to start services
        await startDockerServices()
      }

      // Start backend if not running
      const backendType = await checkBackendRunning()
      if (backendType === 'none') {
        backendProcess = await startBackend()
      } else if (backendType === 'docker') {
        success('Backend is already running in Docker')
      } else if (backendType === 'local') {
        success('Backend is already running locally')
      }
    } else {
      info('Skipping setup (--skip-setup flag set)')
    }

    // Verify services are ready
    header('Verifying Services')
    const backendType = await checkBackendRunning()
    if (backendType === 'docker') {
      if (!(await waitForService(CONFIG.backendHealthEndpointDocker, 'Backend'))) {
        error('Backend is not accessible. Please start it manually.')
        process.exit(1)
      }
    } else if (backendType === 'local') {
      if (!(await waitForService(CONFIG.backendHealthEndpointLocal, 'Backend'))) {
        error('Backend is not accessible. Please start it manually.')
        process.exit(1)
      }
    } else {
      error('Backend is not accessible. Please start it manually.')
      process.exit(1)
    }

    // Run tests
    const exitCode = await runTests(options)

    // Report results
    console.log('')
    if (exitCode === 0) {
      success('All tests passed!')
    } else {
      error(`Some tests failed (exit code: ${exitCode})`)
    }

    process.exit(exitCode)
  } catch (err) {
    error(`Error: ${err.message}`)
    console.error(err)
    await stopBackend(backendProcess)
    process.exit(1)
  }
}

// Handle cleanup
process.on('SIGINT', async () => {
  info('Cleaning up...')
  process.exit(0)
})

process.on('SIGTERM', async () => {
  info('Cleaning up...')
  process.exit(0)
})

// Run main function
main()

