package com.opensandbox.backend.config;

import com.opensandbox.backend.controller.TerminalWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final TerminalWebSocketHandler terminalWebSocketHandler;

    @Value("${cors.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    public WebSocketConfig(TerminalWebSocketHandler terminalWebSocketHandler) {
        this.terminalWebSocketHandler = terminalWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 分割并去除空格
        String[] origins = allowedOrigins.split(",");
        for (int i = 0; i < origins.length; i++) {
            origins[i] = origins[i].trim();
        }
        
        registry.addHandler(terminalWebSocketHandler, "/api/sandboxes/*/terminal")
                .setAllowedOrigins(origins);
    }
}
