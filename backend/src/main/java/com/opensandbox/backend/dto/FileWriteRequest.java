package com.opensandbox.backend.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class FileWriteRequest {
    
    @NotBlank(message = "文件路径不能为空")
    private String path;
    
    @NotBlank(message = "文件内容不能为空")
    private String content;
    
    private Integer mode = 644;
}
