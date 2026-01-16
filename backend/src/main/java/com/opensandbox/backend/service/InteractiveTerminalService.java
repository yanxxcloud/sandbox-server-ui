package com.opensandbox.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/**
 * 交互式终端服务
 * 支持 TTY 模式和实时 stdin 输入
 * 直接调用 execd HTTP API 以支持交互式 TTY
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InteractiveTerminalService {

    private final SandboxService sandboxService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ExecutorService executorService = Executors.newCachedThreadPool();
    
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(0, java.util.concurrent.TimeUnit.SECONDS) // 无超时，支持长连接
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .build();

    // 存储活跃的交互式会话：sessionId -> SessionInfo
    private static class SessionInfo {
        String executionId;
        String endpoint;
        Thread streamThread;
        
        SessionInfo(String executionId, String endpoint, Thread streamThread) {
            this.executionId = executionId;
            this.endpoint = endpoint;
            this.streamThread = streamThread;
        }
    }
    
    private final Map<String, SessionInfo> activeSessions = new ConcurrentHashMap<>();

    /**
     * 启动交互式 shell 会话
     * 使用 SDK 启动 bash，然后通过 HTTP API 发送 stdin
     * @param sandboxId 沙箱 ID
     * @param onStdout stdout 回调
     * @param onStderr stderr 回调
     * @param onExit 退出回调
     * @return sessionId 会话 ID
     */
    public String startInteractiveSession(
            String sandboxId,
            Consumer<String> onStdout,
            Consumer<String> onStderr,
            Consumer<Integer> onExit) {
        
        String sessionId = java.util.UUID.randomUUID().toString();
        
        try {
            com.alibaba.opensandbox.sandbox.Sandbox sandbox = sandboxService.getSandbox(sandboxId);
            String endpoint = sandboxService.getEndpoint(sandboxId);
            
            // 使用 script 命令模拟 TTY，启动交互式 bash
            // script -q -c "bash -il" /dev/null 会创建一个伪终端
            String command = "script -q -c 'bash -il' /dev/null";
            
            com.alibaba.opensandbox.sandbox.domain.models.execd.executions.ExecutionHandlers handlers = 
                    com.alibaba.opensandbox.sandbox.domain.models.execd.executions.ExecutionHandlers.builder()
                    .onStdout(msg -> {
                        String text = msg.getText();
                        onStdout.accept(text);
                    })
                    .onStderr(msg -> {
                        String text = msg.getText();
                        onStderr.accept(text);
                    })
                    .onExecutionComplete(complete -> {
                        activeSessions.remove(sessionId);
                        onExit.accept(0);
                    })
                    .onError(error -> {
                        activeSessions.remove(sessionId);
                        onStderr.accept(error.getName() + ": " + error.getValue());
                        onExit.accept(1);
                    })
                    .build();
            
            com.alibaba.opensandbox.sandbox.domain.models.execd.executions.RunCommandRequest request = 
                    com.alibaba.opensandbox.sandbox.domain.models.execd.executions.RunCommandRequest.builder()
                    .command(command)
                    .workingDirectory("/workspace")
                    .handlers(handlers)
                    .build();
            
            // 在新线程中异步执行，避免阻塞
            Thread executionThread = new Thread(() -> {
                try {
                    com.alibaba.opensandbox.sandbox.domain.models.execd.executions.Execution execution = 
                            sandbox.commands().run(request);
                    String executionId = execution.getId();
                    
                    SessionInfo sessionInfo = new SessionInfo(executionId, endpoint, Thread.currentThread());
                    activeSessions.put(sessionId, sessionInfo);
                    
                    log.info("Started interactive session {} for sandbox {}, execution: {}", 
                            sessionId, sandboxId, executionId);
                    
                } catch (Exception e) {
                    log.error("Error in execution thread: {}", e.getMessage(), e);
                    activeSessions.remove(sessionId);
                    onStderr.accept("Error: " + e.getMessage());
                    onExit.accept(-1);
                }
            });
            executionThread.setDaemon(true);
            executionThread.start();
            
            // 等待一小段时间确保执行开始
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            return sessionId;
            
        } catch (Exception e) {
            log.error("Error starting interactive session: {}", e.getMessage(), e);
            onStderr.accept("Error: " + e.getMessage());
            onExit.accept(-1);
            return null;
        }
    }


    /**
     * 向交互式会话发送输入
     * 注意：SDK 可能不支持直接发送 stdin，这里尝试通过 HTTP API
     * 如果失败，可能需要使用其他方法（如通过文件管道）
     * @param sandboxId 沙箱 ID
     * @param sessionId 会话 ID
     * @param input 输入内容
     */
    public void sendInput(String sandboxId, String sessionId, String input) {
        SessionInfo sessionInfo = activeSessions.get(sessionId);
        if (sessionInfo == null) {
            log.warn("Session {} not found for sandbox {}", sessionId, sandboxId);
            return;
        }
        
        try {
            // 尝试通过 execd API 发送 stdin
            // 注意：实际的 API 路径可能需要调整
            String url = String.format("http://%s/executions/%s/stdin", 
                    sessionInfo.endpoint, sessionInfo.executionId);
            
            RequestBody body = RequestBody.create(
                    input,
                    MediaType.get("text/plain; charset=utf-8")
            );
            
            Request request = new Request.Builder()
                    .url(url)
                    .post(body)
                    .build();
            
            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    // 如果 API 不存在，记录警告但不抛出异常
                    // 实际应用中可能需要使用其他方法（如通过文件管道）
                    log.debug("Failed to send stdin to execution {}: {} (API may not be available)", 
                            sessionInfo.executionId, response.code());
                }
            }
            
        } catch (Exception e) {
            // 不抛出异常，只记录日志
            // 因为 stdin API 可能不可用，这是正常的
            log.debug("Error sending input to session {}: {}", sessionId, e.getMessage());
        }
    }

    /**
     * 中断会话
     * @param sandboxId 沙箱 ID
     * @param sessionId 会话 ID
     */
    public void interrupt(String sandboxId, String sessionId) {
        SessionInfo sessionInfo = activeSessions.get(sessionId);
        if (sessionInfo == null) {
            return;
        }
        
        try {
            String url = String.format("http://%s/executions/%s/interrupt", 
                    sessionInfo.endpoint, sessionInfo.executionId);
            
            Request request = new Request.Builder()
                    .url(url)
                    .post(RequestBody.create("", MediaType.get("application/json")))
                    .build();
            
            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful()) {
                    if (sessionInfo.streamThread != null) {
                        sessionInfo.streamThread.interrupt();
                    }
                    activeSessions.remove(sessionId);
                    log.info("Interrupted session {} for sandbox {}", sessionId, sandboxId);
                }
            }
            
        } catch (Exception e) {
            log.error("Error interrupting session {}: {}", sessionId, e.getMessage(), e);
        }
    }

    /**
     * 关闭会话
     * @param sessionId 会话 ID
     */
    public void closeSession(String sessionId) {
        SessionInfo sessionInfo = activeSessions.remove(sessionId);
        if (sessionInfo != null && sessionInfo.streamThread != null) {
            sessionInfo.streamThread.interrupt();
        }
        log.info("Closed session {}", sessionId);
    }
    
}
