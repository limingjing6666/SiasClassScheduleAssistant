package com.sias.schedule.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * 课程实体类
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Course {

    /**
     * 主键ID
     */
    private Long id;

    /**
     * 学号
     */
    private String studentId;

    /**
     * 课程名称
     */
    private String name;

    /**
     * 教师姓名
     */
    private String teacher;

    /**
     * 教室
     */
    private String room;

    /**
     * 星期几 (1-7)
     */
    private Integer day;

    /**
     * 节次 (如 "1-2", "3-4")
     */
    private String nodes;

    /**
     * 周次二进制字符串 (如 "010101...")
     */
    private String weeks;

    /**
     * 学期ID
     */
    private String semesterId;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}
