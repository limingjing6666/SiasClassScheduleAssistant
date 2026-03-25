/*
 * @Author: limingjing6666 limingjing6868@gmail.com
 * @Date: 2026-03-25 12:50:18
 * @LastEditors: limingjing6666 limingjing6868@gmail.com
 * @LastEditTime: 2026-03-25 13:26:19
 * @FilePath: \SiasClassScheduleAssistant\frontend\src\utils\crypto.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * 密码加密/解密工具
 * 使用学号作为密钥种子，AES 加密密码后存储
 *
 * 注意：使用确定性 IV（从学号派生），避免依赖 window.crypto.getRandomValues
 * （App+ 端 WebView 中该 API 不可用，crypto-js 会报错）
 */

import CryptoJS from 'crypto-js';

const SALT = 'sias_schedule_2026';

/**
 * 从学号派生 AES 密钥和 IV（均为确定性，不需要随机数）
 */
function deriveKeyAndIv(username: string) {
  const hash = CryptoJS.SHA256(username + SALT).toString();
  // 前 32 字符做 key（128-bit），后 32 字符做 IV（128-bit）
  const key = CryptoJS.enc.Hex.parse(hash.substring(0, 32));
  const iv = CryptoJS.enc.Hex.parse(hash.substring(32, 64));
  return { key, iv };
}

/**
 * 加密密码
 * @param password 明文密码
 * @param username 学号（作为密钥种子）
 */
export function encryptPassword(password: string, username: string): string {
  const { key, iv } = deriveKeyAndIv(username);
  return CryptoJS.AES.encrypt(password, key, { iv }).toString();
}

/**
 * 解密密码
 * @param cipher 密文
 * @param username 学号（作为密钥种子）
 * @returns 明文密码，解密失败返回空字符串
 */
export function decryptPassword(cipher: string, username: string): string {
  try {
    const { key, iv } = deriveKeyAndIv(username);
    const bytes = CryptoJS.AES.decrypt(cipher, key, { iv });
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return '';
  }
}

/**
 * 读取密码（兼容旧版明文存储）
 * 如果解密失败，说明是旧版明文密码，直接返回原值
 * @param storedPassword Storage 中存储的密码（可能是明文或密文）
 * @param username 学号
 */
export function readPassword(storedPassword: string, username: string): string {
  if (!storedPassword) return '';
  const decrypted = decryptPassword(storedPassword, username);
  // 解密成功 → 返回明文
  if (decrypted) return decrypted;
  // 解密失败 → 旧版明文密码，直接返回
  return storedPassword;
}
