package com.nsajang.aireport.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "leads")
public class Lead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "target_area", nullable = false, length = 200)
    private String targetArea;

    @Column(name = "report_url", length = 500)
    private String reportUrl;

    @Column(name = "alimtalk_sent", nullable = false)
    private boolean alimtalkSent = false;

    @Column(name = "alimtalk_sent_at")
    private LocalDateTime alimtalkSentAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getTargetArea() {
        return targetArea;
    }

    public void setTargetArea(String targetArea) {
        this.targetArea = targetArea;
    }

    public String getReportUrl() {
        return reportUrl;
    }

    public void setReportUrl(String reportUrl) {
        this.reportUrl = reportUrl;
    }

    public boolean isAlimtalkSent() {
        return alimtalkSent;
    }

    public void setAlimtalkSent(boolean alimtalkSent) {
        this.alimtalkSent = alimtalkSent;
    }

    public LocalDateTime getAlimtalkSentAt() {
        return alimtalkSentAt;
    }

    public void setAlimtalkSentAt(LocalDateTime alimtalkSentAt) {
        this.alimtalkSentAt = alimtalkSentAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
