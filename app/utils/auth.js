const TokenKey = 'RuoYi-App-Token';
const OpenIdKey = 'Duanju-Wx-OpenId';

export function getToken() {
  return uni.getStorageSync(TokenKey) || '';
}

export function setToken(token) {
  return uni.setStorageSync(TokenKey, token);
}

export function removeToken() {
  return uni.removeStorageSync(TokenKey);
}

export function getOpenId() {
  let openid = uni.getStorageSync(OpenIdKey);
  if (!openid) {
    openid = 'wx_director_' + Math.random().toString(36).substring(2, 8);
    uni.setStorageSync(OpenIdKey, openid);
  }
  return openid;
}
