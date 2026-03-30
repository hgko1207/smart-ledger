"use client";

import { useState, useCallback, useRef } from "react";
import type { CategorizedTransaction, UploadResponse } from "@/app/api/upload/route";
import type { DuplicateCandidate } from "@/lib/parsers/duplicate-detector";

type UploadStatus = "idle" | "uploading" | "parsed" | "saving" | "saved";

export default function UploadPage() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");

  // 파싱 결과
  const [parsedTransactions, setParsedTransactions] = useState<CategorizedTransaction[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [internalDuplicates, setInternalDuplicates] = useState<number[][]>([]);
  const [statementInfo, setStatementInfo] = useState<{
    month: number;
    year: number;
    totalRows: number;
    skippedRows: number;
  } | null>(null);

  // 중복 제외 체크 상태 (인덱스 Set)
  const [excludedIndices, setExcludedIndices] = useState<Set<number>>(new Set());

  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 중복 인덱스 Set 생성
  const duplicateIndices = new Set(duplicates.map((d) => d.newIndex));

  async function uploadFile(file: File) {
    setError("");
    setStatus("uploading");
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error || "업로드에 실패했습니다.");
      }

      const data = (await res.json()) as UploadResponse;

      setParsedTransactions(data.transactions);
      setDuplicates(data.duplicates);
      setInternalDuplicates(data.internalDuplicates);
      setStatementInfo({
        month: data.statementMonth,
        year: data.statementYear,
        totalRows: data.totalRows,
        skippedRows: data.skippedRows,
      });

      // 중복 항목은 기본적으로 제외 체크
      const defaultExcluded = new Set(data.duplicates.map((d) => d.newIndex));
      setExcludedIndices(defaultExcluded);

      setStatus("parsed");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "파일 업로드 중 오류가 발생했습니다.";
      setError(message);
      setStatus("idle");
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      void uploadFile(files[0]);
    }
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      void uploadFile(files[0]);
    }
  }

  function toggleExclude(index: number) {
    setExcludedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleSave() {
    setError("");
    setStatus("saving");

    try {
      const toSave = parsedTransactions
        .filter((_, i) => !excludedIndices.has(i))
        .map((tx) => ({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          cardName: tx.cardName,
          memberType: tx.memberType,
          month: tx.month,
          year: tx.year,
          foreignCurrency: tx.foreignCurrency,
          statementFile: fileName,
          installmentTotal: tx.installmentTotal,
          installmentCurrent: tx.installmentCurrent,
          installmentRemaining: tx.installmentRemaining,
        }));

      if (toSave.length === 0) {
        setError("저장할 거래 내역이 없습니다.");
        setStatus("parsed");
        return;
      }

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: toSave }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error || "저장에 실패했습니다.");
      }

      const data = (await res.json()) as { success: boolean; count: number };
      setSavedCount(data.count);
      setStatus("saved");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      setError(message);
      setStatus("parsed");
    }
  }

  function handleReset() {
    setStatus("idle");
    setError("");
    setFileName("");
    setParsedTransactions([]);
    setDuplicates([]);
    setInternalDuplicates([]);
    setStatementInfo(null);
    setExcludedIndices(new Set());
    setSavedCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // 내부 중복 그룹에 속하는 인덱스인지 확인
  function isInternalDuplicate(index: number): boolean {
    return internalDuplicates.some((group) => group.includes(index));
  }

  const activeCount = parsedTransactions.filter(
    (_, i) => !excludedIndices.has(i)
  ).length;

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">명세서 업로드</h1>
        <p className="text-gray-400 mb-8">
          현대카드 엑셀 명세서(.xls)를 업로드하면 자동으로 분석됩니다.
        </p>

        {/* 업로드 영역 */}
        {(status === "idle" || status === "uploading") && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-blue-400 bg-blue-500/10"
                : "border-gray-700 hover:border-gray-500 bg-gray-900/50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />
            {status === "uploading" ? (
              <div>
                <div className="text-4xl mb-4">...</div>
                <p className="text-lg text-gray-300">
                  {fileName} 분석 중...
                </p>
              </div>
            ) : (
              <div>
                <div className="text-4xl mb-4">+</div>
                <p className="text-lg text-gray-300 mb-2">
                  엑셀 파일을 드래그하거나 클릭하여 선택
                </p>
                <p className="text-sm text-gray-500">
                  현대카드 이용대금명세서 (.xls, .xlsx)
                </p>
              </div>
            )}
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* 파싱 결과 */}
        {status === "parsed" && statementInfo && (
          <div>
            {/* 요약 정보 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">명세서</p>
                <p className="text-lg font-semibold">
                  {statementInfo.year}년 {statementInfo.month}월
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">파싱된 거래</p>
                <p className="text-lg font-semibold">
                  {parsedTransactions.length}건
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">중복 후보</p>
                <p className="text-lg font-semibold text-yellow-400">
                  {duplicates.length}건
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-sm text-gray-400">저장 예정</p>
                <p className="text-lg font-semibold text-green-400">
                  {activeCount}건
                </p>
              </div>
            </div>

            {/* 중복 경고 */}
            {duplicates.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                <p className="text-yellow-300 font-medium mb-1">
                  중복 후보 {duplicates.length}건이 발견되었습니다.
                </p>
                <p className="text-yellow-400/70 text-sm">
                  기존 DB에 같은 날짜, 금액, 가맹점의 거래가 있습니다.
                  체크박스를 해제하면 함께 저장됩니다.
                </p>
              </div>
            )}

            {/* 거래 내역 테이블 */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="text-left py-3 px-2 w-10">
                      <span className="sr-only">제외</span>
                    </th>
                    <th className="text-left py-3 px-2">날짜</th>
                    <th className="text-left py-3 px-2">가맹점</th>
                    <th className="text-right py-3 px-2">금액</th>
                    <th className="text-left py-3 px-2">카테고리</th>
                    <th className="text-left py-3 px-2">구분</th>
                    <th className="text-left py-3 px-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedTransactions.map((tx, i) => {
                    const isDuplicate = duplicateIndices.has(i);
                    const isInternal = isInternalDuplicate(i);
                    const isExcluded = excludedIndices.has(i);

                    return (
                      <tr
                        key={`${tx.date}-${tx.description}-${tx.amount}-${i}`}
                        className={`border-b border-gray-800/50 transition-colors ${
                          isExcluded
                            ? "opacity-40"
                            : "hover:bg-gray-900/50"
                        }`}
                      >
                        <td className="py-2 px-2">
                          <input
                            type="checkbox"
                            checked={isExcluded}
                            onChange={() => toggleExclude(i)}
                            title={isExcluded ? "포함하기" : "제외하기"}
                            className="rounded"
                          />
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-2 px-2 max-w-48 truncate">
                          {tx.description}
                          {tx.foreignCurrency && (
                            <span className="ml-1 text-xs text-blue-400">
                              ({tx.foreignCurrency})
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-2 px-2 text-right whitespace-nowrap font-mono ${
                            tx.amount < 0
                              ? "text-green-400"
                              : "text-white"
                          }`}
                        >
                          {tx.amount < 0 ? "-" : ""}
                          {Math.abs(tx.amount).toLocaleString("ko-KR")}원
                        </td>
                        <td className="py-2 px-2">
                          <span className="inline-block px-2 py-0.5 bg-gray-800 rounded text-xs">
                            {tx.category}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {tx.memberType}
                        </td>
                        <td className="py-2 px-2">
                          {isDuplicate && (
                            <span className="text-xs text-yellow-400">
                              DB 중복
                            </span>
                          )}
                          {isInternal && !isDuplicate && (
                            <span className="text-xs text-orange-400">
                              파일 내 중복
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => void handleSave()}
                disabled={activeCount === 0}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {activeCount}건 저장
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
              >
                다시 업로드
              </button>
            </div>
          </div>
        )}

        {/* 저장 중 */}
        {status === "saving" && (
          <div className="text-center py-16">
            <p className="text-lg text-gray-300">저장 중...</p>
          </div>
        )}

        {/* 저장 완료 */}
        {status === "saved" && (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">OK</div>
            <p className="text-xl text-green-400 font-semibold mb-2">
              {savedCount}건의 거래가 저장되었습니다.
            </p>
            <p className="text-gray-400 mb-8">
              {fileName} 처리 완료
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                추가 업로드
              </button>
              <a
                href="/"
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors inline-block"
              >
                대시보드로 이동
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
