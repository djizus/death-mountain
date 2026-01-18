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
import TheatersIcon from "@mui/icons-material/Theaters";
import WatchIcon from "@mui/icons-material/Watch";
import { Box, Button, Tab, Tabs, Typography } from "@mui/material";
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
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

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
        <Box sx={styles.gameInfo}>
          <img
            src={"/images/mobile/adventurer.png?v=2"}
            alt="Adventurer"
            style={{ width: "32px", height: "32px" }}
          />
          <Box sx={styles.nameColumn}>
            <Typography
              color="primary"
              lineHeight={1}
              sx={styles.playerName}
            >
              {game.player_name}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ fontSize: "12px", opacity: 0.8 }}
            >
              ID: #{game.adventurer_id}
            </Typography>
          </Box>
        </Box>

        {game.xp ? (
          <Box sx={styles.statsColumn}>
            <Typography fontSize="13px" lineHeight={1.2} color="primary">
              Lvl: {calculateLevel(game.xp)}
            </Typography>
            <Typography fontSize="13px" lineHeight={1.2}>
              HP: {game.health}
            </Typography>
          </Box>
        ) : (
          <Typography
            fontSize="13px"
            color="primary"
            flex={1}
            sx={{ minWidth: "55px" }}
          >
            New
          </Typography>
        )}

        <Box sx={styles.timeColumn}>
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
        delay: index * 0.08,
      }}
    >
      <Box sx={styles.listItem} className="container">
        <Box sx={styles.gameInfo}>
          <img
            src={"/images/mobile/adventurer.png?v=2"}
            alt="Adventurer"
            style={{ width: "32px", height: "32px" }}
          />
          <Box sx={styles.nameColumn}>
            <Typography
              color="primary"
              lineHeight={1}
              sx={styles.playerName}
            >
              {game.player_name}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ fontSize: "12px", opacity: 0.8 }}
            >
              ID: #{game.adventurer_id}
            </Typography>
          </Box>
        </Box>

        {game.xp ? (
          <Box sx={styles.statsColumn}>
            <Typography fontSize="13px" lineHeight={1.2} color="primary">
              Lvl: {calculateLevel(game.xp)}
            </Typography>
            <Typography fontSize="13px" lineHeight={1.2}>
              XP: {game.xp.toLocaleString()}
            </Typography>
          </Box>
        ) : (
          <Typography
            fontSize="13px"
            color="primary"
            flex={1}
            sx={{ minWidth: "55px" }}
          >
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
          <TheatersIcon fontSize="small" />
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

      <Box sx={styles.tabsContainer}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={styles.tabs}
        >
          <Tab label={`Active (${activeGames.length})`} sx={styles.tab} />
          <Tab label={`Completed (${completedGames.length})`} sx={styles.tab} />
        </Tabs>
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
        ) : activeTab === 0 ? (
          hasActiveGames ? (
            activeGames.map((game, index) => renderActiveGame(game, index))
          ) : (
            <Typography sx={{ textAlign: "center", py: 2, opacity: 0.7 }}>
              No active games
            </Typography>
          )
        ) : (
          hasCompletedGames ? (
            completedGames.map((game, index) => renderCompletedGame(game, index))
          ) : (
            <Typography sx={{ textAlign: "center", py: 2, opacity: 0.7 }}>
              No completed games
            </Typography>
          )
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
  tabsContainer: {
    width: "100%",
    mb: 1,
  },
  tabs: {
    minHeight: "36px",
    "& .MuiTabs-indicator": {
      backgroundColor: "#80FF00",
    },
  },
  tab: {
    minHeight: "36px",
    fontSize: "0.9rem",
    fontFamily: "VT323, monospace",
    fontWeight: 500,
    color: "rgba(128, 255, 0, 0.6)",
    "&.Mui-selected": {
      color: "#80FF00",
    },
  },
  listContainer: {
    width: "100%",
    maxHeight: "320px",
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
  },
  completedItem: {
    opacity: 0.8,
  },
  gameInfo: {
    display: "flex",
    alignItems: "center",
    gap: 1,
    maxWidth: "30vw",
    flex: 1,
  },
  nameColumn: {
    display: "flex",
    flexDirection: "column",
    textAlign: "left",
    overflow: "hidden",
  },
  playerName: {
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
    width: "120px",
  },
  statsColumn: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: "55px",
  },
  timeColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    width: "50px",
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
