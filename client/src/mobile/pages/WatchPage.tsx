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
import { Box, Button, Typography } from '@mui/material';
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
        setEventQueue([]);
        setEventsProcessed(0);
      }
      
      // Jump to the new position
      setReplayIndex(newIndex);
      
      // Process events up to the new position
      for (let i = 0; i <= newIndex; i++) {
        processEvent(replayEvents[i], true);
      }
    } else {
      // Deferred selection - wait 300ms before applying
      selectionTimeoutRef.current = setTimeout(() => {
        // Stop playing if we're scrubbing
        if (isPlaying) {
          setIsPlaying(false);
          setEventQueue([]);
          setEventsProcessed(0);
        }
        
        // Jump to the new position
        setReplayIndex(newIndex);
        
        // Process events up to the new position
        for (let i = 0; i <= newIndex; i++) {
          processEvent(replayEvents[i], true);
        }
      }, 300);
    }
  }, [replayEvents, isPlaying, processEvent]);

  useEffect(() => {
    if (replayEvents.length > 0 && replayIndex === 0) {
      processEvent(replayEvents[0], true)
      replayForward();
    }
  }, [replayEvents]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!isDragging || !sliderRef.current) return;
      
      const rect = sliderRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      setDragPosition(percentage);
      setTooltipPosition(x);
      
      const newIndex = Math.floor(percentage * (replayEvents.length - 1));
      setTooltipStep(newIndex);
      handleSliderChange(newIndex);
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setDragPosition(null);
      setShowTooltip(false);
    };

    const handleGlobalTouchMove = (event: TouchEvent) => {
      if (!isDragging || !sliderRef.current) return;
      
      const touch = event.touches[0];
      const rect = sliderRef.current.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      setDragPosition(percentage);
      setTooltipPosition(x);
      
      const newIndex = Math.floor(percentage * (replayEvents.length - 1));
      setTooltipStep(newIndex);
      handleSliderChange(newIndex);
    };

    const handleGlobalTouchEnd = () => {
      setIsDragging(false);
      setDragPosition(null);
      setShowTooltip(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, replayEvents.length, handleSliderChange]);

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

  const handleSliderMouseDown = useCallback((event: React.MouseEvent) => {
    setIsDragging(true);
    setShowTooltip(true);
    event.preventDefault();
    
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setDragPosition(percentage);
    setTooltipPosition(x);
    
    const newIndex = Math.floor(percentage * (replayEvents.length - 1));
    setTooltipStep(newIndex);
  }, [replayEvents.length]);

  const handleSliderMouseMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging || !sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setDragPosition(percentage);
    setTooltipPosition(x);
    
    const newIndex = Math.floor(percentage * (replayEvents.length - 1));
    setTooltipStep(newIndex);
    handleSliderChange(newIndex);
  }, [isDragging, replayEvents.length, handleSliderChange]);

  const handleSliderMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragPosition(null);
    setShowTooltip(false);
  }, []);

  const handleSliderClick = useCallback((event: React.MouseEvent) => {
    if (!sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newIndex = Math.floor(percentage * (replayEvents.length - 1));
    
    handleSliderChange(newIndex, true); // Immediate selection for clicks
  }, [handleSliderChange]);

  const handleSliderTouchStart = useCallback((event: React.TouchEvent) => {
    setIsDragging(true);
    setShowTooltip(true);
    event.preventDefault();
    
    if (!sliderRef.current) return;
    const touch = event.touches[0];
    const rect = sliderRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setDragPosition(percentage);
    setTooltipPosition(x);
    
    const newIndex = Math.floor(percentage * (replayEvents.length - 1));
    setTooltipStep(newIndex);
  }, [replayEvents.length]);

  const handleSliderTouchMove = useCallback((event: React.TouchEvent) => {
    if (!isDragging || !sliderRef.current) return;
    
    const touch = event.touches[0];
    const rect = sliderRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setDragPosition(percentage);
    setTooltipPosition(x);
    
    const newIndex = Math.floor(percentage * (replayEvents.length - 1));
    setTooltipStep(newIndex);
    handleSliderChange(newIndex);
  }, [isDragging, replayEvents.length, handleSliderChange]);

  const handleSliderTouchEnd = useCallback(() => {
    setIsDragging(false);
    setDragPosition(null);
    setShowTooltip(false);
  }, []);

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
      {!isLoading && (
        <>
          <Box sx={styles.overlay}>
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

                <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-evenly' }}>
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
              </>
            )}
          </Box>
          
          {replayEvents.length > 0 && (
            <Box sx={styles.sliderContainer}>
              <Box
                ref={sliderRef}
                sx={styles.sliderTrack}
                onClick={handleSliderClick}
                onMouseDown={handleSliderMouseDown}
                onTouchStart={handleSliderTouchStart}
                onTouchMove={handleSliderTouchMove}
                onTouchEnd={handleSliderTouchEnd}
              >
                <Box
                  sx={{
                    ...styles.sliderThumb,
                    left: `${(isDragging && dragPosition !== null ? dragPosition : (replayIndex / Math.max(1, replayEvents.length - 1))) * 100}%`,
                  }}
                />
              </Box>
              
              {showTooltip && isDragging && (
                <Box
                  sx={{
                    ...styles.tooltip,
                    left: `${tooltipPosition}px`,
                  }}
                >
                  <Typography sx={styles.tooltipText}>
                    {tooltipStep + 1}/{replayEvents.length}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </>
      )}

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
    borderBottom: 'none',
  },
  sliderContainer: {
    position: 'fixed',
    bottom: '119px', // Position above the overlay
    left: '50%',
    transform: 'translateX(-50%)',
    width: '444px',
    maxWidth: 'calc(100dvw - 6px)',
    height: '6px',
    zIndex: 1001,
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  sliderTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(128, 255, 0, 0.4)',
    position: 'relative',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: 'rgba(128, 255, 0, 0.6)',
    },
  },
  sliderThumb: {
    position: 'absolute',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '20px',
    height: '20px',
    backgroundColor: 'rgba(128, 255, 0, 1)',
    borderRadius: '50%',
    cursor: 'grab',
    border: '3px solid rgba(0, 0, 0, 0.8)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
    transition: 'transform 0.1s ease',
    '&:hover': {
      backgroundColor: 'rgba(128, 255, 0, 1)',
      transform: 'translate(-50%, -50%) scale(1.1)',
    },
    '&:active': {
      cursor: 'grabbing',
      transform: 'translate(-50%, -50%) scale(1.2)',
    },
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    color: 'rgba(128, 255, 0, 1)',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    zIndex: 1002,
    pointerEvents: 'none',
    border: '1px solid rgba(128, 255, 0, 0.3)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
  },
  tooltipText: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'rgba(128, 255, 0, 1)',
    margin: 0,
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
};