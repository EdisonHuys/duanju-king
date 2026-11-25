package com.ruoyi.duanju.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.duanju.domain.DjScript;

/**
 * 剧本配置 Mapper 接口 (严禁在 Java 代码中编写 SQL 注解)
 * 所有 SQL 必须 100% 编写在 XML 中
 * 
 * @author ruoyi
 */
public interface DjScriptMapper {
    /** 查询剧本列表 */
    List<DjScript> selectDjScriptList(DjScript djScript);

    /** 根据ID查询剧本详情 */
    DjScript selectDjScriptById(@Param("id") Long id);

    /** 根据业务编码查询剧本详情 */
    DjScript selectDjScriptByScriptId(@Param("scriptId") String scriptId);

    /** 新增剧本 */
    int insertDjScript(DjScript djScript);

    /** 修改剧本 */
    int updateDjScript(DjScript djScript);

    /** 逻辑删除剧本 */
    int deleteDjScriptById(@Param("id") Long id);

    /** 累加开拍与完播次数 */
    int incrementPlayCount(@Param("scriptId") String scriptId, @Param("finished") boolean finished);
}
