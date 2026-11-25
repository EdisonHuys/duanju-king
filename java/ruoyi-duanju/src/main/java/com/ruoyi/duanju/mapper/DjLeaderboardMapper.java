package com.ruoyi.duanju.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.duanju.domain.DjLeaderboard;

/**
 * 单剧排行榜 Mapper 接口
 * 
 * @author ruoyi
 */
public interface DjLeaderboardMapper {
    /** 查询排行榜列表 (强制分页与状态过滤) */
    List<DjLeaderboard> selectDjLeaderboardList(DjLeaderboard query);

    /** 根据剧本和OpenID查询已有的最高纪录 */
    DjLeaderboard selectByScriptAndOpenid(@Param("scriptId") String scriptId, @Param("wxOpenid") String wxOpenid);

    /** 新增上榜纪录 */
    int insertDjLeaderboard(DjLeaderboard djLeaderboard);

    /** 刷新纪录 */
    int updateDjLeaderboard(DjLeaderboard djLeaderboard);

    /** 修改榜单展示状态(下榜/恢复) */
    int updateStatus(@Param("rankId") Long rankId, @Param("status") String status);

    /** 重置违规主演名 */
    int resetActorName(@Param("rankId") Long rankId, @Param("defaultName") String defaultName);
}
