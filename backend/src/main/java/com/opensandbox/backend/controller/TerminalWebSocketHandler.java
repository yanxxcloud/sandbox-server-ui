package com.opensandbox.backend.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opensandbox.backend.service.SandboxService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 终端 WebSocket 处理器
 * 每次命令独立执行，使用 script 命令模拟 TTY
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    private final SandboxService sandboxService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    // 存储活跃的 WebSocket 会话
    private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sandboxId = extractSandboxId(session);
        sessions.put(session.getId(), session);
        
        log.info("WebSocket connected for sandbox: {}, session: {}", sandboxId, session.getId());
        
        // 发送连接成功消息
        safeSendMessage(session, Map.of(
                "type", "connected",
                "sandboxId", sandboxId,
                "message", "Terminal connected"
        ));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sandboxId = extractSandboxId(session);
        String payload = message.getPayload();
        
        try {
            JsonNode json = objectMapper.readTree(payload);
            String type = json.has("type") ? json.get("type").asText() : "exec";
            
            if ("exec".equals(type)) {
                String command = json.get("command").asText();
                log.debug("Executing command in sandbox {}: {}", sandboxId, command);
                
                // 流式执行命令
                sandboxService.executeCommandStreaming(
                        sandboxId,
                        command,
                        stdout -> safeSendMessage(session, Map.of(
                                "type", "stdout",
                                "data", stdout
                        )),
                        stderr -> safeSendMessage(session, Map.of(
                                "type", "stderr",
                                "data", stderr
                        )),
                        exitCode -> safeSendMessage(session, Map.of(
                                "type", "exit",
                                "exitCode", exitCode
                        ))
                );
            } else if ("ping".equals(type)) {
                safeSendMessage(session, Map.of("type", "pong"));
            }
            
        } catch (Exception e) {
            log.error("Error handling WebSocket message: {}", e.getMessage(), e);
            safeSendMessage(session, Map.of(
                    "type", "error",
                    "message", e.getMessage()
            ));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        sessions.remove(session.getId());
        String sandboxId = extractSandboxId(session);
        log.info("WebSocket disconnected for sandbox: {}, status: {}", sandboxId, status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        log.error("WebSocket transport error: {}", exception.getMessage(), exception);
        sessions.remove(session.getId());
    }

    private String extractSandboxId(WebSocketSession session) {
        // URL 格式: /api/sandboxes/{sandboxId}/terminal
        String path = session.getUri().getPath();
        String[] parts = path.split("/");
        // parts: ["", "api", "sandboxes", "{sandboxId}", "terminal"]
        if (parts.length >= 4) {
            return parts[3];
        }
        return "unknown";
    }

    /**
     * 安全地发送 WebSocket 消息
     */
    private boolean safeSendMessage(WebSocketSession session, Map<String, Object> data) {
        if (session == null) {
            return false;
        }
        
        try {
            if (!session.isOpen()) {
                return false;
            }
            
            String json = objectMapper.writeValueAsString(data);
            session.sendMessage(new TextMessage(json));
            return true;
            
        } catch (java.io.IOException e) {
            if (e.getMessage() != null && e.getMessage().contains("Broken pipe")) {
                log.debug("WebSocket connection closed while sending message: {}", session.getId());
            } else {
                log.warn("IO error sending WebSocket message: {}", e.getMessage());
            }
            return false;
        } catch (Exception e) {
            log.error("Error sending WebSocket message: {}", e.getMessage(), e);
            return false;
        }
    }
}
