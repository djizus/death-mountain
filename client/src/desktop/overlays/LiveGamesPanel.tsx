import { useDynamicConnector } from "@/contexts/starknet";
import { calculateLevel } from "@/utils/game";
import { ChainId } from "@/utils/networkConfig";
import { getContractByName } from "@dojoengine/core";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Box, IconButton, Typography } from "@mui/material";
import type { GameTokenData } from "metagame-sdk";
import { useGameTokens } from "metagame-sdk/sql";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addAddressPadding } from "starknet";

const MIN_LIVE_SCORE = 100;
const TOP_LIVE_GAMES = 5;
const QUERY_LIMIT = 100;
const REFRESH_INTERVAL_MS = 20_000;

const areLiveGamesEqual = (a: GameTokenData[], b: GameTokenData[]) => {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i].token_id !== b[i].token_id) return false;
    if (a[i].score !== b[i].score) return false;
    if ((a[i].player_name ?? "") !== (b[i].player_name ?? "")) return false;
  }

  return true;
};

export default function LiveGamesPanel() {
  const navigate = useNavigate();
  const { currentNetworkConfig } = useDynamicConnector();
  const [displayGames, setDisplayGames] = useState<GameTokenData[]>([]);

  const gameTokenAddress = getContractByName(
    currentNetworkConfig.manifest,
    currentNetworkConfig.namespace,
    "game_token_systems"
  )?.address;

  const mintedByAddress =
    currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
      ? gameTokenAddress
      : currentNetworkConfig.dungeon
        ? addAddressPadding(currentNetworkConfig.dungeon)
        : undefined;

  const settingsId =
    currentNetworkConfig.chainId === ChainId.WP_PG_SLOT ? 0 : undefined;

  const { games, loading, refetch } = useGameTokens({
    mintedByAddress: mintedByAddress ?? "0x0",
    settings_id: settingsId,
    gameOver: false,
    score: { min: MIN_LIVE_SCORE },
    sortBy: "score",
    sortOrder: "desc",
    includeMetadata: false,
    limit: QUERY_LIMIT,
  });

  const nextLiveGames = useMemo(() => {
    if (!games) return [];

    const now = Date.now();
    return games
      .filter((game) => {
        const expiresAt = (game?.lifecycle?.end ?? 0) * 1000;
        const isExpired = expiresAt !== 0 && expiresAt < now;
        return !isExpired;
      })
      .slice(0, TOP_LIVE_GAMES);
  }, [games]);

  useEffect(() => {
    if (!refetch) return;
    if (!mintedByAddress) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refetch();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refetch, mintedByAddress]);

  useEffect(() => {
    setDisplayGames([]);
  }, [mintedByAddress, settingsId]);

  useEffect(() => {
    if (loading) return;
    setDisplayGames((prev) => {
      if (areLiveGamesEqual(prev, nextLiveGames)) return prev;
      return nextLiveGames;
    });
  }, [loading, nextLiveGames]);

  if (!mintedByAddress) return null;
  if (!loading && displayGames.length === 0) return null;

  return (
      <Box sx={styles.container}>
      <Box sx={styles.header}>
        <Typography sx={styles.title}>WATCH GAMES</Typography>
      </Box>

      <Box sx={styles.gamesRow}>
        {displayGames.length === 0 && loading
          ? Array.from({ length: TOP_LIVE_GAMES }).map((_, index) => (
            <Box key={index} sx={styles.gameCard}>
              <Box sx={styles.info}>
                <Typography sx={styles.name}>Loading…</Typography>
                <Typography sx={styles.details}>—</Typography>
              </Box>
              <Box sx={{ width: 34 }} />
            </Box>
          ))
          : displayGames.map((game) => (
            <Box key={game.token_id} sx={styles.gameCard}>
              <Box sx={styles.info}>
                <Typography sx={styles.name}>
                  {game.player_name || "Unknown"}
                </Typography>
                <Typography sx={styles.details}>
                  XP {game.score.toLocaleString()} · Lvl {calculateLevel(game.score)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                sx={styles.watchButton}
                onClick={() => navigate(`/survivor/watch?id=${game.token_id}`)}
                aria-label={`Watch game ${game.token_id}`}
              >
                <VisibilityIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
      </Box>
    </Box>
  );
}

const styles = {
  container: {
    position: "fixed",
    bottom: "calc(12px + env(safe-area-inset-bottom))",
    left: "50%",
    transform: "translateX(-50%)",
    width: 980,
    maxWidth: "calc(100dvw - 8px)",
    height: 70,
    zIndex: 1000,
    boxSizing: "border-box",
    px: 2,
    py: 1,
    display: "flex",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    border: "2px solid rgba(8, 62, 34, 0.7)",
    borderRadius: "10px",
    backdropFilter: "blur(6px)",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 1,
    minWidth: 175,
    flexShrink: 0,
  },
  title: {
    color: "#d0c98d",
    fontWeight: 700,
    letterSpacing: 1,
    fontSize: "0.95rem",
    lineHeight: 1,
  },
  gamesRow: {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flex: 1,
    minWidth: 0,
  },
  gameCard: {
    display: "flex",
    alignItems: "center",
    gap: 1,
    flex: 1,
    minWidth: 0,
    px: 1,
    py: 0.75,
    backgroundColor: "rgba(24, 40, 24, 0.25)",
    border: "1px solid rgba(8, 62, 34, 0.6)",
    borderRadius: "8px",
  },
  info: {
    display: "flex",
    flexDirection: "column",
    gap: 0.25,
    minWidth: 0,
    flex: 1,
  },
  name: {
    color: "#fff",
    fontSize: "0.9rem",
    lineHeight: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  details: {
    color: "rgba(208, 201, 141, 0.75)",
    fontSize: "0.75rem",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  watchButton: {
    color: "rgba(128, 255, 0, 1)",
    border: "1px solid rgba(128, 255, 0, 0.35)",
    borderRadius: "8px",
    width: 34,
    height: 34,
    "&:hover": {
      backgroundColor: "rgba(128, 255, 0, 0.08)",
      border: "1px solid rgba(128, 255, 0, 0.6)",
    },
  },
};
