import { Box, Button, Divider, Link, Typography } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import FavoriteIcon from "@mui/icons-material/Favorite";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useAccount } from "@starknet-react/core";
import { useState } from "react";
import { copyToClipboard, createReferralUrl } from "@/utils/referral";
import ReferralLeaderboard from "./ReferralLeaderboard";
import { useController } from "@/contexts/controller";
import { useUIStore } from "@/stores/uiStore";

const REFERRAL_URL = "https://loot-referral.io/play?ref=0x04364d8e9f994453f5d0c8dc838293226d8ae0aec78030e5ee5fb91614b00eb5";

export default function ReferralTab() {
  const { address } = useAccount();
  const { login } = useController();
  const { referralClicked, setReferralClicked } = useUIStore();
  const [copied, setCopied] = useState(false);

  const referralUrl = address ? createReferralUrl(address) : "";

  const handleCopy = async () => {
    if (!referralUrl) return;
    const success = await copyToClipboard(referralUrl);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTwitter = () => {
    if (!referralUrl) return;
    const text = encodeURIComponent(
      "Join me in Loot Survivor 2 - the onchain dungeon crawler! Use my referral link:"
    );
    const url = encodeURIComponent(referralUrl);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank"
    );
  };

  return (
    <Box sx={styles.container}>
      {/* Prize Banner */}
      <Box sx={styles.prizeBanner}>
        <Typography sx={styles.prizeLabel}>Prizepool</Typography>
        <Typography sx={styles.prizeAmount}>70,000 $STRK</Typography>
        <Typography sx={styles.prizeSubtitle}>Distributed to the top 10</Typography>
      </Box>

      <Divider sx={{ width: "100%", my: 1.5 }} />

      {/* Referral Link Section */}
      <Box sx={styles.section}>
        <Typography sx={styles.sectionTitle}>Your Referral Link</Typography>
        
        {address ? (
          <>
            <Box sx={styles.linkBox}>
              <Typography sx={styles.linkText} noWrap>
                {referralUrl}
              </Typography>
            </Box>
            
            <Box sx={styles.buttonRow}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleCopy}
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                sx={[styles.actionButton, copied && styles.copiedButton]}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
              
              <Button
                variant="outlined"
                size="small"
                onClick={handleShareTwitter}
                startIcon={<OpenInNewIcon />}
                sx={styles.actionButton}
              >
                Share on X
              </Button>
            </Box>
          </>
        ) : (
          <Box sx={styles.connectPrompt}>
            <Typography sx={styles.connectText}>
              Connect your wallet to generate your referral link
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={login}
              sx={styles.connectButton}
            >
              Connect Wallet
            </Button>
          </Box>
        )}
      </Box>

      <Divider sx={{ width: "100%", my: 1.5 }} />

      {/* Leaderboard */}
      <ReferralLeaderboard maxEntries={10} />

      <Divider sx={{ width: "100%", my: 1.5 }} />

      {/* How It Works */}
      <Box sx={styles.infoSection}>
        <Typography sx={styles.infoTitle}>How It Works</Typography>
        <Box sx={styles.infoList}>
          <Typography sx={styles.infoItem}>
            1. Share your unique referral link with friends
          </Typography>
          <Typography sx={styles.infoItem}>
            2. They click your link and start playing
          </Typography>
          <Typography sx={styles.infoItem}>
            3. Earn points based on their games played
          </Typography>
          <Typography sx={styles.infoItem}>
            4. Top 10 referrers win up to 25k STRK!
          </Typography>
        </Box>
        
        <Link
          href="https://starkware.notion.site/lootsurvivor"
          target="_blank"
          rel="noopener"
          sx={styles.learnMoreLink}
        >
          View full rules
        </Link>
      </Box>

      {/* Use Our Referral Button */}
      {!referralClicked && (
        <>
          <Divider sx={{ width: "100%", my: 1.5 }} />
          <Button
            variant="contained"
            fullWidth
            size="small"
            onClick={() => {
              window.open(REFERRAL_URL, "_blank");
              setReferralClicked(true);
            }}
            sx={styles.referralButton}
          >
            <FavoriteIcon sx={{ color: "#111", mr: 1 }} />
            Use our referral
          </Button>
        </>
      )}
    </Box>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    overflow: "hidden",
  },
  prizeBanner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    py: 1.5,
    px: 2,
    width: "100%",
    background: "linear-gradient(135deg, rgba(215, 197, 41, 0.15), rgba(139, 195, 74, 0.1))",
    borderRadius: "8px",
    border: "1px solid rgba(215, 197, 41, 0.3)",
  },
  prizeLabel: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "rgba(208, 201, 141, 0.7)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  prizeAmount: {
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "#d7c529",
    letterSpacing: 1,
    textShadow: "0 0 10px rgba(215, 197, 41, 0.4)",
    mt: 0.25,
  },
  prizeSubtitle: {
    fontSize: "0.8rem",
    fontWeight: 500,
    color: "rgba(208, 201, 141, 0.8)",
    letterSpacing: 0.3,
    mt: 0.25,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  sectionTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "text.primary",
    letterSpacing: 0.3,
    mb: 1,
  },
  linkBox: {
    width: "100%",
    maxWidth: "100%",
    py: 0.75,
    px: 1.5,
    bgcolor: "rgba(0, 0, 0, 0.3)",
    borderRadius: "6px",
    border: "1px solid rgba(208, 201, 141, 0.2)",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  linkText: {
    fontSize: "0.7rem",
    color: "rgba(208, 201, 141, 0.8)",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  buttonRow: {
    display: "flex",
    gap: 1,
    mt: 1,
    width: "100%",
    justifyContent: "center",
  },
  actionButton: {
    fontSize: "0.75rem",
    py: 0.5,
    px: 1.5,
    borderColor: "rgba(208, 201, 141, 0.4)",
    color: "#d0c98d",
    "&:hover": {
      borderColor: "#d0c98d",
      bgcolor: "rgba(208, 201, 141, 0.1)",
    },
  },
  copiedButton: {
    borderColor: "#4caf50",
    color: "#4caf50",
  },
  connectPrompt: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    py: 1,
  },
  connectText: {
    fontSize: "0.8rem",
    color: "rgba(208, 201, 141, 0.7)",
    textAlign: "center",
  },
  connectButton: {
    fontSize: "0.75rem",
    py: 0.5,
    px: 2,
    bgcolor: "#d7c529",
    color: "#111",
    fontWeight: 600,
    "&:hover": {
      bgcolor: "#e5d43a",
    },
  },
  infoSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  infoTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#d7c529",
    letterSpacing: 0.3,
    mb: 0.75,
  },
  infoList: {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
    width: "100%",
  },
  infoItem: {
    fontSize: "0.75rem",
    color: "rgba(208, 201, 141, 0.8)",
    letterSpacing: 0.2,
    pl: 0.5,
  },
  learnMoreLink: {
    mt: 1,
    fontSize: "0.75rem",
    color: "rgba(208, 201, 141, 0.6)",
    textDecoration: "underline !important",
    fontStyle: "italic",
    cursor: "pointer",
    "&:hover": {
      color: "rgba(208, 201, 141, 0.8)",
    },
  },
  referralButton: {
    py: 0.75,
    backgroundColor: "coral",
    color: "#111",
    fontWeight: 500,
    fontSize: "0.8rem",
    justifyContent: "center",
    "&:hover": {
      backgroundColor: "#ff8c66",
    },
  },
};
