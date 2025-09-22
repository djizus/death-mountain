import { useStarknetApi } from '@/api/starknet';
import { useGameDirector } from '@/mobile/contexts/GameDirector';
import { useGameStore } from '@/stores/gameStore';
import { useEntityModel } from '@/types/game';
import { ExplorerReplayEvents, processRawGameEvent } from '@/utils/events';
import { useQueries } from '@/utils/queries';
import { useDojoSDK } from '@dojoengine/sdk/react';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GamePage from './GamePage';

export default function WatchPage() {
  const { sdk } = useDojoSDK();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar()
  const { gameEventsQuery } = useQueries();
  const { getEntityModel } = useEntityModel();
  const { spectating, setSpectating, processEvent, setEventQueue, eventsProcessed, setEventsProcessed } = useGameDirector();
  const { gameId, adventurer, popExploreLog } = useGameStore();
  const { getGameState } = useStarknetApi();

  const [subscription, setSubscription] = useState<any>(null);
  const [replayEvents, setReplayEvents] = useState<any[]>([]);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderStep, setSliderStep] = useState(0);

  const stepIndices = useMemo<number[]>(() => {
    if (replayEvents.length === 0) return [];

    const indices = new Set<number>();
    indices.add(0);

    replayEvents.forEach((event, index) => {
      if (index === 0) return;
      if (event.type === "adventurer" && event.adventurer?.stat_upgrades_available === 0) {
        indices.add(index);
      }
    });

    indices.add(replayEvents.length - 1);

    return Array.from(indices).sort((a, b) => a - b);
  }, [replayEvents]);

  const [searchParams] = useSearchParams();
  const game_id = Number(searchParams.get('id'));
  const hasPrimedReplay = useRef(false);

  const stepForwardOnce = useCallback((startIndex: number) => {
    if (replayEvents.length === 0) return startIndex;
    if (startIndex >= replayEvents.length - 1) return startIndex;

    let currentIndex = startIndex;
    let nextIndex = startIndex + 1;

    while (nextIndex <= replayEvents.length - 1) {
      const currentEvent = replayEvents[nextIndex];
      processEvent(currentEvent, true);
      currentIndex = nextIndex;

      if (currentEvent.type === 'adventurer' && currentEvent.adventurer?.stat_upgrades_available === 0) {
        break;
      }

      nextIndex += 1;
    }

    return currentIndex;
  }, [replayEvents, processEvent]);

  const stepBackwardOnce = useCallback((startIndex: number) => {
    if (replayEvents.length === 0) return startIndex;
    if (startIndex <= 0) return 0;

    let currentIndex = startIndex - 1;

    while (currentIndex > 0) {
      const event = replayEvents[currentIndex];

      if (ExplorerReplayEvents.includes(event.type)) {
        popExploreLog();
      } else {
        processEvent(event, true);
      }

      if (event.type === 'adventurer' && event.adventurer?.stat_upgrades_available === 0) {
        if (event.adventurer?.beast_health > 0) {
          const previous = replayEvents[currentIndex - 1];
          if (previous?.type === 'beast') {
            processEvent(previous, true);
          } else if (previous?.type === 'ambush') {
            const ambushSource = replayEvents[currentIndex - 2];
            if (ambushSource) {
              processEvent(ambushSource, true);
            }
          }
        }

        break;
      }

      currentIndex -= 1;
    }

    return Math.max(currentIndex, 0);
  }, [replayEvents, processEvent, popExploreLog]);

  const replayForward = useCallback(() => {
    if (isPlaying) return;
    setReplayIndex(prevIndex => stepForwardOnce(prevIndex));
  }, [isPlaying, stepForwardOnce]);

  const replayBackward = useCallback(() => {
    if (isPlaying) return;
    setReplayIndex(prevIndex => stepBackwardOnce(prevIndex));
  }, [isPlaying, stepBackwardOnce]);

  const seekToStep = useCallback((targetStep: number) => {
    const targetIndex = stepIndices[targetStep];
    if (targetIndex === undefined) return;

    setReplayIndex(prevIndex => {
      let workingIndex = prevIndex;

      if (targetIndex > prevIndex) {
        while (workingIndex < targetIndex) {
          const nextIndex = stepForwardOnce(workingIndex);
          if (nextIndex === workingIndex) break;
          workingIndex = nextIndex;
        }
      } else if (targetIndex < prevIndex) {
        while (workingIndex > targetIndex) {
          const nextIndex = stepBackwardOnce(workingIndex);
          if (nextIndex === workingIndex) break;
          workingIndex = nextIndex;
        }
      }

      return workingIndex;
    });

    setIsPlaying(false);
    setEventQueue([]);
    setEventsProcessed(0);
  }, [stepIndices, stepForwardOnce, stepBackwardOnce, setEventQueue, setEventsProcessed]);

  const handleSliderChange = (_event: unknown, value: number | number[]) => {
    if (typeof value === 'number') {
      setSliderStep(value);
    }
  };

  const handleSliderChangeCommitted = (_event: unknown, value: number | number[]) => {
    if (typeof value !== 'number') return;
    seekToStep(value);
  };

  const formatEventLabel = useCallback((step: number) => {
    const eventIndex = stepIndices[step];
    const event = replayEvents[eventIndex];
    if (!event) return '';

    const action = event.action_count ?? eventIndex;

    if (event.type === 'adventurer') {
      const details = [
        typeof event.adventurer?.depth === 'number' ? `Depth ${event.adventurer.depth}` : null,
        event.adventurer?.room,
      ].filter(Boolean);

      return details.length > 0
        ? `Action ${action} · ${details.join(' · ')}`
        : `Action ${action}`;
    }

    return `Action ${action} · ${event.type}`;
  }, [replayEvents, stepIndices]);

  useEffect(() => {
    hasPrimedReplay.current = false;
    setReplayIndex(0);
    setSliderStep(0);

    if (game_id) {
      setSpectating(true);
      subscribeEvents(game_id);
    } else {
      setSpectating(false);
      navigate('/survivor');
    }
  }, [game_id]);

  useEffect(() => {
    if (hasPrimedReplay.current) return;
    if (replayEvents.length === 0 || replayIndex !== 0) return;

    hasPrimedReplay.current = true;
    processEvent(replayEvents[0], true);
    replayForward();
  }, [replayEvents, replayIndex, replayForward]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPlaying) return; // Don't handle keyboard events while playing

      if (event.key === 'ArrowRight') {
        replayForward();
      } else if (event.key === 'ArrowLeft') {
        replayBackward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replayForward, replayBackward, isPlaying]);

  useEffect(() => {
    if (stepIndices.length === 0) {
      setSliderStep(prev => (prev === 0 ? prev : 0));
      return;
    }

    const current = stepIndices.indexOf(replayIndex);
    if (current === -1) return;

    setSliderStep(prev => (prev === current ? prev : current));
  }, [replayIndex, stepIndices]);

  const subscribeEvents = async (gameId: number) => {
    if (subscription) {
      try {
        subscription.cancel();
      } catch (error) { }
    }

    const [initialData, sub] = await sdk.subscribeEventQuery({
      query: gameEventsQuery(gameId),
      callback: ({ data, error }: { data?: any[]; error?: Error }) => {
        if (data && data.length > 0) {
          let events = data
            .filter((entity: any) =>
              Boolean(getEntityModel(entity, "GameEvent"))
            )
            .map((entity: any) => processRawGameEvent(getEntityModel(entity, "GameEvent")));

          setEventQueue((prev: any) => [...prev, ...events]);
        }
      },
    });

    let events = (initialData?.getItems() || [])
      .filter((entity: any) => Boolean(getEntityModel(entity, "GameEvent")))
      .map((entity: any) => processRawGameEvent(getEntityModel(entity, "GameEvent")))
      .sort((a, b) => a.action_count - b.action_count);

    const gameState = await getGameState(gameId!);

    if (!gameState || events.length === 0) {
      enqueueSnackbar('Failed to load game', { variant: 'warning', anchorOrigin: { vertical: 'top', horizontal: 'center' } })
      return navigate("/survivor");
    }

    if (gameState.adventurer.health > 0) {
      events.forEach((event: any) => {
        processEvent(event, true);
      });
    } else {
      setReplayEvents(events);
    }

    setSubscription(sub);
  };

  const handleEndWatching = () => {
    setSpectating(false);
    navigate('/survivor');
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

  if (!spectating) return null;

  const isLoading = !gameId || !adventurer;
  const sliderMax = stepIndices.length > 0 ? stepIndices.length - 1 : 0;
  const sliderDisabled = isPlaying || stepIndices.length <= 1;

  return (
    <>
      {!isLoading && <Box sx={styles.overlay}>
        {replayEvents.length === 0 ? (
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
          <>
            <VideocamIcon sx={styles.theatersIcon} />

            <Box sx={styles.controlsContainer}>
              <Button
                disabled={isPlaying}
                onClick={replayBackward}
                sx={styles.controlButton}
              >
                <SkipPreviousIcon />
              </Button>

              <Slider
                min={0}
                max={sliderMax}
                step={1}
                marks={false}
                value={Math.min(sliderStep, sliderMax)}
                onChange={handleSliderChange}
                onChangeCommitted={handleSliderChangeCommitted}
                disabled={sliderDisabled}
                sx={styles.slider}
                valueLabelDisplay="on"
                valueLabelFormat={formatEventLabel}
              />

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
          </>
        )}
      </Box>}

      {spectating && <GamePage />}
    </>
  );
}

const styles = {
  overlay: {
    height: '52px',
    width: '444px',
    maxWidth: 'calc(100dvw - 6px)',
    position: 'fixed',
    bottom: '67px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '0 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    zIndex: 1000,
    boxSizing: 'border-box',
    borderTop: '2px solid rgba(128, 255, 0, 0.4)',
    borderBottom: 'none',
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
  controlsContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  slider: {
    flexGrow: 1,
    color: 'rgba(128, 255, 0, 1)',
    '.MuiSlider-track': {
      border: 'none',
    },
    '.MuiSlider-rail': {
      opacity: 0.4,
    },
    '.MuiSlider-thumb': {
      backgroundColor: '#EDCF33',
    },
    '.MuiSlider-valueLabel': {
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: '#EDCF33',
      border: '1px solid rgba(128, 255, 0, 0.6)',
    },
  },
};
