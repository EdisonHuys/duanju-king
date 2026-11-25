package com.ruoyi.duanju.domain;

import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 剧本配置业务对象 dj_script
 * 对齐阿里巴巴 Java 开发手册规范，继承 BaseEntity 审计字段
 * 
 * @author ruoyi
 */
public class DjScript extends BaseEntity {
    private static final long serialVersionUID = 1L;

    /** 主键ID */
    private Long id;

    /** 剧本业务编码 */
    private String scriptId;

    /** 剧本主标题 */
    private String title;

    /** 剧本副标题 */
    private String subtitle;

    /** 题材分类标签 */
    private String tag;

    /** 是否推荐(1是 0否) */
    private String recommend;

    /** 难度星级(1-3) */
    private Integer difficulty;

    /** 总集数 */
    private Integer totalEpisodes;

    /** 结局总数 */
    private Integer endingCount;

    /** 波普主题色 */
    private String coverTheme;

    /** 封面插画路径 */
    private String coverImage;

    /** 默认主角姓名 */
    private String defaultProtagonist;

    /** 首屏剧情梗概 */
    private String synopsis;

    /** 初始四维属性JSON */
    private String initialStatsJson;

    /** 分集分镜与选项配置JSON */
    private String episodesJson;

    /** 结局判定与评价规则JSON */
    private String endingsJson;

    /** 剧本版本号 */
    private Integer version;

    /** 排序权重 */
    private Integer sortOrder;

    /** 上架状态(0正常 1下架) */
    private String status;

    /** 累计开拍次数 */
    private Long playCount;

    /** 累计完播杀青次数 */
    private Long finishCount;

    /** 逻辑删除标志(0代表存在 2代表删除) */
    private String delFlag;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getScriptId() {
        return scriptId;
    }

    public void setScriptId(String scriptId) {
        this.scriptId = scriptId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSubtitle() {
        return subtitle;
    }

    public void setSubtitle(String subtitle) {
        this.subtitle = subtitle;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public String getRecommend() {
        return recommend;
    }

    public void setRecommend(String recommend) {
        this.recommend = recommend;
    }

    public Integer getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(Integer difficulty) {
        this.difficulty = difficulty;
    }

    public Integer getTotalEpisodes() {
        return totalEpisodes;
    }

    public void setTotalEpisodes(Integer totalEpisodes) {
        this.totalEpisodes = totalEpisodes;
    }

    public Integer getEndingCount() {
        return endingCount;
    }

    public void setEndingCount(Integer endingCount) {
        this.endingCount = endingCount;
    }

    public String getCoverTheme() {
        return coverTheme;
    }

    public void setCoverTheme(String coverTheme) {
        this.coverTheme = coverTheme;
    }

    public String getCoverImage() {
        return coverImage;
    }

    public void setCoverImage(String coverImage) {
        this.coverImage = coverImage;
    }

    public String getDefaultProtagonist() {
        return defaultProtagonist;
    }

    public void setDefaultProtagonist(String defaultProtagonist) {
        this.defaultProtagonist = defaultProtagonist;
    }

    public String getSynopsis() {
        return synopsis;
    }

    public void setSynopsis(String synopsis) {
        this.synopsis = synopsis;
    }

    public String getInitialStatsJson() {
        return initialStatsJson;
    }

    public void setInitialStatsJson(String initialStatsJson) {
        this.initialStatsJson = initialStatsJson;
    }

    public String getEpisodesJson() {
        return episodesJson;
    }

    public void setEpisodesJson(String episodesJson) {
        this.episodesJson = episodesJson;
    }

    public String getEndingsJson() {
        return endingsJson;
    }

    public void setEndingsJson(String endingsJson) {
        this.endingsJson = endingsJson;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getPlayCount() {
        return playCount;
    }

    public void setPlayCount(Long playCount) {
        this.playCount = playCount;
    }

    public Long getFinishCount() {
        return finishCount;
    }

    public void setFinishCount(Long finishCount) {
        this.finishCount = finishCount;
    }

    public String getDelFlag() {
        return delFlag;
    }

    public void setDelFlag(String delFlag) {
        this.delFlag = delFlag;
    }
}
