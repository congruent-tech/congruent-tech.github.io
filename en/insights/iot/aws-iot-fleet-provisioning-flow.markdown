---
layout: insight
title: "AWS IoT Fleet Provisioning: The Complete Flow from Factory to Cloud"
permalink: /en/insights/iot/aws-iot-fleet-provisioning-flow/
categories: [IoT, AWS, Security]
tags: [aws-iot, fleet-provisioning, iot-provisioning, esp32, cbor, mqtt, certificates]
excerpt: "See the complete AWS IoT Fleet Provisioning flow with real ESP32 code and CBOR message examples. Understand all key pairs, certificates, and API calls involved."
date: 2025-09-02
author: "Arash Kashi"
---

# AWS IoT Fleet Provisioning: The Complete Story

Before reading this, understand [CSR](/en/insights/iot/certificate-signing-requests-explained/), [TLS Handshake](/en/insights/iot/tls-handshake-iot-explained/), and [Claim vs Device Credentials](/en/insights/iot/claim-device-credentials-explained/).

Fleet Provisioning is like a **fully automated employee onboarding system** — devices go from visitor pass to full employee badge without human intervention.

---

## The Complete Flow Overview

```mermaid
sequenceDiagram
    participant Factory as Factory
    participant Device as ESP32 Device
    participant AWS as AWS IoT Core
    participant Thing as Thing Registry
    
    Factory->>Device: 1. Install claim credentials
    Device->>Device: 2. First boot - generate device keys
    Device->>Device: 3. Create CSR with device public key
    Device->>AWS: 4. TLS connect with claim credentials
    Device->>AWS: 5. MQTT: CreateCertificateFromCsr
    AWS->>AWS: 6. Verify claim signature
    AWS->>AWS: 7. Generate device certificate
    AWS->>Device: 8. MQTT: Return certificate + token
    Device->>AWS: 9. MQTT: RegisterThing with token
    AWS->>Thing: 10. Create Thing in registry
    AWS->>Device: 11. MQTT: Return Thing name
    Device->>Device: 12. Store device certificate
    Device->>Device: 13. Switch to device credentials
    Note over Device,AWS: Ready for production use
```

---

## Step-by-Step Breakdown

### **Step 1: Factory Preparation**
```c
// Same credentials installed on ALL devices
typedef struct {
    const char* claim_cert_path;        // "/spiffs/claim-certificate.pem"
    const char* claim_key_path;         // "/spiffs/claim-private-key.pem"
    const char* template_name;          // "SmartLockTemplate"
    const char* device_serial;          // "SL001234567" (unique per device)
} factory_config_t;

esp_err_t factory_install_credentials(factory_config_t* config) {
    // Install same claim cert on thousands of devices
    copy_file_to_spiffs(CLAIM_CERT_SOURCE, config->claim_cert_path);
    copy_file_to_spiffs(CLAIM_KEY_SOURCE, config->claim_key_path);
    
    // But unique serial number per device
    write_device_serial(config->device_serial);
    
    return ESP_OK;
}
```

### **Step 2: Device Key Generation**
```c
esp_err_t generate_device_keypair() {
    CK_SESSION_HANDLE session;
    CK_OBJECT_HANDLE private_key, public_key;
    
    // Generate P-256 ECDSA key pair in secure storage
    CK_ATTRIBUTE public_template[] = {
        {CKA_CLASS, &public_key_class, sizeof(public_key_class)},
        {CKA_KEY_TYPE, &ecdsa_type, sizeof(ecdsa_type)},
        {CKA_LABEL, DEVICE_PUBLIC_KEY_LABEL, strlen(DEVICE_PUBLIC_KEY_LABEL)},
        {CKA_VERIFY, &true_val, sizeof(true_val)}
    };
    
    CK_ATTRIBUTE private_template[] = {
        {CKA_CLASS, &private_key_class, sizeof(private_key_class)},
        {CKA_KEY_TYPE, &ecdsa_type, sizeof(ecdsa_type)},
        {CKA_LABEL, DEVICE_PRIVATE_KEY_LABEL, strlen(DEVICE_PRIVATE_KEY_LABEL)},
        {CKA_SIGN, &true_val, sizeof(true_val)},
        {CKA_PRIVATE, &true_val, sizeof(true_val)}
    };
    
    CK_MECHANISM mechanism = {CKM_EC_KEY_PAIR_GEN, ec_params, sizeof(ec_params)};
    
    return C_GenerateKeyPair(session, &mechanism,
                            public_template, 4,
                            private_template, 5,
                            &public_key, &private_key);
}
```

### **Step 3: CSR Creation**
```c
esp_err_t create_device_csr(char* csr_buffer, size_t buffer_size, size_t* csr_length) {
    // Subject information for the CSR
    mbedtls_x509write_csr csr_ctx;
    mbedtls_x509write_csr_init(&csr_ctx);
    
    char subject_name[256];
    snprintf(subject_name, sizeof(subject_name),
             "CN=%s,O=CongruentTech,C=US", get_device_serial());
    
    // Set CSR subject
    mbedtls_x509write_csr_set_subject_name(&csr_ctx, subject_name);
    
    // Load device key from PKCS#11
    mbedtls_pk_context device_key;
    load_pkcs11_key(&device_key, DEVICE_PRIVATE_KEY_LABEL);
    mbedtls_x509write_csr_set_key(&csr_ctx, &device_key);
    
    // Set signature algorithm
    mbedtls_x509write_csr_set_md_alg(&csr_ctx, MBEDTLS_MD_SHA256);
    
    // Generate CSR in PEM format
    return mbedtls_x509write_csr_pem(&csr_ctx, 
                                    (uint8_t*)csr_buffer, 
                                    buffer_size, 
                                    mbedtls_ctr_drbg_random, &ctr_drbg);
}
```

---

## MQTT API Calls (CBOR Format)

### **CreateCertificateFromCsr Request**
```c
esp_err_t send_create_certificate_request(const char* csr) {
    // CBOR message to AWS IoT
    uint8_t cbor_buffer[2048];
    size_t cbor_length;
    
    // Create CBOR payload: {"certificateSigningRequest": "<CSR>"}
    CborEncoder encoder, mapEncoder;
    cbor_encoder_init(&encoder, cbor_buffer, sizeof(cbor_buffer), 0);
    cbor_encoder_create_map(&encoder, &mapEncoder, 1);
    cbor_encode_text_stringz(&mapEncoder, "certificateSigningRequest");
    cbor_encode_text_string(&mapEncoder, csr, strlen(csr));
    cbor_encoder_close_container(&encoder, &mapEncoder);
    
    cbor_length = cbor_encoder_get_buffer_size(&encoder, cbor_buffer);
    
    // Publish to AWS IoT Fleet Provisioning topic
    return esp_mqtt_client_publish(mqtt_client,
                                  "$aws/certificates/create/cbor",
                                  (char*)cbor_buffer, cbor_length, 1, 0);
}
```

### **CreateCertificateFromCsr Response**
```c
void on_certificate_response(const char* topic, const uint8_t* payload, size_t length) {
    // Parse CBOR response from AWS
    CborParser parser;
    CborValue map;
    cbor_parser_init(payload, length, 0, &parser, &map);
    
    // Extract certificate, certificateId, and certificateOwnershipToken
    char certificate[2048];
    char certificate_id[64];  
    char ownership_token[512];
    
    extract_cbor_field(&map, "certificatePem", certificate, sizeof(certificate));
    extract_cbor_field(&map, "certificateId", certificate_id, sizeof(certificate_id));
    extract_cbor_field(&map, "certificateOwnershipToken", ownership_token, sizeof(ownership_token));
    
    // Store certificate in PKCS#11
    pkcs11_store_certificate(certificate, DEVICE_CERTIFICATE_LABEL);
    
    // Use ownership token for Thing registration
    register_thing_with_token(ownership_token);
}
```

### **RegisterThing Request**  
```c
esp_err_t register_thing(const char* ownership_token) {
    // CBOR message for Thing creation
    uint8_t cbor_buffer[1024];
    size_t cbor_length;
    
    CborEncoder encoder, mapEncoder, paramEncoder;
    cbor_encoder_init(&encoder, cbor_buffer, sizeof(cbor_buffer), 0);
    cbor_encoder_create_map(&encoder, &mapEncoder, 2);
    
    // Add ownership token
    cbor_encode_text_stringz(&mapEncoder, "certificateOwnershipToken");
    cbor_encode_text_string(&mapEncoder, ownership_token, strlen(ownership_token));
    
    // Add parameters
    cbor_encode_text_stringz(&mapEncoder, "parameters");
    cbor_encoder_create_map(&mapEncoder, &paramEncoder, 1);
    cbor_encode_text_stringz(&paramEncoder, "SerialNumber");
    cbor_encode_text_stringz(&paramEncoder, get_device_serial());
    cbor_encoder_close_container(&mapEncoder, &paramEncoder);
    
    cbor_encoder_close_container(&encoder, &mapEncoder);
    cbor_length = cbor_encoder_get_buffer_size(&encoder, cbor_buffer);
    
    // Publish to Thing registration topic
    return esp_mqtt_client_publish(mqtt_client,
                                  "$aws/provisioning-templates/SmartLockTemplate/provision/cbor",
                                  (char*)cbor_buffer, cbor_length, 1, 0);
}
```

---

## Real CBOR Message Examples

### **CreateCertificateFromCsr CBOR (hex)**
```
A1                          # map(1)
   78 1A                    # text(26)
      636572746966696361746553696E696E6752657175657374  # "certificateSigningRequest"
   79 05 9C                 # text(1436) 
      2D2D2D2D2D424547494E20434552544946494341544520524551554553542D2D2D2D2D0A...
      # "-----BEGIN CERTIFICATE REQUEST-----\nMIIBVTCBvwIBADBTMQsw..."
```

### **RegisterThing CBOR (hex)**
```
A2                          # map(2)
   78 1A                    # text(26)
      636572746966696361746553696E696E6752657175657374  # "certificateOwnershipToken" 
   78 80                    # text(128)
      61626364656667686969...  # ownership token value
   6A                       # text(10)  
      706172616D6574657273    # "parameters"
   A1                       # map(1)
      6C                    # text(12)
         53657269616C4E756D626572  # "SerialNumber"
      6B                    # text(11)
         534C303031323334353637     # "SL001234567"
```

---

## AWS IoT Provisioning Template

```json
{
  "templateName": "SmartLockTemplate",
  "description": "Template for smart lock devices",
  "enabled": true,
  "provisioningRoleArn": "arn:aws:iam::123456789:role/IoTProvisioningRole",
  "templateBody": {
    "Parameters": {
      "SerialNumber": {
        "Type": "String"
      }
    },
    "Resources": {
      "thing": {
        "Type": "AWS::IoT::Thing",
        "Properties": {
          "thingName": {"Fn::Join": ["-", ["SmartLock", {"Ref": "SerialNumber"}]]},
          "thingTypeName": "SmartLock",
          "attributePayload": {
            "SerialNumber": {"Ref": "SerialNumber"},
            "DeviceType": "SmartLock"
          }
        }
      },
      "certificate": {
        "Type": "AWS::IoT::Certificate",
        "Properties": {
          "certificatePem": {"Fn::GetAtt": ["CSR", "certificatePem"]},
          "status": "ACTIVE"
        }
      },
      "policy": {
        "Type": "AWS::IoT::Policy",
        "Properties": {
          "policyName": "SmartLockPolicy"
        }
      }
    }
  }
}
```

---

## Memory and Timing Analysis

### **ESP32 Memory Usage During Provisioning**
```c
typedef struct {
    size_t claim_credentials;      // ~2.3KB (cert + key)
    size_t device_keypair;         // ~2.3KB (generated pair)
    size_t csr_buffer;            // ~1.5KB (temporary)
    size_t cbor_buffers;          // ~3KB (request/response)
    size_t tls_session;           // ~45KB (during handshake)
    size_t mqtt_client;           // ~8KB (persistent)
} provisioning_memory_t;

// Peak usage: ~62KB
// Steady state after provisioning: ~10KB
```

### **Timing Analysis**
```c
typedef struct {
    uint32_t key_generation_ms;    // 200-500ms (ECDSA P-256)
    uint32_t csr_creation_ms;      // 50-150ms
    uint32_t tls_handshake_ms;     // 800-2000ms
    uint32_t mqtt_connect_ms;      // 200-500ms
    uint32_t cert_request_ms;      // 1000-3000ms (network)
    uint32_t thing_register_ms;    // 500-1500ms (network)
} provisioning_timing_t;

// Total provisioning time: 2.75-7.65 seconds
```

---

## Error Handling

### **Common Failure Points**
```c
esp_err_t handle_provisioning_errors(provisioning_error_t error) {
    switch (error) {
        case PROVISIONING_CLAIM_CERT_EXPIRED:
            ESP_LOGE(TAG, "Claim certificate expired - update factory image");
            return ESP_FAIL;
            
        case PROVISIONING_TEMPLATE_NOT_FOUND:
            ESP_LOGE(TAG, "Template 'SmartLockTemplate' not found in AWS");
            return ESP_FAIL;
            
        case PROVISIONING_CLAIM_NOT_AUTHORIZED:
            ESP_LOGE(TAG, "Claim certificate not registered with template");
            return ESP_FAIL;
            
        case PROVISIONING_NETWORK_TIMEOUT:
            ESP_LOGW(TAG, "Network timeout - retrying in 30 seconds");
            vTaskDelay(30000 / portTICK_PERIOD_MS);
            return ESP_ERR_TIMEOUT;
            
        case PROVISIONING_DUPLICATE_SERIAL:
            ESP_LOGE(TAG, "Device serial already registered");
            return ESP_ERR_DUPLICATE_OBJECT;
    }
    
    return ESP_OK;
}
```

### **Retry Logic**
```c
esp_err_t provision_with_retry() {
    int max_retries = 5;
    int retry_delay_ms = 1000;
    
    for (int attempt = 1; attempt <= max_retries; attempt++) {
        ESP_LOGI(TAG, "Provisioning attempt %d/%d", attempt, max_retries);
        
        esp_err_t ret = device_provisioning_start();
        
        if (ret == ESP_OK) {
            ESP_LOGI(TAG, "Provisioning successful on attempt %d", attempt);
            return ESP_OK;
        }
        
        if (ret == ESP_ERR_TIMEOUT && attempt < max_retries) {
            ESP_LOGW(TAG, "Attempt %d failed, retrying in %d seconds", 
                     attempt, retry_delay_ms / 1000);
            vTaskDelay(retry_delay_ms / portTICK_PERIOD_MS);
            retry_delay_ms *= 2;  // Exponential backoff
        } else {
            ESP_LOGE(TAG, "Provisioning failed permanently: %s", 
                     esp_err_to_name(ret));
            return ret;
        }
    }
    
    return ESP_FAIL;
}
```

---

## Complete ESP32 Implementation

```c
esp_err_t fleet_provisioning_complete_flow() {
    esp_err_t ret;
    
    // Step 1: Load claim credentials from SPIFFS
    ret = load_claim_credentials_from_spiffs();
    if (ret != ESP_OK) return ret;
    
    // Step 2: Generate unique device key pair
    ret = generate_device_keypair();
    if (ret != ESP_OK) return ret;
    
    // Step 3: Create CSR with device public key
    char csr[2048];
    size_t csr_length;
    ret = create_device_csr(csr, sizeof(csr), &csr_length);
    if (ret != ESP_OK) return ret;
    
    // Step 4: Connect to AWS IoT with claim credentials  
    ret = mqtt_connect_with_claim_credentials();
    if (ret != ESP_OK) return ret;
    
    // Step 5: Request device certificate
    ret = send_create_certificate_request(csr);
    if (ret != ESP_OK) return ret;
    
    // Step 6: Wait for certificate response (handled in callback)
    ret = wait_for_certificate_response(30000);  // 30 second timeout
    if (ret != ESP_OK) return ret;
    
    // Step 7: Register Thing (done automatically after cert received)
    ret = wait_for_thing_registration(10000);    // 10 second timeout  
    if (ret != ESP_OK) return ret;
    
    // Step 8: Switch to device credentials
    ret = mqtt_reconnect_with_device_credentials();
    if (ret != ESP_OK) return ret;
    
    // Step 9: Clean up (optional)
    #ifdef CONFIG_DELETE_CLAIM_CREDENTIALS
    delete_claim_credentials();
    #endif
    
    ESP_LOGI(TAG, "✅ Fleet provisioning completed successfully");
    return ESP_OK;
}
```

---

## Next Steps

- **Learn about [Certificate Chain Verification →](/en/insights/iot/certificate-chain-verification-explained/)** (validating your new certificate)
- **Understand [CBOR vs JSON →](/en/insights/iot/cbor-vs-json-iot-explained/)** (why AWS uses CBOR)

Fleet Provisioning transforms your device from **factory visitor** to **registered employee** — completely automated, secure, and scalable for millions of devices!