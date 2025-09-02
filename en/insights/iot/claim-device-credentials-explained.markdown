---
layout: insight
title: "Claim Credentials vs Device Credentials: Temporary Pass vs Employee Badge"
permalink: /en/insights/iot/claim-device-credentials-explained/
categories: [IoT, Security, AWS]
tags: [claim-credentials, device-credentials, aws-iot, provisioning, certificates, esp32]
excerpt: "Learn the difference between claim and device credentials with real examples. See how IoT devices exchange temporary visitor passes for permanent employee badges."
date: 2025-09-02
author: "Arash Kashi"
---

# Claim vs Device Credentials: Visitor Pass vs Employee Badge

Before reading this, understand [Digital Certificates](/en/insights/iot/digital-certificates-explained/) and [Certificate Signing Requests](/en/insights/iot/certificate-signing-requests-explained/).

The difference between **claim credentials** and **device credentials** is like the difference between a **visitor pass** and an **employee badge** at a company.

---

## The Corporate Badge Analogy

**Visitor Pass (Claim Credentials):**
- Temporary access to request permanent badge
- Same pass used by all contractors  
- Limited permissions (can't access secure areas)
- Expires quickly (valid for hours/days)
- Used once to get employee badge

**Employee Badge (Device Credentials):**
- Permanent identification for daily work
- Unique to each employee
- Full access to authorized areas  
- Valid for years (until termination)
- Used for all work activities

---

## Real Certificate Comparison

### **Claim Certificate (Temporary)**
```pem
-----BEGIN CERTIFICATE-----
Subject: CN=ProvisioningClaimCert, O=CongruentTech
Issuer: CN=CongruentTech Provisioning CA
Valid From: 2025-01-01 00:00:00
Valid To:   2025-01-01 23:59:59  ← Only 24 hours!
Serial: 1111111111111111             ← Same for many devices
Extensions:
    Key Usage: Digital Signature
    Extended Key Usage: NONE         ← Limited permissions
-----END CERTIFICATE-----
```

### **Device Certificate (Permanent)**
```pem
-----BEGIN CERTIFICATE-----
Subject: CN=ESP32-LivingRoom-001, O=CongruentTech
Issuer: CN=AWS IoT CA
Valid From: 2025-01-01 00:00:00
Valid To:   2026-01-01 00:00:00      ← Valid for 1 year
Serial: ABC123DEF456789ABC           ← Unique per device
Extensions:
    Key Usage: Digital Signature, Key Agreement
    Extended Key Usage: TLS Client Authentication ← Full access
-----END CERTIFICATE-----
```

---

## Two Key Pairs, Two Purposes

```mermaid
graph LR
    subgraph "Claim Credentials"
        A[Claim Private Key] -.-> B[Claim Certificate]
        B --> C[Request Device Certificate]
    end
    
    subgraph "Device Credentials"  
        D[Device Private Key] --> E[Device Certificate]
        E --> F[Daily AWS IoT Operations]
    end
    
    C --> D
```

**Key Point:** Your device needs **TWO separate key pairs** and certificates!

---

## ESP32 File Structure

```bash
# Before Provisioning (factory install)
/spiffs/provisioning/
├── claim_certificate.pem      # Temporary visitor pass
├── claim_private_key.pem      # Temporary key (same for all)
└── provisioning_template.txt  # "SmartLockTemplate"

# After Provisioning (runtime)  
/nvs/pkcs11/
├── "Claim Cert TLS"           # Imported claim certificate
├── "Claim Priv TLS Key"       # Imported claim private key
├── "Device Cert TLS"          # NEW: Unique device certificate  
└── "Device Priv TLS Key"      # NEW: Unique device private key
```

---

## The Exchange Process

```mermaid
sequenceDiagram
    participant Factory as Factory
    participant Device as ESP32 Device  
    participant AWS as AWS IoT Core
    
    Factory->>Device: Install claim credentials
    Note over Device: First boot
    Device->>Device: Generate unique key pair
    Device->>Device: Create CSR with device public key
    Device->>AWS: Send CSR + signed with claim credentials
    AWS->>AWS: Verify claim signature
    AWS->>AWS: Generate unique device certificate
    AWS->>Device: Return device certificate
    Device->>Device: Store device credentials
    Device->>Device: Delete claim credentials (optional)
    Note over Device: Use device creds forever
```

---

## Real ESP32 Code Example

### **Load Claim Credentials (Factory)**
```c
esp_err_t load_claim_credentials() {
    // Same credentials installed on ALL devices at factory
    esp_err_t ret = pkcs11_import_certificate(
        "/spiffs/claim_certificate.pem",
        "Claim Cert TLS"  // PKCS#11 label
    );
    
    if (ret != ESP_OK) return ret;
    
    return pkcs11_import_private_key(
        "/spiffs/claim_private_key.pem", 
        "Claim Priv TLS Key"
    );
}
```

### **Generate Device Credentials (Runtime)**
```c
esp_err_t generate_device_credentials() {
    CK_SESSION_HANDLE session;
    CK_OBJECT_HANDLE device_private_key, device_public_key;
    
    // 1. Generate unique key pair for THIS device
    CK_MECHANISM mechanism = {CKM_EC_KEY_PAIR_GEN, NULL, 0};
    C_GenerateKeyPair(session, &mechanism,
                      public_template, 3,
                      private_template, 5, 
                      &device_public_key, &device_private_key);
    
    // 2. Create CSR with device's public key
    char csr[2048];
    create_csr(session, device_public_key, device_private_key, csr);
    
    // 3. Sign CSR with claim private key (proves authorization)
    sign_csr_with_claim_key(csr);
    
    return ESP_OK;
}
```

### **Switch to Device Credentials**
```c
esp_err_t provision_complete_callback(const char* device_cert) {
    // Store the certificate AWS sent us
    pkcs11_store_certificate(device_cert, "Device Cert TLS");
    
    // From now on, use device credentials for MQTT
    mqtt_cfg.client_cert_pem = get_pkcs11_cert("Device Cert TLS");
    mqtt_cfg.client_key_handle = find_pkcs11_key("Device Priv TLS Key");
    
    // Optional: Delete claim credentials to save space
    pkcs11_delete_object("Claim Cert TLS");
    pkcs11_delete_object("Claim Priv TLS Key");
    
    return ESP_OK;
}
```

---

## Security Model

### **Claim Credentials Security**
- **Shared among devices** → Not suitable for production use
- **Short-lived** → Limits exposure if compromised  
- **Limited permissions** → Can only request certificates
- **Pre-registered** → AWS knows which claim certs are valid

### **Device Credentials Security**  
- **Unique per device** → No sharing, isolated compromise
- **Long-lived** → Valid for months/years
- **Full permissions** → Can access all authorized AWS resources
- **Generated on-demand** → Created during provisioning

---

## AWS IoT Thing Registration

```json
{
  "thingName": "ESP32-LivingRoom-001",
  "thingTypeName": "SmartLock",  
  "principalArn": "arn:aws:iot:us-east-1:123456789:cert/abc123def...",
  "attributes": {
    "DeviceSerialNumber": "SL001234567",
    "ManufacturingDate": "2025-01-01",
    "ClaimCertificateSerial": "1111111111111111"
  }
}
```

**AWS tracks:**
- Which **claim certificate** was used for provisioning
- Which **device certificate** was issued
- When provisioning occurred
- Device-specific attributes

---

## Credential Lifecycle

```mermaid
graph TD
    A[Factory: Install Claim Creds] --> B[Ship Device]
    B --> C[Customer: First Boot]
    C --> D[Generate Device Keys]
    D --> E[Use Claim Creds to Request Certificate]
    E --> F[Receive Device Certificate]
    F --> G[Store Device Certificate]
    G --> H[Switch to Device Credentials]
    H --> I[Delete Claim Credentials]
    I --> J[Normal Operation]
    
    K[1 Year Later] --> L[Renew Device Certificate]
    L --> J
```

---

## Common Provisioning Errors

### **Claim Certificate Expired**
```
Error: certificate has expired
Time: 2025-01-02 12:00:00 UTC
Claim cert valid until: 2025-01-01 23:59:59 UTC
```
**Solution:** Update factory image with fresh claim certificates

### **Wrong Provisioning Template**  
```
Error: InvalidParameterException
Template 'SmartLockTemplate' does not exist or is not active
```
**Solution:** Create provisioning template in AWS IoT Core

### **Claim Certificate Not Authorized**
```
Error: Forbidden - claim certificate not registered
```
**Solution:** Register claim certificate with provisioning template

### **Clock Synchronization**
```
Error: certificate is not yet valid
Device time: 2024-12-31 (wrong!)  
Certificate valid from: 2025-01-01
```
**Solution:** Sync device clock with NTP before provisioning

---

## Storage Optimization

```c
// Memory usage comparison
typedef struct {
    size_t claim_cert_size;     // ~1.2KB
    size_t claim_key_size;      // ~1.1KB  
    size_t device_cert_size;    // ~1.2KB
    size_t device_key_size;     // ~1.1KB
} credential_sizes_t;

// Total during provisioning: ~4.6KB
// Total after cleanup: ~2.3KB (device creds only)
```

**Production Optimization:**
```c
#ifdef CONFIG_DELETE_CLAIM_CREDS_AFTER_PROVISIONING
    // Save 2.3KB of NVS storage  
    pkcs11_delete_claim_credentials();
#endif
```

---

## Multi-Device Factory Process

```c
// Factory script (runs on manufacturing line)
void provision_device_batch() {
    for (int i = 0; i < 1000; i++) {
        char serial[32];
        sprintf(serial, "SL%09d", i);
        
        // Same claim credentials for entire batch
        install_file(device[i], "/spiffs/claim_certificate.pem");
        install_file(device[i], "/spiffs/claim_private_key.pem");
        
        // But unique serial number per device  
        set_device_serial(device[i], serial);
        
        flash_firmware(device[i]);
    }
}
```

---

## Certificate Rotation

```c
// Device certificates expire - need renewal
esp_err_t check_certificate_expiry() {
    time_t now = time(NULL);
    time_t expiry = get_certificate_expiry("Device Cert TLS");
    
    // Renew 30 days before expiry
    if ((expiry - now) < (30 * 24 * 3600)) {
        return renew_device_certificate();
    }
    
    return ESP_OK;
}

esp_err_t renew_device_certificate() {
    // Generate new key pair
    generate_new_device_keys();
    
    // Create new CSR
    create_renewal_csr();
    
    // Sign with current device key (not claim key)
    sign_csr_with_device_key();
    
    // Send to AWS IoT
    return request_certificate_renewal();
}
```

---

## Next Steps

- **Learn about [AWS IoT Fleet Provisioning Flow →](/en/insights/iot/aws-iot-fleet-provisioning-flow/)** (complete process)
- **Understand [Certificate Chain Verification →](/en/insights/iot/certificate-chain-verification-explained/)** (ensuring trust)

**Remember:** Claim credentials are your **visitor pass** to get the real **employee badge** (device credentials). Use them once, then switch to the permanent credentials for daily work!