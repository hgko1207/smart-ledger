import { db } from "@/db";
import { categoryRules } from "@/db/schema";
import { desc } from "drizzle-orm";
import type { CategoryRule } from "@/db/schema";

// 메모리 캐시: 규칙이 자주 변경되지 않으므로 캐시하여 성능 향상
let cachedRules: CategoryRule[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 1분

/**
 * DB에서 카테고리 규칙 조회 (priority 내림차순, 캐시 사용)
 */
async function getRules(): Promise<CategoryRule[]> {
  const now = Date.now();

  if (cachedRules && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRules;
  }

  const rules = await db
    .select()
    .from(categoryRules)
    .orderBy(desc(categoryRules.priority));

  cachedRules = rules;
  cacheTimestamp = now;
  return rules;
}

/**
 * 캐시 무효화 (규칙 변경 시 호출)
 */
export function invalidateCategoryCache(): void {
  cachedRules = null;
  cacheTimestamp = 0;
}

/**
 * 가맹점명으로 카테고리 자동 분류
 *
 * DB에서 CategoryRule을 priority 내림차순으로 조회하여
 * 가맹점명에 pattern이 포함되어 있는지 확인 (대소문자 무시)
 * 매칭되는 규칙이 없으면 "기타" 반환
 */
export async function categorize(merchantName: string): Promise<string> {
  const rules = await getRules();
  const lowerName = merchantName.toLowerCase();

  for (const rule of rules) {
    if (lowerName.includes(rule.pattern.toLowerCase())) {
      return rule.category;
    }
  }

  return "기타";
}

/**
 * 여러 가맹점명을 한 번에 분류 (DB 조회 1회)
 */
export async function categorizeAll(
  merchantNames: string[]
): Promise<string[]> {
  const rules = await getRules();

  return merchantNames.map((name) => {
    const lowerName = name.toLowerCase();
    for (const rule of rules) {
      if (lowerName.includes(rule.pattern.toLowerCase())) {
        return rule.category;
      }
    }
    return "기타";
  });
}
