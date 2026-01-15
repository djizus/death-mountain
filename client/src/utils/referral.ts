/**
 * Referral utilities for generating and managing referral links
 */

const REFERRAL_BASE_URL = "https://loot-referral.io/play";
const REFERRAL_API_URL = "https://loot-referral.io/api/referrals";

/**
 * Creates a referral URL for a given wallet address
 */
export function createReferralUrl(address: string): string {
  return `${REFERRAL_BASE_URL}?ref=${address}`;
}

/**
 * Truncates an address for display (0x1234...abcd)
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 4) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Leaderboard entry from the API
 */
export interface LeaderboardEntry {
  rank: number;
  referrer_address: string;
  referrer_username: string | null;
  total_points: number; // Number of players onboarded
  points: number; // Calculated points (formula applied)
}

/**
 * Fetches the referral leaderboard from the API
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(`${REFERRAL_API_URL}?leaderboard=true`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data || [];
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}
