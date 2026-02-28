package com.sias.schedule;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 西亚斯课表助手 - 主启动类
 */
@SpringBootApplication
@MapperScan("com.sias.schedule.mapper")
public class SiasScheduleApplication {

    public static void main(String[] args) {
        SpringApplication.run(SiasScheduleApplication.class, args);
    }
}
