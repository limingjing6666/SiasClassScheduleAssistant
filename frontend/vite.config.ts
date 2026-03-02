import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5173,       // 修改此处更改端口
    host: true,       // 允许局域网访问
    strictPort: true, // 强制使用指定端口，不自动切换
    // H5 开发代理 —— 将 /eams 请求转发到教务系统，解决浏览器 CORS 拦截
    proxy: {
      '/eams': {
        target: 'https://jwxt.sias.edu.cn',
        changeOrigin: true,
        secure: false,
        // 重写 302 Location 头，确保重定向始终走代理而不是跳到外部域名
        autoRewrite: true,
        protocolRewrite: 'http',
        // 移除 Set-Cookie 的 Domain 属性，让浏览器将 cookie 存储在 localhost 下
        cookieDomainRewrite: '',
        configure: (proxy) => {
          // ★ 关键：将浏览器自动设置的 Referer / Origin 改写为目标域名
          //   H5 模式下 Referer/Origin 是「禁止修改请求头」，浏览器会忽略代码设置的值，
          //   自动填充 http://localhost:xxxx，导致教务系统 CSRF 校验失败，POST 被拒绝
          proxy.on('proxyReq', (proxyReq: any) => {
            const ref = proxyReq.getHeader('referer');
            if (typeof ref === 'string') {
              proxyReq.setHeader(
                'referer',
                ref.replace(/https?:\/\/[^/]+/, 'https://jwxt.sias.edu.cn')
              );
            }
            const origin = proxyReq.getHeader('origin');
            if (typeof origin === 'string') {
              proxyReq.setHeader('origin', 'https://jwxt.sias.edu.cn');
            }
          });
          // 移除 Secure 和 SameSite 标记，否则 http://localhost 上 cookie 不生效
          proxy.on('proxyRes', (proxyRes: any) => {
            const sc = proxyRes.headers['set-cookie'];
            if (Array.isArray(sc)) {
              proxyRes.headers['set-cookie'] = sc.map((c: string) =>
                c.replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=[^;]*/gi, '')
              );
            }
          });
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});
