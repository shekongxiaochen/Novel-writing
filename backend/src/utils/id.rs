use uuid::Uuid;

/// 生成32位十六进制ID (与Python uuid4().hex一致)
pub fn generate_id() -> String {
    Uuid::new_v4().simple().to_string()
}

/// 生成64位十六进制ID
#[allow(dead_code)]
pub fn generate_long_id() -> String {
    format!("{}{}", generate_id(), generate_id())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_generate_id() {
        let id = generate_id();
        assert_eq!(id.len(), 32);
        assert!(id.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
