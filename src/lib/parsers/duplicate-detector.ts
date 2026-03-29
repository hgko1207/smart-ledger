import type { ParsedTransaction } from "./hyundai";
import type { Transaction } from "@/db/schema";

// 중복 후보 결과 타입
export interface DuplicateCandidate {
  /** 새로 파싱된 거래 (입력 배열 인덱스) */
  newIndex: number;
  /** 새로 파싱된 거래 데이터 */
  newTransaction: ParsedTransaction;
  /** 기존 DB에 있는 매칭 거래 */
  existingTransaction: Transaction;
}

/**
 * 중복 키 생성: 날짜 + 금액 + 가맹점명
 * 정규화하여 비교 정확도 향상
 */
function makeKey(date: string, amount: number, description: string): string {
  // 가맹점명에서 공백 제거, 소문자로 통일
  const normalizedDesc = description.replace(/\s+/g, "").toLowerCase();
  return `${date}|${amount}|${normalizedDesc}`;
}

/**
 * 중복 거래 감지
 *
 * 새로 파싱된 거래 목록과 기존 DB 거래 목록을 비교하여
 * 같은 날짜 + 금액 + 가맹점명인 경우 중복 후보로 반환
 *
 * 자동 삭제하지 않고 후보 목록만 반환 (사용자가 선택)
 */
export function detectDuplicates(
  newTransactions: ParsedTransaction[],
  existingTransactions: Transaction[]
): DuplicateCandidate[] {
  // 기존 거래를 키로 인덱싱
  const existingMap = new Map<string, Transaction>();
  for (const tx of existingTransactions) {
    const key = makeKey(tx.date, tx.amount, tx.description);
    existingMap.set(key, tx);
  }

  const duplicates: DuplicateCandidate[] = [];

  for (let i = 0; i < newTransactions.length; i++) {
    const newTx = newTransactions[i];
    const key = makeKey(newTx.date, newTx.amount, newTx.description);
    const existing = existingMap.get(key);

    if (existing) {
      duplicates.push({
        newIndex: i,
        newTransaction: newTx,
        existingTransaction: existing,
      });
    }
  }

  return duplicates;
}

/**
 * 새 거래 목록 내에서 자체 중복 감지
 * (같은 파일 내 중복 행 또는 같은 가맹점에서 같은 날 같은 금액 결제)
 */
export function detectInternalDuplicates(
  transactions: ParsedTransaction[]
): number[][] {
  const groups = new Map<string, number[]>();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const key = makeKey(tx.date, tx.amount, tx.description);
    const group = groups.get(key);
    if (group) {
      group.push(i);
    } else {
      groups.set(key, [i]);
    }
  }

  // 2건 이상인 그룹만 반환
  const duplicateGroups: number[][] = [];
  for (const indices of groups.values()) {
    if (indices.length > 1) {
      duplicateGroups.push(indices);
    }
  }

  return duplicateGroups;
}
