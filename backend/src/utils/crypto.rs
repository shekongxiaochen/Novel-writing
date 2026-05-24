use pbkdf2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Pbkdf2,
};
use rand::Rng;
use sha2::Sha256;

/// 哈希密码 (PBKDF2-SHA256, 120k iterations - 与Python版本一致)
pub fn hash_password(password: &str, iterations: u32) -> Result<String, String> {
    let salt = SaltString::generate(&mut rand::thread_rng());
    
    let params = pbkdf2::Params {
        rounds: iterations,
        output_length: 32,
    };
    
    let password_hash = Pbkdf2
        .hash_password_customized(
            password.as_bytes(),
            None,
            None,
            params,
            &salt,
        )
        .map_err(|e| e.to_string())?
        .to_string();
    
    Ok(password_hash)
}

/// 验证密码
pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    let parsed_hash = PasswordHash::new(hash).map_err(|e| e.to_string())?;
    Ok(Pbkdf2.verify_password(password.as_bytes(), &parsed_hash).is_ok())
}

/// 生成6位数字验证码
pub fn generate_verification_code() -> String {
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(0..1000000))
}

/// 设备 ID 哈希（注册绑定，不落库明文）
pub fn hash_device_id(device_id: &str) -> String {
    hash_verification_code(device_id.trim())
}

/// 生成系统分配的用户名
pub fn generate_username() -> String {
    const CHARS: &[u8] = b"abcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = rand::thread_rng();
    let suffix: String = (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect();
    format!("nw{suffix}")
}

/// 生成随机密码（注册时一次性展示）
pub fn generate_password() -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let mut rng = rand::thread_rng();
    (0..12)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect()
}

/// 哈希验证码 (用于存储)
pub fn hash_verification_code(code: &str) -> String {
    use sha2::Digest;
    let mut hasher = Sha256::new();
    hasher.update(code.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_password_hashing() {
        let password = "test123456";
        let hash = hash_password(password, 120_000).unwrap();
        
        assert!(verify_password(password, &hash).unwrap());
        assert!(!verify_password("wrong", &hash).unwrap());
    }
    
    #[test]
    fn test_verification_code() {
        let code = generate_verification_code();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| c.is_numeric()));
    }
}
