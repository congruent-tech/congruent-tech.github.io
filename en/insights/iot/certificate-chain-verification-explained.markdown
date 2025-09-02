---
layout: insight
title: "Certificate Chain Verification: Why Your IoT Device Needs to Check Everything"
permalink: /en/insights/iot/certificate-chain-verification-explained/
categories: [IoT, Security, Cryptography]
tags: [certificate-chain, root-ca, intermediate-ca, certificate-verification, esp32, aws-iot]
excerpt: "Learn certificate chain verification with real examples and math. See how IoT devices verify AWS certificates and why public key matching prevents attacks."
date: 2025-09-02
author: "Arash Kashi"
---

# Certificate Chain Verification: The Notary Chain

Before reading this, understand [Digital Signatures](/en/insights/iot/digital-signatures-explained/), [Digital Certificates](/en/insights/iot/digital-certificates-explained/), and [AWS Fleet Provisioning](/en/insights/iot/aws-iot-fleet-provisioning-flow/).

Certificate chain verification is like **checking a chain of notary stamps** — each certificate must be properly signed by the one above it, all the way to a trusted root.

---

## The Notary Chain Analogy

**Traditional Document Verification:**
- Local notary signs your document
- State validates the local notary's license
- Federal government validates the state authority  
- You trust the federal government (root authority)

**Certificate Chain Verification:**
- AWS IoT CA signs your device certificate  
- Amazon Root CA signs the AWS IoT CA certificate
- Your device trusts Amazon Root CA (pre-installed)
- Chain of trust established: Root → Intermediate → Device

---

## Certificate Chain Structure

```mermaid
graph TD
    A[Amazon Root CA 1<br/>Self-Signed<br/>Trusted by ESP32] --> B[AWS IoT CA<br/>Signed by Root CA<br/>Intermediate Certificate]
    B --> C[Device Certificate<br/>ESP32-LivingRoom-001<br/>Signed by IoT CA]
    B --> D[Device Certificate<br/>ESP32-Kitchen-002<br/>Signed by IoT CA]
    
    style A fill:#ff9999
    style B fill:#99ccff
    style C fill:#99ff99
    style D fill:#99ff99
```

---

## Real Certificate Chain Example

### **Root CA Certificate (Pre-installed)**
```pem
-----BEGIN CERTIFICATE-----
Subject: CN=Amazon Root CA 1, O=Amazon, C=US
Issuer: CN=Amazon Root CA 1, O=Amazon, C=US    ← Self-signed!
Valid From: 2015-05-26 00:00:00
Valid To:   2038-01-17 00:00:00                ← Long-lived
Public Key: RSA 2048 bits
    00:b0:28:cf:0c:a4:86:09:6f:85:43:51:83:c6:35:08:
    c9:37:3d:1e:68:b7:ab:5c:20:f8:4e:81:f7:7d:40:2a:
    ...
Signature: (Self-signed with own private key)
-----END CERTIFICATE-----
```

### **Intermediate CA Certificate (Downloaded)**
```pem
-----BEGIN CERTIFICATE-----
Subject: CN=AWS IoT Device Management CA, O=Amazon.com Inc., C=US
Issuer: CN=Amazon Root CA 1, O=Amazon, C=US    ← Signed by Root!
Valid From: 2020-04-01 00:00:00  
Valid To:   2025-04-01 00:00:00                ← Shorter-lived
Public Key: RSA 2048 bits
    00:a1:2b:3c:4d:5e:6f:7a:8b:9c:ad:be:cf:d0:e1:f2:
    03:14:25:36:47:58:69:7a:8b:1c:2d:3e:4f:60:71:82:
    ...
Signature: (Signed by Amazon Root CA 1's private key)
-----END CERTIFICATE-----
```

### **Device Certificate (From Provisioning)**
```pem
-----BEGIN CERTIFICATE-----
Subject: CN=ESP32-LivingRoom-001, O=CongruentTech, C=US
Issuer: CN=AWS IoT Device Management CA, O=Amazon.com Inc., C=US
Valid From: 2025-01-01 00:00:00
Valid To:   2026-01-01 00:00:00                ← Annual renewal
Public Key: ECC P-256
    04:1a:2b:3c:4d:5e:6f:7a:8b:9c:ad:be:cf:d0:e1:f2:
    03:14:25:36:47:58:69:7a:8b:1c:2d:3e:4f:60:71:82:
    ...
Signature: (Signed by AWS IoT CA's private key)
-----END CERTIFICATE-----
```

---

## ESP32 Chain Verification Code

### **Store Root CA Certificate**
```c
// Pre-installed root CA (never changes)
static const char aws_root_ca_pem[] = 
"-----BEGIN CERTIFICATE-----\n"
"MIIBtjCCAVugAwIBAgITBmyf1XSXNmY/Owua2eiedgPySjAKBggqhkjOPQQDAjA5\n"
"MQswCQYDVQQGEwJVUzEPMA0GA1UEChMGQW1hem9uMRkwFwYDVQQDExBBbWF6b24g\n"
"Um9vdCBDQSAxMB4XDTE1MDUyNjAwMDAwMFoXDTM4MDExNzAwMDAwMFowOTELMAkG\n"
"A1UEBhMCVVMxDzANBgNVBAoTBkFtYXpvbjEZMBcGA1UEAxMQQW1hem9uIFJvb3Qg\n"
"Q0EgMTBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABCLNxjm1QqFCGQWYG+YTxOVh\n"
"9YEKrfMT5rPBmTOgLo6BSs7cH0UHfCdNwFCnXl1cAWdB0KHBUxpZWJXzz6j5uq4j\n"
"RTBDMBsGCisGAQQBjyahkgIxAQYLKoZIhvdMBQICFA0wEgYDVR0RBAswCYIHZGRu\n"
"cy5vcmcwCgYIKoZIzj0EAwIDSQAwRgIhAMaC+GEGHrBwCVsRtF9GMJKiYdmCOVV3\n"
"K4kpRaJ0Qm3fAiEAjjD1xZdHhFn5D3VY6/z1J1Z3cOPSaAIEV2FQ3xtODrE=\n"
"-----END CERTIFICATE-----";

esp_err_t store_root_ca() {
    return pkcs11_store_certificate(aws_root_ca_pem, "Root CA Cert");
}
```

### **Verify Certificate Chain**
```c
esp_err_t verify_certificate_chain(const char* device_cert_pem,
                                   const char* intermediate_cert_pem) {
    mbedtls_x509_crt device_cert;
    mbedtls_x509_crt intermediate_cert;
    mbedtls_x509_crt root_ca_cert;
    
    // Parse all certificates
    mbedtls_x509_crt_parse(&device_cert, (uint8_t*)device_cert_pem, 
                          strlen(device_cert_pem) + 1);
    mbedtls_x509_crt_parse(&intermediate_cert, (uint8_t*)intermediate_cert_pem,
                          strlen(intermediate_cert_pem) + 1);
    mbedtls_x509_crt_parse(&root_ca_cert, (uint8_t*)aws_root_ca_pem,
                          strlen(aws_root_ca_pem) + 1);
    
    // Build certificate chain: Device ← Intermediate ← Root
    uint32_t flags;
    int ret = mbedtls_x509_crt_verify(&device_cert,     // Certificate to verify
                                     &intermediate_cert, // Chain of trust  
                                     &root_ca_cert,      // Trust anchors
                                     NULL,               // No CRL
                                     &flags,             // Verification flags
                                     NULL, NULL);        // No callback
    
    if (ret == 0) {
        ESP_LOGI(TAG, "✅ Certificate chain verification successful");
        return ESP_OK;
    } else {
        ESP_LOGE(TAG, "❌ Certificate chain verification failed: 0x%08X", flags);
        log_verification_errors(flags);
        return ESP_FAIL;
    }
}
```

### **Verification Error Analysis**
```c
void log_verification_errors(uint32_t flags) {
    if (flags & MBEDTLS_X509_BADCERT_EXPIRED) {
        ESP_LOGE(TAG, "Certificate has expired");
    }
    if (flags & MBEDTLS_X509_BADCERT_REVOKED) {
        ESP_LOGE(TAG, "Certificate has been revoked");
    }
    if (flags & MBEDTLS_X509_BADCERT_CN_MISMATCH) {
        ESP_LOGE(TAG, "Common Name (CN) does not match");
    }
    if (flags & MBEDTLS_X509_BADCERT_NOT_TRUSTED) {
        ESP_LOGE(TAG, "Certificate is not signed by trusted CA");
    }
    if (flags & MBEDTLS_X509_BADCERT_FUTURE) {
        ESP_LOGE(TAG, "Certificate validity starts in the future");
    }
}
```

---

## The Critical Public Key Verification

This is the security check that prevents certificate substitution attacks:

```c
esp_err_t verify_public_key_match(const char* certificate_pem,
                                  CK_OBJECT_HANDLE device_public_key) {
    // Extract public key from received certificate
    mbedtls_x509_crt cert;
    mbedtls_x509_crt_parse(&cert, (uint8_t*)certificate_pem, 
                          strlen(certificate_pem) + 1);
    
    // Get certificate's public key
    uint8_t cert_pubkey[65];  // P-256 uncompressed format
    size_t cert_pubkey_len;
    mbedtls_pk_write_pubkey_raw(&cert.pk, cert_pubkey, 65);
    
    // Get device's public key from PKCS#11
    uint8_t device_pubkey[65];
    CK_ATTRIBUTE template[] = {
        {CKA_EC_POINT, device_pubkey, sizeof(device_pubkey)}
    };
    C_GetAttributeValue(session, device_public_key, template, 1);
    
    // Compare the two public keys
    if (memcmp(cert_pubkey, device_pubkey, 65) == 0) {
        ESP_LOGI(TAG, "✅ Certificate public key matches device key");
        return ESP_OK;
    } else {
        ESP_LOGE(TAG, "❌ Certificate public key mismatch - possible attack!");
        ESP_LOGE(TAG, "Certificate key: %s", hex_dump(cert_pubkey, 32));
        ESP_LOGE(TAG, "Device key:      %s", hex_dump(device_pubkey, 32));
        return ESP_FAIL;
    }
}
```

---

## Mathematical Chain Verification

### **Signature Verification Process**
```
For each certificate in chain:

1. Extract issuer's public key from parent certificate
2. Hash the certificate's content (TBSCertificate)  
3. Decrypt signature with issuer's public key
4. Compare decrypted hash with computed hash

Example (RSA-2048):
hash = SHA256(certificate_content)
decrypted = signature^e mod n  (using parent's public key)
valid = (hash == decrypted)
```

### **ECC Signature Verification (P-256)**  
```c
esp_err_t verify_ecdsa_signature(const uint8_t* hash,
                                const ecdsa_signature_t* signature,
                                const ecc_point_t* public_key) {
    // ECDSA verification: 
    // u1 = hash * w mod n
    // u2 = r * w mod n  
    // (x, y) = u1*G + u2*Q
    // valid if x == r
    
    mbedtls_ecdsa_context ctx;
    mbedtls_ecdsa_init(&ctx);
    
    int ret = mbedtls_ecdsa_verify(&ctx.grp, hash, 32,
                                  &ctx.Q, signature->r, signature->s);
    
    mbedtls_ecdsa_free(&ctx);
    return (ret == 0) ? ESP_OK : ESP_FAIL;
}
```

---

## Certificate Pinning for Extra Security

```c
// Pin specific AWS IoT intermediate CA
static const char* pinned_aws_iot_ca_fingerprint = 
    "A1:B2:C3:D4:E5:F6:07:08:09:0A:1B:2C:3D:4E:5F:60:71:82:93:A4";

esp_err_t verify_certificate_pinning(mbedtls_x509_crt* cert) {
    uint8_t fingerprint[20];  // SHA-1 hash
    
    // Compute certificate fingerprint
    mbedtls_sha1_ret(cert->raw.p, cert->raw.len, fingerprint);
    
    // Convert to hex string
    char hex_fingerprint[60];
    for (int i = 0; i < 20; i++) {
        sprintf(&hex_fingerprint[i * 3], "%02X:", fingerprint[i]);
    }
    hex_fingerprint[59] = '\0';  // Remove trailing ':'
    
    // Compare with pinned fingerprint
    if (strcmp(hex_fingerprint, pinned_aws_iot_ca_fingerprint) == 0) {
        ESP_LOGI(TAG, "✅ Certificate pinning verification passed");
        return ESP_OK;
    } else {
        ESP_LOGE(TAG, "❌ Certificate pinning failed");
        ESP_LOGE(TAG, "Expected: %s", pinned_aws_iot_ca_fingerprint);
        ESP_LOGE(TAG, "Got:      %s", hex_fingerprint);
        return ESP_FAIL;
    }
}
```

---

## Common Chain Verification Failures

### **Missing Intermediate Certificate**
```
Error: MBEDTLS_X509_BADCERT_NOT_TRUSTED
Root Cause: Device cert → Root CA (missing intermediate)
Solution: Download and store AWS IoT intermediate CA
```

### **Certificate Order Wrong**
```c
// WRONG: Root → Device → Intermediate
mbedtls_x509_crt_verify(&device_cert, &root_ca, &intermediate, ...);

// CORRECT: Device → Intermediate → Root  
mbedtls_x509_crt_verify(&device_cert, &intermediate, &root_ca, ...);
```

### **Expired Intermediate Certificate**
```
Error: MBEDTLS_X509_BADCERT_EXPIRED
Root Cause: Intermediate CA certificate expired
Solution: Update to newer intermediate CA certificate
```

### **Clock Synchronization Issues**
```c
// Device thinks it's 2023, certificate valid from 2025
time_t now = time(NULL);
if (now < cert->valid_from) {
    ESP_LOGE(TAG, "Certificate not yet valid - sync device clock");
    sntp_sync_time();  // NTP time synchronization
}
```

---

## Performance Optimization

### **Certificate Caching**
```c
typedef struct {
    char* cert_pem;
    mbedtls_x509_crt parsed_cert;
    time_t cache_timestamp;
    bool is_valid;
} cert_cache_entry_t;

static cert_cache_entry_t cert_cache[MAX_CACHED_CERTS];

mbedtls_x509_crt* get_cached_certificate(const char* subject_name) {
    for (int i = 0; i < MAX_CACHED_CERTS; i++) {
        if (cert_cache[i].is_valid && 
            strcmp(cert_cache[i].parsed_cert.subject.val.p, subject_name) == 0) {
            return &cert_cache[i].parsed_cert;
        }
    }
    return NULL;  // Cache miss
}
```

### **Hardware Acceleration**
```c
// Use ESP32's hardware crypto acceleration
esp_err_t init_hardware_crypto() {
    // Enable AES, SHA, RSA, ECC hardware acceleration
    esp_aes_acquire_hardware();
    esp_sha_acquire_hardware();
    
    // Configure mbedTLS to use hardware
    mbedtls_hardware_poll(NULL, NULL, 0, NULL);
    
    return ESP_OK;
}
```

---

## Real-World Timing

```c
// Certificate verification timing on ESP32
typedef struct {
    uint32_t parse_cert_ms;        // 10-50ms per certificate
    uint32_t rsa_verify_ms;        // 200-800ms (RSA-2048)
    uint32_t ecc_verify_ms;        // 50-200ms (P-256)
    uint32_t chain_build_ms;       // 5-20ms
    uint32_t total_verify_ms;      // 265-1070ms total
} verification_timing_t;

// Optimization: Cache parsed certificates, use ECC when possible
```

---

## Complete Verification Function

```c
esp_err_t verify_device_certificate_complete(const char* cert_pem) {
    esp_err_t ret;
    
    // Step 1: Basic certificate parsing
    ret = parse_and_validate_certificate(cert_pem);
    if (ret != ESP_OK) return ret;
    
    // Step 2: Verify certificate chain (AWS signature validation)
    ret = verify_certificate_chain(cert_pem, aws_intermediate_ca_pem);
    if (ret != ESP_OK) return ret;
    
    // Step 3: Verify public key matches device's key (prevents attacks)
    CK_OBJECT_HANDLE device_pubkey = find_device_public_key();
    ret = verify_public_key_match(cert_pem, device_pubkey);
    if (ret != ESP_OK) return ret;
    
    // Step 4: Optional certificate pinning
    #ifdef CONFIG_ENABLE_CERT_PINNING
    ret = verify_certificate_pinning(&parsed_cert);
    if (ret != ESP_OK) return ret;
    #endif
    
    // Step 5: Check certificate extensions and usage
    ret = verify_certificate_usage(&parsed_cert);
    if (ret != ESP_OK) return ret;
    
    ESP_LOGI(TAG, "🔒 Certificate verification completed successfully");
    return ESP_OK;
}
```

---

## Next Steps

- **Learn about [CBOR vs JSON →](/en/insights/iot/cbor-vs-json-iot-explained/)** (data formats in IoT)
- **Review [Fleet Provisioning Flow →](/en/insights/iot/aws-iot-fleet-provisioning-flow/)** (putting it all together)

Certificate chain verification is your device's **security checkpoint** — it ensures every certificate in the chain is legitimate, properly signed, and that you received the right certificate for your device!