package com.sias.schedule.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 用户/学生实体类
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Student {

    /**
     * 主键ID
     */
    private Long id;

    /**
     * 学号
     */
    private String studentId;

    /**
     * 教务系统内部ID
     */
    private String internalId;

    /**
     * 姓名
     */
    private String name;

    /**
     * 最后同步时间
     */
    private LocalDateTime lastSyncAt;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
}
