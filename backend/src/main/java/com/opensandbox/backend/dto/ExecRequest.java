package com.opensandbox.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class ExecRequest {
    
    @NotBlank(message = "命令不能为空")
    private String command;
    
    private String workDir;
    
    private Map<String, String> env;
    
    private Long timeoutSeconds;
}
