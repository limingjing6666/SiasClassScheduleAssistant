package com.sias.schedule.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 课程DTO - 用于API响应
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CourseDTO {

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
    private String day;

    /**
     * 节次 (如 "1-2")
     */
    private String nodes;

    /**
     * 周次二进制字符串
     */
    private String weeks;
}
