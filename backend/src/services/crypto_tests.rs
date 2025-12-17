#[cfg(test)]
mod tests {
    use super::super::crypto::{encrypt_string, decrypt_string};

    #[test]
    fn test_encrypt_decrypt_round_trip() {
        let key = "32-byte-secret-key-change-me!!!";
        let plaintext = "hello world";

        let encrypted = encrypt_string(plaintext, key).expect("encrypt");
        assert_ne!(encrypted, plaintext);

        let decrypted = decrypt_string(&encrypted, key).expect("decrypt");
        assert_eq!(decrypted, plaintext);
    }
}


