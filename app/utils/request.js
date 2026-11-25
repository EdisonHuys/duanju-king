import config from '@/config';
import { getToken } from '@/utils/auth';

/**
 * RuoYi-App 统一网络请求封装（支持离线自动降级 NFR-02）
 */
const request = (options) => {
  options.header = options.header || {};
  const isToken = (options.headers || {}).isToken === false;
  if (getToken() && !isToken) {
    options.header['Authorization'] = 'Bearer ' + getToken();
  }

  return new Promise((resolve, reject) => {
    uni.request({
      method: options.method || 'GET',
      timeout: options.timeout || 3500,
      url: config.baseUrl + options.url,
      data: options.data,
      header: options.header,
      dataType: 'json',
      success: (res) => {
        const code = (res.data && res.data.code) || 200;
        const msg = (res.data && res.data.msg) || '系统未知错误';
        if (code === 200) {
          resolve(res.data);
        } else {
          if (!options.silentError) {
            uni.showToast({ title: msg, icon: 'none', duration: 2200 });
          }
          reject(res.data);
        }
      },
      fail: (err) => {
        // 离线或服务不可达时静默交由上层 fallback 处理
        reject({ offline: true, error: err });
      }
    });
  });
};

export default request;
