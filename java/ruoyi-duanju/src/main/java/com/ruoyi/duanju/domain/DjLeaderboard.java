package com.ruoyi.duanju.domain;

import java.math.BigDecimal;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 单剧最佳战绩排行榜业务实体 dj_leaderboard
 * 
 * @author ruoyi
 */
public class DjLeaderboard extends BaseEntity {
    private static final long serialVersionUID = 1L;

    private Long rankId;
    private String scriptId;
    private Long userId;
    private String wxOpenid;
    private String nickname;
    private String avatarUrl;
    private String actorName;
    private String endingId;
    private String endingTitle;
    private String endingBadge;
    private BigDecimal qualityScore;
    private Long boxOffice;
    private String choicePath;
    private String status;
    private String delFlag;

    public Long getRankId() { return rankId; }
    public void setRankId(Long rankId) { this.rankId = rankId; }

    public String getScriptId() { return scriptId; }
    public void setScriptId(String scriptId) { this.scriptId = scriptId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getWxOpenid() { return wxOpenid; }
    public void setWxOpenid(String wxOpenid) { this.wxOpenid = wxOpenid; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }

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

    public String getChoicePath() { return choicePath; }
    public void setChoicePath(String choicePath) { this.choicePath = choicePath; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDelFlag() { return delFlag; }
    public void setDelFlag(String delFlag) { this.delFlag = delFlag; }
}
