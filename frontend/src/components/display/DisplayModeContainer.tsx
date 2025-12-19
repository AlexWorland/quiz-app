import { useState, useEffect } from 'react'
import { ProcessingScreen } from './ProcessingScreen'
import { AnimatedLeaderboard } from './AnimatedLeaderboard'
import { QuestionResultsChart } from './QuestionResultsChart'
import { FinalResults } from './FinalResults'
import type { LeaderboardEntry } from '@/api/endpoints'

type DisplayModeType = 'processing' | 'leaderboard' | 'question_results' | 'quiz_progress' | 'final_results'

interface DisplayModeData {
  mode: DisplayModeType
  data?: any
}

interface ProcessingStatus {
  step: 'transcribing' | 'generating' | 'ready'
  progress?: number
  message: string
}

interface DisplayModeContainerProps {
  processingStatus?: ProcessingStatus | null
  displayMode?: DisplayModeData | null
  rankings?: LeaderboardEntry[]
  previousRankings?: LeaderboardEntry[]
  questionResults?: {
    distribution: Array<{ answer: string; count: number; is_correct: boolean }>
    correctAnswer: string
    totalParticipants: number
    averageResponseTime?: number
  } | null
  finalResults?: {
    rankings: LeaderboardEntry[]
    totalQuestions: number
    eventTitle?: string
  } | null
}

export function DisplayModeContainer({
  processingStatus,
  displayMode,
  rankings = [],
  previousRankings = [],
  questionResults,
  finalResults,
}: DisplayModeContainerProps) {
  const [currentMode, setCurrentMode] = useState<DisplayModeType | null>(null)

  useEffect(() => {
    if (processingStatus) {
      setCurrentMode('processing')
    } else if (displayMode) {
      setCurrentMode(displayMode.mode)
    } else if (finalResults) {
      setCurrentMode('final_results')
    } else if (questionResults) {
      setCurrentMode('question_results')
    } else if (rankings.length > 0) {
      setCurrentMode('leaderboard')
    }
  }, [processingStatus, displayMode, rankings, questionResults, finalResults])

  if (currentMode === 'processing' && processingStatus) {
    return (
      <ProcessingScreen
        step={processingStatus.step}
        progress={processingStatus.progress}
        message={processingStatus.message}
      />
    )
  }

  if (currentMode === 'leaderboard' && rankings.length > 0) {
    return (
      <AnimatedLeaderboard
        rankings={rankings}
        previousRankings={previousRankings}
        highlightTop={3}
        showRankChanges={!!previousRankings.length}
      />
    )
  }

  if (currentMode === 'question_results' && questionResults) {
    return (
      <QuestionResultsChart
        distribution={questionResults.distribution}
        correctAnswer={questionResults.correctAnswer}
        totalParticipants={questionResults.totalParticipants}
        averageResponseTime={questionResults.averageResponseTime}
      />
    )
  }

  if (currentMode === 'final_results' && finalResults) {
    return (
      <FinalResults
        rankings={finalResults.rankings}
        totalQuestions={finalResults.totalQuestions}
        eventTitle={finalResults.eventTitle}
      />
    )
  }

  // Default: show leaderboard if available
  if (rankings.length > 0) {
    return (
      <AnimatedLeaderboard
        rankings={rankings}
        previousRankings={previousRankings}
        highlightTop={3}
        showRankChanges={!!previousRankings.length}
      />
    )
  }

  // Fallback: show processing screen
  return (
    <ProcessingScreen
      step="ready"
      progress={100}
      message="Waiting for quiz to start..."
    />
  )
}

