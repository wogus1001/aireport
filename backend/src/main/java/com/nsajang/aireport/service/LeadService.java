package com.nsajang.aireport.service;

import com.nsajang.aireport.dto.LeadRequestDto;
import com.nsajang.aireport.dto.LeadResponseDto;
import com.nsajang.aireport.entity.Lead;
import com.nsajang.aireport.repository.LeadRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeadService {

    private final LeadRepository leadRepository;
    private final AlimtalkService alimtalkService;

    public LeadService(LeadRepository leadRepository, AlimtalkService alimtalkService) {
        this.leadRepository = leadRepository;
        this.alimtalkService = alimtalkService;
    }

    @Transactional
    public LeadResponseDto saveLead(LeadRequestDto dto) {
        Lead lead = new Lead();
        lead.setName(dto.getName().trim());
        lead.setPhone(dto.getPhone().trim());
        lead.setTargetArea(dto.getTargetArea().trim());
        lead.setReportUrl(dto.getReportUrl() == null ? null : dto.getReportUrl().trim());

        Lead saved = leadRepository.save(lead);
        alimtalkService.sendLeadReportMessage(saved);

        return new LeadResponseDto(saved.getId(), true, "리드 저장 완료");
    }
}
