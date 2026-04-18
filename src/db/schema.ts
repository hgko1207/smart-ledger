import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// 거래 내역 테이블
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(), // UUID
  date: text("date").notNull(), // ISO8601 (YYYY-MM-DD)
  description: text("description").notNull(), // 가맹점명
  amount: integer("amount").notNull(), // KRW 정수, 양수=결제, 음수=환불
  category: text("category").notNull(), // 자동 분류된 카테고리
  cardCompany: text("card_company").notNull(), // hyundai | kb | shinhan | toss
  cardName: text("card_name").notNull(), // 카드명
  memberType: text("member_type").notNull(), // 본인 | 가족
  originalCategory: text("original_category"), // 원래 자동 분류 카테고리 (수정 전)
  customCategory: text("custom_category"), // 사용자 지정 카테고리
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  statementFile: text("statement_file"), // 원본 명세서 파일명
  installmentTotal: integer("installment_total"), // 총 할부 개월수 (예: 3, 10). null이면 일시불
  installmentCurrent: integer("installment_current"), // 현재 회차 (예: 3, 2)
  installmentRemaining: integer("installment_remaining"), // 결제후 남은 잔액 (원)
  isRecurring: integer("is_recurring"), // 매월 반복 여부 (0/1, 수동 지출용)
  memo: text("memo"), // 사용자 한줄 메모 (nullable)
  createdAt: text("created_at").notNull(), // ISO8601
});

// 수입 테이블
export const incomes = sqliteTable("incomes", {
  id: text("id").primaryKey(), // UUID
  date: text("date").notNull(), // ISO8601
  source: text("source").notNull(), // salary | bonus | freelance | tax_refund | investment | allowance | other
  amount: integer("amount").notNull(), // KRW 정수
  description: text("description"), // 설명 (선택)
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: text("created_at").notNull(),
});

// 적금 테이블
export const savings = sqliteTable("savings", {
  id: text("id").primaryKey(), // UUID
  name: text("name").notNull(), // 적금명
  monthlyAmount: integer("monthly_amount").notNull(), // KRW 정수
  startDate: text("start_date").notNull(), // ISO8601
  endDate: text("end_date"), // ISO8601 (선택, null이면 진행중)
  createdAt: text("created_at").notNull(),
});

// 예산 설정 테이블
export const budgets = sqliteTable("budgets", {
  id: text("id").primaryKey(), // UUID
  category: text("category").notNull(), // 카테고리명
  monthlyLimit: integer("monthly_limit").notNull(), // 월간 한도 (KRW)
  createdAt: text("created_at").notNull(), // ISO8601
});

// 카테고리 자동 분류 규칙 테이블
export const categoryRules = sqliteTable("category_rules", {
  id: text("id").primaryKey(), // UUID
  pattern: text("pattern").notNull(), // 매칭 키워드
  category: text("category").notNull(), // 분류될 카테고리명
  priority: integer("priority").notNull(), // 우선순위 (높을수록 먼저 매칭)
  createdAt: text("created_at").notNull(),
});

// 테이블 타입 추출
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Income = typeof incomes.$inferSelect;
export type NewIncome = typeof incomes.$inferInsert;
export type Saving = typeof savings.$inferSelect;
export type NewSaving = typeof savings.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;
