/**
 * 加密工具：HMAC 签名验证 + PKCE 码生成
 */

import { createHmac, randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * 验证 Webhook 签名（HMAC-SHA256 + 时间安全比较）
 * @param payload - 原始请求体
 * @param signature - 请求头中的签名值
 * @param secret - Webhook 密钥
 * @returns 签名是否匹配
 */
export function verifySignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  if (expected.length !== signature.length) return false;

  return timingSafeEqual(
    Buffer.from(expected, "utf-8"),
    Buffer.from(signature, "utf-8"),
  );
}

/** PKCE 码对 */
export interface PKCEPair {
  /** 随机生成的 code_verifier */
  codeVerifier: string;
  /** 对应的 code_challenge（S256） */
  codeChallenge: string;
}

/**
 * 生成 OAuth PKCE 码对（S256 方式）
 */
export function generatePKCE(): PKCEPair {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}
