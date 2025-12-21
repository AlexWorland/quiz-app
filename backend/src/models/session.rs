use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Game session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Waiting,
    Active,
    Finished,
}

impl ToString for SessionStatus {
    fn to_string(&self) -> String {
        match self {
            SessionStatus::Waiting => "waiting".to_string(),
            SessionStatus::Active => "active".to_string(),
            SessionStatus::Finished => "finished".to_string(),
        }
    }
}

impl From<String> for SessionStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "active" => SessionStatus::Active,
            "finished" => SessionStatus::Finished,
            _ => SessionStatus::Waiting,
        }
    }
}

/// Game session database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct GameSession {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub join_code: String,
    pub status: String,
    pub current_question_index: Option<i32>,
    pub question_started_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Session participant
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionParticipant {
    pub id: Uuid,
    pub session_id: Uuid,
    pub user_id: Uuid,
    pub total_score: Option<i32>,
    pub joined_at: Option<DateTime<Utc>>,
}

/// Question response from a participant
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Response {
    pub id: Uuid,
    pub session_id: Uuid,
    pub question_id: Uuid,
    pub user_id: Uuid,
    pub selected_answer: String,
    pub is_correct: bool,
    pub response_time_ms: i32,
    pub points_earned: i32,
    pub created_at: Option<DateTime<Utc>>,
}

/// Create session request
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateSessionRequest {
    pub quiz_id: Uuid,
}

/// Session response with details
#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub join_code: String,
    pub status: String,
    pub current_question_index: i32,
    pub participants: Vec<ParticipantInfo>,
}

/// Participant info for session response
#[derive(Debug, Clone, Serialize)]
pub struct ParticipantInfo {
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub total_score: i32,
}

/// Join session request
#[derive(Debug, Deserialize)]
pub struct JoinSessionRequest {
    // User is identified by auth token
}

/// Submit answer request
#[derive(Debug, Deserialize, Serialize)]
pub struct SubmitAnswerRequest {
    pub question_id: Uuid,
    pub selected_answer: String,
    pub response_time_ms: i32,
}

/// Leaderboard entry
#[derive(Debug, Clone, Serialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub total_score: i32,
}

/// Answer distribution for results
#[derive(Debug, Clone, Serialize)]
pub struct AnswerDistribution {
    pub answer: String,
    pub count: i32,
    pub is_correct: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use chrono::Utc;

    #[test]
    fn test_session_status_to_string() {
        assert_eq!(SessionStatus::Waiting.to_string(), "waiting");
        assert_eq!(SessionStatus::Active.to_string(), "active");
        assert_eq!(SessionStatus::Finished.to_string(), "finished");
    }

    #[test]
    fn test_session_status_from_string() {
        assert_eq!(SessionStatus::from("waiting".to_string()), SessionStatus::Waiting);
        assert_eq!(SessionStatus::from("active".to_string()), SessionStatus::Active);
        assert_eq!(SessionStatus::from("finished".to_string()), SessionStatus::Finished);
        assert_eq!(SessionStatus::from("unknown".to_string()), SessionStatus::Waiting); // defaults to Waiting
        assert_eq!(SessionStatus::from("".to_string()), SessionStatus::Waiting);
    }

    #[test]
    fn test_session_status_round_trip() {
        assert_eq!(SessionStatus::from(SessionStatus::Waiting.to_string()), SessionStatus::Waiting);
        assert_eq!(SessionStatus::from(SessionStatus::Active.to_string()), SessionStatus::Active);
        assert_eq!(SessionStatus::from(SessionStatus::Finished.to_string()), SessionStatus::Finished);
    }

    #[test]
    fn test_game_session_structure() {
        let session = GameSession {
            id: Uuid::new_v4(),
            quiz_id: Uuid::new_v4(),
            join_code: "ABC123".to_string(),
            status: "waiting".to_string(),
            current_question_index: Some(0),
            question_started_at: Some(Utc::now()),
            created_at: Some(Utc::now()),
        };

        assert_eq!(session.join_code, "ABC123");
        assert_eq!(session.status, "waiting");
        assert_eq!(session.current_question_index, Some(0));
    }

    #[test]
    fn test_session_participant_structure() {
        let participant = SessionParticipant {
            id: Uuid::new_v4(),
            session_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            total_score: Some(500),
            joined_at: Some(Utc::now()),
        };

        assert_eq!(participant.total_score, Some(500));
        assert!(participant.joined_at.is_some());
    }

    #[test]
    fn test_response_structure() {
        let response = Response {
            id: Uuid::new_v4(),
            session_id: Uuid::new_v4(),
            question_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            selected_answer: "Paris".to_string(),
            is_correct: true,
            response_time_ms: 5000,
            points_earned: 800,
            created_at: Some(Utc::now()),
        };

        assert_eq!(response.selected_answer, "Paris");
        assert_eq!(response.is_correct, true);
        assert_eq!(response.response_time_ms, 5000);
        assert_eq!(response.points_earned, 800);
    }

    #[test]
    fn test_create_session_request() {
        let quiz_id = Uuid::new_v4();
        let request = CreateSessionRequest { quiz_id };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: CreateSessionRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.quiz_id, quiz_id);
    }

    #[test]
    fn test_session_response_with_participants() {
        let participants = vec![
            ParticipantInfo {
                user_id: Uuid::new_v4(),
                username: "user1".to_string(),
                avatar_url: Some("https://example.com/avatar1.jpg".to_string()),
                total_score: 500,
            },
            ParticipantInfo {
                user_id: Uuid::new_v4(),
                username: "user2".to_string(),
                avatar_url: None,
                total_score: 300,
            },
        ];

        let response = SessionResponse {
            id: Uuid::new_v4(),
            quiz_id: Uuid::new_v4(),
            join_code: "XYZ789".to_string(),
            status: "active".to_string(),
            current_question_index: 2,
            participants: participants.clone(),
        };

        assert_eq!(response.join_code, "XYZ789");
        assert_eq!(response.status, "active");
        assert_eq!(response.current_question_index, 2);
        assert_eq!(response.participants.len(), 2);
        assert_eq!(response.participants[0].username, "user1");
        assert_eq!(response.participants[1].total_score, 300);
    }

    #[test]
    fn test_submit_answer_request() {
        let request = SubmitAnswerRequest {
            question_id: Uuid::new_v4(),
            selected_answer: "Blue".to_string(),
            response_time_ms: 3000,
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: SubmitAnswerRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.selected_answer, "Blue");
        assert_eq!(deserialized.response_time_ms, 3000);
    }

    #[test]
    fn test_leaderboard_entry_comparison() {
        let mut entries = vec![
            LeaderboardEntry {
                rank: 2,
                user_id: Uuid::new_v4(),
                username: "user2".to_string(),
                avatar_url: None,
                total_score: 300,
            },
            LeaderboardEntry {
                rank: 1,
                user_id: Uuid::new_v4(),
                username: "user1".to_string(),
                avatar_url: Some("https://example.com/avatar.jpg".to_string()),
                total_score: 500,
            },
        ];

        entries.sort_by_key(|e| e.rank);

        assert_eq!(entries[0].rank, 1);
        assert_eq!(entries[0].username, "user1");
        assert_eq!(entries[0].total_score, 500);
        assert_eq!(entries[1].rank, 2);
        assert_eq!(entries[1].username, "user2");
        assert_eq!(entries[1].total_score, 300);
    }

    #[test]
    fn test_answer_distribution() {
        let distributions = vec![
            AnswerDistribution {
                answer: "Paris".to_string(),
                count: 5,
                is_correct: true,
            },
            AnswerDistribution {
                answer: "London".to_string(),
                count: 2,
                is_correct: false,
            },
        ];

        assert_eq!(distributions[0].answer, "Paris");
        assert_eq!(distributions[0].count, 5);
        assert_eq!(distributions[0].is_correct, true);
        assert_eq!(distributions[1].answer, "London");
        assert_eq!(distributions[1].count, 2);
        assert_eq!(distributions[1].is_correct, false);
    }

    #[test]
    fn test_participant_info_creation() {
        let info = ParticipantInfo {
            user_id: Uuid::new_v4(),
            username: "participant".to_string(),
            avatar_url: Some("https://example.com/avatar.jpg".to_string()),
            total_score: 750,
        };

        assert_eq!(info.username, "participant");
        assert_eq!(info.total_score, 750);
        assert!(info.avatar_url.is_some());
    }
}