pub fn retry_delay_ms(backoff_ms: i32, attempt_number: i32) -> i64 {
    let exp = attempt_number.saturating_sub(1).max(0) as u32;
    let factor = 1i64.checked_shl(exp).unwrap_or(i64::MAX);
    (backoff_ms as i64).saturating_mul(factor)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn retry_delay_exponential() {
        assert_eq!(retry_delay_ms(1000, 1), 1000);
        assert_eq!(retry_delay_ms(1000, 2), 2000);
        assert_eq!(retry_delay_ms(1000, 3), 4000);
    }
}
