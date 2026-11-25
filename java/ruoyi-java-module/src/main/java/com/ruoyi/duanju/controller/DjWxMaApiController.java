package com.ruoyi.duanju.controller;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.duanju.service.DjGameService;

/**
 * 《漫剧大导演》微信小程序端接口 Controller (对接 RuoYi-App uni-app 前端)
 * 说明：在若依 SecurityConfig 中可将 /app-api/duanju/** 配置为 permitAll 或走小程序 OpenID Token 过滤器
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/app-api/duanju")
public class DjWxMaApiController extends BaseController {

    @Autowired
    private DjGameService djGameService;

    /**
     * 1. 小程序冷启动初始化接口：拉取上架剧本列表、28图鉴字典、全局提审/广告配置及全服神剧跑马灯
     */
    @GetMapping("/bootstrap")
    public AjaxResult bootstrap(@RequestParam(required = false, defaultValue = "wx_guest_001") String openid) {
        return AjaxResult.success(djGameService.getMiniProgramBootstrap(openid));
    }

    /**
     * 2. 主演改名内容安全检测接口（对接本地敏感词黑名单 + 微信官方 security.msgSecCheck 2.0）
     */
    @PostMapping("/checkName")
    public AjaxResult checkActorName(@RequestBody Map<String, Object> body) {
        String name = String.valueOf(body.getOrDefault("actorName", "")).trim();
        String openid = String.valueOf(body.getOrDefault("openid", "wx_guest_001"));
        Map<String, Object> checkResult = djGameService.checkActorNameSafety(name, openid);
        if (Boolean.TRUE.equals(checkResult.get("pass"))) {
            return AjaxResult.success("名字合法，准许开拍！", checkResult);
        } else {
            return AjaxResult.error(String.valueOf(checkResult.get("reason")));
        }
    }

    /**
     * 3. 杀青战绩上报与服务端防作弊复算接口 (AC-MP-03.2 & AC-ADM-02)
     * 接收参数：openid, nickname, avatarUrl, scriptId, actorName, choicePath(6集选项ID数组),
     *          clientScore, unlockedCards
     */
    @PostMapping("/shoot/submit")
    public AjaxResult submitShootRecord(@RequestBody Map<String, Object> payload) {
        try {
            Map<String, Object> result = djGameService.verifyAndSubmitShoot(payload);
            return AjaxResult.success("杀青战绩上报成功", result);
        } catch (IllegalArgumentException e) {
            return AjaxResult.error(400, e.getMessage());
        }
    }

    /**
     * 4. 获取多维封神排行榜（单剧最高分榜 Top 100 / 全服百亿导演总榜 Top 100）
     */
    @GetMapping("/leaderboard")
    public AjaxResult getLeaderboard(
            @RequestParam(defaultValue = "script") String boardType,
            @RequestParam(defaultValue = "script_01_zhuixu") String scriptId,
            @RequestParam(defaultValue = "wx_guest_001") String openid) {
        return AjaxResult.success(djGameService.getPublicLeaderboard(boardType, scriptId, openid));
    }
}
