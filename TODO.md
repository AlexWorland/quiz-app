# Quiz App - Feature TODOs

## Display Mode Feature

### Overview
Add a dedicated "Display Mode" for presenting quiz results, leaderboards, and question statistics to participants and audience.

### Requirements

#### Loading/Processing Screen
- When presenter clicks "Done" (stops recording), show a processing/loading screen
- Display a throbber/spinner animation during processing
- Show current processing step underneath the spinner:
  - "Processing final transcription..."
  - "Generating questions from transcript..."
  - "Preparing quiz..."
  - "Ready to start quiz"
- Automatically transition to quiz when processing complete

#### Display Mode Views
1. **Leaderboard View**
   - Real-time leaderboard with animations
   - Show rank changes (up/down arrows)
   - Segment leaderboard vs Event leaderboard toggle
   - Highlight top 3 with special styling

2. **Question Results View**
   - Show answer distribution as bar chart or pie chart
   - Highlight correct answer
   - Show percentage of participants who got it right
   - Display response time statistics

3. **Quiz Progress View**
   - Current question number / total questions
   - Timer display for current question
   - Number of participants who have answered

4. **Final Results View**
   - Overall event statistics
   - Winner announcement with celebration animation
   - Summary of all questions and correct answers
   - Export results option

### Technical Considerations
- Use WebSocket for real-time updates
- Consider full-screen/presentation mode
- Mobile-responsive design for audience viewing on phones
- Accessibility: ensure screen reader compatibility

### Priority
Medium - Enhances presentation experience significantly
