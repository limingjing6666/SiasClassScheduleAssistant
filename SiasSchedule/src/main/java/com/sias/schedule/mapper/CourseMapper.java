package com.sias.schedule.mapper;

import com.sias.schedule.entity.Course;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 课程 Mapper 接口
 */
@Mapper
public interface CourseMapper {

    /**
     * 根据学号查询课程列表
     */
    List<Course> findByStudentId(@Param("studentId") String studentId);

    /**
     * 根据学号和学期ID查询课程列表
     */
    List<Course> findByStudentIdAndSemesterId(@Param("studentId") String studentId,
                                               @Param("semesterId") String semesterId);

    /**
     * 插入课程
     */
    int insert(Course course);

    /**
     * 批量插入课程
     */
    int batchInsert(@Param("courses") List<Course> courses);

    /**
     * 删除指定学号的所有课程
     */
    int deleteByStudentId(@Param("studentId") String studentId);

    /**
     * 删除指定学号和学期的所有课程
     */
    int deleteByStudentIdAndSemesterId(@Param("studentId") String studentId,
                                        @Param("semesterId") String semesterId);
}
