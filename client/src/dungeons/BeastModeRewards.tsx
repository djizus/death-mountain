import {
  JACKPOT_AMOUNT,
  totalCollectableBeasts,
  useStatistics,
  TierData,
} from "@/contexts/Statistics";
import { useUIStore } from "@/stores/uiStore";
import { formatRewardNumber } from "@/utils/utils";
import {
  Box,
  Divider,
  LinearProgress,
  Link,
  Skeleton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { isMobile } from "react-device-detect";
import { useState } from "react";
import ReferralTab from "@/components/ReferralTab";

export default function BeastModeRewards() {
  const { strkPrice, beastTierData, survivorTokenPrice } = useStatistics();
  const { useMobileClient } = useUIStore();
  const { remainingSurvivorTokens, collectedBeasts } = useStatistics();
  const beastsRemaining = totalCollectableBeasts - collectedBeasts;
  const BEAST_ENTITLEMENTS_ORIGINAL = 931500;
  
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Mobile shows just rewards content (Refer & Earn is separate button)
  if (isMobile || useMobileClient) {
    return (
      <RewardsContent 
        remainingSurvivorTokens={remainingSurvivorTokens}
        BEAST_ENTITLEMENTS_ORIGINAL={BEAST_ENTITLEMENTS_ORIGINAL}
        beastsRemaining={beastsRemaining}
        strkPrice={strkPrice}
        beastTierData={beastTierData}
        survivorTokenPrice={survivorTokenPrice}
      />
    );
  }

  return (
    <>
      <Box sx={styles.tabsContainer}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          sx={styles.tabs}
          TabIndicatorProps={{ sx: { bgcolor: "#d7c529" } }}
        >
          <Tab label="Dungeon Rewards" sx={styles.tab} />
          <Tab label="Refer & Earn" sx={styles.tab} />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <RewardsContent 
          remainingSurvivorTokens={remainingSurvivorTokens}
          BEAST_ENTITLEMENTS_ORIGINAL={BEAST_ENTITLEMENTS_ORIGINAL}
          beastsRemaining={beastsRemaining}
          strkPrice={strkPrice}
          beastTierData={beastTierData}
          survivorTokenPrice={survivorTokenPrice}
        />
      )}

      {activeTab === 1 && <ReferralTab />}
    </>
  );
}

interface RewardsContentProps {
  remainingSurvivorTokens: number | null;
  BEAST_ENTITLEMENTS_ORIGINAL: number;
  beastsRemaining: number;
  strkPrice: string | null;
  beastTierData: TierData[];
  survivorTokenPrice: string | null;
}

// Wanted beasts data
const WANTED_BEASTS = [
  {
    name: '"Torment Bane" Balrog',
    image: "/images/jackpot_balrog.png",
    type: "Brute",
    tier: "T1",
    collected: false,
  },
  {
    name: '"Pain Whisper" Warlock',
    image: "/images/jackpot_warlock.png",
    type: "Magical",
    tier: "T1",
    collected: false,
  },
  {
    name: '"Demon Grasp" Dragon',
    image: "/images/jackpot_dragon.png",
    type: "Hunter",
    tier: "T1",
    collected: true,
  },
];

function RewardsContent({ 
  remainingSurvivorTokens, 
  BEAST_ENTITLEMENTS_ORIGINAL, 
  beastsRemaining, 
  strkPrice,
  beastTierData,
  survivorTokenPrice,
}: RewardsContentProps) {
  const bountyValue = Math.round(Number(strkPrice || 0) * JACKPOT_AMOUNT);
  const tokenPriceUsd = survivorTokenPrice ? `$${survivorTokenPrice}` : "...";

  return (
    <>
      {/* SURVIVOR TOKENS & COLLECTABLE BEASTS - SIDE BY SIDE */}
      <Box sx={styles.sideBySideContainer}>
        {/* SURVIVOR TOKENS */}
        <Box sx={styles.rewardColumn}>
          <Box sx={styles.headerRow}>
            <img src="/images/survivor_token.png" alt="token" height={28} />
            <Typography sx={styles.rewardTitle}>Survivor Tokens</Typography>
            <Tooltip title="Learn more about Survivor Tokens" arrow>
              <Link
                href="https://docs.provable.games/lootsurvivor/overview/tokens"
                target="_blank"
                rel="noopener"
                sx={styles.infoIcon}
              >
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              </Link>
            </Tooltip>
          </Box>

          {remainingSurvivorTokens !== null ? (
            <>
              <Box sx={styles.progressContainer}>
                <Box sx={styles.progressBar}>
                  <LinearProgress
                    variant="determinate"
                    value={(remainingSurvivorTokens / BEAST_ENTITLEMENTS_ORIGINAL) * 100}
                    sx={styles.progressStyle}
                  />
                </Box>
                <Box sx={styles.progressOverlay}>
                  <Typography sx={styles.progressText}>
                    {formatRewardNumber(remainingSurvivorTokens)} / {formatRewardNumber(BEAST_ENTITLEMENTS_ORIGINAL)}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={styles.remainingText}>
                {remainingSurvivorTokens.toLocaleString()} remaining
              </Typography>
            </>
          ) : (
            <Skeleton variant="rectangular" sx={{ height: 14, borderRadius: 4, my: 0.5, width: "100%" }} />
          )}
        </Box>

        {/* COLLECTABLE BEASTS */}
        <Box sx={styles.rewardColumn}>
          <Box sx={styles.headerRow}>
            <img src="/images/beast.png" alt="beast" height={28} />
            <Typography sx={styles.rewardTitle}>Collectable Beasts</Typography>
            <Tooltip title="Learn more about Collectable Beasts" arrow>
              <Link
                href="https://docs.provable.games/lootsurvivor/overview/beasts"
                target="_blank"
                rel="noopener"
                sx={styles.infoIcon}
              >
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
              </Link>
            </Tooltip>
          </Box>

          {beastsRemaining > 0 ? (
            <>
              <Box sx={styles.progressContainer}>
                <Box sx={styles.progressBar}>
                  <LinearProgress
                    variant="determinate"
                    value={(beastsRemaining / totalCollectableBeasts) * 100}
                    sx={styles.progressStyle}
                  />
                </Box>
                <Box sx={styles.progressOverlay}>
                  <Typography sx={styles.progressText}>
                    {formatRewardNumber(beastsRemaining)} / {totalCollectableBeasts.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Typography sx={styles.remainingText}>
                {beastsRemaining.toLocaleString()} remaining
              </Typography>
            </>
          ) : (
            <Skeleton variant="rectangular" sx={{ height: 14, borderRadius: 4, my: 0.5, width: "100%" }} />
          )}
        </Box>
      </Box>

      {/* TIER CARDS */}
      <Box sx={styles.tierCardsContainer}>
        <Typography sx={styles.tierCardsTitle}>Rewards by Beast Tier</Typography>
        <Box sx={styles.tierCardsGrid}>
          {beastTierData.length > 0 ? (
            beastTierData.map((tier) => (
              <Box key={tier.tier} sx={[styles.tierCard, { borderColor: tier.color }]}>
                <Typography sx={[styles.tierCardBadge, { bgcolor: tier.color }]}>
                  T{tier.tier}
                </Typography>
                <Typography sx={styles.tierCardBeasts}>
                  {tier.remaining.toLocaleString()}
                </Typography>
                <Typography sx={styles.tierCardBeastsLabel}>left</Typography>
                <Box sx={styles.tierCardDivider} />
                <Box sx={styles.tierCardTokensRow}>
                  <Typography sx={[styles.tierCardTokens, { color: tier.color }]}>
                    {tier.tokensPerBeast}
                  </Typography>
                  <img src="/images/survivor_token.png" alt="token" style={{ height: 18 }} />
                </Box>
              </Box>
            ))
          ) : (
            [1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rectangular" sx={{ height: 90, borderRadius: 2 }} />
            ))
          )}
        </Box>
        <Typography sx={styles.infoText}>
          1 Survivor Token = {tokenPriceUsd}
        </Typography>
      </Box>

      <Divider sx={{ width: "100%", my: 1.5 }} />

      {/* WANTED BEASTS */}
      <Box sx={styles.rewardSection}>
        <Typography sx={styles.wantedTitle}>Wanted Beasts</Typography>
        <Typography sx={styles.wantedSubtitle}>
          Bounty: ~${bountyValue.toLocaleString()} each
        </Typography>

        <Box sx={styles.wantedCardsContainer}>
          {WANTED_BEASTS.map((beast) => (
            <Box 
              key={beast.name} 
              sx={[
                styles.wantedCard, 
                beast.collected && styles.wantedCardCollected
              ]}
            >
              <Box sx={styles.wantedCardImageContainer}>
                <img 
                  src={beast.image} 
                  alt={beast.name} 
                  style={{ 
                    height: 80, 
                    filter: beast.collected ? "grayscale(100%)" : "none",
                    opacity: beast.collected ? 0.5 : 1,
                  }} 
                />
                {beast.collected && (
                  <Box sx={styles.collectedBadge}>SLAIN</Box>
                )}
              </Box>
              <Typography sx={[
                styles.wantedCardName,
                !beast.collected && styles.wantedCardNameGlow
              ]}>
                {beast.name}
              </Typography>
              <Box sx={styles.wantedCardInfo}>
                <Typography sx={styles.wantedCardTier}>{beast.tier}</Typography>
                <Typography sx={styles.wantedCardType}>{beast.type}</Typography>
              </Box>
              <Typography sx={styles.wantedCardBounty}>
                {JACKPOT_AMOUNT.toLocaleString()} STRK
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
}

const styles = {
  tabsContainer: {
    width: "calc(100% + 40px)",
    mx: -2.5,
    mt: -2.5,
    mb: 1.5,
    borderBottom: "1px solid rgba(208, 201, 141, 0.2)",
  },
  tabsContainerMobile: {
    width: "100%",
    mx: 0,
    mt: 0,
  },
  tabs: {
    minHeight: "36px",
    width: "100%",
    "& .MuiTabs-flexContainer": {
      width: "100%",
    },
    "& .MuiTabs-indicator": {
      bottom: 0,
      height: 2,
    },
  },
  tab: {
    minHeight: "36px",
    width: "50%",
    maxWidth: "none",
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "rgba(208, 201, 141, 0.6)",
    letterSpacing: 0.3,
    textTransform: "none",
    px: 0,
    py: 1,
    "&.Mui-selected": {
      color: "#d7c529",
    },
  },
  sideBySideContainer: {
    display: "flex",
    gap: 1.5,
    width: "100%",
    mb: 1,
  },
  rewardColumn: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  rewardSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    width: "100%",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0.5,
    mb: 0.5,
    flexWrap: "nowrap",
  },
  rewardTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "text.primary",
    letterSpacing: 0.3,
    whiteSpace: "nowrap",
  },
  remainingText: {
    fontSize: "0.75rem",
    color: "rgba(208, 201, 141, 0.6)",
    mt: 0.5,
  },
  infoIcon: {
    display: "flex",
    alignItems: "center",
    color: "rgba(208, 201, 141, 0.4)",
    cursor: "pointer",
    "&:hover": {
      color: "rgba(208, 201, 141, 0.8)",
    },
  },
  progressContainer: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    width: "100%",
  },
  progressBar: {
    width: "100%",
    height: 20,
    borderRadius: 4,
    border: "1px solid #656217",
    background: "#16281a",
    display: "flex",
    alignItems: "center",
    overflow: "hidden",
  },
  progressStyle: {
    width: "100%",
    height: "100%",
    background: "transparent",
    "& .MuiLinearProgress-bar": {
      background: "#656217",
      borderRadius: 4,
    },
  },
  progressOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  progressText: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  // Tier cards styles
  tierCardsContainer: {
    width: "100%",
    mt: 0.5,
  },
  tierCardsTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "rgba(208, 201, 141, 0.9)",
    mb: 1,
    textAlign: "center",
  },
  tierCardsGrid: {
    display: "flex",
    gap: 0.75,
    justifyContent: "center",
  },
  tierCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    py: 1,
    px: 0.75,
    borderRadius: "8px",
    bgcolor: "rgba(0, 0, 0, 0.25)",
    border: "1px solid",
    borderColor: "rgba(208, 201, 141, 0.2)",
    transition: "all 0.2s",
    "&:hover": {
      bgcolor: "rgba(0, 0, 0, 0.35)",
      transform: "translateY(-2px)",
    },
  },
  tierCardBadge: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#111",
    px: 0.75,
    py: 0.2,
    borderRadius: "4px",
    mb: 0.5,
  },
  tierCardBeasts: {
    fontSize: "1rem",
    fontWeight: 700,
    color: "text.primary",
    lineHeight: 1,
  },
  tierCardBeastsLabel: {
    fontSize: "0.65rem",
    color: "rgba(208, 201, 141, 0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tierCardDivider: {
    width: "60%",
    height: 1,
    bgcolor: "rgba(208, 201, 141, 0.15)",
    my: 0.75,
  },
  tierCardTokensRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 0.5,
  },
  tierCardTokens: {
    fontSize: "1.1rem",
    fontWeight: 700,
    lineHeight: 1,
  },
  infoText: {
    fontSize: "0.8rem",
    color: "rgba(208, 201, 141, 0.6)",
    mt: 1,
    lineHeight: 1.3,
    fontStyle: "italic",
    textAlign: "center",
  },
  // Wanted beasts styles
  wantedTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "#d7c529",
    letterSpacing: 0.5,
  },
  wantedSubtitle: {
    fontSize: "0.75rem",
    color: "rgba(208, 201, 141, 0.8)",
    mb: 1,
  },
  wantedCardsContainer: {
    display: "flex",
    gap: 1,
    width: "100%",
    justifyContent: "center",
  },
  wantedCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    py: 1,
    px: 0.5,
    borderRadius: "10px",
    bgcolor: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(215, 197, 41, 0.25)",
    transition: "all 0.2s",
    "&:hover": {
      bgcolor: "rgba(0, 0, 0, 0.4)",
      borderColor: "rgba(215, 197, 41, 0.4)",
    },
  },
  wantedCardCollected: {
    opacity: 0.6,
    borderColor: "rgba(100, 100, 100, 0.3)",
    "&:hover": {
      bgcolor: "rgba(0, 0, 0, 0.3)",
      borderColor: "rgba(100, 100, 100, 0.3)",
    },
  },
  wantedCardImageContainer: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    mb: 0.5,
  },
  collectedBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-15deg)",
    bgcolor: "rgba(180, 0, 0, 0.9)",
    color: "#fff",
    fontSize: "0.6rem",
    fontWeight: 700,
    px: 0.75,
    py: 0.25,
    borderRadius: "3px",
    letterSpacing: 1,
  },
  wantedCardName: {
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#d7c529",
    lineHeight: 1.3,
    textAlign: "center",
    mb: 0.5,
  },
  wantedCardNameGlow: {
    textShadow: "0 0 8px rgba(215, 197, 41, 0.6), 0 0 16px rgba(215, 197, 41, 0.4)",
  },
  wantedCardInfo: {
    display: "flex",
    gap: 0.5,
    mb: 0.5,
  },
  wantedCardType: {
    fontSize: "0.6rem",
    color: "rgba(208, 201, 141, 0.7)",
    bgcolor: "rgba(0, 0, 0, 0.3)",
    px: 0.5,
    py: 0.15,
    borderRadius: "3px",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  wantedCardTier: {
    fontSize: "0.6rem",
    color: "#FFD700",
    bgcolor: "rgba(255, 215, 0, 0.15)",
    px: 0.5,
    py: 0.15,
    borderRadius: "3px",
    fontWeight: 600,
  },
  wantedCardBounty: {
    fontSize: "0.8rem",
    fontWeight: 700,
    color: "#4caf50",
    letterSpacing: 0.3,
  },
};
