package com.nsajang.aireport.service;

import com.nsajang.aireport.entity.Lead;
import com.nsajang.aireport.repository.LeadRepository;
import java.time.LocalDateTime;
import net.nurigo.sdk.NurigoApp;
import net.nurigo.sdk.message.model.KakaoOption;
import net.nurigo.sdk.message.model.Message;
import net.nurigo.sdk.message.request.SingleMessageSendingRequest;
import net.nurigo.sdk.message.service.DefaultMessageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class AlimtalkService {

    private static final Logger log = LoggerFactory.getLogger(AlimtalkService.class);

    @Value("${solapi.api-key:}")
    private String apiKey;

    @Value("${solapi.api-secret:}")
    private String apiSecret;

    @Value("${solapi.sender:}")
    private String sender;

    @Value("${solapi.template-id:}")
    private String templateId;

    private final LeadRepository leadRepository;

    public AlimtalkService(LeadRepository leadRepository) {
        this.leadRepository = leadRepository;
    }

    public void sendLeadReportMessage(Lead lead) {
        if (lead == null) {
            return;
        }

        if (isBlank(apiKey) || isBlank(apiSecret) || isBlank(sender)) {
            log.info("SOLAPI not configured. Skip message send.");
            return;
        }

        String targetPhone = lead.getPhone() == null ? "" : lead.getPhone().trim();
        if (targetPhone.isEmpty()) {
            log.warn("Skip message send because target phone is empty.");
            return;
        }

        String safeName = lead.getName() == null ? "고객" : lead.getName().trim();
        String reportUrl = lead.getReportUrl();
        String safeReportUrl = (reportUrl == null || reportUrl.isBlank()) ? "-" : reportUrl.trim();
        String text = String.format("[내일사장] %s님의 상권분석 리포트: %s", safeName, safeReportUrl);

        try {
            DefaultMessageService messageService = NurigoApp.INSTANCE.initialize(
                    apiKey,
                    apiSecret,
                    "https://api.coolsms.co.kr"
            );
            Message message = new Message();
            message.setFrom(sender.trim());
            message.setTo(targetPhone);
            message.setText(text);

            if (!isBlank(templateId)) {
                KakaoOption kakaoOption = new KakaoOption();
                kakaoOption.setTemplateId(templateId.trim());
                message.setKakaoOptions(kakaoOption);
            }

            messageService.sendOne(new SingleMessageSendingRequest(message));
            lead.setAlimtalkSent(true);
            lead.setAlimtalkSentAt(LocalDateTime.now());
            leadRepository.save(lead);
            log.info("Lead report message sent to {}", targetPhone);
        } catch (Exception exception) {
            log.warn("Failed to send SOLAPI message, continue without blocking lead save.", exception);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
