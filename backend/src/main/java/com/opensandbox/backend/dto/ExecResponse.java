package com.opensandbox.backend.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class ExecResponse {
    
    private int exitCode;
    private List<String> stdout;
    private List<String> stderr;
    private long executionTimeMs;
    private boolean success;
    private String error;
}
