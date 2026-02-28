package com.sias.schedule.service;

import com.sias.schedule.dto.CourseDTO;
import com.sias.schedule.entity.Course;
import com.sias.schedule.entity.Student;
import com.sias.schedule.mapper.CourseMapper;
import com.sias.schedule.mapper.StudentMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 课表服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final CrawlerService crawlerService;
    private final CourseMapper courseMapper;
    private final StudentMapper studentMapper;

    /**
     * 同步课表数据
     *
     * @param username 学号
     * @param password 密码
     * @return 课程列表
     */
    @Transactional
    public List<CourseDTO> syncSchedule(String username, String password) throws Exception {
        log.info("开始同步课表, 学号: {}", username);

        // 1. 调用爬虫获取数据
        List<CourseDTO> courses = crawlerService.fetchSchedule(username, password);

        // 2. 保存/更新学生信息
        Student existingStudent = studentMapper.findByStudentId(username);
        if (existingStudent == null) {
            Student newStudent = Student.builder()
                    .studentId(username)
                    .lastSyncAt(LocalDateTime.now())
                    .build();
            studentMapper.insert(newStudent);
        } else {
            existingStudent.setLastSyncAt(LocalDateTime.now());
            studentMapper.update(existingStudent);
        }

//        // 2. 更新或创建学生信息
//        Student student = studentMapper.selectOne(new LambdaQueryWrapper<Student>()
//                .eq(Student::getStudentId, username));
//
//        if (student == null) {
//            student = Student.builder()
//                    .studentId(username)
//                    .password(password) // 实际生产环境建议加密存储
//                    .lastUpdate(LocalDateTime.now())
//                    .build();
//            studentMapper.insert(student);
//        } else {
//            student.setPassword(password);
//            student.setLastUpdate(LocalDateTime.now());
//            studentMapper.updateById(student);
//        }

        // 3. 删除旧的课程数据
        courseMapper.deleteByStudentId(username);

//        // 3. 删除该学生旧的课表数据 (全量覆盖策略)
//        // 注意：如果你希望保留历史学期数据，这里逻辑需要调整，比如加上 semester_id 字段区分
//        // 目前为了简单，我们假设只存当前查询的学期数据
//        courseMapper.delete(new LambdaQueryWrapper<Course>()
//                .eq(Course::getStudentId, username));

        // 4. 保存新的课程数据
        List<Course> courseEntities = courses.stream()
                .map(dto -> Course.builder()
                        .studentId(username)
                        .name(dto.getName())
                        .teacher(dto.getTeacher())
                        .room(dto.getRoom())
                        .day(parseDay(dto.getDay()))
                        .nodes(dto.getNodes())
                        .weeks(dto.getWeeks())
                        .build())
                .collect(Collectors.toList());

        if (!courseEntities.isEmpty()) {
            courseMapper.batchInsert(courseEntities);
        }

        log.info("课表同步完成, 共{}门课程", courses.size());
        return courses;
    }

//        // 4. 批量插入新课表
//        Long studentId = student.getId();
//        List<Course> courseEntities = courses.stream().map(dto -> Course.builder()
//                .studentId(studentId) // 关联数据库主键ID
//                .courseName(dto.getName())
//                .teacher(dto.getTeacher())
//                .location(dto.getRoom())
//                .day(parseDay(dto.getDay()))
//                .startNode(parseStartNode(dto.getNodes()))
//                .step(parseStep(dto.getNodes()))
//                .weeksBinary(dto.getWeeks())
//                .build()).collect(Collectors.toList());
//
//        // 简单的批量插入循环 (实际项目可用 MyBatis-Plus 的 saveBatch)
//        for (Course course : courseEntities) {
//            courseMapper.insert(course);
//        }
//
//        return courses;
//    }

    /**
     * 获取缓存的课表数据
     *
     * @param studentId 学号
     * @return 课程列表
     */
    public List<CourseDTO> getCachedSchedule(String studentId) {
        List<Course> courses = courseMapper.findByStudentId(studentId);
        return courses.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    /**
     * 转换为DTO
     */
    private CourseDTO toDTO(Course course) {
        CourseDTO dto = new CourseDTO();
        dto.setName(course.getName());
        dto.setTeacher(course.getTeacher());
        dto.setRoom(course.getRoom());
        dto.setDay(String.valueOf(course.getDay()));
        dto.setNodes(course.getNodes());
        dto.setWeeks(course.getWeeks());
        return dto;
    }

    /**
     * 解析星期
     */
    private Integer parseDay(String day) {
        try {
            return Integer.parseInt(day);
        } catch (NumberFormatException e) {
            return 1;
        }
    }
}
