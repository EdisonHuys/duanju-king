const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8082;

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
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((req, res) => {
  const parsedUrl = req.url.split('?')[0];
  let filePath;

  if (parsedUrl === '/' || parsedUrl === '/index.html' || parsedUrl === '/preview.html') {
    filePath = path.resolve(__dirname, './preview.html');
  } else {
    // 映射当前目录下静态资源或 static 目录
    filePath = path.resolve(__dirname, '.' + parsedUrl);
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(fs.readFileSync(filePath));
  }

  // 兜底返回 preview.html
  const fallbackHtml = path.resolve(__dirname, './preview.html');
  if (fs.existsSync(fallbackHtml)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(fallbackHtml, 'utf-8'));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`《漫剧大导演》RuoYi-App 微信小程序实时预览器已启动: http://localhost:${PORT}`);
});
