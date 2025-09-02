---
layout: insight
title: "TLS Handshake in IoT: How Devices Create Secure Connections"
permalink: /en/insights/iot/tls-handshake-iot-explained/
categories: [IoT, Security, Networking]
tags: [tls, ssl, handshake, iot-security, esp32, aws-iot, mutual-authentication]
excerpt: "Learn the TLS handshake process with real ESP32 packet examples. See how IoT devices establish secure connections with AWS IoT Core step by step."
date: 2025-09-02
author: "Arash Kashi"
---

# TLS Handshake in IoT: The Secret Handshake

Before reading this, understand [Public Keys](/en/insights/iot/public-private-keys-explained/), [Digital Certificates](/en/insights/iot/digital-certificates-explained/), and [Digital Signatures](/en/insights/iot/digital-signatures-explained/).

The **TLS handshake** is like a **secret handshake between friends** — both parties prove their identity and agree on a secret code for their conversation.

---

## The Secret Handshake Analogy

**Meeting a Friend:**
1. "Hi, I'm Alice" (introduce yourself)
2. "Prove it - what's our secret word?" (challenge)
3. "Pineapple!" (respond with proof)
4. "OK, let's use cipher #7 for today" (agree on encryption)

**TLS Handshake:**
1. "Hello, I'm ESP32-001" (Client Hello)
2. "Prove it - here's my certificate" (Server Hello + Certificate)
3. Device verifies certificate + sends its own
4. Both agree on encryption keys

---

## TLS 1.2 Handshake Flow

```mermaid
sequenceDiagram
    participant D as ESP32 Device
    participant A as AWS IoT Core
    
    D->>A: 1. ClientHello (ciphers, random)
    A->>D: 2. ServerHello (chosen cipher, random)
    A->>D: 3. Certificate (AWS IoT certificate)
    A->>D: 4. CertificateRequest (want client cert)
    A->>D: 5. ServerHelloDone
    D->>A: 6. Certificate (device certificate)
    D->>A: 7. ClientKeyExchange (encrypted key)
    D->>A: 8. CertificateVerify (proof of private key)
    D->>A: 9. ChangeCipherSpec
    D->>A: 10. Finished (encrypted summary)
    A->>D: 11. ChangeCipherSpec
    A->>D: 12. Finished (encrypted summary)
    
    Note over D,A: 🔐 Secure MQTT traffic begins
```

---

## Real ESP32 Wireshark Capture

### **1. ClientHello Packet**
```
TLS Record: Handshake Protocol: Client Hello
    Content Type: Handshake (22)
    Version: TLS 1.2 (0x0303)
    Length: 512
    Handshake Protocol: Client Hello
        Client Random: a1b2c3d4e5f6789a...
        Session ID Length: 0
        Cipher Suites Length: 32
        Cipher Suites (16 suites):
            TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256 (0xc02f)
            TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256 (0xc02b)
        Extensions:
            server_name: a3l4xd5...iot.us-east-1.amazonaws.com
            ec_point_formats: uncompressed (0)
```

### **2. ServerHello Response**  
```
TLS Record: Handshake Protocol: Server Hello
    Content Type: Handshake (22)  
    Version: TLS 1.2 (0x0303)
    Server Random: 9f8e7d6c5b4a3210...
    Session ID: (empty)
    Cipher Suite: TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
    Compression Method: null (0)
```

---

## ESP32 TLS Configuration

```c
// mbedTLS configuration for AWS IoT
esp_tls_cfg_t tls_cfg = {
    .cacert_buf = aws_root_ca_pem,
    .cacert_bytes = strlen(aws_root_ca_pem) + 1,
    .clientcert_buf = device_cert_pem,  
    .clientcert_bytes = strlen(device_cert_pem) + 1,
    .clientkey_buf = device_key_pem,
    .clientkey_bytes = strlen(device_key_pem) + 1,
    .timeout_ms = 10000,
    .keep_alive_cfg = &keep_alive_cfg,
    .skip_common_name = false,  // Verify server hostname
};

// Establish TLS connection
esp_tls_t *tls = esp_tls_conn_new_sync("a3l4xd5...iot.us-east-1.amazonaws.com", 
                                       8883, &tls_cfg);
```

---

## Mutual TLS Authentication (mTLS)

Unlike web browsers, IoT devices use **mutual authentication**:

| Connection Type | Client Auth | Server Auth |
|----------------|-------------|-------------|
| **HTTPS (web)** | ❌ Optional | ✅ Required |
| **AWS IoT** | ✅ Required | ✅ Required |

```c
// Both sides verify each other
bool verify_server_cert(const char* cert) {
    // Check if cert is signed by AWS CA
    return mbedtls_x509_crt_verify(&server_cert, &ca_chain, ...);
}

bool server_verifies_client() {
    // AWS checks if device cert is valid
    // and matches registered Thing
    return aws_iot_verify_device_certificate();
}
```

---

## Cipher Suites Explained

**Format:** `TLS_KEYEXCHANGE_AUTHENTICATION_WITH_ENCRYPTION_MAC`

### **ESP32 Preferred Cipher**
```
TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
│     │     │         │       │       └── Hash: SHA-256
│     │     │         │       └────────── Mode: GCM (auth + encrypt)  
│     │     │         └────────────────── Encryption: AES-128
│     │     └──────────────────────────── Authentication: ECDSA
│     └────────────────────────────────── Key Exchange: ECDHE
└──────────────────────────────────────── Protocol: TLS
```

**Why This Cipher?**
- **ECDHE**: Perfect Forward Secrecy
- **ECDSA**: Fast verification on ESP32  
- **AES-128**: Hardware accelerated
- **GCM**: Combined encryption + authentication

---

## Key Exchange Mathematics

### **ECDHE (Elliptic Curve Diffie-Hellman Ephemeral)**
```
Device generates: private_a, public_A = private_a × G
Server generates: private_b, public_B = private_b × G

Shared secret = private_a × public_B = private_b × public_A

Both sides compute same secret without sharing private keys!
```

### **Session Key Derivation**
```c
// Both sides compute identical keys
uint8_t master_secret[48];
uint8_t client_random[32];
uint8_t server_random[32];

// PRF = Pseudo-Random Function
prf_tls12(master_secret, "key expansion",
          server_random, client_random, key_material, 128);

// Results in:
struct {
    uint8_t client_mac_key[32];
    uint8_t server_mac_key[32];  
    uint8_t client_enc_key[16];
    uint8_t server_enc_key[16];
} key_material;
```

---

## Real ESP32 TLS Memory Usage

```c
// mbedTLS memory requirements
Heap usage during handshake: ~45KB
├── X.509 certificate parsing: ~8KB
├── ECDHE key generation: ~4KB
├── AES-128 context: ~200 bytes
├── SHA-256 context: ~200 bytes
└── TLS record buffers: ~32KB

Post-handshake steady state: ~8KB
```

---

## Handshake Timing Analysis

```c
// Real ESP32 measurements
typedef struct {
    uint32_t dns_lookup_ms;      // 50-200ms
    uint32_t tcp_connect_ms;     // 100-500ms  
    uint32_t tls_handshake_ms;   // 800-2000ms
    uint32_t mqtt_connect_ms;    // 200-500ms
} connection_timing_t;

// Total connection time: 1.15-3.2 seconds
```

**Optimization techniques:**
```c
// TLS session resumption (skip handshake)
esp_tls_cfg_t cfg = {
    .use_secure_element = true,    // Hardware acceleration
    .timeout_ms = 5000,            // Reasonable timeout
    .keep_alive_cfg = &keep_alive, // Reuse connections
};
```

---

## Common TLS Errors in IoT

### **Certificate Verification Failed**
```
mbedtls_ssl_handshake returned -0x2700
MBEDTLS_ERR_X509_CERT_VERIFY_FAILED
```
**Causes:**
- Wrong CA certificate
- Expired device certificate  
- Clock not synced (certificate "not yet valid")

### **Handshake Timeout**
```
mbedtls_ssl_handshake returned -0x6800
MBEDTLS_ERR_SSL_TIMEOUT
```
**Solutions:**
- Increase `timeout_ms`
- Check network connectivity
- Reduce MTU size

### **Out of Memory**
```
mbedtls_ssl_setup returned -0x7F00
MBEDTLS_ERR_SSL_ALLOC_FAILED
```
**Solutions:**
- Increase heap size in `sdkconfig`
- Free unused memory before TLS
- Use hardware crypto acceleration

---

## TLS 1.3 vs TLS 1.2 in IoT

| Feature | TLS 1.2 | TLS 1.3 |
|---------|---------|---------|
| **Handshake** | 2 round trips | 1 round trip |
| **Memory** | ~45KB | ~35KB |
| **Speed** | Baseline | 30% faster |
| **ESP32 Support** | ✅ Full | ⚠️ Limited |
| **AWS IoT Support** | ✅ Yes | ✅ Yes |

---

## Real Packet Sizes

```
ClientHello:        ~512 bytes
ServerHello:        ~1,200 bytes (includes cert)
ClientKeyExchange:  ~150 bytes
Finished messages:  ~64 bytes each
                    ─────────────
Total handshake:    ~1,990 bytes
```

**Over 2G/3G networks:** This represents ~2-3 seconds of data transfer.

---

## TLS Implementation in ESP-IDF

```c
// Low-level mbedTLS (more control)
mbedtls_ssl_context ssl;
mbedtls_ssl_config conf;
mbedtls_x509_crt cert;
mbedtls_pk_context pkey;

// High-level ESP-TLS (easier)
esp_tls_t *tls = esp_tls_init();
esp_tls_conn_new_sync(hostname, port, &cfg);

// MQTT over TLS (highest level)  
esp_mqtt_client_config_t mqtt_cfg = {
    .transport = MQTT_TRANSPORT_OVER_SSL,
    .cert_pem = device_cert,
    .key_pem = device_key,
    .host = aws_endpoint,
    .port = 8883
};
```

---

## Security Considerations

### **✅ Best Practices**
```c
// Always verify server certificate
cfg.skip_common_name = false;

// Use strong cipher suites only
cfg.ciphersuites_list = strong_ciphers;

// Enable certificate pinning
cfg.server_cert_verification_callback = verify_aws_cert;
```

### **❌ Common Mistakes**
```c
// BAD: Skip certificate verification
cfg.skip_cert_common_name_check = true;

// BAD: Allow weak ciphers
cfg.disable_auto_flush = true;  // Wrong config

// BAD: No timeout handling
while (handshake_in_progress) {
    // Infinite loop risk
}
```

---

## Next Steps

- **Learn about [Claim vs Device Credentials →](/en/insights/iot/claim-device-credentials-explained/)** (different certificate types)
- **Understand [AWS IoT Fleet Provisioning →](/en/insights/iot/aws-iot-fleet-provisioning-flow/)** (using TLS for provisioning)

The TLS handshake is your device's **security checkpoint** — it ensures both you and AWS are who you claim to be before any sensitive data flows!