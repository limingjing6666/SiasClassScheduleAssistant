# 🎓 西亚斯课表助手 (SiasSchedule)

> 基于 Spring Boot + MyBatis + Python 爬虫的课表同步后端服务

## 📖 项目简介

为郑州西亚斯学院学生打造的课表同步服务，通过 Python 爬虫自动登录教务系统抓取课表数据，提供 RESTful API 供前端调用。

## 🛠️ 技术栈

- **后端框架**: Spring Boot 3.5.10
- **持久层**: MyBatis 3.0.3
- **数据库**: MySQL 8.0+
- **爬虫**: Python 3.8+ (requests)
- **JDK**: Java 17+

## 🚀 快速开始

### 本地运行

#### 1. 安装 Python 依赖

```bash
pip install -r src/main/resources/scripts/requirements.txt
```

#### 2. 配置 application.yml

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/sias_schedule
    username: ${DB_USERNAME:root}
    password: ${DB_PASSWORD:}

crawler:
  python:
    path: ${PYTHON_PATH:python}
    timeout: 30
```

#### 3. 启动项目

```bash
./mvnw spring-boot:run
```

服务运行在 `http://localhost:8088`

---

### 🐳 Docker 部署（云服务器）

#### 方式一：一键部署（推荐）

```bash
# 1. 上传项目到服务器
scp -r SiasSchedule root@your_server_ip:/opt/

# 2. 登录服务器执行部署脚本
ssh root@your_server_ip
cd /opt/SiasSchedule
chmod +x deploy.sh
./deploy.sh
```

#### 方式二：手动部署

```bash
# 1. 上传项目并登录服务器
scp -r SiasSchedule root@your_server_ip:/opt/
ssh root@your_server_ip
cd /opt/SiasSchedule

# 2. 配置环境变量
cp .env.example .env
vim .env  # 修改 DB_PASSWORD

# 3. 启动服务
docker-compose up -d --build

# 4. 查看日志
docker-compose logs -f app
```

#### 访问服务

```
http://your_server_ip:8080/api/schedule/health
```

#### 常用命令

```bash
docker-compose down      # 停止服务
docker-compose restart   # 重启服务
docker-compose ps        # 查看状态
docker-compose logs -f   # 查看日志
```

## ⚠️ 注意事项

- 敏感配置请使用环境变量，不要硬编码
- Python 路径需根据实际环境配置
- 教务系统结构变化可能需要更新爬虫脚本

## 📄 License

MIT License


