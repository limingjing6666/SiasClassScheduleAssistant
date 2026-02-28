package com.sias.schedule.controller;

import com.sias.schedule.dto.ApiResponse;
import com.sias.schedule.dto.CourseDTO;
import com.sias.schedule.dto.SyncRequest;
import com.sias.schedule.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 课表控制器
 */
@Slf4j
@RestController
@RequestMapping("/api/schedule")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ScheduleController {

    private final ScheduleService scheduleService;

    /**
     * 同步课表
     * POST /api/schedule/sync
     *
     * @param request 同步请求 (包含学号和密码)
     * @return 课程列表
     */
    @PostMapping("/sync")
    public ApiResponse<List<CourseDTO>> syncSchedule(@Valid @RequestBody SyncRequest request) {
        log.info("收到课表同步请求, 学号: {}", request.getUsername());

        try {
            List<CourseDTO> courses = scheduleService.syncSchedule(
                    request.getUsername(),
                    request.getPassword()
            );
            return ApiResponse.success(courses);
        } catch (Exception e) {
            log.error("课表同步失败", e);
            return ApiResponse.error(500, e.getMessage());
        }
    }

    /**
     * 获取缓存的课表
     * GET /api/schedule/{studentId}
     *
     * @param studentId 学号
     * @return 课程列表
     */
    @GetMapping("/{studentId}")
    public ApiResponse<List<CourseDTO>> getSchedule(@PathVariable String studentId) {
        log.info("获取缓存课表, 学号: {}", studentId);

        List<CourseDTO> courses = scheduleService.getCachedSchedule(studentId);
        if (courses.isEmpty()) {
            return ApiResponse.error(404, "未找到课表数据，请先同步");
        }
        return ApiResponse.success(courses);
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public ApiResponse<String> health() {
        return ApiResponse.success("服务正常运行");
    }
}
