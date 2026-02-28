# -*- coding: utf-8 -*-
"""
西亚斯课表爬虫脚本 (全自动探测版)
逻辑：
1. 强制自动探测用户 ID
2. 强制自动探测学期 ID
"""

import requests
import re
import hashlib
import urllib3
import json
import sys
import io

# 禁用SSL警告
urllib3.disable_warnings()

class SiasCrawler:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.base_url = "https://jwxt.sias.edu.cn/eams"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": f"{self.base_url}/login.action"
        }
        self.user_id = None
        # 【关键】初始为 None，强制从网页抓取
        self.current_semester_id = None

    def login(self):
        try:
            resp = self.session.get(f"{self.base_url}/login.action", headers=self.headers, verify=False, timeout=10)
            salt_match = re.search(r"CryptoJS\.SHA1\('([^']+)'", resp.text)
            if not salt_match: return False
            salt = salt_match.group(1)
            enc_pwd = hashlib.sha1((salt + self.password).encode('utf-8')).hexdigest()
            data = {"username": self.username, "password": enc_pwd, "session_locale": "zh_CN"}
            res = self.session.post(f"{self.base_url}/loginExt.action", data=data, headers=self.headers, verify=False, timeout=10)
            return "login" not in res.url and ("欢迎" in res.text or "homeExt" in res.url)
        except: return False

    def auto_detect(self):
        """ 核心探测逻辑 """

        # 1. 访问课表外壳页
        url_shell = f"{self.base_url}/courseTableForStd.action"
        self.headers["Referer"] = f"{self.base_url}/homeExt.action"

        try:
            res_shell = self.session.get(url_shell, headers=self.headers, verify=False, timeout=10)

            # 2. 提取跳转链接 bg.Go(...)
            match = re.search(r"bg\.Go\('([^']+)'", res_shell.text)
            if match:
                inner_url = match.group(1)
                if inner_url.startswith("/eams"): inner_url = "https://jwxt.sias.edu.cn" + inner_url
                else: inner_url = f"{self.base_url}/{inner_url}"

                # 3. 访问内部页
                head = self.headers.copy()
                head["X-Requested-With"] = "XMLHttpRequest"
                head["Referer"] = url_shell
                res_inner = self.session.get(inner_url, headers=head, verify=False, timeout=10)

                # 4. 提取信息 (ID 和 学期)
                self.scan_html_for_info(res_inner.text)

            # 5. 如果未找到，尝试学籍页
            if not self.user_id:
                url_detail = f"{self.base_url}/stdDetail.action"
                res_detail = self.session.get(url_detail, headers=self.headers, verify=False, timeout=10)
                match_detail = re.search(r"bg\.Go\('([^']+)'", res_detail.text)
                if match_detail:
                    inner_detail = match_detail.group(1)
                    if inner_detail.startswith("/eams"): inner_detail = "https://jwxt.sias.edu.cn" + inner_detail
                    else: inner_detail = f"{self.base_url}/{inner_detail}"

                    head = self.headers.copy()
                    head["X-Requested-With"] = "XMLHttpRequest"
                    res_inner_detail = self.session.get(inner_detail, headers=head, verify=False, timeout=10)
                    self.scan_html_for_info(res_inner_detail.text)

            # 只要找到了用户ID就算探测成功，学期在 get_data 里检查
            return self.user_id is not None

        except: return False

    def scan_html_for_info(self, html):
        """ 同时扫描 用户ID 和 学期ID """

        # 1. 扫描用户 ID
        if not self.user_id:
            patterns = [
                r'name="ids"\s+value="(\d+)"',
                r'ids=(\d+)',
                r'bg\.form\.addInput\(form,\s*"ids",\s*"(\d+)"\)',
                r'value="(\d+)"\s+name="ids"',
                r'name="student\.id"\s+value="(\d+)"'
            ]
            for p in patterns:
                m = re.search(p, html)
                if m:
                    self.user_id = m.group(1)
                    break

        # 2. 扫描学期 ID (务必抓取!)
        # 增加 value:"262" 这种 JS 写法的匹配 (针对 semesterCalendar.js)
        if not self.current_semester_id:
            sem_patterns = [
                r'semester\.id=(\d+)',
                r'name="semester\.id"\s+value="(\d+)"',
                r'bg\.form\.addInput\(form,\s*"semester\.id",\s*"(\d+)"\)',
                r'value:"(\d+)"' # 匹配 JS 对象写法，如 value:"262"
            ]
            for p in sem_patterns:
                m = re.search(p, html)
                if m:
                    # 简单过滤：学期ID通常是2-3位数字
                    val = m.group(1)
                    if len(val) >= 2:
                        self.current_semester_id = val
                        break

    def get_data(self):
        # 严格检查参数
        if not self.user_id:
            return {"error": "ID_NOT_FOUND"}

        # 【关键】如果此时还没有抓到学期ID，直接报错
        if not self.current_semester_id:
            return {"error": "SEMESTER_NOT_FOUND"}

        try:
            post_data = {
                "ignoreHead": "1", "setting.kind": "std", "startWeek": "",
                "project.id": "1", "semester.id": self.current_semester_id, "ids": self.user_id
            }
            head = self.headers.copy()
            head["X-Requested-With"] = "XMLHttpRequest"

            res = self.session.post(f"{self.base_url}/courseTableForStd!courseTable.action",
                                  data=post_data, headers=head, verify=False, timeout=15)
            return self.parse(res.text)
        except Exception as e: return {"error": str(e)}

    def parse(self, html):
        courses = []
        chunks = html.split("var teachers =")

        for i, chunk in enumerate(chunks):
            if i == 0: continue
            try:
                t_name = "未知"
                names_found = re.findall(r'name\s*:\s*["\']([^"\']+)["\']', chunk)
                if names_found:
                    for name in names_found:
                        if name.strip():
                            t_name = name
                            break

                task = re.search(r'new TaskActivity\((.*?)\);', chunk, re.DOTALL)
                if not task: continue

                args = re.findall(r'"([^"]*)"', task.group(1))
                if len(args) >= 8:
                    courses.append({
                        "name": args[2],
                        "teacher": t_name,
                        "room": args[6],
                        "day": args[1],
                        "nodes": args[0],
                        "weeks": args[7]
                    })
            except: pass
        return courses

def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if len(sys.argv) < 3:
        print(json.dumps({"error": "ARGS_MISSING"}, ensure_ascii=False))
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]

    # 移除学期参数接收，只传账号密码
    crawler = SiasCrawler(username, password)

    if crawler.login():
        if crawler.auto_detect():
            print(json.dumps(crawler.get_data(), ensure_ascii=False))
        else:
            print(json.dumps({"error": "DETECT_FAILED"}, ensure_ascii=False))
    else:
        print(json.dumps({"error": "LOGIN_FAILED"}, ensure_ascii=False))

if __name__ == "__main__":
    main()