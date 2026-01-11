import { useStarknetApi } from '@/api/starknet';
import { useGameEvents } from '@/dojo/useGameEvents';
import { useGameDirector } from '@/mobile/contexts/GameDirector';
import { useGameStore } from '@/stores/gameStore';
import type { Item } from '@/types/game';
import { ExplorerReplayEvents, processGameEvent } from '@/utils/events';
import { calculateLevel } from '@/utils/game';
import CloseIcon from '@mui/icons-material/Close';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import VideocamIcon from '@mui/icons-material/Videocam';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Box, Button, Slider, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GamePage from './GamePage';
import { useDungeon } from '@/dojo/useDungeon';

const LIVE_POLL_INTERVAL_MS = 2500;

export default function WatchPage() {
  const navigate = useNavigate();
  const dungeon = useDungeon();
  const { enqueueSnackbar } = useSnackbar();
  const { processEvent, setEventQueue, eventsProcessed, setEventsProcessed } = useGameDirector();
  const {
    adventurer,
    popExploreLog,
    setAdventurer,
    setBag,
    setBeast,
    setMarketItemIds,
    setCollectable,
    setShowInventory,
    setBattleEvent,
    exitGame,
    spectating,
    setSpectating,
  } = useGameStore();
  const { getGameState } = useStarknetApi();
  const { getGameEvents, getGameEventsAfterActionCount } = useGameEvents();

  const [replayEvents, setReplayEvents] = useState<any[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isLiveGame, setIsLiveGame] = useState(false);
  const [liveSyncReady, setLiveSyncReady] = useState(false);
  const [searchParams] = useSearchParams();
  const game_id = Number(searchParams.get('id'));
  const beast = searchParams.get('beast');
  const hasPrimedReplay = useRef(false);
  const liveActionCountRef = useRef(0);
  const livePollInFlightRef = useRef(false);

  const subscribeEvents = async (gameId: number) => {
    const gameState = await getGameState(gameId!);

    if (!gameState) {
      enqueueSnackbar('Failed to load game', { variant: 'warning', anchorOrigin: { vertical: 'top', horizontal: 'center' } });
      return navigate(`/${dungeon.id}`);
    }

    const isLive = gameState.adventurer.health !== 0;
    setIsLiveGame(isLive);
    if (isLive) {
      hasPrimedReplay.current = true;
    }
    setLiveSyncReady(false);

    if (isLive) {
      useGameStore.setState({ exploreLog: [] });
      setBattleEvent(null);

      setAdventurer(gameState.adventurer);
      setBag(
        Object.values(gameState.bag).filter(
          (item: any) => typeof item === 'object' && item.id !== 0
        ) as Item[]
      );
      setMarketItemIds(gameState.market);
      setShowInventory(gameState.adventurer.stat_upgrades_available > 0);

      if (gameState.adventurer.beast_health > 0) {
        const beast = processGameEvent(
          {
            action_count: 0,
            details: { beast: gameState.beast },
          },
          dungeon
        ).beast!;
        setBeast(beast);
        setCollectable(beast.isCollectable ? beast : null);
      } else {
        setBeast(null);
        setCollectable(null);
      }

      liveActionCountRef.current = gameState.adventurer.action_count ?? 0;
      setLiveSyncReady(true);
      return;
    }

    const events = await getGameEvents(gameId!);
    if (events.length === 0) {
      enqueueSnackbar('Failed to load game', { variant: 'warning', anchorOrigin: { vertical: 'top', horizontal: 'center' } });
      return navigate(`/${dungeon.id}`);
    }

    setReplayEvents(events);
    setReplayIndex(0);
  };

  const handleEndWatching = () => {
    setSpectating(false);
    navigate(`/${dungeon.id}`);
  };

  const handlePlayPause = (play: boolean) => {
    if (play) {
      setEventQueue(replayEvents.slice(replayIndex));
    } else {
      setReplayIndex(prev => prev + eventsProcessed + 1);
      setEventQueue([]);
      setEventsProcessed(0);
    }

    setIsPlaying(play);
  };

  const replayForward = () => {
    if (replayIndex >= replayEvents.length - 1) return;

    let currentIndex = replayIndex + 1;
    while (currentIndex <= replayEvents.length - 1) {
      const currentEvent = replayEvents[currentIndex];
      processEvent(currentEvent, true);

      if (currentEvent.type === 'adventurer' && currentEvent.adventurer?.stat_upgrades_available === 0) {
        break;
      }

      if (currentEvent.type === 'attack' && replayEvents[currentIndex + 1]?.type !== 'adventurer') {
        break;
      }

      if (currentEvent.type === 'beast_attack' && replayEvents[currentIndex + 1]?.type !== 'adventurer') {
        break;
      }

      currentIndex++;
    }

    setReplayIndex(currentIndex);
  };

  const replayBackward = () => {
    if (replayIndex < 1) return;

    let currentIndex = replayIndex - 1;
    while (currentIndex > 0) {
      const event = replayEvents[currentIndex];
      if (ExplorerReplayEvents.includes(event.type)) {
        popExploreLog();
      } else {
        processEvent(event, true);
      }

      if (event.type === 'adventurer' && event.adventurer?.stat_upgrades_available === 0) {
        if (event.adventurer?.beast_health > 0) {
          if (replayEvents[currentIndex - 1]?.type === 'beast') {
            processEvent(replayEvents[currentIndex - 1], true);
          } else if (replayEvents[currentIndex - 1]?.type === 'ambush') {
            processEvent(replayEvents[currentIndex - 2], true);
          }
        }

        break;
      }

      currentIndex--;
    }

    setReplayIndex(currentIndex);
  };

  const jumpToIndex = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= replayEvents.length) return;
    if (targetIndex === replayIndex) return;

    // Process events rapidly from current index to target index
    if (targetIndex > replayIndex) {
      // Move forward - process all events from current to target
      for (let i = replayIndex + 1; i <= targetIndex; i++) {
        processEvent(replayEvents[i], true);
      }
    } else {
      // Move backward - process events in reverse
      for (let i = replayIndex; i > targetIndex; i--) {
        const event = replayEvents[i];
        if (ExplorerReplayEvents.includes(event.type)) {
          popExploreLog();
        } else {
          processEvent(event, true);
        }
      }
    }

    setReplayIndex(targetIndex);
  };

  const handleSliderChange = (_event: Event, newValue: number | number[]) => {
    // Update slider value for visual feedback while dragging
    const value = Array.isArray(newValue) ? newValue[0] : newValue;
    setSliderValue(Math.round(value));
  };

  const handleSliderChangeCommitted = (_event: Event | React.SyntheticEvent, newValue: number | number[]) => {
    // Only jump when user releases the slider
    const targetIndex = Array.isArray(newValue) ? newValue[0] : newValue;
    jumpToIndex(Math.max(1, Math.round(targetIndex)));
  };
  useEffect(() => {
    if (game_id) {
      exitGame();
      setSpectating(true);
      hasPrimedReplay.current = false;
      setLiveSyncReady(false);
      setIsLiveGame(false);
      liveActionCountRef.current = 0;
      setReplayEvents([]);
      setReplayIndex(0);
      setSliderValue(0);
      setIsPlaying(false);
      setEventQueue([]);
      setEventsProcessed(0);
      subscribeEvents(game_id);
    } else {
      setSpectating(false);
      navigate(`/${dungeon.id}`);
    }
  }, [game_id]);

  useEffect(() => {
    if (isLiveGame) return;
    if (hasPrimedReplay.current) return;
    if (replayEvents.length === 0 || replayIndex !== 0) return;

    hasPrimedReplay.current = true;

    let cancelled = false;

    Promise.resolve().then(() => {
      if (cancelled) return;

      if (beast) {
        const [prefix, suffix, name] = beast.toLowerCase().split(/[-_]/);
        const beastIndex = replayEvents.findIndex(
          (event) =>
            event.type === 'beast' &&
            event.beast?.baseName.toLowerCase() === name &&
            event.beast?.specialPrefix?.toLowerCase() === prefix &&
            event.beast?.specialSuffix?.toLowerCase() === suffix
        );

        if (beastIndex !== -1) {
          const adventurerIndex = replayEvents
            .slice(beastIndex)
            .findIndex((event) => event.type === 'adventurer');
          jumpToIndex(beastIndex + (adventurerIndex >= 0 ? adventurerIndex : 0));
          return;
        }
      }

      processEvent(replayEvents[0], true);
      replayForward();
    });

    return () => {
      cancelled = true;
    };
  }, [
    isLiveGame,
    replayEvents,
    replayIndex,
    replayForward,
    processEvent,
    beast,
    jumpToIndex,
  ]);

  useEffect(() => {
    if (!spectating) return;
    if (!isLiveGame || !liveSyncReady) return;
    if (!game_id) return;

    let cancelled = false;

    const pollLiveEvents = async () => {
      if (livePollInFlightRef.current) return;
      livePollInFlightRef.current = true;

      try {
        const newEvents = await getGameEventsAfterActionCount(
          game_id,
          liveActionCountRef.current
        );
        if (cancelled) return;

        if (!newEvents || newEvents.length === 0) return;

        const nextCursor = newEvents.reduce(
          (max: number, event: any) => Math.max(max, event?.action_count ?? 0),
          liveActionCountRef.current
        );
        liveActionCountRef.current = nextCursor;

        setEventQueue((prevQueue: any[]) =>
          (Array.isArray(prevQueue) ? prevQueue : []).concat(newEvents)
        );

        const died = newEvents.some(
          (event: any) => event.type === 'adventurer' && event.adventurer?.health === 0
        );
        if (died) {
          setIsLiveGame(false);
          setLiveSyncReady(false);

          const allEvents = await getGameEvents(game_id);
          if (cancelled) return;

          setReplayEvents(allEvents);
          setReplayIndex(Math.max(0, allEvents.length - 1));
          useGameStore.setState({
            exploreLog: allEvents
              .filter((event: any) => ExplorerReplayEvents.includes(event.type))
              .reverse(),
          });
        }
      } finally {
        livePollInFlightRef.current = false;
      }
    };

    pollLiveEvents();

    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      pollLiveEvents();
    }, LIVE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [spectating, isLiveGame, liveSyncReady, game_id, getGameEvents, getGameEventsAfterActionCount, setEventQueue]);

  // Sync slider value with replayIndex
  useEffect(() => {
    setSliderValue(replayIndex);
  }, [replayIndex]);

  // Build efficient mapping of event index to adventurer level
  const eventLevelMap = useMemo(() => {
    if (replayEvents.length === 0) return new Map<number, number>();

    const levelMap = new Map<number, number>();
    let lastKnownXP = 0;
    let hasAdventurerXP = false;

    // Single pass: for each event, track the last known adventurer XP
    for (let i = 0; i < replayEvents.length; i++) {
      const event = replayEvents[i];
      if (event.type === 'adventurer' && event.adventurer?.xp !== undefined) {
        lastKnownXP = event.adventurer.xp;
        hasAdventurerXP = true;
      }
      // Map this index to the level based on the last known XP
      // If we haven't seen any adventurer events yet, default to level 1
      levelMap.set(i, hasAdventurerXP ? calculateLevel(lastKnownXP) : 1);
    }

    return levelMap;
  }, [replayEvents]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPlaying) return; // Don't handle keyboard events while playing
      if (isLiveGame) return;

      if (event.key === 'ArrowRight') {
        replayForward();
      } else if (event.key === 'ArrowLeft') {
        replayBackward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replayForward, replayBackward, isPlaying, isLiveGame]);

  if (!spectating) return null;

  const isLoading = !adventurer;

  return (
    <>
      {!isLoading && <Box sx={styles.overlay}>
        {replayEvents.length === 0 && !isLiveGame ? (
          <>
            <Box />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <VisibilityIcon sx={styles.visibilityIcon} />
              <Typography sx={styles.text}>
                Spectating
              </Typography>
            </Box>

            <CloseIcon sx={styles.closeIcon} onClick={handleEndWatching} />
          </>
        ) : (
          isLiveGame ? (
            <>
              <Box sx={styles.modeRow}>
                <VideocamIcon sx={styles.theatersIcon} />
              </Box>

              <Box sx={styles.liveStatus}>
                <VisibilityIcon sx={styles.visibilityIcon} />
                <Typography sx={styles.liveText}>watching live</Typography>
              </Box>

              <ExitToAppIcon sx={styles.closeIcon} onClick={handleEndWatching} />
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {/* Slider row */}
              <Box sx={{ width: '100%' }}>
                <Slider
                  value={sliderValue}
                  min={1}
                  max={Math.max(0, replayEvents.length - 1)}
                  onChange={handleSliderChange}
                  onChangeCommitted={handleSliderChangeCommitted}
                  disabled={isPlaying || replayEvents.length === 0}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => {
                    const level = eventLevelMap.get(value) || 1;
                    return `Lvl ${level}`;
                  }}
                  sx={styles.slider}
                  size="small"
                />
              </Box>

              {/* Controls row */}
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={styles.modeRow}>
                  <VideocamIcon sx={styles.theatersIcon} />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', flex: 1 }}>
                  <Button
                    disabled={isPlaying}
                    onClick={replayBackward}
                    sx={styles.controlButton}
                  >
                    <SkipPreviousIcon />
                  </Button>

                  <Button
                    onClick={() => handlePlayPause(!isPlaying)}
                    sx={styles.controlButton}
                  >
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  </Button>

                  <Button
                    onClick={replayForward}
                    disabled={isPlaying}
                    sx={styles.controlButton}
                  >
                    <SkipNextIcon />
                  </Button>
                </Box>

                <ExitToAppIcon sx={styles.closeIcon} onClick={handleEndWatching} />
              </Box>
            </Box>
          )
        )}
      </Box>}

      {spectating && <GamePage />}
    </>
  );
}

const styles = {
  overlay: {
    minHeight: '52px',
    width: '444px',
    maxWidth: 'calc(100dvw - 6px)',
    position: 'fixed',
    bottom: '3px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    zIndex: 1000,
    boxSizing: 'border-box',
    borderTop: '2px solid rgba(128, 255, 0, 0.4)',
    borderBottom: 'none',
  },
  modeRow: {
    display: 'flex',
    alignItems: 'center',
    minWidth: '32px',
  },
  liveStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flex: 1,
    minWidth: 0,
  },
  liveText: {
    color: 'rgba(128, 255, 0, 1)',
    fontSize: '1.05rem',
  },
  visibilityIcon: {
    color: 'rgba(128, 255, 0, 1)',
  },
  closeIcon: {
    cursor: 'pointer',
    color: '#FF0000',
    '&:hover': {
      color: 'rgba(255, 0, 0, 0.6)',
    },
  },
  text: {
    color: 'rgba(128, 255, 0, 1)',
    fontSize: '1.4rem',
  },
  controlButton: {
    color: 'rgba(128, 255, 0, 1)',
    fontSize: '12px',
    '&:disabled': {
      color: 'rgba(128, 255, 0, 0.5)',
    },
  },
  theatersIcon: {
    color: '#EDCF33',
  },
  slider: {
    color: 'rgba(128, 255, 0, 1)',
    '& .MuiSlider-thumb': {
      '&:hover, &.Mui-focusVisible': {
        boxShadow: '0 0 0 8px rgba(128, 255, 0, 0.16)',
      },
    },
    '& .MuiSlider-track': {
      backgroundColor: 'rgba(128, 255, 0, 1)',
    },
    '& .MuiSlider-rail': {
      backgroundColor: 'rgba(128, 255, 0, 0.3)',
    },
    '& .MuiSlider-valueLabel': {
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      color: 'rgba(128, 255, 0, 1)',
      border: '1px solid rgba(128, 255, 0, 0.4)',
      fontSize: '0.75rem',
      '&::before': {
        borderTopColor: 'rgba(128, 255, 0, 0.4)',
      },
    },
    '&.Mui-disabled': {
      color: 'rgba(128, 255, 0, 0.5)',
      '& .MuiSlider-track': {
        backgroundColor: 'rgba(128, 255, 0, 0.5)',
      },
      '& .MuiSlider-rail': {
        backgroundColor: 'rgba(128, 255, 0, 0.2)',
      },
    },
  },
};
