package com.opensandbox.backend.dto;

import lombok.Data;

@Data
public class FileListRequest {
    
    private String path = "/";
    private String pattern = "*";
    private boolean recursive = false;
}
