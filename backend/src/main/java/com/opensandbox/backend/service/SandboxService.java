package com.opensandbox.backend.service;

import com.alibaba.opensandbox.sandbox.Sandbox;
import com.alibaba.opensandbox.sandbox.SandboxManager;
import com.alibaba.opensandbox.sandbox.config.ConnectionConfig;
import com.alibaba.opensandbox.sandbox.domain.models.execd.executions.Execution;
import com.alibaba.opensandbox.sandbox.domain.models.execd.executions.ExecutionHandlers;
import com.alibaba.opensandbox.sandbox.domain.models.execd.executions.RunCommandRequest;
import com.alibaba.opensandbox.sandbox.domain.models.execd.filesystem.SearchEntry;
import com.alibaba.opensandbox.sandbox.domain.models.execd.filesystem.WriteEntry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opensandbox.backend.config.OpenSandboxConfig;
import com.opensandbox.backend.dto.*;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Consumer;

/**
 * 沙箱服务
 * 
 * - 命令执行：使用 SDK 的 Sandbox.connector()
 * - 文件操作：由于 SDK 反序列化兼容性问题，使用 HTTP 直接调用
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SandboxService {

    private final OpenSandboxConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private OkHttpClient httpClient;
    private ConnectionConfig connectionConfig;
    private SandboxManager sandboxManager;
    
    // 缓存已连接的沙箱实例
    private final Map<String, Sandbox> sandboxCache = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .writeTimeout(60, TimeUnit.SECONDS)
                .build();
        
        connectionConfig = ConnectionConfig.builder()
                .domain(config.getDomain())
                .apiKey(config.getApiKey())
                .protocol(config.getProtocol())
                .requestTimeout(config.getRequestTimeout())
                .debug(config.isDebug())
                .build();
        
        sandboxManager = SandboxManager.builder()
                .connectionConfig(connectionConfig)
                .build();
        
        log.info("OpenSandbox service initialized with domain: {}", config.getDomain());
    }

    @PreDestroy
    public void destroy() {
        sandboxCache.values().forEach(sandbox -> {
            try {
                sandbox.close();
            } catch (Exception e) {
                log.warn("Error closing sandbox: {}", e.getMessage());
            }
        });
        sandboxCache.clear();
        
        if (sandboxManager != null) {
            sandboxManager.close();
        }
    }

    /**
     * 获取或连接到沙箱实例 (用于命令执行)
     */
    public Sandbox getSandbox(String sandboxId) {
        return sandboxCache.computeIfAbsent(sandboxId, id -> {
            log.info("Connecting to sandbox: {}", id);
            return Sandbox.connector()
                    .sandboxId(UUID.fromString(id))
                    .connectionConfig(connectionConfig)
                    .connect();
        });
    }

    /**
     * 获取沙箱的 endpoint (用于文件操作)
     * 从沙箱详情的 metadata 中获取 http-port
     */
    public String getEndpoint(String sandboxId) throws IOException {
        String url = String.format("%s://%s/sandboxes/%s", 
                config.getProtocol(), config.getDomain(), sandboxId);
        
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();
        
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                throw new IOException("获取沙箱详情失败: " + response.code());
            }
            
            String body = response.body().string();
            JsonNode sandbox = objectMapper.readTree(body);
            
            JsonNode metadata = sandbox.get("metadata");
            if (metadata != null && metadata.has("opensandbox.io/http-port")) {
                String port = metadata.get("opensandbox.io/http-port").asText();
                return "127.0.0.1:" + port;
            }
            
            throw new IOException("沙箱无可用 endpoint (metadata 中缺少 http-port)");
        }
    }

    /**
     * 执行命令 - 使用 SDK
     */
    public ExecResponse executeCommand(String sandboxId, ExecRequest request) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            
            List<String> stdoutLines = new ArrayList<>();
            List<String> stderrLines = new ArrayList<>();
            AtomicLong executionTime = new AtomicLong(0);
            AtomicInteger exitCode = new AtomicInteger(0);
            
            ExecutionHandlers handlers = ExecutionHandlers.builder()
                    .onStdout(msg -> stdoutLines.add(msg.getText()))
                    .onStderr(msg -> stderrLines.add(msg.getText()))
                    .onExecutionComplete(complete -> executionTime.set(complete.getExecutionTimeInMillis()))
                    .onError(error -> {
                        stderrLines.add(error.getName() + ": " + error.getValue());
                        exitCode.set(1);
                    })
                    .build();
            
            RunCommandRequest.Builder cmdBuilder = RunCommandRequest.builder()
                    .command(request.getCommand())
                    .handlers(handlers);
            
            if (request.getWorkDir() != null) {
                cmdBuilder.workingDirectory(request.getWorkDir());
            }
            
            Execution execution = sandbox.commands().run(cmdBuilder.build());
            
            if (execution.getError() != null) {
                exitCode.set(1);
                if (stderrLines.isEmpty()) {
                    stderrLines.add(execution.getError().getName() + ": " + execution.getError().getValue());
                }
            }
            
            return ExecResponse.builder()
                    .exitCode(exitCode.get())
                    .stdout(stdoutLines)
                    .stderr(stderrLines)
                    .executionTimeMs(executionTime.get())
                    .success(exitCode.get() == 0)
                    .build();
                    
        } catch (Exception e) {
            log.error("Error executing command in sandbox {}: {}", sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            return ExecResponse.builder()
                    .exitCode(-1)
                    .stdout(List.of())
                    .stderr(List.of(e.getMessage()))
                    .success(false)
                    .error(e.getMessage())
                    .build();
        }
    }

    /**
     * 执行命令（流式输出）
     */
    public void executeCommandStreaming(String sandboxId, String command, 
                                        Consumer<String> onStdout, 
                                        Consumer<String> onStderr,
                                        Consumer<Integer> onComplete) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            AtomicInteger exitCode = new AtomicInteger(0);
            
            ExecutionHandlers handlers = ExecutionHandlers.builder()
                    .onStdout(msg -> onStdout.accept(msg.getText()))
                    .onStderr(msg -> onStderr.accept(msg.getText()))
                    .onExecutionComplete(complete -> onComplete.accept(exitCode.get()))
                    .onError(error -> {
                        exitCode.set(1);
                        onStderr.accept(error.getName() + ": " + error.getValue());
                    })
                    .build();
            
            // 使用 script 命令模拟 TTY
            String wrappedCommand = String.format("script -q -c '%s' /dev/null", 
                    command.replace("'", "'\"'\"'"));
            
            RunCommandRequest request = RunCommandRequest.builder()
                    .command(wrappedCommand)
                    .handlers(handlers)
                    .build();
            
            sandbox.commands().run(request);
            
        } catch (Exception e) {
            log.error("Error executing streaming command: {}", e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            onStderr.accept("Error: " + e.getMessage());
            onComplete.accept(-1);
        }
    }

    /**
     * 列出文件 - 使用 SDK
     */
    public List<FileInfo> listFiles(String sandboxId, FileListRequest request) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            SearchEntry searchEntry =SearchEntry.builder()
                    .path(request.getPath())
                    .pattern(request.getPattern())
                    .build();
            var entries = sandbox.files().search(searchEntry);
            
            List<FileInfo> files = new ArrayList<>();
            for (var entry : entries) {
                String path = entry.getPath();
                String name = path.contains("/") ? path.substring(path.lastIndexOf('/') + 1) : path;
                if (name.isEmpty()) name = path;
                
                int mode = entry.getMode();
                // S_IFDIR = 0x4000 (16384)
                String type = (mode & 0x4000) != 0 ? "directory" : "file";
                
                files.add(FileInfo.builder()
                        .name(name)
                        .path(path)
                        .type(type)
                        .size(entry.getSize())
                        .mode(mode)
                        .modTime(entry.getModifiedAt().toString())
                        .build());
            }
            return files;
            
        } catch (Exception e) {
            log.error("Error listing files in sandbox {}: {}", sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            throw new RuntimeException("列出文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 读取文件内容 - 使用 SDK
     */
    public String readFile(String sandboxId, String path) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            byte[] content = sandbox.files().readByteArray(path);
            return new String(content, java.nio.charset.StandardCharsets.UTF_8);
            
        } catch (Exception e) {
            log.error("Error reading file {} in sandbox {}: {}", path, sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            throw new RuntimeException("读取文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 读取文件（二进制） - 使用 SDK
     */
    public byte[] readFileBytes(String sandboxId, String path) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            return sandbox.files().readByteArray(path);
            
        } catch (Exception e) {
            log.error("Error reading file bytes {} in sandbox {}: {}", path, sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            throw new RuntimeException("读取文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 写入文件 - 使用 SDK
     */
    public void writeFile(String sandboxId, FileWriteRequest request) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            WriteEntry writeEntry = WriteEntry.builder()
                    .data(request.getContent().getBytes(java.nio.charset.StandardCharsets.UTF_8))
                    .mode(request.getMode())
                    .path(request.getPath())
                    .build();
            sandbox.files().write(Collections.singletonList(writeEntry));
            
        } catch (Exception e) {
            log.error("Error writing file {} in sandbox {}: {}", request.getPath(), sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            throw new RuntimeException("写入文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 上传文件（二进制） - 使用 SDK
     */
    public void uploadFile(String sandboxId, String path, byte[] content, int mode) {
        try {
            Sandbox sandbox = getSandbox(sandboxId); WriteEntry writeEntry = WriteEntry.builder()
                    .data(content)
                    .mode(mode).path(path)
                    .build();
            sandbox.files().write(Collections.singletonList(writeEntry));
            
        } catch (Exception e) {
            log.error("Error uploading file {} in sandbox {}: {}", path, sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            throw new RuntimeException("上传文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 删除文件 - 使用 SDK
     */
    public void deleteFiles(String sandboxId, List<String> paths) {
        try {
            Sandbox sandbox = getSandbox(sandboxId);
            sandbox.files().deleteFiles(paths);
            
        } catch (Exception e) {
            log.error("Error deleting files in sandbox {}: {}", sandboxId, e.getMessage(), e);
            sandboxCache.remove(sandboxId);
            throw new RuntimeException("删除文件失败: " + e.getMessage(), e);
        }
    }

    /**
     * 移除缓存的沙箱连接
     */
    public void removeSandboxFromCache(String sandboxId) {
        Sandbox sandbox = sandboxCache.remove(sandboxId);
        if (sandbox != null) {
            try {
                sandbox.close();
            } catch (Exception e) {
                log.warn("Error closing sandbox {}: {}", sandboxId, e.getMessage());
            }
        }
    }
}
