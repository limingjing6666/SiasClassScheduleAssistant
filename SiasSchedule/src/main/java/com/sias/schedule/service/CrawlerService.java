package com.sias.schedule.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sias.schedule.dto.CourseDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Python爬虫服务
 * 负责调用Python脚本并解析返回结果
 */
@Slf4j
@Service
public class CrawlerService {

    @Value("${crawler.python.path:python}")
    private String pythonPath;

    @Value("${crawler.python.timeout:30}")
    private int timeout;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * 执行爬虫获取课表数据
     *
     * @param username 学号
     * @param password 密码
     * @return 课程列表
     * @throws Exception 执行异常
     */
    public List<CourseDTO> fetchSchedule(String username, String password) throws Exception {
        // 获取脚本文件路径
        Path scriptPath = extractScriptToTemp();

        log.info("开始执行爬虫脚本, 学号: {}", username);

        // 构建命令
        ProcessBuilder pb = new ProcessBuilder(
                pythonPath,
                scriptPath.toString(),
                username,
                password
        );

        // 合并错误流到标准输出
        pb.redirectErrorStream(true);

        // 启动进程
        Process process = pb.start();

        // 读取输出
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
        }

        // 等待进程结束
        boolean finished = process.waitFor(timeout, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("爬虫脚本执行超时");
        }

        String result = output.toString().trim();
        log.debug("爬虫脚本输出: {}", result);

        // 解析JSON结果
        return parseResult(result);
    }

    /**
     * 将脚本从资源文件提取到临时目录
     */
    private Path extractScriptToTemp() throws IOException {
        ClassPathResource resource = new ClassPathResource("scripts/crawler.py");
        Path tempScript = Files.createTempFile("sias_crawler_", ".py");

        try (InputStream is = resource.getInputStream();
             OutputStream os = Files.newOutputStream(tempScript)) {
            is.transferTo(os);
        }

        tempScript.toFile().deleteOnExit();
        return tempScript;
    }

    /**
     * 解析Python脚本返回的JSON结果
     */
    private List<CourseDTO> parseResult(String jsonStr) throws Exception {
        if (jsonStr == null || jsonStr.isEmpty()) {
            throw new RuntimeException("爬虫返回结果为空");
        }

        // 尝试解析JSON
        JsonNode rootNode = objectMapper.readTree(jsonStr);

        // 检查是否有错误
        if (rootNode.has("error")) {
            String errorMsg = rootNode.get("error").asText();
            throw new RuntimeException(translateError(errorMsg));
        }

        // 解析课程列表
        if (rootNode.isArray()) {
            return objectMapper.readValue(jsonStr, new TypeReference<List<CourseDTO>>() {});
        }

        throw new RuntimeException("无法解析爬虫返回的数据格式");
    }

    /**
     * 翻译错误消息
     */
    private String translateError(String error) {
        return switch (error) {
            case "LOGIN_FAILED" -> "登录失败，请检查学号和密码";
            case "DETECT_FAILED" -> "获取用户信息失败，请稍后重试";
            case "ID_NOT_FOUND" -> "未找到用户ID，请稍后重试";
            case "ARGS_MISSING" -> "参数缺失";
            default -> "未知错误: " + error;
        };
    }
}
