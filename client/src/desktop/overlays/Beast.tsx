import { JACKPOT_BEASTS } from '@/constants/beast';
import { useDynamicConnector } from '@/contexts/starknet';
import { useResponsiveScale } from '@/desktop/hooks/useResponsiveScale';
import { useGameStore } from '@/stores/gameStore';
import { beastPowerPercent, collectableImage, getCollectableTraits } from '@/utils/beast';
import { calculateLevel } from '@/utils/game';
import { Box, LinearProgress, Typography, keyframes } from '@mui/material';
import { useEffect, useState } from 'react';
import ArmorTooltip from '../components/ArmorTooltip';
import WeaponTooltip from '../components/WeaponTooltip';
import { useDungeon } from '@/dojo/useDungeon';
import { useGameTokens } from '@/dojo/useGameTokens';

export default function Beast() {
  const dungeon = useDungeon();
  const { getBeastOwner } = useGameTokens();
  const { currentNetworkConfig } = useDynamicConnector();
  const { scalePx } = useResponsiveScale();
  const { adventurer, beast, battleEvent, setShowInventory } = useGameStore();
  const [beastHealth, setBeastHealth] = useState(adventurer!.beast_health);
  const [ownerName, setOwnerName] = useState<string | null>(null);

  const collectable = beast ? beast!.isCollectable : false;
  const collectableTraits = collectable ? getCollectableTraits(beast!.seed) : null;
  const isJackpot = currentNetworkConfig.beasts && JACKPOT_BEASTS.includes(beast?.name!);
  const critChance = calculateLevel(adventurer!.xp);
  const beastPower = Number(beast!.level) * (6 - Number(beast!.tier));

  useEffect(() => {
    if (battleEvent && battleEvent.type === "attack") {
      setBeastHealth(prev => Math.max(0, prev - battleEvent?.attack?.damage!));
    }
  }, [battleEvent]);

  useEffect(() => {
    setShowInventory(true);
  }, []);

  useEffect(() => {
    if (beast && beast.specialPrefix && dungeon.id === "survivor" && !collectable) {
      getBeastOwner(beast).then((name: string | null) => setOwnerName(name));
    }
  }, [beast]);

  // Responsive sizes
  const edgeOffset = scalePx(30);
  const panelWidth = scalePx(360);

  return (
    <>
      <Box sx={{
        ...(collectable ? styles.panelCollectable : styles.panel),
        top: edgeOffset,
        right: edgeOffset,
        width: panelWidth,
      }}>
        {/* Portrait with level badge and tooltips */}
        <Box sx={collectable ? styles.portraitContainerCollectable : styles.portraitContainer}>
          {collectable ? (
            <Box sx={{ position: 'relative', overflow: 'hidden', width: '100%', height: '100%', borderRadius: '50%' }}>
              <img src={collectableImage(beast!.baseName, collectableTraits!)}
                alt="Beast" style={{
                  width: '48px',
                  height: '48px',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)'
                }} />
            </Box>
          ) : (
            <img src="/images/beast.png" alt="Beast" style={styles.portraitImage} />
          )}

          {/* Level badge */}
          <Box sx={collectable ? styles.levelBadgeCollectable : styles.levelBadge}>
            <Typography sx={styles.levelBadgeText}>{beast?.level || 0}</Typography>
          </Box>

          {/* Weapon tooltip (bottom left) */}
          <Box sx={[styles.tooltipBadge, { left: -4 }, collectable && styles.tooltipBadgeCollectable]}>
            <WeaponTooltip beastId={beast!.id} />
          </Box>

          {/* Armor tooltip (bottom right) */}
          <Box sx={[styles.tooltipBadge, { right: -4 }, collectable && styles.tooltipBadgeCollectable]}>
            <ArmorTooltip beastId={beast!.id} />
          </Box>
        </Box>

        {/* Name and bars */}
        <Box sx={styles.barsContainer}>
          {/* Beast Name */}
          <Typography sx={styles.beastName}>
            {beast?.name || 'Beast'}
          </Typography>

          {/* Health Bar */}
          <Box sx={{ position: 'relative' }}>
            <LinearProgress
              variant="determinate"
              value={(beastHealth / beast!.health) * 100}
              sx={styles.healthBar}
            />
            <Typography sx={styles.barOverlayText}>
              {beastHealth}/{beast!.health}
            </Typography>
          </Box>

          {/* Power Bar */}
          <Box sx={{ position: 'relative', mt: 0.75 }}>
            <LinearProgress
              variant="determinate"
              value={beastPowerPercent(critChance, beastPower)}
              sx={styles.powerBarRtl}
            />
            <Typography sx={styles.barOverlayText}>
              Power: {beastPower}
            </Typography>
          </Box>

          {/* Crit Chance Bar */}
          <Box sx={{ position: 'relative', mt: 0.75 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, critChance)}
              sx={styles.critBar}
            />
            <Typography sx={styles.barOverlayText}>
              Crit {critChance}%
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Collectable Indicator */}
      {collectable && (
        <Box sx={{
          ...styles.collectableIndicator,
          top: scalePx(122),
          right: edgeOffset,
          width: panelWidth,
        }}>
          <Typography sx={styles.collectableText}>
            {currentNetworkConfig.beasts ? "Defeat to collect" : "Collectable (beast mode)"}
          </Typography>
        </Box>
      )}

      {/* Owner Name */}
      {ownerName && (
        <Box sx={{
          ...styles.collectableIndicator,
          top: scalePx(122),
          right: edgeOffset,
          width: panelWidth,
        }}>
          <Typography sx={styles.ownerNameText}>
            Owned by {ownerName}
          </Typography>
        </Box>
      )}

      {/* Wanted Beast Toast */}
      {collectable && isJackpot && (
        <Box sx={{
          ...styles.toastContainer,
          top: scalePx(117),
        }}>
          <Typography sx={styles.wantedBeastText}>
            WANTED BEAST
          </Typography>
        </Box>
      )}
    </>
  );
}

const pulseGold = keyframes`
  0% {
    box-shadow: 0 0 8px rgba(237, 207, 51, 0.4);
  }
  50% {
    box-shadow: 0 0 15px rgba(237, 207, 51, 0.6);
  }
  100% {
    box-shadow: 0 0 8px rgba(237, 207, 51, 0.4);
  }
`;

const elegantPulse = keyframes`
  0% {
    box-shadow: 0 0 15px rgba(237, 207, 51, 0.4), 0 0 30px rgba(237, 207, 51, 0.2);
    border: 1px solid rgba(237, 207, 51, 0.6);
  }
  50% {
    box-shadow: 0 0 25px rgba(237, 207, 51, 0.8), 0 0 50px rgba(237, 207, 51, 0.4);
    border: 1px solid rgba(237, 207, 51, 1);
  }
  100% {
    box-shadow: 0 0 15px rgba(237, 207, 51, 0.4), 0 0 30px rgba(237, 207, 51, 0.2);
    border: 1px solid rgba(237, 207, 51, 0.6);
  }
`;

const styles = {
  panel: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: 'rgba(24, 40, 24, 0.55)',
    border: '2px solid #083e22',
    borderRadius: '10px',
    boxShadow: '0 0 8px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
  },
  panelCollectable: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: 'rgba(24, 40, 24, 0.55)',
    border: '2px solid #EDCF33',
    borderRadius: '10px',
    boxShadow: '0 0 8px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(8px)',
    zIndex: 100,
    animation: `${pulseGold} 2s infinite ease-in-out`,
  },
  portraitContainer: {
    position: 'relative',
    width: '56px',
    height: '56px',
    flexShrink: 0,
  },
  portraitContainerCollectable: {
    position: 'relative',
    width: '56px',
    height: '56px',
    flexShrink: 0,
  },
  portraitImage: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '3px solid #083e22',
    background: 'rgba(0, 0, 0, 1)',
  } as React.CSSProperties,
  levelBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #083e22',
    zIndex: 1,
  },
  levelBadgeCollectable: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #EDCF33',
    zIndex: 1,
    animation: `${pulseGold} 2s infinite ease-in-out`,
  },
  levelBadgeText: {
    fontWeight: 'bold',
    fontSize: '12px',
    lineHeight: 1,
  },
  tooltipBadge: {
    position: 'absolute',
    bottom: -4,
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #083e22',
    zIndex: 150,
  },
  tooltipBadgeCollectable: {
    border: '2px solid #EDCF33',
    animation: `${pulseGold} 2s infinite ease-in-out`,
  },
  barsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  beastName: {
    fontSize: '15px',
    fontWeight: 600,
    marginBottom: '6px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  healthBar: {
    height: '16px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#FF4444',
      boxShadow: '0 0 8px rgba(255, 68, 68, 0.5)',
    },
  },
  critBar: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#9C27B0',
      boxShadow: '0 0 8px rgba(156, 39, 176, 0.5)',
    },
  },
  powerBar: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#d7c529',
      boxShadow: '0 0 8px rgba(184, 134, 11, 0.5)',
    },
  },
  powerBarRtl: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    transform: 'scaleX(-1)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#d7c529',
      boxShadow: '0 0 8px rgba(184, 134, 11, 0.5)',
    },
  },
  barOverlayText: {
    position: 'absolute',
    top: 1,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontWeight: 'bold',
    textShadow: '0 0 4px #000',
    pointerEvents: 'none',
    fontSize: '0.8rem',
  },
  collectableIndicator: {
    position: 'absolute',
    textAlign: 'center',
  },
  collectableText: {
    color: '#EDCF33',
    fontSize: '0.75rem',
    textAlign: 'center',
    textShadow: '0 0 8px rgba(237, 207, 51, 0.3)',
    lineHeight: '1.1',
  },
  ownerNameText: {
    color: '#FFFFFF',
    fontSize: '0.75rem',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: '1.1',
  },
  wantedBeastText: {
    color: '#EDCF33',
    fontSize: '0.85rem',
    fontWeight: '600',
    textAlign: 'center',
    textShadow: '0 0 8px rgba(237, 207, 51, 0.6), 0 0 16px rgba(237, 207, 51, 0.3)',
    lineHeight: '1.1',
    letterSpacing: '0.5px',
  },
  toastContainer: {
    display: 'flex',
    alignItems: 'baseline',
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 20px',
    borderRadius: '8px',
    background: 'rgba(24, 40, 24, 0.9)',
    border: '1px solid rgba(237, 207, 51, 0.6)',
    backdropFilter: 'blur(8px)',
    zIndex: 1000,
    animation: `${elegantPulse} 2s infinite ease-in-out`,
  },
};
