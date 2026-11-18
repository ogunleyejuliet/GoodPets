# Password Hashing

## 1. Purpose

This document describes the password-hashing approach implemented in Good Pets as part of Task 4: Server Security and Data Integrity.

Passwords must never be stored as plaintext or protected using fast general-purpose hashing algorithms such as SHA-256. Good Pets uses Argon2id to make password verification computationally expensive and reduce the feasibility of brute-force attacks.

## 2. Hashing Algorithm

Good Pets uses **Argon2id**, a password-hashing algorithm designed to resist both GPU-based and memory-based attacks.

The implementation uses the `@node-rs/argon2` package.

### Configuration

| Parameter | Value |
|---|---:|
| Algorithm | Argon2id |
| Version | 19 |
| Memory cost | 19,456 KiB (19 MiB) |
| Time cost | 2 iterations |
| Parallelism | 1 |
| Output length | 32 bytes |

These parameters configure the computational and memory resources required to derive a password hash.

## 3. Salt Generation

Argon2id generates a unique random salt when hashing a password.

This means that hashing the same password twice produces different hash strings because each operation uses a different salt.

The salt is included in the encoded Argon2id hash. It does not need to be stored separately.

### Verification

Password verification uses the Argon2id verification function to compare a submitted password against the stored hash.

The application does not decrypt passwords. It verifies whether the submitted password matches the stored password hash.

## 4. Signup and Signin Integration

During signup:

1. The submitted password is normalized by trimming leading and trailing whitespace.
2. The normalized password is passed to Argon2id.
3. The resulting hash is stored in the database.
4. The original plaintext password is not stored.

During signin:

1. The submitted password is normalized using the same trimming rule.
2. The application retrieves the stored password hash.
3. Argon2id verifies the submitted password against the stored hash.
4. Authentication proceeds only when verification succeeds.

Internal spaces within passwords are preserved.

## 5. SHA-256 and Argon2id Performance Comparison

A local benchmark compared SHA-256 with Argon2id to demonstrate the difference between a fast general-purpose hash and a deliberately expensive password-hashing algorithm.

### Recorded results

| Algorithm | Average hashing time |
|---|---:|
| SHA-256 | 0.068 ms |
| Argon2id | 17.754 ms |

Argon2id took approximately **262 times longer** than SHA-256 in this benchmark.

This additional computational cost is intentional. It increases the time and resources required to test password guesses.

The benchmark is a local measurement, not a guarantee of performance or an estimate of an attacker's total guessing capacity.

## 6. Evidence

The following evidence supports the implementation:

- `evidence/07-hash-twice-different.txt` — demonstrates that hashing the same password twice produces different Argon2id hashes and that both hashes verify successfully.
- `evidence/08-timing-argon-vs-sha.txt` — records the measured performance comparison between SHA-256 and Argon2id.

## 7. Security Considerations

- Plaintext passwords are not stored in the database.
- Argon2id uses a unique salt for each password hash.
- Password verification uses the stored hash rather than decrypting passwords.
- The hashing configuration deliberately increases the cost of password guessing.
- Password normalization is applied consistently during signup and signin.

## 8. Conclusion

Good Pets uses Argon2id for password storage and verification. The implementation uses a unique salt for each hash and configurable memory and computational costs. The recorded benchmark demonstrates why Argon2id is more appropriate for password storage than a fast general-purpose hash such as SHA-256.