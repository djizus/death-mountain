import { useController } from "@/contexts/controller";
import { useDynamicConnector } from "@/contexts/starknet";
import { useDungeon } from "@/dojo/useDungeon";
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
  const { account } = useController();
  const dungeon = useDungeon();
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
        : addAddressPadding(dungeon.address),
    owner: account?.address,
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

  const handleWatchGame = (gameId: number) => {
    navigate(`/${dungeon.id}/watch?id=${gameId}`);
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          justifyContent: "center",
        }}
      >
        <Box sx={styles.adventurersHeader}>
          <Button
            variant="text"
            size="large"
            onClick={onBack}
            sx={styles.backButton}
            startIcon={<ArrowBackIcon fontSize="large" sx={{ mr: 1 }} />}
          >
            <Typography variant="h4" color="primary">
              Replay Games
            </Typography>
          </Button>
        </Box>
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
              <Box sx={styles.listItem} className="container">
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
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
                      variant="h6"
                      color="primary"
                      lineHeight={1}
                      sx={{
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        width: "100%",
                      }}
                    >
                      {game.player_name}
                    </Typography>

                    <Typography color="text.secondary">
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
                      color="#EDCF33"
                    >
                      Lvl: {calculateLevel(game.xp)}
                    </Typography>
                    <Typography fontSize="13px" lineHeight={1.1}>
                      XP: {game.xp.toLocaleString()}
                    </Typography>
                  </Box>
                ) : (
                  <Typography
                    fontSize="13px"
                    color="#EDCF33"
                    flex={1}
                    sx={{ minWidth: "55px" }}
                  >
                    New Game
                  </Typography>
                )}

                <Box sx={styles.actionColumn}>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    sx={styles.watchButton}
                    onClick={() => handleWatchGame(game.adventurer_id)}
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
    maxHeight: "365px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    overflowY: "auto",
    pr: 0.5,
  },
  listItem: {
    height: "60px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    padding: "6px !important",
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
  watchButton: {
    width: "50px",
    height: "34px",
    fontSize: "12px",
    "&.Mui-disabled": {
      backgroundColor: "rgba(128, 255, 0, 0.1)",
      color: "rgba(128, 255, 0, 0.3)",
      border: "1px solid rgba(128, 255, 0, 0.2)",
    },
  },
};
