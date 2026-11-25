package com.ruoyi.duanju.domain;

import java.math.BigDecimal;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 拍摄杀青流水业务实体 dj_shoot_record
 * 
 * @author ruoyi
 */
public class DjShootRecord extends BaseEntity {
    private static final long serialVersionUID = 1L;

    private Long recordId;
    private Long userId;
    private String wxOpenid;
    private String nickname;
    private String scriptId;
    private String scriptTitle;
    private String actorName;
    private String choicePath;
    private String finalStatsJson;
    private String endingId;
    private String endingTitle;
    private String endingBadge;
    private BigDecimal qualityScore;
    private Long boxOffice;
    private String verifyStatus;
    private String clientIp;
    private String delFlag;

    public Long getRecordId() { return recordId; }
    public void setRecordId(Long recordId) { this.recordId = recordId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getWxOpenid() { return wxOpenid; }
    public void setWxOpenid(String wxOpenid) { this.wxOpenid = wxOpenid; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getScriptId() { return scriptId; }
    public void setScriptId(String scriptId) { this.scriptId = scriptId; }

    public String getScriptTitle() { return scriptTitle; }
    public void setScriptTitle(String scriptTitle) { this.scriptTitle = scriptTitle; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

    public String getChoicePath() { return choicePath; }
    public void setChoicePath(String choicePath) { this.choicePath = choicePath; }

    public String getFinalStatsJson() { return finalStatsJson; }
    public void setFinalStatsJson(String finalStatsJson) { this.finalStatsJson = finalStatsJson; }

    public String getEndingId() { return endingId; }
    public void setEndingId(String endingId) { this.endingId = endingId; }

    public String getEndingTitle() { return endingTitle; }
    public void setEndingTitle(String endingTitle) { this.endingTitle = endingTitle; }

    public String getEndingBadge() { return endingBadge; }
    public void setEndingBadge(String endingBadge) { this.endingBadge = endingBadge; }

    public BigDecimal getQualityScore() { return qualityScore; }
    public void setQualityScore(BigDecimal qualityScore) { this.qualityScore = qualityScore; }

    public Long getBoxOffice() { return boxOffice; }
    public void setBoxOffice(Long boxOffice) { this.boxOffice = boxOffice; }

    public String getVerifyStatus() { return verifyStatus; }
    public void setVerifyStatus(String verifyStatus) { this.verifyStatus = verifyStatus; }

    public String getClientIp() { return clientIp; }
    public void setClientIp(String clientIp) { this.clientIp = clientIp; }

    public String getDelFlag() { return delFlag; }
    public void setDelFlag(String delFlag) { this.delFlag = delFlag; }
}
