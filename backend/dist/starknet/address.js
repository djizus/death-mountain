export function normalizeAddress(value) {
    if (value === null || value === undefined)
        return null;
    const trimmed = value.toString().trim();
    if (!trimmed)
        return null;
    const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    if (!/^0x[0-9a-fA-F]+$/.test(normalized))
        return null;
    try {
        const asBigInt = BigInt(normalized);
        if (asBigInt < 0n)
            return null;
        return `0x${asBigInt.toString(16)}`;
    }
    catch {
        return null;
    }
}
export function requireNormalizedAddress(value, label) {
    const normalized = normalizeAddress(value);
    if (!normalized) {
        throw new Error(`Invalid ${label} address: ${value}`);
    }
    return normalized;
}
