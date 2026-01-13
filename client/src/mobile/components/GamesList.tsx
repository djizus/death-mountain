import { useController } from "@/contexts/controller";
import { useDynamicConnector } from "@/contexts/starknet";
import { useDungeon } from "@/dojo/useDungeon";
import { useGameTokens } from "@/dojo/useGameTokens";
import { calculateLevel } from "@/utils/game";
import { ChainId } from "@/utils/networkConfig";
import { getContractByName } from "@dojoengine/core";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WatchIcon from "@mui/icons-material/Watch";
import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useGameTokens as useMetagameTokens } from "metagame-sdk/sql";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addAddressPadding } from "starknet";

interface GamesListProps {
  onBack: () => void;
}

interface GameData {
  adventurer_id: number;
  player_name: string;
  xp: number;
  health: number;
  dead: boolean;
  expired: boolean;
  game_over: boolean;
  available_at: number;
  expires_at: number;
}

export default function GamesList({ onBack }: GamesListProps) {
  const navigate = useNavigate();
  const { account } = useController();
  const { fetchAdventurerData } = useGameTokens();
  const dungeon = useDungeon();
  const { currentNetworkConfig } = useDynamicConnector();
  const namespace = currentNetworkConfig.namespace;
  const GAME_TOKEN_ADDRESS = getContractByName(
    currentNetworkConfig.manifest,
    namespace,
    "game_token_systems"
  )?.address;
  const { games: gamesData, loading: gamesLoading } = useMetagameTokens({
    mintedByAddress:
      currentNetworkConfig.chainId === ChainId.WP_PG_SLOT
        ? GAME_TOKEN_ADDRESS
        : addAddressPadding(dungeon.address),
    owner: account?.address,
    limit: 10000,
  });

  const [activeGames, setActiveGames] = useState<GameData[]>([]);
  const [completedGames, setCompletedGames] = useState<GameData[]>([]);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    async function fetchGames() {
      if (gamesLoading) return;
      if (gamesData === undefined) return;

      const games = await fetchAdventurerData(gamesData);

      const active = games
        .filter((game: GameData) => !game.dead && !game.expired)
        .sort((a: GameData, b: GameData) => b.adventurer_id - a.adventurer_id);

      const completed = games
        .filter((game: GameData) => game.dead || game.expired || game.game_over)
        .sort((a: GameData, b: GameData) => b.adventurer_id - a.adventurer_id);

      setActiveGames(active);
      setCompletedGames(completed);
      setHasFetched(true);
    }
    fetchGames();
  }, [gamesData, gamesLoading]);

  const handleResumeGame = (gameId: number) => {
    navigate(`/${dungeon.id}/play?id=${gameId}`);
  };

  const handleWatchGame = (gameId: number) => {
    navigate(`/${dungeon.id}/watch?id=${gameId}`);
  };

  const renderTimeRemaining = (timestamp: number) => {
    const hours = Math.max(
      0,
      Math.floor((timestamp - Date.now()) / (1000 * 60 * 60))
    );
    const minutes = Math.max(
      0,
      Math.floor(((timestamp - Date.now()) % (1000 * 60 * 60)) / (1000 * 60))
    );

    return (
      <>
        {hours > 0 && (
          <>
            <Typography color="primary" sx={{ fontSize: "13px" }}>
              {hours}
            </Typography>
            <Typography color="primary" sx={{ fontSize: "13px", ml: "2px" }}>
              h
            </Typography>
          </>
        )}
        <Typography
          color="primary"
          sx={{ fontSize: "13px", ml: hours > 0 ? "4px" : "0px" }}
        >
          {minutes}
        </Typography>
        <Typography color="primary" sx={{ fontSize: "13px", ml: "2px" }}>
          m
        </Typography>
      </>
    );
  };

  const renderActiveGame = (game: GameData, index: number) => (
    <motion.div
      key={game.adventurer_id}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 1,
        delay: index * 0.08,
      }}
    >
      <Box sx={styles.listItem} className="container">
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            maxWidth: "30vw",
            flex: 1,
          }}
        >
          <img
            src={"/images/mobile/adventurer.png?v=2"}
            alt="Adventurer"
            style={{ width: "32px", height: "32px" }}
          />
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
                width: "100%",
                overflow: "hidden",
              }}
            >
              {game.player_name}
            </Typography>
            <Typography color="text.secondary" noWrap>
              ID: #{game.adventurer_id}
            </Typography>
          </Box>
        </Box>

        {game.xp ? (
          <Stack direction="column" flex={1} minWidth="55px">
            <Typography variant="body2" lineHeight={1.2} color="#EDCF33">
              Lvl: {calculateLevel(game.xp)}
            </Typography>
            <Typography variant="body2" lineHeight={1.1}>
              HP: {game.health}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="#EDCF33" flex={1}>
            New Game
          </Typography>
        )}

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            width: "50px",
          }}
        >
          {(game.available_at > 0 || game.expires_at > 0) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
              {game.available_at < Date.now() ? (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <AccessTimeIcon
                    color="primary"
                    sx={{ fontSize: "16px", mr: "3px" }}
                  />
                  {renderTimeRemaining(game.expires_at)}
                </Box>
              ) : (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <WatchIcon
                    color="primary"
                    sx={{ fontSize: "16px", mr: "3px" }}
                  />
                  {renderTimeRemaining(game.available_at)}
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Button
          variant="contained"
          color="primary"
          size="small"
          sx={styles.actionButton}
          onClick={() => handleResumeGame(game.adventurer_id)}
          disabled={game.available_at > Date.now()}
        >
          <ArrowForwardIcon fontSize="small" />
        </Button>
      </Box>
    </motion.div>
  );

  const renderCompletedGame = (game: GameData, index: number) => (
    <motion.div
      key={game.adventurer_id}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 1,
        delay: (activeGames.length + index) * 0.08,
      }}
    >
      <Box sx={[styles.listItem, styles.completedItem]} className="container">
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
                opacity: 0.7,
              }}
            >
              {game.player_name}
            </Typography>
            <Typography color="text.secondary" sx={{ opacity: 0.7 }}>
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
            <Typography fontSize="13px" lineHeight={1.2} color="#EDCF33" sx={{ opacity: 0.7 }}>
              Lvl: {calculateLevel(game.xp)}
            </Typography>
            <Typography fontSize="13px" lineHeight={1.1} sx={{ opacity: 0.7 }}>
              XP: {game.xp.toLocaleString()}
            </Typography>
          </Box>
        ) : (
          <Typography fontSize="13px" color="#EDCF33" flex={1} sx={{ minWidth: "55px", opacity: 0.7 }}>
            -
          </Typography>
        )}

        <Button
          variant="contained"
          color="primary"
          size="small"
          sx={styles.actionButton}
          onClick={() => handleWatchGame(game.adventurer_id)}
        >
          <VisibilityIcon fontSize="small" />
        </Button>
      </Box>
    </motion.div>
  );

  const isLoading = !hasFetched;
  const hasActiveGames = activeGames.length > 0;
  const hasCompletedGames = completedGames.length > 0;
  const hasNoGames = !isLoading && !hasActiveGames && !hasCompletedGames;

  return (
    <motion.div
      key="games-list"
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
        <Box sx={styles.header}>
          <Button
            variant="text"
            size="large"
            onClick={onBack}
            sx={styles.backButton}
            startIcon={<ArrowBackIcon fontSize="large" sx={{ mr: 1 }} />}
          >
            <Typography variant="h4" color="primary">
              My Games
            </Typography>
          </Button>
        </Box>
      </Box>

      <Box sx={styles.listContainer}>
        {isLoading ? (
          <Typography sx={{ textAlign: "center", py: 2 }}>
            Loading...
          </Typography>
        ) : hasNoGames ? (
          <Typography sx={{ textAlign: "center", py: 2, opacity: 0.7 }}>
            No games yet. Enter the dungeon to start your adventure!
          </Typography>
        ) : (
          <>
            {/* Active Games Section */}
            {hasActiveGames && (
              <>
                <Typography sx={styles.sectionTitle}>
                  Active ({activeGames.length})
                </Typography>
                {activeGames.map((game, index) => renderActiveGame(game, index))}
              </>
            )}

            {/* Completed Games Section */}
            {hasCompletedGames && (
              <>
                {hasActiveGames && (
                  <Divider sx={{ my: 1.5, borderColor: "rgba(208, 201, 141, 0.2)" }} />
                )}
                <Typography sx={styles.sectionTitle}>
                  Completed ({completedGames.length})
                </Typography>
                {completedGames.map((game, index) => renderCompletedGame(game, index))}
              </>
            )}
          </>
        )}
      </Box>
    </motion.div>
  );
}

const styles = {
  header: {
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
  sectionTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "#d0c98d",
    letterSpacing: 0.5,
    mb: 0.5,
    mt: 0.5,
  },
  listItem: {
    height: "52px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 2,
    p: "5px !important",
    flexShrink: 0,
  },
  completedItem: {
    opacity: 0.8,
  },
  actionButton: {
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
