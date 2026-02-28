package com.sias.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 同步请求DTO
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SyncRequest {

    /**
     * 学号
     */
    @NotBlank(message = "学号不能为空")
    private String username;

    /**
     * 密码
     */
    @NotBlank(message = "密码不能为空")
    private String password;


    // 新增：学期ID字段 (例如 "282", "262")
    // 非必填，如果为空则由脚本自动探测
    /**
     *学期号
     */
    private String semesterId;
}
