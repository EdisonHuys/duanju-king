package com.ruoyi.duanju.controller;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.ruoyi.common.annotation.Log;
import com.ruoyi.common.core.controller.BaseController;
import com.ruoyi.common.core.domain.AjaxResult;
import com.ruoyi.common.core.page.TableDataInfo;
import com.ruoyi.common.enums.BusinessType;
import com.ruoyi.duanju.service.DjGameService;

/**
 * 《漫剧大导演》若依管理后台 Controller (对接 RuoYi-Vue3 管理端)
 * 
 * @author ruoyi
 */
@RestController
@RequestMapping("/duanju")
public class DjAdminController extends BaseController {

    @Autowired
    private DjGameService djGameService;

    /** 1. 获取运营数据看板与每集选项点击漏斗 (F-ADM-04) */
    @PreAuthorize("@ss.hasPermi('duanju:dashboard:view')")
    @GetMapping("/dashboard/stats")
    public AjaxResult getDashboardStats(@RequestParam(required = false) String scriptId) {
        return AjaxResult.success(djGameService.getDashboardStats(scriptId));
    }

    /** 2. 查询剧本列表 (F-ADM-01) */
    @PreAuthorize("@ss.hasPermi('duanju:script:list')")
    @GetMapping("/script/list")
    public TableDataInfo listScripts(@RequestParam Map<String, Object> params) {
        startPage();
        List<Map<String, Object>> list = djGameService.selectScriptList(params);
        return getDataTable(list);
    }

    /** 3. 新增或修改剧本（含6集分镜JSON与4大结局规则，自动递增version版本号实现热更） */
    @PreAuthorize("@ss.hasPermi('duanju:script:list')")
    @Log(title = "短剧剧本管理", businessType = BusinessType.UPDATE)
    @PostMapping("/script/save")
    public AjaxResult saveScript(@RequestBody Map<String, Object> scriptData) {
        return toAjax(djGameService.saveOrUpdateScript(scriptData, getUsername()));
    }

    /** 4. 剧本上下架状态热切换 */
    @PreAuthorize("@ss.hasPermi('duanju:script:list')")
    @Log(title = "短剧剧本状态", businessType = BusinessType.UPDATE)
    @PutMapping("/script/status")
    public AjaxResult changeScriptStatus(@RequestBody Map<String, Object> body) {
        return toAjax(djGameService.updateScriptStatus(
            String.valueOf(body.get("scriptId")),
            String.valueOf(body.get("status"))
        ));
    }

    /** 5. 批量导入 SCRIPTS_DATABASE.json */
    @PreAuthorize("@ss.hasPermi('duanju:script:list')")
    @Log(title = "短剧剧本JSON导入", businessType = BusinessType.IMPORT)
    @PostMapping("/script/importJson")
    public AjaxResult importScriptJson(@RequestBody Map<String, Object> fullDatabaseJson) {
        return AjaxResult.success(djGameService.importFullJsonDatabase(fullDatabaseJson));
    }

    /** 6. 查询 28 图鉴配置列表 (F-ADM-02) */
    @PreAuthorize("@ss.hasPermi('duanju:collection:list')")
    @GetMapping("/collection/list")
    public TableDataInfo listCollections(@RequestParam Map<String, Object> params) {
        startPage();
        List<Map<String, Object>> list = djGameService.selectCollectionList(params);
        return getDataTable(list);
    }

    /** 7. 修改图鉴信息（名称、稀有度、未解锁提示语） */
    @PreAuthorize("@ss.hasPermi('duanju:collection:list')")
    @Log(title = "短剧28图鉴管理", businessType = BusinessType.UPDATE)
    @PutMapping("/collection")
    public AjaxResult updateCollection(@RequestBody Map<String, Object> collection) {
        return toAjax(djGameService.updateCollection(collection));
    }

    /** 8. 查询封神排行榜列表 (F-ADM-02) */
    @PreAuthorize("@ss.hasPermi('duanju:leaderboard:list')")
    @GetMapping("/leaderboard/list")
    public TableDataInfo listLeaderboard(@RequestParam Map<String, Object> params) {
        startPage();
        List<Map<String, Object>> list = djGameService.selectLeaderboardList(params);
        return getDataTable(list);
    }

    /** 9. 排行榜风控操作：一键下榜 / 重置违规主演名 / 封禁作弊账号 */
    @PreAuthorize("@ss.hasPermi('duanju:leaderboard:list')")
    @Log(title = "短剧排行榜风控", businessType = BusinessType.UPDATE)
    @PostMapping("/leaderboard/moderate")
    public AjaxResult moderateLeaderboard(@RequestBody Map<String, Object> body) {
        return toAjax(djGameService.moderateLeaderboard(body));
    }

    /** 10. 查询玩家拍摄杀青流水日志 */
    @PreAuthorize("@ss.hasPermi('duanju:record:list')")
    @GetMapping("/record/list")
    public TableDataInfo listRecords(@RequestParam Map<String, Object> params) {
        startPage();
        List<Map<String, Object>> list = djGameService.selectShootRecordList(params);
        return getDataTable(list);
    }

    /** 11. 获取与更新风控、敏感词、激励广告及微信提审纯净模式开关 (F-ADM-03 & F-ADM-05) */
    @PreAuthorize("@ss.hasPermi('duanju:config:edit')")
    @GetMapping("/config")
    public AjaxResult getConfig() {
        return AjaxResult.success(djGameService.getGlobalConfigs());
    }

    @PreAuthorize("@ss.hasPermi('duanju:config:edit')")
    @Log(title = "短剧风控与提审配置", businessType = BusinessType.UPDATE)
    @PutMapping("/config")
    public AjaxResult updateConfig(@RequestBody Map<String, Object> configMap) {
        djGameService.updateGlobalConfigs(configMap);
        return AjaxResult.success("配置更新成功，小程序端已实时生效");
    }
}
