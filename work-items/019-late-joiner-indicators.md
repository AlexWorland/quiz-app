# TICKET-019: Late Joiner Indicators - Leaderboard Marking

**Priority:** 🟡 MEDIUM
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** TICKET-016

---

## Description

Mark participants who joined after a segment's quiz started on the leaderboard with visual indicators explaining score differences. This helps participants understand why some users have lower scores and provides context for fair competition.

When a participant joins a segment after the quiz has started, they miss questions and thus have fewer opportunities to score points. This ticket adds visual indicators to clearly mark these late joiners on both segment and event leaderboards.

## Files to Modify

### 1. `backend/migrations/<timestamp>_add_segment_quiz_start_time.up.sql`

```sql
-- Add quiz_start_time column to track when the quiz phase begins
ALTER TABLE segments
ADD COLUMN quiz_start_time TIMESTAMPTZ;

-- Add joined_at column to segment_scores to track when participant joined this segment
ALTER TABLE segment_scores
ADD COLUMN joined_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for efficient late joiner queries
CREATE INDEX idx_segment_scores_joined_at ON segment_scores(joined_at);
```

### 2. `backend/migrations/<timestamp>_add_segment_quiz_start_time.down.sql`

```sql
-- Revert changes
DROP INDEX IF EXISTS idx_segment_scores_joined_at;

ALTER TABLE segment_scores
DROP COLUMN joined_at;

ALTER TABLE segments
DROP COLUMN quiz_start_time;
```

### 3. `backend/src/ws/handler.rs`

Add logic to set quiz_start_time when quiz begins and calculate late joiner status:

```rust
// In handle_start_game function (around line 250-300)
GameMessage::StartGame => {
    // ... existing validation code ...

    // Set quiz_start_time for the segment
    if let Some(segment_id) = game_state.current_segment_id {
        let _ = sqlx::query(
            "UPDATE segments SET quiz_start_time = NOW() WHERE id = $1"
        )
        .bind(segment_id)
        .execute(&state.db)
        .await;
    }

    // ... rest of existing start_game logic ...
}

// In handle_answer function, update segment_scores insert with joined_at
// (around line 780-790)
let _ = sqlx::query(
    r#"
    INSERT INTO segment_scores (segment_id, user_id, score, questions_answered, questions_correct, joined_at)
    VALUES ($1, $2, $3, 1, $4, NOW())
    ON CONFLICT (segment_id, user_id)
    DO UPDATE SET
        score = segment_scores.score + $3,
        questions_answered = segment_scores.questions_answered + 1,
        questions_correct = segment_scores.questions_correct + $4
        -- joined_at is NOT updated on conflict, preserving original join time
    "#
)
.bind(segment_id)
.bind(uid)
.bind(points)
.bind(if is_correct { 1 } else { 0 })
.execute(&state.db)
.await;

// Update leaderboard generation to include late joiner flag
// Modify get_segment_leaderboard and get_event_leaderboard queries
async fn get_segment_leaderboard(
    db: &sqlx::PgPool,
    segment_id: Uuid,
) -> Vec<LeaderboardEntryWithMeta> {
    sqlx::query_as::<_, LeaderboardEntryWithMeta>(
        r#"
        SELECT
            ROW_NUMBER() OVER (ORDER BY ss.score DESC, u.username ASC) as rank,
            u.id as user_id,
            u.username,
            u.avatar_url,
            ss.score,
            ss.joined_at,
            s.quiz_start_time,
            CASE
                WHEN s.quiz_start_time IS NOT NULL
                    AND ss.joined_at > s.quiz_start_time
                THEN true
                ELSE false
            END as is_late_joiner
        FROM segment_scores ss
        INNER JOIN users u ON ss.user_id = u.id
        INNER JOIN segments s ON ss.segment_id = s.id
        WHERE ss.segment_id = $1
        ORDER BY ss.score DESC, u.username ASC
        "#
    )
    .bind(segment_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

// Similar update for get_event_leaderboard
// Aggregate late joiner status across all segments
async fn get_event_leaderboard(
    db: &sqlx::PgPool,
    event_id: Uuid,
) -> Vec<LeaderboardEntryWithMeta> {
    sqlx::query_as::<_, LeaderboardEntryWithMeta>(
        r#"
        SELECT
            ROW_NUMBER() OVER (ORDER BY ep.total_score DESC, u.username ASC) as rank,
            u.id as user_id,
            u.username,
            u.avatar_url,
            ep.total_score as score,
            MIN(ss.joined_at) as joined_at,
            NULL::TIMESTAMPTZ as quiz_start_time,
            BOOL_OR(
                CASE
                    WHEN s.quiz_start_time IS NOT NULL
                        AND ss.joined_at > s.quiz_start_time
                    THEN true
                    ELSE false
                END
            ) as is_late_joiner
        FROM event_participants ep
        INNER JOIN users u ON ep.user_id = u.id
        LEFT JOIN segment_scores ss ON ep.user_id = ss.user_id
        LEFT JOIN segments s ON ss.segment_id = s.id AND s.event_id = ep.event_id
        WHERE ep.event_id = $1
        GROUP BY ep.id, u.id, u.username, u.avatar_url, ep.total_score
        ORDER BY ep.total_score DESC, u.username ASC
        "#
    )
    .bind(event_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}
```

### 4. `backend/src/ws/messages.rs`

Update LeaderboardEntry to include late joiner metadata:

```rust
/// Leaderboard entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub score: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_late_joiner: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub joined_at: Option<String>, // ISO 8601 timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quiz_start_time: Option<String>, // ISO 8601 timestamp
}

// Internal struct for DB queries with metadata
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LeaderboardEntryWithMeta {
    pub rank: i64,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub score: i32,
    pub joined_at: Option<chrono::DateTime<chrono::Utc>>,
    pub quiz_start_time: Option<chrono::DateTime<chrono::Utc>>,
    pub is_late_joiner: bool,
}

impl From<LeaderboardEntryWithMeta> for LeaderboardEntry {
    fn from(meta: LeaderboardEntryWithMeta) -> Self {
        Self {
            rank: meta.rank as i32,
            user_id: meta.user_id,
            username: meta.username,
            avatar_url: meta.avatar_url,
            score: meta.score,
            is_late_joiner: Some(meta.is_late_joiner),
            joined_at: meta.joined_at.map(|dt| dt.to_rfc3339()),
            quiz_start_time: meta.quiz_start_time.map(|dt| dt.to_rfc3339()),
        }
    }
}
```

### 5. `frontend/src/api/endpoints.ts`

Update LeaderboardEntry interface:

```typescript
export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url?: string
  score: number
  is_late_joiner?: boolean
  joined_at?: string // ISO 8601 timestamp
  quiz_start_time?: string // ISO 8601 timestamp
}
```

### 6. `frontend/src/hooks/useEventWebSocket.ts`

Update local LeaderboardEntry interface to match:

```typescript
export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url?: string
  score: number
  is_late_joiner?: boolean
  joined_at?: string
  quiz_start_time?: string
}
```

### 7. `frontend/src/components/leaderboard/SegmentLeaderboard.tsx`

Add visual indicators for late joiners:

```typescript
import { Trophy, Medal, Award, Clock } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'

interface SegmentLeaderboardProps {
  rankings: LeaderboardEntry[]
}

export function SegmentLeaderboard({ rankings }: SegmentLeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return <span className="text-gray-400 font-semibold">{rank}</span>
    }
  }

  return (
    <div className="bg-dark-900 rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Segment Leaderboard</h2>
      <div className="space-y-3">
        {rankings.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No scores yet</p>
        ) : (
          rankings.map((entry) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                entry.is_late_joiner
                  ? 'bg-dark-800/60 border border-yellow-500/30'
                  : 'bg-dark-800 hover:bg-dark-700'
              }`}
            >
              <div className="w-12 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="flex-1 flex items-center gap-3">
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.username}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-cyan/20 flex items-center justify-center">
                    <span className="text-accent-cyan font-semibold">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${entry.is_late_joiner ? 'text-gray-300' : 'text-white'}`}>
                      {entry.username}
                    </span>
                    {entry.is_late_joiner && (
                      <div className="group relative">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs text-yellow-300">Joined Late</span>
                        </div>
                        <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-dark-700 border border-yellow-500/30 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <p className="text-xs text-gray-300">
                            This participant joined after the quiz started and missed some questions.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xl font-bold ${entry.is_late_joiner ? 'text-gray-400' : 'text-accent-cyan'}`}>
                  {entry.score}
                </div>
                <div className="text-xs text-gray-400">points</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

### 8. `frontend/src/components/leaderboard/MasterLeaderboard.tsx`

Apply similar updates for event-level leaderboard:

```typescript
import { Trophy, Medal, Award, Clock } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'

interface MasterLeaderboardProps {
  rankings: LeaderboardEntry[]
  title?: string
}

export function MasterLeaderboard({ rankings, title = 'Event Leaderboard' }: MasterLeaderboardProps) {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-8 h-8 text-yellow-400" />
      case 2:
        return <Medal className="w-8 h-8 text-gray-300" />
      case 3:
        return <Award className="w-8 h-8 text-amber-600" />
      default:
        return <span className="text-gray-400 font-bold text-xl">{rank}</span>
    }
  }

  return (
    <div className="bg-dark-900 rounded-lg p-8">
      <h2 className="text-3xl font-bold text-white mb-8 text-center">{title}</h2>
      <div className="space-y-4">
        {rankings.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No scores yet</p>
        ) : (
          rankings.map((entry) => (
            <div
              key={entry.user_id}
              className={`flex items-center gap-6 p-6 rounded-lg transition-all ${
                entry.is_late_joiner
                  ? 'bg-dark-800/50 border border-yellow-500/20'
                  : 'bg-dark-800 hover:bg-dark-700 hover:scale-[1.02]'
              }`}
            >
              <div className="w-16 flex items-center justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="flex-1 flex items-center gap-4">
                {entry.avatar_url ? (
                  <img
                    src={entry.avatar_url}
                    alt={entry.username}
                    className="w-14 h-14 rounded-full"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-accent-cyan/20 flex items-center justify-center">
                    <span className="text-accent-cyan font-bold text-xl">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold ${entry.is_late_joiner ? 'text-gray-300' : 'text-white'}`}>
                      {entry.username}
                    </span>
                    {entry.is_late_joiner && (
                      <div className="group relative">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/40 rounded-full">
                          <Clock className="w-4 h-4 text-yellow-400" />
                          <span className="text-sm text-yellow-300">Joined Late</span>
                        </div>
                        <div className="absolute left-0 top-full mt-2 w-72 p-4 bg-dark-700 border border-yellow-500/30 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          <p className="text-sm text-gray-300">
                            This participant joined late during one or more segments and missed some questions,
                            resulting in fewer scoring opportunities.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${entry.is_late_joiner ? 'text-gray-400' : 'text-accent-cyan'}`}>
                  {entry.score}
                </div>
                <div className="text-sm text-gray-400">points</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

### 9. `frontend/src/components/quiz/QuizResults.tsx`

Update local interface to match new LeaderboardEntry:

```typescript
export interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url?: string
  score: number
  is_late_joiner?: boolean
  joined_at?: string
  quiz_start_time?: string
}

// Apply same late joiner visual treatment in the results display
```

## Implementation Steps

1. **Create database migration**:
   ```bash
   cd backend
   sqlx migrate add -r add_segment_quiz_start_time
   ```

2. **Write migration SQL** (up and down files as shown above)

3. **Run migration**:
   ```bash
   cargo sqlx migrate run
   ```

4. **Update backend message types** in `ws/messages.rs`:
   - Add fields to `LeaderboardEntry`
   - Create `LeaderboardEntryWithMeta` struct
   - Implement `From` trait

5. **Update backend WebSocket handler** in `ws/handler.rs`:
   - Set `quiz_start_time` in `StartGame` handler
   - Update `segment_scores` insert to capture `joined_at`
   - Modify leaderboard query functions to calculate `is_late_joiner`
   - Convert DB results to message types with metadata

6. **Update frontend TypeScript types**:
   - Modify `LeaderboardEntry` in `api/endpoints.ts`
   - Update hook interfaces in `useEventWebSocket.ts`
   - Update component interfaces in `QuizResults.tsx`

7. **Update leaderboard UI components**:
   - Add late joiner badge with clock icon
   - Apply visual differentiation (reduced opacity, border)
   - Add hover tooltip with explanation
   - Adjust score text color for late joiners

8. **Test the implementation**:
   - Start a segment and quiz
   - Join with one participant
   - Start quiz
   - Join with another participant (late joiner)
   - Both answer questions
   - Verify late joiner is marked on leaderboard
   - Check tooltip appears on hover

## Acceptance Criteria

- [ ] Migration adds `quiz_start_time` to segments table
- [ ] Migration adds `joined_at` to segment_scores table
- [ ] Index created for efficient queries
- [ ] Backend sets `quiz_start_time` when quiz starts
- [ ] Backend captures `joined_at` when participant first answers
- [ ] Leaderboard queries calculate `is_late_joiner` flag correctly
- [ ] Segment leaderboard includes late joiner metadata
- [ ] Event leaderboard aggregates late joiner status across segments
- [ ] Frontend displays "Joined Late" badge with clock icon
- [ ] Late joiners have visual differentiation (border, reduced opacity)
- [ ] Tooltip explains why participant has fewer points
- [ ] Score text color is muted for late joiners
- [ ] Both SegmentLeaderboard and MasterLeaderboard updated
- [ ] QuizResults component updated with new interface
- [ ] No TypeScript compilation errors
- [ ] No Rust compilation errors or warnings

## Testing

### Manual Testing

1. **Setup**: Create event with 2 segments, each with 3 questions
2. **Segment 1**:
   - Participant A joins and connects
   - Start quiz
   - Participant A answers all 3 questions
   - Participant B joins late (after question 1)
   - Participant B answers questions 2 and 3
   - Check segment leaderboard: Participant B should have "Joined Late" badge
3. **Segment 2**:
   - Both participants present from start
   - Start quiz
   - Both answer all questions
   - Check segment leaderboard: Neither should have late badge
4. **Event Complete**:
   - Check event leaderboard
   - Participant B should have "Joined Late" badge (joined late in Segment 1)
   - Hover over badge to see tooltip
5. **Visual Verification**:
   - Late joiner has yellow border
   - Late joiner has clock icon
   - Score is grayed out
   - Tooltip appears on hover with explanation

### Database Verification

```sql
-- Check quiz_start_time is set
SELECT id, title, quiz_start_time FROM segments WHERE quiz_start_time IS NOT NULL;

-- Check joined_at is captured
SELECT segment_id, user_id, joined_at, score FROM segment_scores;

-- Check late joiner calculation
SELECT
    u.username,
    ss.score,
    ss.joined_at,
    s.quiz_start_time,
    ss.joined_at > s.quiz_start_time as is_late_joiner
FROM segment_scores ss
INNER JOIN users u ON ss.user_id = u.id
INNER JOIN segments s ON ss.segment_id = s.id;
```

### Unit Tests

```bash
cd backend
cargo test late_joiner_tracking

cd frontend
npm test -- QuizResults
npm test -- SegmentLeaderboard
npm test -- MasterLeaderboard
```

## Dependencies

- **TICKET-016**: Segment join time tracking (prerequisite for this ticket)
  - Must have participant join tracking infrastructure
  - Requires segment_scores table and participation tracking

## Related Tickets

- TICKET-001: Device/Session Identity - Database (participant tracking foundation)
- TICKET-016: Segment join time tracking (direct dependency)
- TICKET-020: Fair scoring adjustments for late joiners (future enhancement)

## Notes

### Design Decisions

- **Late joiner threshold**: Joining after `quiz_start_time` (i.e., after StartGame message)
  - Alternative considered: after first question answered, but quiz start is clearer
- **Visual treatment**: Yellow border + badge instead of red/negative styling
  - Purpose is informational, not punitive
- **Tooltip on hover**: Provides context without cluttering UI
- **Event leaderboard**: Uses `BOOL_OR` to mark if user joined late in ANY segment
  - Alternative: show per-segment breakdown, but that's future enhancement

### Edge Cases

- Participant joins before quiz starts: `is_late_joiner = false`
- Participant joins during question 1: `is_late_joiner = true`
- Multiple segments: Late joiner flag set if late in ANY segment
- No quiz_start_time set: `is_late_joiner = false` (defensive)

### Future Enhancements

- Show exactly how many questions were missed
- Display join time relative to quiz start
- Add "fair scoring" mode that normalizes scores (TICKET-020)
- Segment breakdown in event leaderboard showing which segments user joined late

### Performance Considerations

- Index on `segment_scores.joined_at` enables efficient queries
- `BOOL_OR` aggregate minimal overhead for event leaderboard
- Tooltip rendering only on hover (no performance impact)

### Accessibility

- Clock icon has proper alt text via lucide-react
- Color is not the only indicator (border + badge + icon)
- Tooltip accessible via hover and focus
- Contrast ratios meet WCAG AA standards (yellow on dark background)
