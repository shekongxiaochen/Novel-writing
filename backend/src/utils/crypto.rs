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

/// 设备 ID 哈希（旧算法，无盐单轮 SHA-256）。
///
/// 仅用于存量数据的兜底匹配与平滑迁移，新写入一律使用 [`hash_device_id_hmac`]。
/// 无盐单轮哈希对 device_id 这类“免密登录凭证”不安全（可彩虹表/暴力反推），
/// 故已弃用。
#[deprecated(note = "使用 hash_device_id_hmac；本函数仅供存量兜底匹配")]
pub fn hash_device_id(device_id: &str) -> String {
    hash_verification_code(device_id.trim())
}

/// 设备 ID 哈希（HMAC-SHA256，带服务端密钥）。
///
/// 相比无盐 SHA-256，HMAC 引入服务端密钥：即使数据库泄露，攻击者没有密钥也
/// 无法离线反推/枚举 device_id。`key` 应取自高熵服务端密钥（如 JWT_SECRET）。
pub fn hash_device_id_hmac(device_id: &str, key: &[u8]) -> String {
    use hmac::{Hmac, Mac};
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(key)
        .expect("HMAC 接受任意长度密钥");
    mac.update(device_id.trim().as_bytes());
    let out = mac.finalize().into_bytes();
    out.iter().map(|b| format!("{:02x}", b)).collect()
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

    #[test]
    fn test_hash_device_id_hmac() {
        let key = b"test-secret-key-at-least-strong";
        let h1 = hash_device_id_hmac("device-abc-1234567890", key);
        // 稳定：同输入同密钥 → 同输出
        assert_eq!(h1, hash_device_id_hmac("device-abc-1234567890", key));
        // 64 位十六进制（SHA-256 输出 32 字节）
        assert_eq!(h1.len(), 64);
        assert!(h1.chars().all(|c| c.is_ascii_hexdigit()));
        // 不同设备 → 不同哈希
        assert_ne!(h1, hash_device_id_hmac("device-xyz-0987654321", key));
        // 不同密钥 → 不同哈希（密钥确实参与计算）
        assert_ne!(h1, hash_device_id_hmac("device-abc-1234567890", b"another-key-value-here"));
        // trim 行为与旧算法一致
        assert_eq!(h1, hash_device_id_hmac("  device-abc-1234567890  ", key));
    }
}
