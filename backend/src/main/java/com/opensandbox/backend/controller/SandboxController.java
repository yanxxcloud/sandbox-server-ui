package com.opensandbox.backend.controller;

import com.opensandbox.backend.dto.*;
import com.opensandbox.backend.service.SandboxService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/sandboxes")
@RequiredArgsConstructor
public class SandboxController {

    private final SandboxService sandboxService;

    /**
     * 执行命令
     */
    @PostMapping("/{sandboxId}/exec")
    public ResponseEntity<ExecResponse> executeCommand(
            @PathVariable String sandboxId,
            @Valid @RequestBody ExecRequest request) {
        
        log.info("Executing command in sandbox {}: {}", sandboxId, request.getCommand());
        ExecResponse response = sandboxService.executeCommand(sandboxId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * 列出文件
     */
    @GetMapping("/{sandboxId}/files")
    public ResponseEntity<List<FileInfo>> listFiles(
            @PathVariable String sandboxId,
            @RequestParam(defaultValue = "/") String path,
            @RequestParam(defaultValue = "*") String pattern) {
        
        FileListRequest request = new FileListRequest();
        request.setPath(path);
        request.setPattern(pattern);
        
        List<FileInfo> files = sandboxService.listFiles(sandboxId, request);
        return ResponseEntity.ok(files);
    }

    /**
     * 读取文件内容
     */
    @GetMapping("/{sandboxId}/files/read")
    public ResponseEntity<Map<String, String>> readFile(
            @PathVariable String sandboxId,
            @RequestParam String path) {
        
        String content = sandboxService.readFile(sandboxId, path);
        return ResponseEntity.ok(Map.of("content", content, "path", path));
    }

    /**
     * 下载文件
     */
    @GetMapping("/{sandboxId}/files/download")
    public ResponseEntity<byte[]> downloadFile(
            @PathVariable String sandboxId,
            @RequestParam String path) {
        
        byte[] content = sandboxService.readFileBytes(sandboxId, path);
        
        String filename = path.substring(path.lastIndexOf('/') + 1);
        String encodedFilename = URLEncoder.encode(filename, StandardCharsets.UTF_8);
        
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, 
                        "attachment; filename=\"" + encodedFilename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(content);
    }

    /**
     * 写入文件（文本）
     */
    @PostMapping("/{sandboxId}/files/write")
    public ResponseEntity<Map<String, Object>> writeFile(
            @PathVariable String sandboxId,
            @Valid @RequestBody FileWriteRequest request) {
        
        sandboxService.writeFile(sandboxId, request);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "path", request.getPath(),
                "message", "文件写入成功"
        ));
    }

    /**
     * 上传文件
     */
    @PostMapping("/{sandboxId}/files/upload")
    public ResponseEntity<Map<String, Object>> uploadFile(
            @PathVariable String sandboxId,
            @RequestParam String path,
            @RequestParam(defaultValue = "644") int mode,
            @RequestParam("file") MultipartFile file) {
        
        try {
            byte[] content = file.getBytes();
            sandboxService.uploadFile(sandboxId, path, content, mode);
            
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "path", path,
                    "size", content.length,
                    "message", "文件上传成功"
            ));
        } catch (Exception e) {
            log.error("Upload failed: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * 删除文件
     */
    @DeleteMapping("/{sandboxId}/files")
    public ResponseEntity<Map<String, Object>> deleteFiles(
            @PathVariable String sandboxId,
            @RequestBody List<String> paths) {
        
        sandboxService.deleteFiles(sandboxId, paths);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "deleted", paths,
                "message", "文件删除成功"
        ));
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "service", "sandbox-backend"
        ));
    }
}
