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
        {/* 헤더 */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white">명세서 업로드</h1>
          <p className="text-gray-400 text-sm mt-1">
            현대카드 엑셀 명세서(.xls)를 업로드하면 자동으로 분석됩니다
          </p>
        </div>

        {/* 업로드 영역 */}
        {(status === "idle" || status === "uploading") && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            aria-label="파일 업로드 영역"
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              dragOver
                ? "border-blue-400 bg-blue-500/10"
                : "border-gray-700 hover:border-gray-600 bg-gray-900"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx"
              onChange={handleFileSelect}
              aria-label="엑셀 파일 선택"
              className="hidden"
            />
            {status === "uploading" ? (
              <div>
                <div className="flex justify-center mb-4">
                  <svg className="w-12 h-12 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-lg text-gray-300 font-medium">
                  {fileName} 분석 중...
                </p>
                <p className="text-sm text-gray-400 mt-1">잠시만 기다려 주세요</p>
              </div>
            ) : (
              <div>
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                </div>
                <p className="text-lg text-gray-300 font-medium mb-1">
                  엑셀 파일을 드래그하거나 클릭하여 선택
                </p>
                <p className="text-sm text-gray-400">
                  현대카드 이용대금명세서 (.xls, .xlsx)
                </p>
              </div>
            )}
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* 파싱 결과 */}
        {status === "parsed" && statementInfo && (
          <div>
            {/* 요약 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">명세서</p>
                <p className="text-lg font-semibold text-white">
                  {statementInfo.year}년 {statementInfo.month}월
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">파싱된 거래</p>
                <p className="text-lg font-semibold text-white">
                  {parsedTransactions.length}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">중복 후보</p>
                <p className="text-lg font-semibold text-yellow-400">
                  {duplicates.length}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">저장 예정</p>
                <p className="text-lg font-semibold text-green-400">
                  {activeCount}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span>
                </p>
              </div>
            </div>

            {/* 중복 경고 */}
            {duplicates.length > 0 && (
              <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-yellow-300 font-medium text-sm">
                    중복 후보 {duplicates.length}건이 발견되었습니다
                  </p>
                  <p className="text-yellow-400/70 text-xs mt-1">
                    기존 DB에 같은 날짜, 금액, 가맹점의 거래가 있습니다. 체크박스를 해제하면 함께 저장됩니다.
                  </p>
                </div>
              </div>
            )}

            {/* 거래 내역 테이블 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/50">
                      <th className="text-left py-3 px-3 w-10">
                        <span className="sr-only">제외</span>
                      </th>
                      <th className="text-left py-3 px-3 text-xs text-gray-400 font-medium">날짜</th>
                      <th className="text-left py-3 px-3 text-xs text-gray-400 font-medium">가맹점</th>
                      <th className="text-right py-3 px-3 text-xs text-gray-400 font-medium">금액</th>
                      <th className="text-left py-3 px-3 text-xs text-gray-400 font-medium">카테고리</th>
                      <th className="text-left py-3 px-3 text-xs text-gray-400 font-medium">구분</th>
                      <th className="text-left py-3 px-3 text-xs text-gray-400 font-medium">상태</th>
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
                          className={`border-b border-gray-800 transition-colors ${
                            isExcluded
                              ? "opacity-40"
                              : "hover:bg-gray-800/30"
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={isExcluded}
                              onChange={() => toggleExclude(i)}
                              aria-label={isExcluded ? `${tx.description} 포함하기` : `${tx.description} 제외하기`}
                              className="rounded border-gray-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-gray-300">
                            {tx.date}
                          </td>
                          <td className="py-2.5 px-3 max-w-48 truncate text-white">
                            {tx.description}
                            {tx.foreignCurrency && (
                              <span className="ml-1 text-xs text-blue-400">
                                ({tx.foreignCurrency})
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right whitespace-nowrap font-mono ${
                              tx.amount < 0
                                ? "text-green-400"
                                : "text-white"
                            }`}
                          >
                            {tx.amount < 0 ? "-" : ""}
                            {Math.abs(tx.amount).toLocaleString("ko-KR")}원
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-gray-400">
                            {tx.memberType}
                          </td>
                          <td className="py-2.5 px-3">
                            {isDuplicate && (
                              <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                DB 중복
                              </span>
                            )}
                            {isInternal && !isDuplicate && (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
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
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-4">
              <button
                onClick={() => void handleSave()}
                disabled={activeCount === 0}
                aria-label={`${activeCount}건 저장`}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {activeCount}건 저장
              </button>
              <button
                onClick={handleReset}
                aria-label="다시 업로드"
                className="px-6 py-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 font-medium rounded-lg transition-colors"
              >
                다시 업로드
              </button>
            </div>
          </div>
        )}

        {/* 저장 중 */}
        {status === "saving" && (
          <div className="text-center py-20">
            <svg className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-lg text-gray-300">거래 내역을 저장하고 있습니다...</p>
          </div>
        )}

        {/* 저장 완료 */}
        {status === "saved" && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl text-green-400 font-semibold mb-1">
              {savedCount}건의 거래가 저장되었습니다
            </p>
            <p className="text-gray-400 text-sm mb-8">
              {fileName} 처리 완료
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleReset}
                aria-label="추가 업로드"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                추가 업로드
              </button>
              <a
                href="/"
                className="px-6 py-3 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-300 font-medium rounded-lg transition-colors inline-block"
              >
                대시보드로 이동
              </a>
            </div>
          </div>
        )}

        {/* 빈 상태 안내 (idle 상태에서 에러 없을 때) */}
        {status === "idle" && !error && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <span className="text-blue-400 font-bold text-sm">1</span>
              </div>
              <h3 className="text-sm font-medium text-white mb-1">파일 선택</h3>
              <p className="text-xs text-gray-400">현대카드 엑셀 명세서(.xls)를 드래그하거나 클릭하여 업로드합니다</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <span className="text-blue-400 font-bold text-sm">2</span>
              </div>
              <h3 className="text-sm font-medium text-white mb-1">자동 분석</h3>
              <p className="text-xs text-gray-400">거래 내역이 자동으로 파싱되고 카테고리가 분류됩니다</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <span className="text-blue-400 font-bold text-sm">3</span>
              </div>
              <h3 className="text-sm font-medium text-white mb-1">확인 후 저장</h3>
              <p className="text-xs text-gray-400">중복 항목을 검토하고 확인 후 데이터베이스에 저장합니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
