import { defineConfig, devices } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolve root directory: frontend/playwright.config.ts -> frontend -> quiz-app
// Try multiple methods to find the project root
const ROOT_DIR = (() => {
  // Method 1: Go up from __dirname (frontend -> quiz-app)
  const fromDirname = path.resolve(__dirname, '..');
  if (existsSync(path.join(fromDirname, 'docker-compose.yml'))) {
    return fromDirname;
  }
  // Method 2: Go up from current working directory (if running from frontend/)
  const fromCwd = path.resolve(process.cwd(), '..');
  if (existsSync(path.join(fromCwd, 'docker-compose.yml'))) {
    return fromCwd;
  }
  // Method 3: Assume we're in frontend/ and go up one level
  return fromDirname; // Default fallback
})();

const useDocker = process.env.E2E_MODE !== 'local' && process.env.E2E_NO_DOCKER !== '1';
const startServer = process.env.E2E_START_SERVER !== 'false';
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4173';
const apiURL = process.env.E2E_API_URL || process.env.VITE_API_URL || 'http://localhost:8080';
const wsURL = process.env.E2E_WS_URL || process.env.VITE_WS_URL || 'ws://localhost:8080';
const webCommand = process.env.E2E_WEB_COMMAND || 'npm run dev -- --host 0.0.0.0 --port 4173';
const shouldEnsureDocker = !process.env.CI && useDocker;
const startLocalServices = process.env.E2E_LOCAL_START_SERVICES !== 'false';
const startLocalBackend = process.env.E2E_LOCAL_START_BACKEND === 'true';
const useMocks = process.env.E2E_USE_MOCKS === '1';

// Helper to check if Docker services are running and start them if needed
function ensureDockerServices() {
  let composeCommand = 'docker compose';
  
  // Check if Docker is available
  try {
    execSync('docker --version', { stdio: 'ignore' });
  } catch {
    console.warn('⚠️  Docker is not installed or not in PATH.');
    console.warn('   E2E tests require Docker to run all services.');
    console.warn('   Please install Docker Desktop: https://www.docker.com/products/docker-desktop');
    console.warn('   Or start services manually: docker compose up -d');
    return false;
  }

  // Check if Docker daemon is running
  try {
    execSync('docker info > /dev/null 2>&1', { stdio: 'ignore' });
  } catch {
    console.warn('⚠️  Docker daemon is not running.');
    console.warn('   Please start Docker Desktop or the Docker daemon.');
    return false;
  }

  // Check if docker-compose is available
  try {
    execSync('docker compose version', { stdio: 'ignore' });
  } catch {
    try {
      execSync('docker-compose version', { stdio: 'ignore' });
      composeCommand = 'docker-compose';
    } catch {
      console.warn('⚠️  docker-compose is not available.');
      return false;
    }
  }
  
  const composeFile = path.join(ROOT_DIR, 'docker-compose.yml');
  
  // Check if all required services are running
  let servicesRunning = false;
  try {
    const result = execSync(`${composeCommand} -f ${composeFile} ps --format json 2>/dev/null`, {
      encoding: 'utf-8',
      cwd: ROOT_DIR,
    });
    
    const services = JSON.parse(`[${result.trim().split('\n').filter(Boolean).join(',')}]`);
    const requiredServices = ['postgres', 'minio', 'backend', 'frontend'];
    const runningServices = services
      .filter((s: any) => s.State === 'running' || s.State === 'healthy')
      .map((s: any) => s.Service);
    
    servicesRunning = requiredServices.every(service => runningServices.includes(service));
  } catch {
    servicesRunning = false;
  }
  
  if (!servicesRunning) {
    console.log('📦 Docker services are not running.');
    console.log('🚀 Starting all services with docker-compose...');
    
    try {
      // Start all services (dependencies will start automatically)
      execSync(`${composeCommand} -f ${composeFile} up -d`, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
      });
      
      console.log('⏳ Waiting for services to be ready (this may take a few minutes for first build)...');
      
      // Wait for services to be healthy
      const startTime = Date.now();
      const maxWait = 180000; // 3 minutes max (backend compilation takes time)
      let servicesReady = false;
      
      while (Date.now() - startTime < maxWait && !servicesReady) {
        try {
          const result = execSync(`${composeCommand} -f ${composeFile} ps --format json 2>/dev/null`, {
            encoding: 'utf-8',
            cwd: ROOT_DIR,
          });
          
          const services = JSON.parse(`[${result.trim().split('\n').filter(Boolean).join(',')}]`);
          const backendHealthy = services.some((s: any) => 
            s.Service === 'backend' && (s.Health === 'healthy' || s.State === 'running')
          );
          const frontendHealthy = services.some((s: any) => 
            s.Service === 'frontend' && (s.Health === 'healthy' || s.State === 'running')
          );
          const postgresHealthy = services.some((s: any) => 
            s.Service === 'postgres' && (s.Health === 'healthy' || s.State === 'running')
          );
          const minioHealthy = services.some((s: any) => 
            s.Service === 'minio' && (s.Health === 'healthy' || s.State === 'running')
          );
          
          if (backendHealthy && frontendHealthy && postgresHealthy && minioHealthy) {
            servicesReady = true;
            console.log('✅ All Docker services are ready!');
            break;
          }
        } catch {
          // Continue waiting
        }
        
        // Wait 2 seconds before checking again
        const waitStart = Date.now();
        while (Date.now() - waitStart < 2000) {
          // Busy wait for 2 seconds
        }
      }
      
      if (!servicesReady) {
        console.warn('⚠️  Some services may not be fully ready yet.');
        console.warn('   Tests will start but may fail if services are not ready.');
        console.warn(`   Check status: ${composeCommand} -f ${composeFile} ps`);
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to start Docker services automatically.');
      console.error('   Error:', error.message);
      console.error(`   Please start manually: ${composeCommand} -f ${composeFile} up -d`);
      return false;
    }
  } else {
    console.log('✅ Docker services are already running.');
    return true;
  }
}

function isBackendHealthy() {
  try {
    execSync(`curl -sf ${apiURL}/api/health`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureLocalServices() {
  if (useMocks) {
    console.warn('ℹ️  E2E_USE_MOCKS=1 set; skipping backend/database checks.');
    return true;
  }

  if (isBackendHealthy()) {
    return true;
  }

  if (!startLocalServices) {
    console.warn('⚠️  Backend not reachable and E2E_LOCAL_START_SERVICES=false. Start backend/db manually or set E2E_USE_MOCKS=1.');
    return false;
  }

  let composeCommand = 'docker compose';
  try {
    execSync('docker --version', { stdio: 'ignore' });
    execSync('docker info > /dev/null 2>&1', { stdio: 'ignore' });
    execSync('docker compose version', { stdio: 'ignore' });
  } catch {
    console.warn('⚠️  Docker not available to start local services. Start backend/db manually or enable E2E_USE_MOCKS=1.');
    return false;
  }

  const composeFile = path.join(ROOT_DIR, 'docker-compose.test.yml');
  const services = ['postgres', 'minio', 'minio-init'];
  if (startLocalBackend) {
    services.push('backend-test');
  }

  console.log(`🚀 Starting local test services: ${services.join(', ')}`);
  try {
    execSync(`${composeCommand} -f ${composeFile} up -d ${services.join(' ')}`, {
      cwd: ROOT_DIR,
      stdio: 'inherit',
    });
  } catch (e: any) {
    console.warn(`⚠️  Failed to start local services: ${e.message}`);
    return false;
  }

  // Simple wait for backend if we started it; otherwise just return true
  if (startLocalBackend) {
    const startTime = Date.now();
    const maxWait = 120000;
    while (Date.now() - startTime < maxWait) {
      if (isBackendHealthy()) {
        console.log('✅ Backend is healthy.');
        return true;
      }
    }
    console.warn('⚠️  Backend did not become healthy in time; tests may fail.');
  }

  return true;
}

// Ensure Docker services are running before tests (unless explicitly disabled)
if (process.env.DOCKER_ENV === 'true' || process.env.E2E_MODE === 'docker') {
  // Inside container: services already started by compose
} else if (shouldEnsureDocker) {
  const servicesReady = ensureDockerServices();
  if (!servicesReady) {
    console.warn('⚠️  Proceeding with tests, but services may not be available.');
  }
} else if (!process.env.CI) {
  console.warn('ℹ️  Skipping Docker auto-start (E2E_MODE=local or E2E_NO_DOCKER set).');
  ensureLocalServices();
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30000, // 30 seconds per test - fail fast
  expect: {
    timeout: 5000, // 5 seconds for assertions
  },
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10000, // 10 seconds for actions
    navigationTimeout: 15000, // 15 seconds for navigation
    extraHTTPHeaders: {
      'x-e2e-mode': process.env.E2E_MODE || 'docker',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: startServer
    ? {
        command: webCommand,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: {
          VITE_API_URL: apiURL,
          VITE_WS_URL: wsURL,
          E2E_API_URL: apiURL,
          E2E_WS_URL: wsURL,
        },
      }
    : undefined,
});
