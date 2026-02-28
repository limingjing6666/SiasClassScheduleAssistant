package com.sias.schedule.mapper;

import com.sias.schedule.entity.Student;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 学生 Mapper 接口
 */
@Mapper
public interface StudentMapper {

    /**
     * 根据学号查询学生
     */
    Student findByStudentId(@Param("studentId") String studentId);

    /**
     * 判断学号是否存在
     */
    boolean existsByStudentId(@Param("studentId") String studentId);

    /**
     * 插入学生
     */
    int insert(Student student);

    /**
     * 更新学生
     */
    int update(Student student);

    /**
     * 插入或更新学生 (如果存在则更新)
     */
    int insertOrUpdate(Student student);
}
