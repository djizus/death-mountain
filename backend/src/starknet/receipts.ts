export function getReceiptStatuses(
  receipt: unknown
): {
  finalityStatus?: string;
  executionStatus?: string;
  revertReason?: string;
} {
  if (!receipt || typeof receipt !== "object") {
    return {};
  }

  const rec = receipt as any;
  const finalityStatus =
    typeof rec.finality_status === "string"
      ? rec.finality_status
      : typeof rec.status === "string"
        ? rec.status
        : undefined;

  const executionStatus =
    typeof rec.execution_status === "string"
      ? rec.execution_status
      : typeof rec.statusReceipt === "string"
        ? rec.statusReceipt
        : undefined;

  const revertReason =
    typeof rec.revert_reason === "string"
      ? rec.revert_reason
      : typeof rec.execution_error === "string"
        ? rec.execution_error
        : undefined;

  return { finalityStatus, executionStatus, revertReason };
}

export function isReceiptSuccess(receipt: unknown): boolean {
  const { executionStatus } = getReceiptStatuses(receipt);
  if (!executionStatus) {
    // Some providers omit execution status; treat as unknown.
    return false;
  }
  return executionStatus === "SUCCEEDED";
}
