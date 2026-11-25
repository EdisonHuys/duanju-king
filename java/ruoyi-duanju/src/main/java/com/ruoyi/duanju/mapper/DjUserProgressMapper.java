package com.ruoyi.duanju.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.duanju.domain.DjUserProgress;

/**
 * 用户剧本拍摄进度档期 Mapper 接口
 * 严格遵循 XML 映射规范与逻辑删除原则
 * 
 * @author ruoyi
 */
public interface DjUserProgressMapper {
    /** 查询用户拍摄进度档期列表 */
    List<DjUserProgress> selectDjUserProgressList(DjUserProgress djUserProgress);

    /** 根据用户与剧本查询唯一拍摄进度 */
    DjUserProgress selectProgressByUserAndScript(@Param("userId") Long userId, @Param("scriptId") String scriptId);

    /** 根据ID查询详情 */
    DjUserProgress selectDjUserProgressById(@Param("id") Long id);

    /** 新增或覆盖保存拍摄进度 */
    int upsertDjUserProgress(DjUserProgress djUserProgress);

    /** 修改拍摄进度 */
    int updateDjUserProgress(DjUserProgress djUserProgress);

    /** 重置单部剧本拍摄进度 */
    int resetProgressByUserAndScript(@Param("userId") Long userId, @Param("scriptId") String scriptId);

    /** 逻辑删除拍摄进度 */
    int deleteDjUserProgressById(@Param("id") Long id);
}
