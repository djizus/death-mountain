import { STARTING_HEALTH } from '@/constants/game';
import { useController } from '@/contexts/controller';
import { useResponsiveScale } from '@/desktop/hooks/useResponsiveScale';
import { useGameStore } from '@/stores/gameStore';
import { useMarketStore } from '@/stores/marketStore';
import { CombatStats } from '@/types/game';
import { calculateLevel, calculateNextLevelXP } from '@/utils/game';
import { Box, LinearProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';

export default function Adventurer({ combatStats }: { combatStats?: CombatStats }) {
  const { playerName } = useController();
  const { scalePx } = useResponsiveScale();
  const { adventurer, metadata, battleEvent, beast } = useGameStore();
  const { cart } = useMarketStore();

  const [health, setHealth] = useState(adventurer!.health);

  useEffect(() => {
    if (battleEvent && battleEvent.type === "beast_attack") {
      setHealth(prev => Math.max(0, prev - battleEvent?.attack?.damage!));
    }
  }, [battleEvent]);

  useEffect(() => {
    if (!beast) {
      setHealth(adventurer!.health);
    }
  }, [adventurer?.health, beast]);

  const maxHealth = STARTING_HEALTH + (adventurer!.stats.vitality * 15);
  const healthPercent = (health / maxHealth) * 100;
  const potionHealth = cart.potions * 10;
  const previewHealth = Math.min(health + potionHealth, maxHealth);
  const previewHealthPercent = (previewHealth / maxHealth) * 100;
  const previewProtection = combatStats?.bestProtection || 0;
  const previewProtectionPercent = Math.min(100, previewProtection);
  const previewAttack = combatStats?.bestDamage || 0;
  const previewAttackPercent = Math.min(100, Math.floor(previewAttack / (beast?.health || 1) * 100));
  const currentLevel = calculateLevel(adventurer?.xp || 0);
  const nextLevelXp = calculateNextLevelXP(currentLevel);
  const currentLevelFloor = currentLevel ** 2;
  const currentXpIntoLevel = (adventurer?.xp || 0) - currentLevelFloor;
  const xpRequiredForNext = nextLevelXp - currentLevelFloor;
  const xpProgress = xpRequiredForNext > 0 ? (currentXpIntoLevel / xpRequiredForNext) * 100 : 100;

  // Responsive sizes
  const edgeOffset = scalePx(30);
  const panelWidth = scalePx(360);

  return (
    <Box sx={{
      ...styles.panel,
      top: edgeOffset,
      left: scalePx(8),
      width: panelWidth,
    }}>
      {/* Portrait with level badge */}
      <Box sx={styles.portraitContainer}>
        <img src="/images/adventurer.png" alt="Adventurer" style={styles.portraitImage} />
        <Box sx={styles.levelBadge}>
          <Typography sx={styles.levelBadgeText}>{currentLevel}</Typography>
        </Box>
      </Box>

      {/* Name and bars */}
      <Box sx={{ ...styles.barsContainer, pl: beast ? '20px' : 0 }}>
        {!beast && (
          <Typography sx={styles.adventurerName}>
            {metadata?.player_name || playerName || 'Adventurer'}
          </Typography>
        )}

        {/* Health Bar */}
        <Box sx={{ position: 'relative' }}>
          {beast && (
            <Box sx={styles.barIconContainer}>
              <span style={styles.heartIcon}>❤️</span>
            </Box>
          )}
          <LinearProgress
            variant="determinate"
            value={healthPercent}
            sx={styles.healthBar}
          />
          {cart.potions > 0 && (
            <LinearProgress
              variant="determinate"
              value={previewHealthPercent}
              sx={styles.previewHealthBar}
            />
          )}
          <Typography sx={styles.barOverlayText}>
            {previewHealth}/{maxHealth}
          </Typography>
        </Box>

        {/* XP Bar */}
        <Box sx={{ position: 'relative', mt: 0.75 }}>
          {beast && (
            <Box sx={styles.barIconContainer}>
              <span style={styles.bookIcon}>📘</span>
            </Box>
          )}
          <LinearProgress
            variant="determinate"
            value={adventurer?.stat_upgrades_available! > 0 ? 100 : xpProgress}
            sx={styles.xpBar}
          />
          <Typography sx={styles.barOverlayText}>
            {adventurer?.stat_upgrades_available! > 0
              ? 'LEVEL UP'
              : `${currentXpIntoLevel}/${xpRequiredForNext}`}
          </Typography>
        </Box>

        {/* Attack/Defense bars during combat */}
        {beast && combatStats && (
          <>
            {/* Attack Bar */}
            <Box sx={{ position: 'relative', mt: 0.75 }}>
              <Box sx={styles.barIconContainer}>
                <span style={styles.swordIcon}>⚔️</span>
              </Box>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.floor(combatStats.baseDamage / beast.health * 100))}
                sx={styles.attackBar}
              />
              {previewAttack > combatStats.baseDamage && (
                <LinearProgress
                  variant="determinate"
                  value={previewAttackPercent}
                  sx={styles.previewAttackBar}
                />
              )}
            </Box>
            {/* Defense Bar */}
            <Box sx={{ position: 'relative', mt: 0.75 }}>
              <Box sx={styles.barIconContainer}>
                <span style={styles.shieldIcon}>🛡️</span>
              </Box>
              <LinearProgress
                variant="determinate"
                value={combatStats.protection}
                sx={styles.defenseBar}
              />
              {previewProtection > combatStats.protection && (
                <LinearProgress
                  variant="determinate"
                  value={previewProtectionPercent}
                  sx={styles.previewDefenseBar}
                />
              )}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

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
  portraitContainer: {
    position: 'relative',
    width: '68px',
    height: '68px',
    flexShrink: 0,
  },
  portraitImage: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '3px solid #083e22',
    background: 'rgba(24, 40, 24, 1)',
  } as React.CSSProperties,
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
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
  levelBadgeText: {
    fontWeight: 'bold',
    fontSize: '12px',
    lineHeight: 1,
  },
  barsContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  adventurerName: {
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
      backgroundColor: '#4CAF50',
      boxShadow: '0 0 8px rgba(76, 175, 80, 0.5)',
    },
  },
  previewHealthBar: {
    height: '16px',
    borderRadius: '6px',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    '& .MuiLinearProgress-bar': {
      backgroundColor: 'rgba(76, 175, 80, 0.3)',
      boxShadow: '0 0 8px rgba(76, 175, 80, 0.3)',
    },
  },
  xpBar: {
    height: '16px',
    borderRadius: '6px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#9C27B0',
      boxShadow: '0 0 8px rgba(156, 39, 176, 0.5)',
    },
  },
  attackBar: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#FF8C00',
      boxShadow: '0 0 8px rgba(184, 134, 11, 0.5)',
    },
  },
  defenseBar: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'rgba(0,0,0,0.3)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#C0C0C0',
      boxShadow: '0 0 8px rgba(192, 192, 192, 0.5)',
    },
  },
  previewAttackBar: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    '& .MuiLinearProgress-bar': {
      backgroundColor: 'rgba(255, 140, 0, 0.3)',
    },
  },
  previewDefenseBar: {
    height: '14px',
    borderRadius: '5px',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    '& .MuiLinearProgress-bar': {
      backgroundColor: 'rgba(192, 192, 192, 0.3)',
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
  barIconContainer: {
    position: 'absolute',
    top: 0,
    left: -18,
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  heartIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
  bookIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
  swordIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
  shieldIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
};
