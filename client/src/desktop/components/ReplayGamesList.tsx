import { useController } from "@/contexts/controller";
import { useDynamicConnector } from "@/contexts/starknet";
import { useGameTokens } from "@/dojo/useGameTokens";
import { calculateLevel } from "@/utils/game";
import { ChainId } from "@/utils/networkConfig";
import { getContractByName } from "@dojoengine/core";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { Box, Button, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useGameTokens as useMetagameTokens } from "metagame-sdk/sql";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addAddressPadding } from "starknet";

interface ReplayGamesListProps {
  onBack: () => void;
}

export default function ReplayGamesList({ onBack }: ReplayGamesListProps) {
  const navigate = useNavigate();
  const { address } = useController();
  const { fetchAdventurerData } = useGameTokens();
  const { currentNetworkConfig } = useDynamicConnector();
  const namespace = currentNetworkConfig.namespace;
  const gameTokenAddress = getContractByName(
    currentNetworkConfig.manifest,
    namespace,
    "game_token_systems"
  )?.address;
  const { games: gamesData, loading: gamesLoading } = useMetagameTokens({
    mintedByAddress:
      currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
        ? gameTokenAddress
        : addAddressPadding(currentNetworkConfig.dungeon),
    owner: address,
    limit: 10000,
  });
  const [gameTokens, setGameTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdventurers() {
      if (!gamesData) return;

      const games = await fetchAdventurerData(gamesData);

      const completedRuns = games.filter(
        (game: any) => game.dead || game.expired || game.game_over
      );

      setGameTokens(
        completedRuns.sort((a: any, b: any) => b.adventurer_id - a.adventurer_id)
      );
      setLoading(false);
    }
    fetchAdventurers();
  }, [gamesData]);

  const handleWatch = (adventurerId: number) => {
    navigate(`/survivor/watch?id=${adventurerId}`);
  };

  return (
    <motion.div
      key="replay-games-list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ width: "100%" }}
    >
      <Box sx={styles.adventurersHeader}>
        <Button
          variant="text"
          onClick={onBack}
          sx={styles.backButton}
          startIcon={<ArrowBackIcon />}
        >
          Replay Games
        </Button>
      </Box>

      <Box sx={styles.listContainer}>
        {loading || gamesLoading ? (
          <Typography sx={{ textAlign: "center", py: 2 }}>
            Loading...
          </Typography>
        ) : (
          gameTokens.map((game: any, index: number) => (
            <motion.div
              key={game.adventurer_id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                mass: 1,
                delay: index * 0.1,
              }}
            >
              <Box sx={styles.listItem}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    maxWidth: "30vw",
                    flex: 1,
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      textAlign: "left",
                      overflow: "hidden",
                    }}
                  >
                    <Typography
                      color="primary"
                      lineHeight={1}
                      sx={{
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        width: "120px",
                      }}
                    >
                      {game.player_name}
                    </Typography>
                    <Typography
                      color="secondary"
                      sx={{ fontSize: "12px", opacity: 0.8 }}
                    >
                      ID: #{game.adventurer_id}
                    </Typography>
                  </Box>
                </Box>

                {game.xp ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: "55px",
                    }}
                  >
                    <Typography
                      fontSize="13px"
                      lineHeight={1.2}
                      color="secondary"
                    >
                      Lvl: {calculateLevel(game.xp)}
                    </Typography>
                    <Typography fontSize="13px" lineHeight={1.2}>
                      XP: {game.xp.toLocaleString()}
                    </Typography>
                  </Box>
                ) : (
                  <Typography
                    fontSize="13px"
                    color="secondary"
                    flex={1}
                    sx={{ minWidth: "55px" }}
                  >
                    New
                  </Typography>
                )}

                <Box sx={styles.actionColumn}>
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    sx={styles.watchButton}
                    onClick={() => handleWatch(game.adventurer_id)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </Button>
                </Box>
              </Box>
            </motion.div>
          ))
        )}
      </Box>
    </motion.div>
  );
}

const styles = {
  adventurersHeader: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    mb: 1,
  },
  backButton: {
    minWidth: "auto",
    px: 1,
  },
  listContainer: {
    width: "100%",
    maxHeight: "550px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    overflowY: "auto",
    pr: 0.5,
  },
  listItem: {
    height: "52px",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1,
    px: "5px !important",
    pl: "8px !important",
    boxSizing: "border-box",
    flexShrink: 0,
    background: "rgba(24, 40, 24, 0.3)",
    border: "1px solid rgba(8, 62, 34, 0.5)",
    borderRadius: "4px",
  },
  actionColumn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 0.5,
  },
  statusLabel: {
    fontSize: "13px",
    color: "#fff",
    opacity: 0.8,
  },
  watchButton: {
    width: "36px",
    height: "36px",
  },
};
