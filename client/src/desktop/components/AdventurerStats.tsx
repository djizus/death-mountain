import { MAX_STAT_VALUE } from '@/constants/game';
import { useGameStore } from '@/stores/gameStore';
import { ability_based_percentage, calculateCombatStats, calculateLevel } from '@/utils/game';
import { ItemUtils } from '@/utils/loot';
import { potionPrice } from '@/utils/market';
import { Box, Button, Typography } from '@mui/material';
import { useMemo } from 'react';

const STAT_DESCRIPTIONS = {
  strength: "Increases attack damage.",
  dexterity: "Increases chance of fleeing Beasts.",
  vitality: "Increases your maximum health.",
  intelligence: "Increases chance of dodging Obstacles.",
  wisdom: "Increases chance of avoiding Beast ambush.",
  charisma: "Provides discounts on the marketplace.",
  luck: "Increases chance of critical hits. Based on the total level of all your equipped and bagged jewelry."
} as const;

const COMBAT_STAT_DESCRIPTIONS = {
  baseDamage: "Damage you deal per hit.",
  criticalDamage: "Damage you deal if critical hit.",
  critChance: "Chance to land a critical hit. Based on the total level of all your equipped and bagged jewelry.",
  gearScore: "Combined power of your equipment and bag."
} as const;

interface AdventurerStatsProps {
  variant: 'stats' | 'combat';
}

export default function AdventurerStats({ variant }: AdventurerStatsProps) {
  const { adventurer, bag, beast, selectedStats, setSelectedStats } = useGameStore();
  const isStatsVariant = variant === 'stats';
  const hasAvailableUpgrades = adventurer?.stat_upgrades_available! > 0;

  const combatStats = useMemo(() => {
    return calculateCombatStats(adventurer!, bag, beast);
  }, [adventurer, bag, beast]);

  const equippedItemStats = useMemo(() => {
    return ItemUtils.getEquippedItemStats(adventurer!, bag);
  }, [adventurer, bag]);

  const totalSelected = Object.values(selectedStats).reduce((a, b) => a + b, 0);
  const pointsRemaining = adventurer!.stat_upgrades_available - totalSelected;

  const handleStatIncrement = (stat: keyof typeof STAT_DESCRIPTIONS) => {
    if (pointsRemaining > 0 && (selectedStats[stat] + adventurer!.stats[stat]) < (MAX_STAT_VALUE + equippedItemStats[stat])) {
      setSelectedStats({
        ...selectedStats,
        [stat]: selectedStats[stat] + 1
      });
    }
  };

  const handleStatDecrement = (stat: keyof typeof STAT_DESCRIPTIONS) => {
    if (selectedStats[stat] > 0) {
      setSelectedStats({
        ...selectedStats,
        [stat]: selectedStats[stat] - 1
      });
    }
  };

  function STAT_TITLE(stat: string) {
    if (stat === 'intelligence') {
      return 'Intellect';
    }

    if (stat === "luck") {
      return 'Crit Chance';
    }

    return stat.charAt(0).toUpperCase() + stat.slice(1);
  }

  function COMBAT_STAT_TITLE(stat: string) {
    if (stat === 'baseDamage') {
      return 'Attack Dmg';
    } else if (stat === 'critChance') {
      return 'Crit Chance';
    } else if (stat === 'criticalDamage') {
      return 'Crit Dmg';
    } else if (stat === 'gearScore') {
      return 'Gear Score';
    }

    return stat.charAt(0).toUpperCase() + stat.slice(1);
  }

  function STAT_HELPER_TEXT(stat: string, currentValue: number) {
    const level = calculateLevel(adventurer!.xp);

    if (stat === 'strength') {
      return `+${currentValue * 10}% damage`;
    } else if (stat === 'dexterity') {
      return `${ability_based_percentage(adventurer!.xp, currentValue)}% chance`;
    } else if (stat === 'vitality') {
      return `+${currentValue * 15} Health`;
    } else if (stat === 'intelligence') {
      return `${ability_based_percentage(adventurer!.xp, currentValue)}% chance`;
    } else if (stat === 'wisdom') {
      return `${ability_based_percentage(adventurer!.xp, currentValue)}% chance`;
    } else if (stat === 'charisma') {
      return `Pot ${potionPrice(level, currentValue)}G - Items ${currentValue}G`;
    } else if (stat === 'luck') {
      return `${currentValue}% chance of critical hits`;
    }
    return null;
  }

  const renderStatsView = () => (
    <>
      <Box sx={styles.statGrid}>
        {['strength', 'vitality', 'dexterity', 'intelligence', 'wisdom', 'charisma'].map((stat) => {
          const totalStatValue = adventurer?.stats?.[stat as keyof typeof STAT_DESCRIPTIONS]! + selectedStats[stat as keyof typeof STAT_DESCRIPTIONS]!;
          const effectText = STAT_HELPER_TEXT(stat, totalStatValue);

          return (
            <Box sx={styles.statRow} key={stat}>
              <Box sx={styles.statInfo}>
                <Typography sx={styles.statLabel}>{STAT_TITLE(stat)}</Typography>
                {effectText && (
                  <Typography sx={styles.statEffect}>{effectText}</Typography>
                )}
              </Box>
              <Box sx={styles.statControls}>
                {adventurer?.stat_upgrades_available! > 0 && stat !== 'luck' && <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleStatDecrement(stat as keyof typeof STAT_DESCRIPTIONS)}
                  sx={styles.controlButton}
                >
                  -
                </Button>}

                <Typography sx={styles.statValue}>
                  {totalStatValue}
                </Typography>

                {adventurer?.stat_upgrades_available! > 0 && stat !== 'luck' && <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleStatIncrement(stat as keyof typeof STAT_DESCRIPTIONS)}
                  disabled={(adventurer!.stats[stat as keyof typeof STAT_DESCRIPTIONS] + selectedStats[stat as keyof typeof STAT_DESCRIPTIONS]) >= (MAX_STAT_VALUE + equippedItemStats[stat as keyof typeof STAT_DESCRIPTIONS])}
                  sx={styles.controlButton}
                >
                  +
                </Button>}
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 0.5 }}>
        {adventurer?.stat_upgrades_available! > 0 &&
          <Typography color="secondary" >{pointsRemaining} remaining</Typography>
        }
      </Box>
    </>
  );

  const renderCombatView = () => (
    <>
      {Object.entries(COMBAT_STAT_DESCRIPTIONS).map(([stat]) => {
        const value = (combatStats as any)?.[stat];

        return (
          <Box sx={styles.statRow} key={stat}>
            <Typography sx={styles.statLabel}>{COMBAT_STAT_TITLE(stat)}</Typography>
            <Box sx={styles.statControls}>
              <Typography sx={styles.combatValue}>
                {value}{stat === 'critChance' ? '%' : ''}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </>
  );

  return (
    <>
      <Box
        sx={{
          ...styles.statsPanel,
          ...(isStatsVariant ? styles.statsPanelStatsVariant : styles.statsPanelCombatVariant),
          ...(isStatsVariant && hasAvailableUpgrades && pointsRemaining > 0 && styles.statsPanelHighlighted),
          ...(isStatsVariant && hasAvailableUpgrades && pointsRemaining === 0 && styles.statsPanelBorderOnly)
        }}
      >
        <Box sx={styles.panelHeader}>
          {isStatsVariant ? (
            hasAvailableUpgrades ? (
              <Typography sx={styles.selectStatsText}>Select Stats</Typography>
            ) : (
              <Typography sx={styles.statsTitle}>Stats</Typography>
            )
          ) : (
            <Typography sx={styles.statsTitle}>Combat</Typography>
          )}
        </Box>
        {isStatsVariant ? renderStatsView() : renderCombatView()}
      </Box>
    </>
  );
}

const styles = {
  statsPanel: {
    background: 'rgba(24, 40, 24, 0.95)',
    border: '2px solid #083e22',
    borderRadius: '8px',
    padding: '10px 8px 6px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    boxShadow: '0 0 8px #000a',
    transition: 'all 0.3s ease-in-out',
  },
  statsPanelCombatVariant: {
    height: '310px',
    width: '185px',
    flexShrink: 0,
  },
  statsPanelStatsVariant: {
    width: '100%',
    height: '450px',
    flex: 1,
    minWidth: 0,
  },
  statsPanelHighlighted: {
    border: '1px solid #d7c529',
    boxShadow: '0 0 12px rgba(215, 197, 41, 0.4), 0 0 8px #000a',
    background: 'rgba(24, 40, 24, 0.98)',
    animation: 'containerPulse 2s ease-in-out infinite',
    '@keyframes containerPulse': {
      '0%': {
        boxShadow: '0 0 12px rgba(215, 197, 41, 0.4), 0 0 8px #000a',
      },
      '50%': {
        boxShadow: '0 0 20px rgba(215, 197, 41, 0.6), 0 0 8px #000a',
      },
      '100%': {
        boxShadow: '0 0 12px rgba(215, 197, 41, 0.4), 0 0 8px #000a',
      },
    },
  },
  statsPanelBorderOnly: {
    border: '1px solid #d7c529',
    boxShadow: '0 0 8px #000a',
    background: 'rgba(24, 40, 24, 0.98)',
  },
  selectStatsText: {
    color: '#d7c529',
    fontSize: '14px',
    fontWeight: 'bold',
    textAlign: 'center',
    width: '100%',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    mb: 0.5,
  },
  statsTitle: {
    fontWeight: '500',
    fontSize: 16,
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 0.5,
    border: '2px solid rgba(8, 62, 34, 0.85)',
    borderRadius: '6px',
    padding: '8px',
    background: 'rgba(18, 30, 18, 0.92)',
    boxShadow: '0 0 6px rgba(0, 0, 0, 0.5)',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    columnGap: 0,
    rowGap: 0.75,
  },
  statInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flexGrow: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: '13px',
    fontWeight: '500',
    pt: '1px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  statEffect: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  statControls: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '3px',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  controlButton: {
    minWidth: '20px',
    height: '20px',
    padding: '0',
    background: 'rgba(215, 197, 41, 0.2)',
    color: '#d7c529',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    fontWeight: 'bold',
    borderRadius: '3px',
    border: '1px solid rgba(215, 197, 41, 0.4)',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      background: 'rgba(215, 197, 41, 0.3)',
      border: '1px solid rgba(215, 197, 41, 0.6)',
      transform: 'scale(1.05)',
    },
    '&:disabled': {
      background: 'rgba(0, 0, 0, 0.1)',
      color: 'rgba(255, 255, 255, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      transform: 'none',
    },
  },
  combatValue: {
    fontSize: '13px',
    fontWeight: '600',
    minWidth: '32px',
    textAlign: 'center',
  },
  statValue: {
    width: '26px',
    textAlign: 'center',
    fontSize: '14px',
    pt: '1px',
    flexShrink: 0,
  },

};
