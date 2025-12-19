import { useState, useEffect } from 'react'
import { Play, Square, RefreshCw, CheckCircle, XCircle, Loader } from 'lucide-react'
import { Button } from '@/components/common/Button'

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  error?: string
}

interface TestSuite {
  name: string
  file: string
  tests: TestResult[]
}

export function TestRunnerPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null)
  const [output, setOutput] = useState<string[]>([])
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking')

  // Available test suites - matches actual test files in e2e directory
  const availableSuites = [
    { name: 'All Tests', file: '', description: 'Run all test suites' },
    {
      name: 'Multi-Presenter Features',
      file: 'multi-presenter.spec.ts',
      description: 'Presenter auth, pass presenter, role switching, completion',
    },
    {
      name: 'Authentication',
      file: 'auth.spec.ts',
      description: 'Login, registration, form validation',
    },
    {
      name: 'Event Management',
      file: 'event.spec.ts',
      description: 'Event creation, event listing, event details',
    },
    {
      name: 'Quiz Participation',
      file: 'quiz.spec.ts',
      description: 'Joining events, WebSocket connections, quiz UI',
    },
    {
      name: 'Navigation',
      file: 'navigation.spec.ts',
      description: 'Route navigation, redirects, 404 handling',
    },
  ]

  // Check backend status
  useEffect(() => {
    checkBackendStatus()
    const interval = setInterval(checkBackendStatus, 10000) // Check every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/health')
      setBackendStatus(response.ok ? 'online' : 'offline')
    } catch {
      setBackendStatus('offline')
    }
  }

  const addOutput = (message: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const runTests = async (testFile?: string) => {
    setIsRunning(true)
    setOutput([])
    addOutput('Starting test run...')

    try {
      // Check backend status first
      if (backendStatus !== 'online') {
        addOutput('⚠️  Warning: Backend appears to be offline')
        addOutput('   Make sure the backend is running on http://localhost:8080')
      }

      // In a real implementation, this would call a backend API endpoint
      // that runs Playwright tests. For now, we'll simulate it.
      addOutput(`Running tests${testFile ? `: ${testFile}` : ' (all tests)'}...`)
      addOutput('')

      // Simulate test execution
      // In production, this would be an API call to a test runner service
      await simulateTestRun(testFile)

      addOutput('')
      addOutput('Test run completed')
    } catch (error) {
      addOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
  }

  const simulateTestRun = async (testFile?: string) => {
    // This is a simulation - in production, you'd call a real test runner API
    const suites = testFile
      ? availableSuites.filter((s) => s.file === testFile)
      : availableSuites.slice(1) // All except "All Tests"

    for (const suite of suites) {
      addOutput(`Running ${suite.name}...`)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      const tests: TestResult[] = [
        { name: 'Test 1', status: 'passed', duration: 1234 },
        { name: 'Test 2', status: 'passed', duration: 856 },
        { name: 'Test 3', status: 'failed', duration: 2341, error: 'Assertion failed' },
      ]

      setTestSuites((prev) => {
        const existing = prev.findIndex((s) => s.name === suite.name)
        if (existing >= 0) {
          const updated = [...prev]
          updated[existing] = { ...updated[existing], tests }
          return updated
        }
        return [...prev, { name: suite.name, file: suite.file, tests }]
      })

      const passed = tests.filter((t) => t.status === 'passed').length
      const failed = tests.filter((t) => t.status === 'failed').length
      addOutput(`  ✓ ${passed} passed, ✗ ${failed} failed`)
    }
  }

  const stopTests = () => {
    setIsRunning(false)
    addOutput('Test run stopped by user')
  }

  const clearOutput = () => {
    setOutput([])
    setTestSuites([])
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />
      case 'running':
        return <Loader className="w-4 h-4 text-blue-400 animate-spin" />
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-500" />
    }
  }

  const totalTests = testSuites.reduce((sum, suite) => sum + suite.tests.length, 0)
  const passedTests = testSuites.reduce(
    (sum, suite) => sum + suite.tests.filter((t) => t.status === 'passed').length,
    0
  )
  const failedTests = testSuites.reduce(
    (sum, suite) => sum + suite.tests.filter((t) => t.status === 'failed').length,
    0
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-dark-900 rounded-lg border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">E2E Test Runner</h1>
              <p className="text-gray-400">
                Run and monitor end-to-end tests for the quiz application
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Backend Status */}
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    backendStatus === 'online'
                      ? 'bg-green-500'
                      : backendStatus === 'offline'
                        ? 'bg-red-500'
                        : 'bg-yellow-500 animate-pulse'
                  }`}
                />
                <span className="text-sm text-gray-400">
                  Backend: {backendStatus === 'online' ? 'Online' : backendStatus === 'offline' ? 'Offline' : 'Checking...'}
                </span>
              </div>
            </div>
          </div>

          {/* Test Suite Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Test Suite
            </label>
            <div className="flex flex-wrap gap-2">
              {availableSuites.map((suite) => (
                <button
                  key={suite.file}
                  onClick={() => setSelectedSuite(suite.file)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    selectedSuite === suite.file
                      ? 'bg-cyan-500 text-white'
                      : 'bg-dark-800 text-gray-300 hover:bg-dark-700'
                  }`}
                >
                  {suite.name}
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => runTests(selectedSuite || undefined)}
              disabled={isRunning}
              variant="primary"
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isRunning ? 'Running...' : 'Run Tests'}
            </Button>
            {isRunning && (
              <Button
                onClick={stopTests}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}
            <Button onClick={clearOutput} variant="secondary" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Clear
            </Button>
          </div>
        </div>

        {/* Test Results Summary */}
        {testSuites.length > 0 && (
          <div className="bg-dark-900 rounded-lg border border-dark-700 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Test Results</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-dark-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Total Tests</div>
                <div className="text-2xl font-bold text-white">{totalTests}</div>
              </div>
              <div className="bg-dark-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Passed</div>
                <div className="text-2xl font-bold text-green-400">{passedTests}</div>
              </div>
              <div className="bg-dark-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-400">{failedTests}</div>
              </div>
            </div>

            {/* Test Suites */}
            <div className="space-y-4">
              {testSuites.map((suite) => (
                <div key={suite.name} className="bg-dark-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">{suite.name}</h3>
                  <div className="space-y-2">
                    {suite.tests.map((test, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-dark-900 rounded p-3"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(test.status)}
                          <span className="text-gray-300">{test.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {test.duration && (
                            <span className="text-sm text-gray-500">
                              {test.duration}ms
                            </span>
                          )}
                          {test.error && (
                            <span className="text-sm text-red-400">{test.error}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Output Log */}
        <div className="bg-dark-900 rounded-lg border border-dark-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Output Log</h2>
            <Button onClick={clearOutput} variant="secondary" size="sm">
              Clear
            </Button>
          </div>
          <div className="bg-dark-950 rounded-lg p-4 font-mono text-sm text-gray-300 h-64 overflow-y-auto">
            {output.length === 0 ? (
              <div className="text-gray-500">No output yet. Run tests to see output.</div>
            ) : (
              output.map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-dark-900 rounded-lg border border-dark-700 p-6">
          <h2 className="text-xl font-bold text-white mb-4">Instructions</h2>
          <div className="space-y-2 text-gray-400">
            <p>
              <strong className="text-white">Note:</strong> This is a UI mockup. In production,
              this would connect to a test runner API service.
            </p>
            <p>To run tests manually, use one of these methods:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>
                <code className="bg-dark-800 px-2 py-1 rounded">npm run test:e2e</code> - Run all
                tests
              </li>
              <li>
                <code className="bg-dark-800 px-2 py-1 rounded">
                  npm run test:e2e:ui
                </code>{' '}
                - Run with interactive UI
              </li>
              <li>
                <code className="bg-dark-800 px-2 py-1 rounded">
                  ./scripts/run-e2e-tests.sh
                </code>{' '}
                - Use test runner script
              </li>
              <li>
                <code className="bg-dark-800 px-2 py-1 rounded">
                  node scripts/run-e2e-tests.js
                </code>{' '}
                - Use Node.js test runner
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

