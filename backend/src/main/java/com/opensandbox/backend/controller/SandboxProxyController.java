package com.opensandbox.backend.controller;

import com.opensandbox.backend.config.OpenSandboxConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StreamUtils;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

/**
 * 代理控制器 - 将请求代理到 OpenSandbox 服务
 * 解决跨域问题
 */
@Slf4j
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SandboxProxyController {

    private final OpenSandboxConfig config;
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build();

    /**
     * 代理所有 /sandboxes 相关的请求到 OpenSandbox 服务
     * 排除 WebSocket 升级请求（通过 headers 条件排除），由 WebSocketHandler 处理
     */
    @RequestMapping(
        value = "/sandboxes/**", 
        method = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.PATCH, RequestMethod.OPTIONS},
        headers = "!Upgrade"  // 排除 WebSocket 升级请求
    )
    public ResponseEntity<?> proxyRequest(HttpServletRequest request) throws IOException {
        
        String requestURI = request.getRequestURI();
        
        // 额外检查：排除 /terminal 路径（双重保险）
        // 如果路径包含 /terminal，说明 headers 条件没有生效，直接返回 404
        // 让 Spring 继续寻找其他处理器（WebSocketHandler）
        if (requestURI.contains("/terminal")) {
            log.debug("Skipping WebSocket path: {}", requestURI);
            return ResponseEntity.notFound().build();
        }
        
        // 构建目标 URL
        String path = requestURI.replace("/api", "");
        String queryString = request.getQueryString();
        String targetUrl = String.format("%s://%s%s%s",
                config.getProtocol(),
                config.getDomain(),
                path,
                queryString != null ? "?" + queryString : "");
        
        log.debug("Proxying request: {} {} -> {}", request.getMethod(), requestURI, targetUrl);
        
        // 读取请求体
        byte[] requestBodyBytes = StreamUtils.copyToByteArray(request.getInputStream());
        String requestBody = new String(requestBodyBytes, StandardCharsets.UTF_8);
        
        // 构建请求
        Request.Builder requestBuilder = new Request.Builder()
                .url(targetUrl);
        
        // 添加 API Key
        if (config.getApiKey() != null && !config.getApiKey().isEmpty()) {
            requestBuilder.header("X-API-Key", config.getApiKey());
        }
        
        // 复制请求头（排除一些不需要的）
        java.util.Enumeration<String> headerNames = request.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            String lowerHeaderName = headerName.toLowerCase();
            // 跳过一些不需要的请求头
            if (!lowerHeaderName.equals("host") && 
                !lowerHeaderName.equals("content-length") &&
                !lowerHeaderName.equals("connection") &&
                !lowerHeaderName.equals("transfer-encoding")) {
                String headerValue = request.getHeader(headerName);
                requestBuilder.header(headerName, headerValue);
            }
        }
        
        // 根据请求方法设置请求体
        String method = request.getMethod();
        okhttp3.RequestBody body = null;
        
        if ("GET".equals(method) || "DELETE".equals(method) || "OPTIONS".equals(method)) {
            body = null;
        } else if (requestBodyBytes.length > 0) {
            String contentType = request.getContentType();
            if (contentType == null) {
                contentType = MediaType.APPLICATION_JSON_VALUE;
            }
            body = okhttp3.RequestBody.create(
                    requestBodyBytes,
                    okhttp3.MediaType.parse(contentType)
            );
        } else {
            // 空请求体
            String contentType = request.getContentType();
            if (contentType == null) {
                contentType = MediaType.APPLICATION_JSON_VALUE;
            }
            body = okhttp3.RequestBody.create(new byte[0], okhttp3.MediaType.parse(contentType));
        }
        
        Request okHttpRequest = requestBuilder.method(method, body).build();
        
        // 执行请求
        try (Response response = httpClient.newCall(okHttpRequest).execute()) {
            byte[] responseBodyBytes = response.body() != null ? response.body().bytes() : new byte[0];
            
            // 构建响应
            ResponseEntity.BodyBuilder responseBuilder = ResponseEntity
                    .status(response.code());
            
            // 复制响应头（排除一些不需要的）
            Headers headers = response.headers();
            for (String name : headers.names()) {
                String lowerName = name.toLowerCase();
                // 跳过一些不需要的响应头，特别是 CORS 相关的头（由 Spring CORS 配置处理）
                if (!lowerName.equals("content-encoding") && 
                    !lowerName.equals("transfer-encoding") &&
                    !lowerName.equals("connection") &&
                    !lowerName.equals("content-length") &&
                    !lowerName.equals("access-control-allow-origin") &&
                    !lowerName.equals("access-control-allow-methods") &&
                    !lowerName.equals("access-control-allow-headers") &&
                    !lowerName.equals("access-control-allow-credentials") &&
                    !lowerName.equals("access-control-expose-headers") &&
                    !lowerName.equals("access-control-max-age") &&
                    !lowerName.equals("vary")) {
                    responseBuilder.header(name, headers.get(name));
                }
            }
            
            // 设置 Content-Type
            String contentType = response.header(HttpHeaders.CONTENT_TYPE);
            if (contentType != null) {
                responseBuilder.contentType(MediaType.parseMediaType(contentType));
            }
            
            return responseBuilder.body(responseBodyBytes);
        }
    }
}
