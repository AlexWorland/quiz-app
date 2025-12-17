/// Calculate speed-based score (Kahoot style)
///
/// Base points = 1000
/// Time factor = (timeLimit - responseTime) / timeLimit
/// Points = Base points × Time factor
pub fn calculate_speed_based_score(time_limit_ms: i32, response_time_ms: i32) -> i32 {
    const BASE_POINTS: f64 = 1000.0;

    if response_time_ms >= time_limit_ms {
        // If time expired, give minimal points (1 point)
        return 1;
    }

    let time_factor = (time_limit_ms - response_time_ms) as f64 / time_limit_ms as f64;
    let points = (BASE_POINTS * time_factor).ceil() as i32;

    // Ensure minimum 1 point for correct answer
    points.max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_time_used() {
        let score = calculate_speed_based_score(30000, 29999);
        assert!(score < 50); // Very little time left
    }

    #[test]
    fn test_instant_answer() {
        let score = calculate_speed_based_score(30000, 1000);
        assert!(score > 900); // Most time remaining
    }

    #[test]
    fn test_time_expired() {
        let score = calculate_speed_based_score(10000, 15000);
        assert_eq!(score, 1); // Minimum points
    }
}
