const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8081;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = req.url.split('?')[0];

  // 静态资源路由（映射 ruoyi-app 下的静态资源，如封面与分镜图）
  if (parsedUrl.startsWith('/static/')) {
    const staticFilePath = path.resolve(__dirname, '../ruoyi-app' + parsedUrl);
    if (fs.existsSync(staticFilePath) && fs.statSync(staticFilePath).isFile()) {
      const ext = path.extname(staticFilePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(fs.readFileSync(staticFilePath));
    }
  }

  // 默认返回若依管理端主页面
  const htmlPath = path.resolve(__dirname, './index.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(htmlPath, 'utf-8'));
});

server.listen(PORT, () => {
  console.log(`[RuoYi] 《漫剧大导演》若依管理后台 (RuoYi-Vue3 Admin) 已启动: http://localhost:${PORT}`);
});
