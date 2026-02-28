-- ====================================
-- 西亚斯课表助手 - 数据库初始化脚本
-- MySQL 8.0+
-- ====================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS sias_schedule
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE sias_schedule;

-- ====================================
-- 学生表
-- ====================================
CREATE TABLE IF NOT EXISTS t_student (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL UNIQUE COMMENT '学号',
  internal_id VARCHAR(20) COMMENT '教务系统内部ID',
  name VARCHAR(50) COMMENT '姓名',
  last_sync_at DATETIME COMMENT '最后同步时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  INDEX idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='学生表';

-- ====================================
-- 课程表
-- ====================================
CREATE TABLE IF NOT EXISTS t_course (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  student_id VARCHAR(20) NOT NULL COMMENT '学号',
  name VARCHAR(100) NOT NULL COMMENT '课程名称',
  teacher VARCHAR(50) COMMENT '教师姓名',
  room VARCHAR(50) COMMENT '教室',
  day INT NOT NULL COMMENT '星期几(1-7)',
  nodes VARCHAR(20) COMMENT '节次(如1-2)',
  weeks VARCHAR(64) COMMENT '周次二进制字符串',
  semester_id VARCHAR(20) COMMENT '学期ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',

  INDEX idx_student_id (student_id),
  INDEX idx_semester (semester_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='课程表';

-- ====================================
-- 示例数据 (可选)
-- ====================================
-- INSERT INTO t_student (student_id, name) VALUES ('2023105190218', '张三');
--
-- INSERT INTO t_course (student_id, name, teacher, room, day, nodes, weeks) VALUES
-- ('2023105190218', 'Java程序设计', '张老师', 'T11-205', 1, '1-2', '0111111111111111110'),
-- ('2023105190218', '数据结构', '李老师', 'T12-301', 2, '3-4', '0111111111111111110'),
-- ('2023105190218', '计算机网络', '王老师', 'T11-102', 3, '5-6', '0111111111111111110');
