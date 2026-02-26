package com.nsajang.aireport.controller;

import com.nsajang.aireport.dto.LeadRequestDto;
import com.nsajang.aireport.dto.LeadResponseDto;
import com.nsajang.aireport.service.LeadService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class LeadController {

    private final LeadService leadService;

    public LeadController(LeadService leadService) {
        this.leadService = leadService;
    }

    @PostMapping("/leads")
    public ResponseEntity<LeadResponseDto> createLead(@Valid @RequestBody LeadRequestDto dto) {
        LeadResponseDto response = leadService.saveLead(dto);
        return ResponseEntity.ok(response);
    }
}
