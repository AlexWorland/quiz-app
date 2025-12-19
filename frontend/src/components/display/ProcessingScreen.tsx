import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ProcessingScreenProps {
  step: 'transcribing' | 'generating' | 'ready'
  progress?: number
  message: string
}

const steps = [
  { key: 'transcribing', label: 'Processing final transcription...', icon: '🎤' },
  { key: 'generating', label: 'Generating questions from transcript...', icon: '🤖' },
  { key: 'ready', label: 'Ready to start quiz', icon: '✅' },
]

export function ProcessingScreen({ step, progress, message }: ProcessingScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    const index = steps.findIndex((s) => s.key === step)
    if (index >= 0) {
      setCurrentStepIndex(index)
    }
  }, [step])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-8">
      <div className="max-w-2xl w-full">
        {/* Spinner Animation */}
        <div className="flex justify-center mb-8">
          <motion.div
            className="w-24 h-24 border-4 border-white border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {steps.map((s, index) => (
              <div key={s.key} className="flex flex-col items-center flex-1">
                <motion.div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl mb-2 ${
                    index <= currentStepIndex
                      ? 'bg-white text-purple-900'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                  initial={false}
                  animate={{
                    scale: index === currentStepIndex ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {s.icon}
                </motion.div>
                <span
                  className={`text-sm text-center ${
                    index <= currentStepIndex ? 'text-white' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Progress Bar */}
          {progress !== undefined && (
            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          )}
        </div>

        {/* Current Message */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <h2 className="text-3xl font-bold mb-4">{message}</h2>
            {step === 'ready' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

