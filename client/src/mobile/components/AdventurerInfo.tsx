import { useController } from "@/contexts/controller";
import { useGameStore } from "@/stores/gameStore";
import { calculateLevel, calculateNextLevelXP, calculateProgress } from "@/utils/game";
import { ItemUtils } from "@/utils/loot";
import { LinearProgress, Typography } from "@mui/material";
import { useState, useMemo } from "react";

import { STARTING_HEALTH } from "@/constants/game";
import { Box } from "@mui/material";

export default function AdventurerInfo() {
  const { openProfile, playerName } = useController();
  const { adventurer, metadata, bag } = useGameStore();
  const [showDetailedStats, setShowDetailedStats] = useState(false);
  
  // Calculate level using the proper function
  const level = calculateLevel(adventurer?.xp || 1);
  const progress = calculateProgress(adventurer?.xp || 1);
  const nextLevelXP = calculateNextLevelXP(level);
  const xpToNextLevel = nextLevelXP - (adventurer?.xp || 0);
  const maxHealth = STARTING_HEALTH + (adventurer!.stats.vitality * 15);
  
  // Calculate item bonuses
  const itemBonuses = useMemo(() => {
    if (!adventurer || !bag) return { strength: 0, dexterity: 0, vitality: 0, intelligence: 0, wisdom: 0, charisma: 0, luck: 0 };
    return ItemUtils.getEquippedItemStats(adventurer, bag);
  }, [adventurer, bag]);
  
  // Calculate base stats (total - item bonuses)
  const baseStats = useMemo(() => {
    if (!adventurer) return { strength: 0, dexterity: 0, vitality: 0, intelligence: 0, wisdom: 0, charisma: 0, luck: 0 };
    return {
      strength: Math.max(0, adventurer.stats.strength - itemBonuses.strength),
      dexterity: Math.max(0, adventurer.stats.dexterity - itemBonuses.dexterity),
      vitality: Math.max(0, adventurer.stats.vitality - itemBonuses.vitality),
      intelligence: Math.max(0, adventurer.stats.intelligence - itemBonuses.intelligence),
      wisdom: Math.max(0, adventurer.stats.wisdom - itemBonuses.wisdom),
      charisma: Math.max(0, adventurer.stats.charisma - itemBonuses.charisma),
      luck: Math.max(0, adventurer.stats.luck - itemBonuses.luck),
    };
  }, [adventurer, itemBonuses]);
  
  // Calculate health percentage for color determination
  const healthPercentage = (adventurer?.health || 0) / maxHealth * 100;
  
  // Function to get health bar color based on percentage
  const getHealthBarColor = (percentage: number) => {
    if (percentage >= 66) return '#80FF00'; // Green
    if (percentage >= 33) return '#EDCF33'; // Yellow
    return 'rgb(248, 27, 27)';
  };
  
  // Function to handle stat card click
  const handleStatClick = () => {
    setShowDetailedStats(!showDetailedStats);
  };
  
  // Function to render stat value
  const renderStatValue = (statName: keyof typeof baseStats) => {
    const baseValue = baseStats[statName];
    const bonusValue = itemBonuses[statName];
    
    if (showDetailedStats) {
      return (
        <Box sx={styles.statsItemContainer}>
          <Typography sx={{ ...styles.statValue, color: '#80FF00' }}>
            {baseValue}
          </Typography>
          <Typography sx={{ ...styles.statValue, color: '#EDCF33' }}>
            (+{bonusValue})
          </Typography>
        </Box>
      );
    }
    
    return (
      <Typography sx={styles.statValue}>{adventurer?.stats?.[statName] || 0}</Typography>
    );
  };

  return (
    <>
      <Box sx={styles.characterHeader}>
        <Box onClick={openProfile}>
          <Typography variant="h4" sx={styles.characterName}>
            {metadata?.player_name || playerName || 'Adventurer'}
          </Typography>
        </Box>
        <Box sx={styles.headerStats}>
          <Box sx={styles.goldContainer}>
            <Typography variant="body2" sx={styles.levelText}>
              {adventurer?.gold || 0} Gold
            </Typography>
          </Box>
          <Box sx={styles.goldContainer}>
            <Typography variant="body2" sx={styles.levelText}>
              Level {level}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Health and XP Bars */}
      <Box sx={styles.statsContainer}>
        <Box sx={styles.statItem}>
          <Typography variant="body2" sx={styles.statLabel}>Health</Typography>
          <LinearProgress
            variant="determinate"
            value={(adventurer?.health || 0) / maxHealth * 100}
            sx={{
              ...styles.healthBar,
              '& .MuiLinearProgress-bar': {
                backgroundColor: getHealthBarColor(healthPercentage),
              },
            }}
          />
          <Typography variant="body2" sx={styles.statValue}>
            {adventurer?.health || 0}/{maxHealth}
          </Typography>
        </Box>
        <Box sx={styles.statItem}>
          <Typography variant="body2" sx={styles.statLabel}>XP</Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={styles.xpBar}
          />
          <Box sx={styles.xpInfo}>
            <Typography variant="body2" sx={styles.statValue}>
              {adventurer?.xp || 0}
            </Typography>
            <Typography variant="body2" sx={styles.xpToNext}>
              {xpToNextLevel} to next level
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Stats Grid */}
      <Box sx={styles.statsGrid} onClick={handleStatClick}>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>STR</Typography>
          {renderStatValue('strength')}
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>DEX</Typography>
          {renderStatValue('dexterity')}
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>VIT</Typography>
          {renderStatValue('vitality')}
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>INT</Typography>
          {renderStatValue('intelligence')}
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>WIS</Typography>
          {renderStatValue('wisdom')}
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>CHA</Typography>
          {renderStatValue('charisma')}
        </Box>
        <Box sx={styles.statCard}>
          <Typography sx={styles.statLabel}>LUCK</Typography>
          {renderStatValue('luck')}
        </Box>
      </Box>
    </>
  )
}

const styles = {
  characterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  characterName: {
    color: '#80FF00',
    fontWeight: 'bold',
    textShadow: '0 0 10px rgba(128, 255, 0, 0.3)',
  },
  levelText: {
    color: '#EDCF33',
    fontFamily: 'VT323, monospace',
  },
  statsContainer: {
    display: 'flex',
    gap: 2,
  },
  statsItemContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
  },
  statItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  statLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontSize: '0.85rem',
    fontFamily: 'VT323, monospace',
    lineHeight: 1,
  },
  statValue: {
    color: '#80FF00',
    fontSize: '0.9rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  healthBar: {
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
  },
  xpBar: {
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(237, 207, 51, 0.1)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#EDCF33',
    },
  },
  xpInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
  },
  xpToNext: {
    color: 'rgba(237, 207, 51, 0.7)',
    fontSize: '0.8rem',
    fontFamily: 'VT323, monospace',
  },
  goldContainer: {
    background: 'rgba(237, 207, 51, 0.1)',
    padding: '0 8px',
    borderRadius: '6px',
    border: '1px solid rgba(237, 207, 51, 0.2)',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
  },
  goldValue: {
    color: '#EDCF33',
    fontSize: '0.85rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    lineHeight: '24px',
  },
  headerStats: {
    display: 'flex',
    gap: '8px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '4px',
    marginBottom: '4px',
  },
  statCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: 'rgba(128, 255, 0, 0.1)',
    borderRadius: '4px',
    py: '4px',
    border: '1px solid rgba(128, 255, 0, 0.2)',
  },
};
