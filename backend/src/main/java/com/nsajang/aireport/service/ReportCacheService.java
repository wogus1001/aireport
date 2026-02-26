package com.nsajang.aireport.service;

import com.nsajang.aireport.entity.ReportCache;
import com.nsajang.aireport.repository.ReportCacheRepository;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportCacheService {

    private final ReportCacheRepository reportCacheRepository;

    public ReportCacheService(ReportCacheRepository reportCacheRepository) {
        this.reportCacheRepository = reportCacheRepository;
    }

    @Transactional(readOnly = true)
    public Optional<ReportCache> findByAddressKey(String addressKey) {
        return reportCacheRepository.findByAddressKeyAndExpiresAtAfter(addressKey, LocalDateTime.now());
    }

    @Transactional
    public ReportCache save(String addressKey, String reportJson, String publicDataJson) {
        ReportCache cache = reportCacheRepository.findByAddressKey(addressKey)
                .orElseGet(ReportCache::new);

        cache.setAddressKey(addressKey);
        cache.setReportJson(reportJson);
        cache.setPublicDataJson(publicDataJson);
        cache.setExpiresAt(LocalDateTime.now().plusHours(24));

        return reportCacheRepository.save(cache);
    }
}
