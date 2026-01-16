package com.opensandbox.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FileInfo {
    
    private String name;
    private String path;
    private String type; // file, directory, symlink
    private long size;
    private int mode;
    private String modTime;
}
