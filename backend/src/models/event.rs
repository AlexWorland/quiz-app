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
    pub created_at: DateTime<Utc>,
}

/// Segment database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Segment {
    pub id: Uuid,
    pub event_id: Uuid,
    pub presenter_name: String,
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
#[derive(Debug, Deserialize)]
pub struct CreateEventRequest {
    pub title: String,
    pub description: Option<String>,
    pub mode: Option<String>, // defaults to "listen_only"
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
}

/// Update event request
#[derive(Debug, Deserialize)]
pub struct UpdateEventRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
}

/// Create segment request
#[derive(Debug, Deserialize)]
pub struct CreateSegmentRequest {
    pub presenter_name: String,
    pub title: Option<String>,
}

/// Update segment request
#[derive(Debug, Deserialize)]
pub struct UpdateSegmentRequest {
    pub presenter_name: Option<String>,
    pub title: Option<String>,
    pub status: Option<String>,
}
