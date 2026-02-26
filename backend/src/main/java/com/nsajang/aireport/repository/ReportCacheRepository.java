package com.nsajang.aireport.repository;

import com.nsajang.aireport.entity.ReportCache;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportCacheRepository extends JpaRepository<ReportCache, Long> {

    Optional<ReportCache> findByAddressKey(String addressKey);

    Optional<ReportCache> findByAddressKeyAndExpiresAtAfter(String addressKey, LocalDateTime now);
}
