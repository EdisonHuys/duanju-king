package com.ruoyi.duanju.mapper;

import java.util.List;
import org.apache.ibatis.annotations.Param;
import com.ruoyi.duanju.domain.DjUser;

/**
 * 玩家导演用户 Mapper 接口 (严格遵循若依与阿里巴巴规范，禁止在 Java 中写 SQL 注解)
 * 所有 SQL 100% 编写在 XML 中
 * 
 * @author ruoyi
 */
public interface DjUserMapper {
    /** 查询用户列表 */
    List<DjUser> selectDjUserList(DjUser djUser);

    /** 根据ID查询用户 */
    DjUser selectDjUserById(@Param("userId") Long userId);

    /** 根据OpenID查询用户 */
    DjUser selectDjUserByOpenid(@Param("wxOpenid") String wxOpenid);

    /** 根据账号用户名查询用户 */
    DjUser selectDjUserByUserName(@Param("userName") String userName);

    /** 新增用户 */
    int insertDjUser(DjUser djUser);

    /** 修改用户 */
    int updateDjUser(DjUser djUser);

    /** 逻辑删除用户 */
    int deleteDjUserById(@Param("userId") Long userId);
}
