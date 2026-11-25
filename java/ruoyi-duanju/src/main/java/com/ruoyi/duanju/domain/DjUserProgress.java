package com.ruoyi.duanju.domain;

import java.math.BigDecimal;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 用户剧本拍摄进度档期业务对象 dj_user_progress
 * 支撑多用户各剧本拍摄集数追踪与断点续拍
 * 
 * @author ruoyi
 */
public class DjUserProgress extends BaseEntity {
    private static final long serialVersionUID = 1L;

    /** 主键ID */
    private Long id;

    /** 关联玩家用户ID */
    private Long userId;

    /** 微信OpenID或唯一用户标识 */
    private String wxOpenid;

    /** 剧本业务编码(如script_01_zhuixu) */
    private String scriptId;

    /** 剧本标题 */
    private String scriptTitle;

    /** 当前拍摄集数(1-6) */
    private Integer currentEpisode;

    /** 当前集分镜幕数(0-3) */
    private Integer currentPanel;

    /** 已完成各集选项轨迹与剧情流水JSON */
    private String historyChoicesJson;

    /** 当前五维数值JSON */
    private String currentStatsJson;

    /** 是否已杀青(0拍摄中 1已完播杀青) */
    private String isFinished;

    /** 杀青评分 */
    private BigDecimal finishScore;

    /** 杀青票房(播放量) */
    private Long finishBoxOffice;

    /** 最近拍摄存档时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date lastShootTime;

    /** 用户昵称(视图冗余展示) */
    private String nickname;

    /** 登录用户名(视图冗余展示) */
    private String userName;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getWxOpenid() {
        return wxOpenid;
    }

    public void setWxOpenid(String wxOpenid) {
        this.wxOpenid = wxOpenid;
    }

    public String getScriptId() {
        return scriptId;
    }

    public void setScriptId(String scriptId) {
        this.scriptId = scriptId;
    }

    public String getScriptTitle() {
        return scriptTitle;
    }

    public void setScriptTitle(String scriptTitle) {
        this.scriptTitle = scriptTitle;
    }

    public Integer getCurrentEpisode() {
        return currentEpisode;
    }

    public void setCurrentEpisode(Integer currentEpisode) {
        this.currentEpisode = currentEpisode;
    }

    public Integer getCurrentPanel() {
        return currentPanel;
    }

    public void setCurrentPanel(Integer currentPanel) {
        this.currentPanel = currentPanel;
    }

    public String getHistoryChoicesJson() {
        return historyChoicesJson;
    }

    public void setHistoryChoicesJson(String historyChoicesJson) {
        this.historyChoicesJson = historyChoicesJson;
    }

    public String getCurrentStatsJson() {
        return currentStatsJson;
    }

    public void setCurrentStatsJson(String currentStatsJson) {
        this.currentStatsJson = currentStatsJson;
    }

    public String getIsFinished() {
        return isFinished;
    }

    public void setIsFinished(String isFinished) {
        this.isFinished = isFinished;
    }

    public BigDecimal getFinishScore() {
        return finishScore;
    }

    public void setFinishScore(BigDecimal finishScore) {
        this.finishScore = finishScore;
    }

    public Long getFinishBoxOffice() {
        return finishBoxOffice;
    }

    public void setFinishBoxOffice(Long finishBoxOffice) {
        this.finishBoxOffice = finishBoxOffice;
    }

    public Date getLastShootTime() {
        return lastShootTime;
    }

    public void setLastShootTime(Date lastShootTime) {
        this.lastShootTime = lastShootTime;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }
}
