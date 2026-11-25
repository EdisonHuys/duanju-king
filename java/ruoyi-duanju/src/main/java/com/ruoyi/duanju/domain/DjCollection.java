package com.ruoyi.duanju.domain;

import com.ruoyi.common.core.domain.BaseEntity;

/**
 * 28图鉴业务实体 dj_collection
 * 
 * @author ruoyi
 */
public class DjCollection extends BaseEntity {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String cardId;
    private String scriptId;
    private String type;
    private String rarity;
    private String title;
    private String hint;
    private String iconImage;
    private Long unlockCount;
    private String delFlag;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCardId() { return cardId; }
    public void setCardId(String cardId) { this.cardId = cardId; }

    public String getScriptId() { return scriptId; }
    public void setScriptId(String scriptId) { this.scriptId = scriptId; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getRarity() { return rarity; }
    public void setRarity(String rarity) { this.rarity = rarity; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getHint() { return hint; }
    public void setHint(String hint) { this.hint = hint; }

    public String getIconImage() { return iconImage; }
    public void setIconImage(String iconImage) { this.iconImage = iconImage; }

    public Long getUnlockCount() { return unlockCount; }
    public void setUnlockCount(Long unlockCount) { this.unlockCount = unlockCount; }

    public String getDelFlag() { return delFlag; }
    public void setDelFlag(String delFlag) { this.delFlag = delFlag; }
}
