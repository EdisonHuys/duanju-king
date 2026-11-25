package com.ruoyi.duanju.domain;

import java.math.BigDecimal;
import java.util.Date;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 玩家导演用户对象 dj_user
 * 对应《漫剧大导演》多端导演账号体系
 * 
 * @author ruoyi
 */
public class DjUser extends BaseEntity {
    private static final long serialVersionUID = 1L;

    /** 用户主键ID */
    private Long userId;

    /** 微信OpenID或唯一用户标识 */
    private String wxOpenid;

    /** 登录账号用户名 */
    private String userName;

    /** 登录密码密文 */
    private String password;

    /** 绑定手机号 */
    private String phone;

    /** 导演对外昵称 */
    private String nickname;

    /** 头像徽章 */
    private String avatarUrl;

    /** 主演改名定制名 */
    private String customActorName;

    /** 已解锁图鉴列表JSON */
    private String unlockedCardsJson;

    /** 已解锁图鉴数量 */
    private Integer unlockedCount;

    /** 累计斩获票房(播放量) */
    private Long totalBoxOffice;

    /** 历史最高评分 */
    private BigDecimal bestScore;

    /** 执导拍摄总部数 */
    private Integer shootCount;

    /** 最后登录时间 */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date lastLoginTime;

    /** 最后登录IP */
    private String lastLoginIp;

    /** 账号状态(0正常 1停用/违规) */
    private String status;

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

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getNickname() {
        return nickname;
    }

    public void setNickname(String nickname) {
        this.nickname = nickname;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public String getCustomActorName() {
        return customActorName;
    }

    public void setCustomActorName(String customActorName) {
        this.customActorName = customActorName;
    }

    public String getUnlockedCardsJson() {
        return unlockedCardsJson;
    }

    public void setUnlockedCardsJson(String unlockedCardsJson) {
        this.unlockedCardsJson = unlockedCardsJson;
    }

    public Integer getUnlockedCount() {
        return unlockedCount;
    }

    public void setUnlockedCount(Integer unlockedCount) {
        this.unlockedCount = unlockedCount;
    }

    public Long getTotalBoxOffice() {
        return totalBoxOffice;
    }

    public void setTotalBoxOffice(Long totalBoxOffice) {
        this.totalBoxOffice = totalBoxOffice;
    }

    public BigDecimal getBestScore() {
        return bestScore;
    }

    public void setBestScore(BigDecimal bestScore) {
        this.bestScore = bestScore;
    }

    public Integer getShootCount() {
        return shootCount;
    }

    public void setShootCount(Integer shootCount) {
        this.shootCount = shootCount;
    }

    public Date getLastLoginTime() {
        return lastLoginTime;
    }

    public void setLastLoginTime(Date lastLoginTime) {
        this.lastLoginTime = lastLoginTime;
    }

    public String getLastLoginIp() {
        return lastLoginIp;
    }

    public void setLastLoginIp(String lastLoginIp) {
        this.lastLoginIp = lastLoginIp;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
