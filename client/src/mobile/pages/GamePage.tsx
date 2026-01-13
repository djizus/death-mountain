import { getOrder } from "@/api/orders";
import { useController } from "@/contexts/controller";
import { useDynamicConnector } from "@/contexts/starknet";
import { useDungeon } from "@/dojo/useDungeon";
import { useSystemCalls } from "@/dojo/useSystemCalls";
import { useGameStore } from "@/stores/gameStore";
import { ChainId, getNetworkConfig, NetworkConfig } from "@/utils/networkConfig";
import { Box } from "@mui/material";
import { useAccount } from "@starknet-react/core";
import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import { useNavigate, useSearchParams } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import BeastScreen from "../containers/BeastScreen";
import BeastSlainScreen from "../containers/BeastSlainScreen";
import CharacterScreen from "../containers/CharacterScreen";
import DeathScreen from "../containers/DeathScreen";
import ExploreScreen from "../containers/ExploreScreen";
import LoadingContainer from "../containers/LoadingScreen";
import MarketScreen from "../containers/MarketScreen";
import QuestCompletedScreen from "../containers/QuestCompletedScreen";
import SettingsScreen from "../containers/SettingsScreen";
import StatSelectionScreen from "../containers/StatSelectionScreen";

export default function GamePage() {
  const navigate = useNavigate();
  const dungeon = useDungeon();
  const { setCurrentNetworkConfig, currentNetworkConfig } = useDynamicConnector();
  const { mintGame } = useSystemCalls();
  const {
    account,
    playerName,
    login,
    isPending,
  } = useController();
  const { address: controllerAddress } = useAccount();
  const {
    gameId,
    adventurer,
    exitGame,
    setGameId,
    beast,
    showBeastRewards,
    quest,
    spectating,
  } = useGameStore();


  const [activeNavItem, setActiveNavItem] = useState<
    "GAME" | "CHARACTER" | "MARKET" | "SETTINGS"
  >("GAME");

  const [loadingProgress, setLoadingProgress] = useState(0);

  const [searchParams] = useSearchParams();
  const game_id = Number(searchParams.get("id"));
  const settings_id = Number(searchParams.get("settingsId"));
  const mode = searchParams.get("mode");
  const orderId = searchParams.get("orderId");

  async function mint() {
    setLoadingProgress(45);
    let tokenId = await mintGame(playerName, settings_id);
    navigate(
      `/${dungeon.id}/play?id=${tokenId}${mode === "practice" ? "&mode=practice" : ""
      }`,
      { replace: true }
    );
  }

  useEffect(() => {
    if (!account && gameId && adventurer) {
      navigate(`/${dungeon.id}`);
    }
  }, [account]);

  useEffect(() => {
    if (mode === "practice" && currentNetworkConfig.chainId !== ChainId.WP_PG_SLOT) {
      return;
    }

    if (spectating && game_id) {
      setLoadingProgress(99);
      setGameId(game_id);
      return;
    }

    if (mode !== "entering" && game_id === 0 && currentNetworkConfig.chainId !== ChainId.WP_PG_SLOT) {
      if (dungeon.includePractice) {
        navigate(`/${dungeon.id}/play?mode=practice`, { replace: true })
      } else {
        navigate(`/${dungeon.id}`, { replace: true })
      }

      return;
    }

    if (isPending) return;

    if (mode === "entering") {
      setLoadingProgress(45);
      return;
    }

    if (!controllerAddress && currentNetworkConfig.chainId !== ChainId.WP_PG_SLOT) {
      login();
      return;
    }

    if (!account) {
      return;
    }

    if (game_id) {
      setLoadingProgress(99);
      setGameId(game_id);
    } else if (game_id === 0) {
      mint();
    }
  }, [game_id, controllerAddress, isPending, account, currentNetworkConfig.chainId]);

  useEffect(() => {
    if (mode !== "entering" || !orderId) return;

    let cancelled = false;
    let timeout: number | null = null;

    const poll = async () => {
      try {
        const order = await getOrder(orderId);
        console.log("[GamePage] Order poll result:", {
          orderId,
          status: order.status,
          gameId: order.gameId,
          lastError: order.lastError,
          paymentTxHash: order.paymentTxHash,
          fulfillTxHash: order.fulfillTxHash,
        });
        if (cancelled) return;

        if (order.status === "fulfilled" && order.gameId) {
          console.log("[GamePage] Order fulfilled, navigating to game:", order.gameId);
          navigate(`/${dungeon.id}/play?id=${order.gameId}`, { replace: true });
          return;
        }

        if (order.status === "failed" || order.status === "expired") {
          console.error("[GamePage] Order failed/expired:", order.status, order.lastError);
          navigate(`/${dungeon.id}`, { replace: true });
          return;
        }
      } catch (error) {
        console.error("[GamePage] Error polling order:", error);
      }

      if (!cancelled) {
        timeout = window.setTimeout(poll, 1000);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeout !== null) {
        window.clearTimeout(timeout);
      }
    };
  }, [mode, orderId, dungeon.id, navigate]);

  useEffect(() => {
    setActiveNavItem("GAME");
  }, [adventurer?.stat_upgrades_available, adventurer?.beast_health]);

  useEffect(() => {
    return () => {
      exitGame();
    };
  }, []);

  const isLoading = !gameId || !adventurer;
  const isDead = adventurer && adventurer.health === 0;
  const isBeastDefeated = showBeastRewards && adventurer?.beast_health === 0;
  const isQuestCompleted = quest && adventurer && adventurer.xp >= quest.targetScore;

  return (
    <Box className="container" sx={styles.container}>
      {isLoading ? (
        <LoadingContainer loadingProgress={loadingProgress} />
      ) : isDead ? (
        <DeathScreen />
      ) : isQuestCompleted ? (
        <QuestCompletedScreen />
      ) : isBeastDefeated ? (
        <BeastSlainScreen />
      ) : (
        <>
          {adventurer.beast_health > 0 && beast && <BeastScreen />}
          {adventurer.stat_upgrades_available > 0 && <StatSelectionScreen />}
          {adventurer.beast_health === 0 &&
            adventurer.stat_upgrades_available === 0 && <ExploreScreen />}
        </>
      )}

      {activeNavItem === "CHARACTER" && <CharacterScreen />}
      {activeNavItem === "MARKET" && <MarketScreen />}
      {activeNavItem === "SETTINGS" && <SettingsScreen />}

      {!isLoading && !spectating && (
        <BottomNav
          activeNavItem={activeNavItem}
          setActiveNavItem={setActiveNavItem}
        />
      )}
    </Box>
  );
}

const styles = {
  container: {
    width: "450px",
    maxWidth: "100vw",
    height: isMobile ? "100dvh" : "calc(100dvh - 50px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    margin: "0 auto",
    gap: 2,
    position: "relative",
  },
};
