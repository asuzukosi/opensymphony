pub fn retry_delay_ms(backoff_ms: i32, attempt_number: i32) -> i64 {
    let exp = attempt_number.saturating_sub(1).max(0) as u32;
    let factor = 1i64.checked_shl(exp).unwrap_or(i64::MAX);
    (backoff_ms as i64).saturating_mul(factor)
}
