package com.nsajang.aireport.controller;

import com.nsajang.aireport.entity.ReportCache;
import com.nsajang.aireport.service.ReportCacheService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CacheController {

    private final ReportCacheService reportCacheService;

    public CacheController(ReportCacheService reportCacheService) {
        this.reportCacheService = reportCacheService;
    }

    @GetMapping("/cache/{addressKey}")
    public ResponseEntity<CacheLookupResponse> findCache(@PathVariable String addressKey) {
        String trimmedKey = addressKey == null ? "" : addressKey.trim();
        if (trimmedKey.isEmpty()) {
            return ResponseEntity.ok(CacheLookupResponse.miss());
        }

        Optional<ReportCache> cached = reportCacheService.findByAddressKey(trimmedKey);
        if (cached.isEmpty()) {
            String encodedKey = encodeAddressKey(trimmedKey);
            if (!encodedKey.equals(trimmedKey)) {
                cached = reportCacheService.findByAddressKey(encodedKey);
            }
        }

        if (cached.isEmpty()) {
            return ResponseEntity.ok(CacheLookupResponse.miss());
        }

        ReportCache cache = cached.get();
        return ResponseEntity.ok(new CacheLookupResponse(true, cache.getReportJson(), cache.getPublicDataJson()));
    }

    @PostMapping("/cache")
    public ResponseEntity<Map<String, Object>> saveCache(@Valid @RequestBody CacheSaveRequest request) {
        String addressKey = request.getAddressKey().trim();
        String reportJson = request.getReportJson().trim();
        String publicDataJson = request.getPublicDataJson() == null
                ? null
                : request.getPublicDataJson().trim();

        reportCacheService.save(addressKey, reportJson, publicDataJson);
        return ResponseEntity.ok(Map.of("saved", true));
    }

    private String encodeAddressKey(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    static class CacheLookupResponse {
        private final boolean hit;
        private final String reportJson;
        private final String publicDataJson;

        CacheLookupResponse(boolean hit, String reportJson, String publicDataJson) {
            this.hit = hit;
            this.reportJson = reportJson;
            this.publicDataJson = publicDataJson;
        }

        static CacheLookupResponse miss() {
            return new CacheLookupResponse(false, null, null);
        }

        public boolean isHit() {
            return hit;
        }

        public String getReportJson() {
            return reportJson;
        }

        public String getPublicDataJson() {
            return publicDataJson;
        }
    }

    static class CacheSaveRequest {
        @NotBlank
        private String addressKey;

        @NotBlank
        private String reportJson;

        private String publicDataJson;

        public String getAddressKey() {
            return addressKey;
        }

        public void setAddressKey(String addressKey) {
            this.addressKey = addressKey;
        }

        public String getReportJson() {
            return reportJson;
        }

        public void setReportJson(String reportJson) {
            this.reportJson = reportJson;
        }

        public String getPublicDataJson() {
            return publicDataJson;
        }

        public void setPublicDataJson(String publicDataJson) {
            this.publicDataJson = publicDataJson;
        }
    }
}
