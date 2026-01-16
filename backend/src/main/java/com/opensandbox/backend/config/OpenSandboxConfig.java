package com.opensandbox.backend.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Data
@Configuration
@ConfigurationProperties(prefix = "opensandbox")
public class OpenSandboxConfig {
    
    private String domain = "127.0.0.1:8080";
    private String apiKey = "your-api-key";
    private String protocol = "http";
    private Duration requestTimeout = Duration.ofSeconds(30);
    private boolean debug = false;
}
