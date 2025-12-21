use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Event database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Event {
    pub id: Uuid,
    pub host_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub join_code: String,
    pub mode: String, // "listen_only" or "normal"
    pub status: String, // "waiting", "active", "finished"
    pub num_fake_answers: i32,
    pub time_per_question: i32,
    pub question_gen_interval_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
}

/// Segment database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Segment {
    pub id: Uuid,
    pub event_id: Uuid,
    pub presenter_name: String,
    pub presenter_user_id: Option<Uuid>,
    pub title: Option<String>,
    pub order_index: i32,
    pub status: String, // "pending", "recording", "recording_paused", "quiz_ready", "quizzing", "completed"
    pub recording_started_at: Option<DateTime<Utc>>,
    pub recording_ended_at: Option<DateTime<Utc>>,
    pub quiz_started_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Event response (public view)
#[derive(Debug, Clone, Serialize)]
pub struct EventResponse {
    pub id: Uuid,
    pub host_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub join_code: String,
    pub mode: String,
    pub status: String,
    pub num_fake_answers: i32,
    pub time_per_question: i32,
    pub question_gen_interval_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
}

impl From<Event> for EventResponse {
    fn from(event: Event) -> Self {
        Self {
            id: event.id,
            host_id: event.host_id,
            title: event.title,
            description: event.description,
            join_code: event.join_code,
            mode: event.mode,
            status: event.status,
            num_fake_answers: event.num_fake_answers,
            time_per_question: event.time_per_question,
            question_gen_interval_seconds: event.question_gen_interval_seconds,
            created_at: event.created_at,
        }
    }
}

/// Segment response
#[derive(Debug, Clone, Serialize)]
pub struct SegmentResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub presenter_name: String,
    pub presenter_user_id: Option<Uuid>,
    pub title: Option<String>,
    pub order_index: i32,
    pub status: String,
    pub recording_started_at: Option<DateTime<Utc>>,
    pub recording_ended_at: Option<DateTime<Utc>>,
    pub quiz_started_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<Segment> for SegmentResponse {
    fn from(segment: Segment) -> Self {
        Self {
            id: segment.id,
            event_id: segment.event_id,
            presenter_name: segment.presenter_name,
            presenter_user_id: segment.presenter_user_id,
            title: segment.title,
            order_index: segment.order_index,
            status: segment.status,
            recording_started_at: segment.recording_started_at,
            recording_ended_at: segment.recording_ended_at,
            quiz_started_at: segment.quiz_started_at,
            created_at: segment.created_at,
        }
    }
}

/// Create event request
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub mode: Option<String>, // defaults to "listen_only"
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
    pub question_gen_interval_seconds: Option<i32>,
}

/// Update event request
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateEventRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
    pub question_gen_interval_seconds: Option<i32>,
}

/// Create segment request
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateSegmentRequest {
    pub presenter_name: String,
    pub presenter_user_id: Option<Uuid>,
    pub title: Option<String>,
}

/// Update segment request
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateSegmentRequest {
    pub presenter_name: Option<String>,
    pub title: Option<String>,
    pub status: Option<String>,
}

/// Event participant database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct EventParticipant {
    pub id: Uuid,
    pub event_id: Uuid,
    pub user_id: Uuid,
    pub total_score: i32,
    pub joined_at: DateTime<Utc>,
    pub device_id: Uuid,
    pub session_token: Option<String>,
    pub join_timestamp: Option<DateTime<Utc>>,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub join_status: String, // NEW: 'joined', 'waiting_for_segment', 'active_in_quiz', 'segment_complete'
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use chrono::Utc;

    #[test]
    fn test_event_to_event_response_conversion() {
        let event = Event {
            id: Uuid::new_v4(),
            host_id: Uuid::new_v4(),
            title: "Test Event".to_string(),
            description: Some("A test event".to_string()),
            join_code: "EVENT123".to_string(),
            mode: "normal".to_string(),
            status: "active".to_string(),
            num_fake_answers: 3,
            time_per_question: 45,
            question_gen_interval_seconds: Some(30),
            created_at: Utc::now(),
        };

        let response: EventResponse = event.clone().into();

        assert_eq!(response.id, event.id);
        assert_eq!(response.host_id, event.host_id);
        assert_eq!(response.title, event.title);
        assert_eq!(response.description, event.description);
        assert_eq!(response.join_code, event.join_code);
        assert_eq!(response.mode, event.mode);
        assert_eq!(response.status, event.status);
        assert_eq!(response.num_fake_answers, event.num_fake_answers);
        assert_eq!(response.time_per_question, event.time_per_question);
        assert_eq!(response.question_gen_interval_seconds, event.question_gen_interval_seconds);
        assert_eq!(response.created_at, event.created_at);
    }

    #[test]
    fn test_segment_to_segment_response_conversion() {
        let segment = Segment {
            id: Uuid::new_v4(),
            event_id: Uuid::new_v4(),
            presenter_name: "John Doe".to_string(),
            presenter_user_id: Some(Uuid::new_v4()),
            title: Some("Introduction".to_string()),
            order_index: 1,
            status: "recording".to_string(),
            recording_started_at: Some(Utc::now()),
            recording_ended_at: None,
            quiz_started_at: None,
            created_at: Utc::now(),
        };

        let response: SegmentResponse = segment.clone().into();

        assert_eq!(response.id, segment.id);
        assert_eq!(response.event_id, segment.event_id);
        assert_eq!(response.presenter_name, segment.presenter_name);
        assert_eq!(response.presenter_user_id, segment.presenter_user_id);
        assert_eq!(response.title, segment.title);
        assert_eq!(response.order_index, segment.order_index);
        assert_eq!(response.status, segment.status);
        assert_eq!(response.recording_started_at, segment.recording_started_at);
        assert_eq!(response.recording_ended_at, segment.recording_ended_at);
        assert_eq!(response.quiz_started_at, segment.quiz_started_at);
        assert_eq!(response.created_at, segment.created_at);
    }

    #[test]
    fn test_create_event_request_validation() {
        let request = CreateEventRequest {
            title: "Valid Event Title".to_string(),
            description: Some("Description".to_string()),
            mode: Some("normal".to_string()),
            num_fake_answers: Some(2),
            time_per_question: Some(60),
            question_gen_interval_seconds: Some(45),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: CreateEventRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, "Valid Event Title");
        assert_eq!(deserialized.mode, Some("normal".to_string()));
        assert_eq!(deserialized.num_fake_answers, Some(2));
    }

    #[test]
    fn test_create_event_request_defaults() {
        let request = CreateEventRequest {
            title: "Minimal Event".to_string(),
            description: None,
            mode: None,
            num_fake_answers: None,
            time_per_question: None,
            question_gen_interval_seconds: None,
        };

        assert_eq!(request.title, "Minimal Event");
        assert_eq!(request.mode, None);
        assert_eq!(request.num_fake_answers, None);
    }

    #[test]
    fn test_update_event_request_partial() {
        let request = UpdateEventRequest {
            title: Some("Updated Title".to_string()),
            description: None,
            status: Some("finished".to_string()),
            num_fake_answers: Some(4),
            time_per_question: None,
            question_gen_interval_seconds: Some(60),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateEventRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, Some("Updated Title".to_string()));
        assert_eq!(deserialized.status, Some("finished".to_string()));
        assert_eq!(deserialized.num_fake_answers, Some(4));
    }

    #[test]
    fn test_create_segment_request() {
        let presenter_user_id = Uuid::new_v4();
        let request = CreateSegmentRequest {
            presenter_name: "Jane Smith".to_string(),
            presenter_user_id: Some(presenter_user_id),
            title: Some("Welcome Session".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: CreateSegmentRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.presenter_name, "Jane Smith");
        assert_eq!(deserialized.presenter_user_id, Some(presenter_user_id));
        assert_eq!(deserialized.title, Some("Welcome Session".to_string()));
    }

    #[test]
    fn test_update_segment_request_partial() {
        let request = UpdateSegmentRequest {
            presenter_name: Some("Updated Presenter".to_string()),
            title: None,
            status: Some("completed".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateSegmentRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.presenter_name, Some("Updated Presenter".to_string()));
        assert_eq!(deserialized.title, None);
        assert_eq!(deserialized.status, Some("completed".to_string()));
    }

    #[test]
    fn test_event_participant_structure() {
        let participant = EventParticipant {
            id: Uuid::new_v4(),
            event_id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            total_score: 1200,
            joined_at: Utc::now(),
            device_id: Uuid::new_v4(),
            session_token: Some("session-token-123".to_string()),
            join_timestamp: Some(Utc::now()),
            last_heartbeat: Some(Utc::now()),
            join_status: "active_in_quiz".to_string(),
        };

        assert_eq!(participant.total_score, 1200);
        assert_eq!(participant.join_status, "active_in_quiz");
        assert!(participant.session_token.is_some());
        assert!(participant.join_timestamp.is_some());
        assert!(participant.last_heartbeat.is_some());
    }

    #[test]
    fn test_segment_status_transitions() {
        // Test various segment statuses
        let statuses = vec![
            "pending",
            "recording",
            "recording_paused",
            "quiz_ready",
            "quizzing",
            "completed"
        ];

        for status in statuses {
            let segment = Segment {
                id: Uuid::new_v4(),
                event_id: Uuid::new_v4(),
                presenter_name: "Test Presenter".to_string(),
                presenter_user_id: None,
                title: None,
                order_index: 0,
                status: status.to_string(),
                recording_started_at: None,
                recording_ended_at: None,
                quiz_started_at: None,
                created_at: Utc::now(),
            };

            assert_eq!(segment.status, status);
        }
    }

    #[test]
    fn test_event_mode_validation() {
        // Test valid event modes
        let valid_modes = vec!["listen_only", "normal"];

        for mode in valid_modes {
            let event = Event {
                id: Uuid::new_v4(),
                host_id: Uuid::new_v4(),
                title: "Test Event".to_string(),
                description: None,
                join_code: "CODE123".to_string(),
                mode: mode.to_string(),
                status: "waiting".to_string(),
                num_fake_answers: 2,
                time_per_question: 30,
                question_gen_interval_seconds: None,
                created_at: Utc::now(),
            };

            assert_eq!(event.mode, mode);
        }
    }

    #[test]
    fn test_event_join_code_uniqueness() {
        let event1 = Event {
            id: Uuid::new_v4(),
            host_id: Uuid::new_v4(),
            title: "Event 1".to_string(),
            description: None,
            join_code: "UNIQUE123".to_string(),
            mode: "normal".to_string(),
            status: "waiting".to_string(),
            num_fake_answers: 2,
            time_per_question: 30,
            question_gen_interval_seconds: None,
            created_at: Utc::now(),
        };

        let event2 = Event {
            id: Uuid::new_v4(),
            host_id: Uuid::new_v4(),
            title: "Event 2".to_string(),
            description: None,
            join_code: "DIFFERENT456".to_string(),
            mode: "normal".to_string(),
            status: "waiting".to_string(),
            num_fake_answers: 2,
            time_per_question: 30,
            question_gen_interval_seconds: None,
            created_at: Utc::now(),
        };

        assert_ne!(event1.join_code, event2.join_code);
        assert_eq!(event1.join_code, "UNIQUE123");
        assert_eq!(event2.join_code, "DIFFERENT456");
    }

    #[test]
    fn test_segment_ordering() {
        let mut segments = vec![
            Segment {
                id: Uuid::new_v4(),
                event_id: Uuid::new_v4(),
                presenter_name: "Presenter 2".to_string(),
                presenter_user_id: None,
                title: None,
                order_index: 1,
                status: "pending".to_string(),
                recording_started_at: None,
                recording_ended_at: None,
                quiz_started_at: None,
                created_at: Utc::now(),
            },
            Segment {
                id: Uuid::new_v4(),
                event_id: Uuid::new_v4(),
                presenter_name: "Presenter 1".to_string(),
                presenter_user_id: None,
                title: None,
                order_index: 0,
                status: "pending".to_string(),
                recording_started_at: None,
                recording_ended_at: None,
                quiz_started_at: None,
                created_at: Utc::now(),
            },
        ];

        segments.sort_by_key(|s| s.order_index);

        assert_eq!(segments[0].order_index, 0);
        assert_eq!(segments[0].presenter_name, "Presenter 1");
        assert_eq!(segments[1].order_index, 1);
        assert_eq!(segments[1].presenter_name, "Presenter 2");
    }
}