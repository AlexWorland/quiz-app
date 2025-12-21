use crate::error::{AppError, Result};
use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm, Nonce}; // 96-bit nonce
use base64::{engine::general_purpose, Engine as _};

/// Encrypt a string using AES-256-GCM with the provided key
pub fn encrypt_string(plaintext: &str, key: &str) -> Result<String> {
    if key.len() < 32 {
        return Err(AppError::Internal("Encryption key must be at least 32 bytes".to_string()));
    }

    let key_bytes = &key.as_bytes()[0..32];
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| AppError::Internal(format!("Failed to init cipher: {}", e)))?;

    let nonce_bytes = Aes256Gcm::generate_nonce(&mut OsRng);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AppError::Internal(format!("Encryption failed: {}", e)))?;

    // Store nonce + ciphertext together, base64-encoded
    let mut combined = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(general_purpose::STANDARD.encode(combined))
}

/// Decrypt a string using AES-256-GCM with the provided key
pub fn decrypt_string(ciphertext_b64: &str, key: &str) -> Result<String> {
    if key.len() < 32 {
        return Err(AppError::Internal("Encryption key must be at least 32 bytes".to_string()));
    }

    let key_bytes = &key.as_bytes()[0..32];
    let cipher = Aes256Gcm::new_from_slice(key_bytes)
        .map_err(|e| AppError::Internal(format!("Failed to init cipher: {}", e)))?;

    let combined = general_purpose::STANDARD
        .decode(ciphertext_b64)
        .map_err(|e| AppError::Internal(format!("Failed to decode ciphertext: {}", e)))?;

    if combined.len() < 12 {
        return Err(AppError::Internal("Ciphertext too short".to_string()));
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext)
        .map_err(|e| AppError::Internal(format!("Decrypted data not valid UTF-8: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_round_trip() {
        let key = "32-byte-secret-key-change-me!!!!";
        let plaintext = "hello world";

        let encrypted = encrypt_string(plaintext, key).expect("encrypt");
        assert_ne!(encrypted, plaintext);

        let decrypted = decrypt_string(&encrypted, key).expect("decrypt");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_string() {
        let key = "32-byte-secret-key-change-me!!!!";
        let plaintext = "sensitive-api-key-12345";

        let ciphertext = encrypt_string(plaintext, key).unwrap();
        assert_ne!(ciphertext, plaintext);
        assert!(ciphertext.len() > 0);

        let decrypted = decrypt_string(&ciphertext, key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_fails_short_key() {
        let key = "short";
        let plaintext = "test";

        let result = encrypt_string(plaintext, key);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("32 bytes"));
    }

    #[test]
    fn test_decrypt_fails_short_key() {
        let key = "short";
        let ciphertext = "dGVzdA==";

        let result = decrypt_string(ciphertext, key);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("32 bytes"));
    }

    #[test]
    fn test_decrypt_fails_invalid_base64() {
        let key = "32-byte-secret-key-change-me!!!!";
        let invalid_ciphertext = "not-valid-base64!!!";

        let result = decrypt_string(invalid_ciphertext, key);
        assert!(result.is_err());
    }

    #[test]
    fn test_decrypt_fails_short_ciphertext() {
        let key = "32-byte-secret-key-change-me!!!!";
        let short_ciphertext = "dGVzdA=="; // "test" in base64, but too short for nonce+ciphertext

        let result = decrypt_string(short_ciphertext, key);
        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_decrypt_empty_string() {
        let key = "32-byte-secret-key-change-me!!!!";
        let plaintext = "";

        let ciphertext = encrypt_string(plaintext, key).unwrap();
        let decrypted = decrypt_string(&ciphertext, key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_decrypt_long_string() {
        let key = "32-byte-secret-key-change-me!!!!";
        let plaintext = "a".repeat(1000);

        let ciphertext = encrypt_string(&plaintext, key).unwrap();
        let decrypted = decrypt_string(&ciphertext, key).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_encrypt_produces_different_ciphertexts() {
        let key = "32-byte-secret-key-change-me!!!!";
        let plaintext = "same plaintext";

        let ciphertext1 = encrypt_string(plaintext, key).unwrap();
        let ciphertext2 = encrypt_string(plaintext, key).unwrap();

        // Should be different due to random nonce
        assert_ne!(ciphertext1, ciphertext2);

        // But both should decrypt to the same plaintext
        assert_eq!(decrypt_string(&ciphertext1, key).unwrap(), plaintext);
        assert_eq!(decrypt_string(&ciphertext2, key).unwrap(), plaintext);
    }
}

