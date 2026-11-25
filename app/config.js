// RuoYi-App 全局应用配置
export default {
  // 后端接口地址（本地开发指向 8080 若依服务，上线微信小程序时改为您的 https 域名）
  baseUrl: 'http://192.168.3.19:8080',
  // 应用信息
  appInfo: {
    name: '漫剧大导演',
    version: '1.0.0',
    logo: '/static/logo.png',
    site_url: 'https://ruoyi.vip',
    agreements: [
      {
        title: '用户隐私保护指引',
        url: 'https://ruoyi.vip/protocol.html'
      }
    ]
  }
};
