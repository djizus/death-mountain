import { useStarknetApi } from '@/api/starknet';
import { useGameDirector } from '@/desktop/contexts/GameDirector';
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
import { Box, Button, Typography, Slider } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useState, useRef, useCallback } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState(0);
  const [tooltipStep, setTooltipStep] = useState(0);
  
  const sliderRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<number | null>(null);

  const [searchParams] = useSearchParams();
  const game_id = Number(searchParams.get('id'));

  useEffect(() => {
    if (game_id) {
      setSpectating(true);
      subscribeEvents(game_id);
    } else {
      setSpectating(false);
      navigate('/survivor');
    }
  }, [game_id]);

  const handleSliderChange = useCallback((newIndex: number, immediate: boolean = false) => {
    if (newIndex < 0 || newIndex >= replayEvents.length) return;
    
    // Clear any existing timeout
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }
    
    if (immediate) {
      // Stop playing if we're scrubbing
      if (isPlaying) {
        setIsPlaying(false);
      }
      setReplayIndex(newIndex);
      processEvent(replayEvents[newIndex], true);
    } else {
      // Set a timeout to update after user stops dragging
      selectionTimeoutRef.current = window.setTimeout(() => {
        setReplayIndex(newIndex);
        processEvent(replayEvents[newIndex], true);
      }, 100);
    }
  }, [replayEvents, isPlaying, processEvent]);

  const handleSliderMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current || !isDragging) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newIndex = Math.floor(percentage * (replayEvents.length - 1));
    
    setDragPosition(percentage * 100);
    setTooltipPosition(x);
    setTooltipStep(newIndex);
    setShowTooltip(true);
    
    // Update data in real-time during dragging
    if (newIndex !== replayIndex) {
      handleSliderChange(newIndex, true);
    }
  }, [isDragging, replayEvents.length, replayIndex, handleSliderChange]);

  const handleSliderMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleSliderMouseMove(event);
  }, [handleSliderMouseMove]);

  const handleSliderMouseUp = useCallback(() => {
    if (isDragging && dragPosition !== null) {
      const newIndex = Math.floor((dragPosition / 100) * (replayEvents.length - 1));
      handleSliderChange(newIndex, true);
    }
    setIsDragging(false);
    setDragPosition(null);
    setShowTooltip(false);
  }, [isDragging, dragPosition, replayEvents.length, handleSliderChange]);

  useEffect(() => {
    if (replayEvents.length > 0 && replayIndex === 0) {
      processEvent(replayEvents[0], true)
      replayForward();
    }
  }, [replayEvents]);

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
  }, [replayIndex, isPlaying]); // Add dependencies

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

  const replayForward = () => {
    if (replayIndex >= replayEvents.length - 1) return;

    let currentIndex = replayIndex + 1;
    while (currentIndex <= replayEvents.length - 1) {
      let currentEvent = replayEvents[currentIndex];
      processEvent(currentEvent, true);

      if (currentEvent.type === 'adventurer' && currentEvent.adventurer?.stat_upgrades_available === 0) {
        break;
      }

      currentIndex++;
    }

    setReplayIndex(currentIndex);
  }

  const replayBackward = () => {
    if (replayIndex < 1) return;

    let currentIndex = replayIndex - 1;
    while (currentIndex > 0) {
      let event = replayEvents[currentIndex];
      if (ExplorerReplayEvents.includes(event.type)) {
        popExploreLog()
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
  }

  if (!spectating) return null;

  const isLoading = !gameId || !adventurer;

  return (
    <>
      {/* Independent Floating Progress Bar */}
      {!isLoading && replayEvents.length > 0 && (
        <Box
          ref={sliderRef}
          sx={styles.floatingProgressBar}
          onMouseDown={handleSliderMouseDown}
          onMouseMove={handleSliderMouseMove}
          onMouseUp={handleSliderMouseUp}
          onMouseLeave={handleSliderMouseUp}
        >
          <Box sx={styles.floatingProgressTrack}>
             <Box 
               sx={{
                 ...styles.floatingProgressFill,
                 width: `${isDragging && dragPosition !== null ? dragPosition : (replayIndex / (replayEvents.length - 1)) * 100}%`
               }}
             />
             {/* Always visible thumb */}
             <Box 
               sx={{
                 ...styles.floatingProgressHandle,
                 left: `${isDragging && dragPosition !== null ? dragPosition : (replayIndex / (replayEvents.length - 1)) * 100}%`
               }}
             />
          </Box>
          {/* Persistent Step Counter INSIDE the box */}
          <Box sx={styles.stepCounter}>
            <Typography sx={styles.stepCounterText}>
              {replayIndex + 1} / {replayEvents.length}
            </Typography>
          </Box>
          {showTooltip && (
            <Box 
              sx={{
                ...styles.floatingTooltip,
                left: `${tooltipPosition}px`
              }}
            >
              <Typography sx={styles.floatingTooltipText}>
                Step {tooltipStep + 1}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Main Controls Overlay */}
      {!isLoading && <Box sx={styles.overlay}>
        {replayEvents.length === 0 ? (
          <>
            <Box />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <VisibilityIcon sx={styles.visibilityIcon} />
              <Typography sx={styles.text}>
                spectating
              </Typography>
            </Box>

            <CloseIcon sx={styles.closeIcon} onClick={handleEndWatching} />
          </>
        ) : (
          <>
            <VideocamIcon sx={styles.theatersIcon} />

            <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-evenly' }}>
              <Button
                disabled={isPlaying}
                onClick={replayBackward}
                sx={styles.controlButton}
              >
                <SkipPreviousIcon />
              </Button>

              {/* <Button
                onClick={() => handlePlayPause(!isPlaying)}
                sx={styles.controlButton}
              >
                {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </Button> */}

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
    bottom: '0px',
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
    border: '2px solid rgba(128, 255, 0, 0.4)',
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
    fontSize: '1.1rem',
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
  floatingProgressBar: {
    position: 'absolute',
    bottom: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '444px',
    zIndex: 10,
    padding: '16px 16px',
    pointerEvents: 'auto',
    cursor: 'pointer',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    border: '2px solid rgba(128, 255, 0, 0.4)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  floatingProgressTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(128, 255, 0, 0.2)',
    borderRadius: '3px',
    position: 'relative',
    overflow: 'visible',
  },
  floatingProgressFill: {
    height: '100%',
    backgroundColor: '#80FF00',
    borderRadius: '3px',
    boxShadow: '0 0 8px rgba(128, 255, 0, 0.5)',
  },
  floatingProgressHandle: {
    position: 'absolute',
    top: '-4px',
    width: '14px',
    height: '14px',
    backgroundColor: '#80FF00',
    borderRadius: '50%',
    border: '2px solid rgba(0, 0, 0, 0.8)',
    transform: 'translateX(-50%)',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4), 0 0 8px rgba(128, 255, 0, 0.6)',
  },
  floatingTooltip: {
    position: 'absolute',
    bottom: '100%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    color: '#80FF00',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '14px',
    whiteSpace: 'nowrap',
    zIndex: 1002,
    border: '2px solid rgba(128, 255, 0, 0.4)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
    marginBottom: '8px',
  },
  floatingTooltipText: {
    fontSize: '14px',
    color: '#80FF00',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
  },
  stepCounter: {
    backgroundColor: 'transparent',
    padding: '0',
    marginTop: '6px',
  },
  stepCounterText: {
    fontSize: '14px',
    color: '#80FF00',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
};