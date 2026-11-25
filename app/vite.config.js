import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import fs from 'fs';
import path from 'path';

const MINIGAME_PACK_IGNORE = [
  { type: 'folder', value: 'pages' },
  { type: 'folder', value: 'api' },
  { type: 'folder', value: 'common' },
  { type: 'folder', value: 'utils' },
  { type: 'folder', value: 'static/images' },
  { type: 'folder', value: 'static/scripts' },
  { type: 'file', value: 'app.js' },
  { type: 'file', value: 'app.json' },
  { type: 'file', value: 'app.wxss' },
  { type: 'file', value: 'config.js' },
  { type: 'file', value: 'game-data.js' },
  { type: 'suffix', value: '.wxml' },
  { type: 'suffix', value: '.wxss' },
  { type: 'suffix', value: '.webp' }
];

function copyMiniGameFilesPlugin() {
  return {
    name: 'copy-minigame-entry-files',
    closeBundle() {
      const rootDir = __dirname;
      const targets = [
        path.resolve(rootDir, 'unpackage/dist/dev/mp-weixin'),
        path.resolve(rootDir, 'unpackage/dist/build/mp-weixin')
      ];
      const files = ['game.json', 'game.js'];
      const invalidDirs = ['pages', 'api', 'common', 'utils', 'static/images', 'static/scripts'];
      const invalidFiles = ['app.js', 'app.json', 'app.wxss', 'config.js', 'game-data.js'];

      targets.forEach((tDir) => {
        if (!fs.existsSync(tDir)) return;

        // 1. 清理小程序残留目录及未使用的大图目录（防止超出 4MB/8MB 限制或含非法后缀）
        invalidDirs.forEach((d) => {
          const p = path.resolve(tDir, d);
          if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
        });
        invalidFiles.forEach((f) => {
          const p = path.resolve(tDir, f);
          if (fs.existsSync(p)) fs.rmSync(p, { force: true });
        });

        // 2. 同步小游戏核心入口文件与 workers 占位目录
        files.forEach((f) => {
          const src = path.resolve(rootDir, f);
          const dest = path.resolve(tDir, f);
          if (fs.existsSync(src)) fs.copyFileSync(src, dest);
        });
        const workersSrcDir = path.resolve(rootDir, 'workers');
        const workersDestDir = path.resolve(tDir, 'workers');
        if (fs.existsSync(workersSrcDir)) {
          fs.mkdirSync(workersDestDir, { recursive: true });
          fs.readdirSync(workersSrcDir).forEach((wf) => {
            const wSrc = path.resolve(workersSrcDir, wf);
            if (fs.statSync(wSrc).isFile()) {
              fs.copyFileSync(wSrc, path.resolve(workersDestDir, wf));
            }
          });
        }

        // 3. 确保 project.config.json 为小游戏模式并注入打包白名单忽略规则与基础库版本
        const projCfg = path.resolve(tDir, 'project.config.json');
        if (fs.existsSync(projCfg)) {
          try {
            const cfg = JSON.parse(fs.readFileSync(projCfg, 'utf8'));
            cfg.compileType = 'game';
            if (!cfg.libVersion) cfg.libVersion = '3.17.6';
            cfg.packOptions = {
              ...(cfg.packOptions || {}),
              ignore: MINIGAME_PACK_IGNORE
            };
            fs.writeFileSync(projCfg, JSON.stringify(cfg, null, 2), 'utf8');
          } catch (e) {}
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [uni(), copyMiniGameFilesPlugin()]
});
