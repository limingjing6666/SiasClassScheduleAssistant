#!/bin/bash
#====================================
# 西亚斯课表助手 - 全自动部署脚本
# 支持系统: CentOS 7/8, Ubuntu 18.04+
#====================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置变量
PROJECT_NAME="sias-schedule"
DEPLOY_DIR="/opt/SiasSchedule"
DB_PASSWORD="${DB_PASSWORD:-Sias@2024}"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}   西亚斯课表助手 - 全自动部署脚本   ${NC}"
echo -e "${GREEN}======================================${NC}"

# 检测系统类型
detect_os() {
    if [ -f /etc/redhat-release ]; then
        OS="centos"
        PKG_MANAGER="yum"
    elif [ -f /etc/lsb-release ]; then
        OS="ubuntu"
        PKG_MANAGER="apt"
    else
        echo -e "${RED}不支持的操作系统${NC}"
        exit 1
    fi
    echo -e "${GREEN}[✓] 检测到系统: $OS${NC}"
}

# 安装 Docker
install_docker() {
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}[✓] Docker 已安装${NC}"
        return
    fi

    echo -e "${YELLOW}[*] 正在安装 Docker...${NC}"

    if [ "$OS" == "centos" ]; then
        yum install -y yum-utils
        yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        yum install -y docker-ce docker-ce-cli containerd.io
    else
        apt update
        apt install -y apt-transport-https ca-certificates curl software-properties-common
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
        add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
        apt update
        apt install -y docker-ce docker-ce-cli containerd.io
    fi

    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}[✓] Docker 安装完成${NC}"
}

# 安装 Docker Compose
install_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}[✓] Docker Compose 已安装${NC}"
        return
    fi

    echo -e "${YELLOW}[*] 正在安装 Docker Compose...${NC}"
    curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    echo -e "${GREEN}[✓] Docker Compose 安装完成${NC}"
}

# 配置防火墙
configure_firewall() {
    echo -e "${YELLOW}[*] 配置防火墙...${NC}"

    if [ "$OS" == "centos" ]; then
        if command -v firewall-cmd &> /dev/null; then
            firewall-cmd --permanent --add-port=8080/tcp 2>/dev/null || true
            firewall-cmd --reload 2>/dev/null || true
        fi
    else
        if command -v ufw &> /dev/null; then
            ufw allow 8080/tcp 2>/dev/null || true
        fi
    fi
    echo -e "${GREEN}[✓] 防火墙配置完成${NC}"
}

# 创建项目目录和配置文件
setup_project() {
    echo -e "${YELLOW}[*] 配置项目...${NC}"

    cd "$DEPLOY_DIR"

    # 创建 .env 文件
    cat > .env << EOF
DB_PASSWORD=${DB_PASSWORD}
EOF

    echo -e "${GREEN}[✓] 项目配置完成${NC}"
}

# 构建并启动服务
start_services() {
    echo -e "${YELLOW}[*] 构建并启动服务...${NC}"

    cd "$DEPLOY_DIR"

    # 停止旧服务
    docker-compose down 2>/dev/null || true

    # 构建并启动
    docker-compose up -d --build

    echo -e "${GREEN}[✓] 服务启动完成${NC}"
}

# 等待服务就绪
wait_for_service() {
    echo -e "${YELLOW}[*] 等待服务就绪...${NC}"

    for i in {1..30}; do
        if curl -s http://localhost:8080/api/schedule/health > /dev/null 2>&1; then
            echo -e "${GREEN}[✓] 服务已就绪${NC}"
            return
        fi
        echo -n "."
        sleep 2
    done

    echo -e "${YELLOW}[!] 服务启动中，请稍后检查${NC}"
}

# 显示部署信息
show_info() {
    LOCAL_IP=$(hostname -I | awk '{print $1}')

    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}         部署完成！                  ${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    echo -e "访问地址: ${YELLOW}http://${LOCAL_IP}:8080${NC}"
    echo -e "健康检查: ${YELLOW}http://${LOCAL_IP}:8080/api/schedule/health${NC}"
    echo ""
    echo -e "常用命令:"
    echo -e "  查看日志: ${YELLOW}cd $DEPLOY_DIR && docker-compose logs -f${NC}"
    echo -e "  重启服务: ${YELLOW}cd $DEPLOY_DIR && docker-compose restart${NC}"
    echo -e "  停止服务: ${YELLOW}cd $DEPLOY_DIR && docker-compose down${NC}"
    echo ""
}

# 主流程
main() {
    # 检查是否为 root 用户
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}请使用 root 用户运行此脚本${NC}"
        exit 1
    fi

    # 检查项目目录
    if [ ! -d "$DEPLOY_DIR" ]; then
        echo -e "${RED}项目目录不存在: $DEPLOY_DIR${NC}"
        echo -e "${YELLOW}请先上传项目到 $DEPLOY_DIR${NC}"
        exit 1
    fi

    detect_os
    install_docker
    install_docker_compose
    configure_firewall
    setup_project
    start_services
    wait_for_service
    show_info
}

main "$@"

