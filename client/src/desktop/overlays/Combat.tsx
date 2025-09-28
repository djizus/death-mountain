import AnimatedText from '@/desktop/components/AnimatedText';
import { useGameDirector } from '@/desktop/contexts/GameDirector';
import { useGameStore } from '@/stores/gameStore';
import { defaultSimulationResult, simulateCombatOutcomes } from '@/utils/combatSimulation';
import { ability_based_percentage, calculateAttackDamage, calculateCombatStats, calculateLevel, getNewItemsEquipped } from '@/utils/game';
import { potionPrice } from '@/utils/market';
import { Box, Button, Checkbox, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import Adventurer from './Adventurer';
import Beast from './Beast';
import InventoryOverlay from './Inventory';
import SettingsOverlay from './Settings';
import { JACKPOT_BEASTS, GOLD_MULTIPLIER, GOLD_REWARD_DIVISOR, MINIMUM_XP_REWARD } from '@/constants/beast';
import { useDynamicConnector } from '@/contexts/starknet';

const attackMessage = "Attacking";
const fleeMessage = "Attempting to flee";
const equipMessage = "Equipping items";

export default function CombatOverlay() {
  const { executeGameAction, actionFailed, spectating, setSkipCombat, skipCombat, showSkipCombat } = useGameDirector();
  const { currentNetworkConfig } = useDynamicConnector();
  const { adventurer, adventurerState, beast, battleEvent, bag, undoEquipment } = useGameStore();

  const [untilDeath, setUntilDeath] = useState(false);
  const [attackInProgress, setAttackInProgress] = useState(false);
  const [fleeInProgress, setFleeInProgress] = useState(false);
  const [equipInProgress, setEquipInProgress] = useState(false);
  const [combatLog, setCombatLog] = useState("");
  const [simulationResult, setSimulationResult] = useState(defaultSimulationResult);
  const formatNumber = (value: number) => value.toLocaleString();
  const formatRange = (minValue: number, maxValue: number) => {
    if (Number.isNaN(minValue) || Number.isNaN(maxValue)) {
      return '-';
    }

    if (minValue === maxValue) {
      return formatNumber(minValue);
    }

    return `${formatNumber(minValue)} - ${formatNumber(maxValue)}`;
  };

  useEffect(() => {
    if (adventurer?.xp === 0) {
      setCombatLog(beast!.baseName + " ambushed you for 10 damage!");
    }
  }, []);

  useEffect(() => {
    if (battleEvent && !skipCombat) {
      if (battleEvent.type === "attack") {
        setCombatLog(`You attacked ${beast!.baseName} for ${battleEvent.attack?.damage} damage ${battleEvent.attack?.critical_hit ? 'CRITICAL HIT!' : ''}`);
      }

      else if (battleEvent.type === "beast_attack") {
        setCombatLog(`${beast!.baseName} attacked your ${battleEvent.attack?.location} for ${battleEvent.attack?.damage} damage ${battleEvent.attack?.critical_hit ? 'CRITICAL HIT!' : ''}`);
      }

      else if (battleEvent.type === "flee") {
        if (battleEvent.success) {
          setCombatLog(`You successfully fled`);
        } else {
          setCombatLog(`You failed to flee`);
        }
      }

      else if (battleEvent.type === "ambush") {
        setCombatLog(`${beast!.baseName} ambushed your ${battleEvent.attack?.location} for ${battleEvent.attack?.damage} damage ${battleEvent.attack?.critical_hit ? 'CRITICAL HIT!' : ''}`);
      }
    }
  }, [battleEvent]);

  useEffect(() => {
    setAttackInProgress(false);
    setFleeInProgress(false);
    setEquipInProgress(false);

    if ([fleeMessage, attackMessage, equipMessage].includes(combatLog)) {
      setCombatLog("");
    }
  }, [actionFailed]);

  useEffect(() => {
    setEquipInProgress(false);

    if (!untilDeath) {
      setAttackInProgress(false);
      setFleeInProgress(false);
    }
  }, [adventurer!.action_count]);

  const handleAttack = () => {
    setAttackInProgress(true);
    setCombatLog(attackMessage);
    executeGameAction({ type: 'attack', untilDeath });
  };

  const handleFlee = () => {
    setFleeInProgress(true);
    setCombatLog(fleeMessage);
    executeGameAction({ type: 'flee', untilDeath });
  };

  const handleEquipItems = () => {
    setEquipInProgress(true);
    setCombatLog(equipMessage);
    executeGameAction({ type: 'equip' });
  };

  const handleSkipCombat = () => {
    setSkipCombat(true);
  };

  const fleePercentage = ability_based_percentage(adventurer!.xp, adventurer!.stats.dexterity);
  const combatStats = calculateCombatStats(adventurer!, bag, beast);

  const hasNewItemsEquipped = useMemo(() => {
    if (!adventurer?.equipment || !adventurerState?.equipment) return false;
    return getNewItemsEquipped(adventurer.equipment, adventurerState.equipment).length > 0;
  }, [adventurer?.equipment]);

  const isJackpot = useMemo(() => {
    return currentNetworkConfig.beasts && JACKPOT_BEASTS.includes(beast?.name!);
  }, [beast]);

  const beastCombatSummary = useMemo(() => {
    if (!adventurer || !beast) {
      return null;
    }

    const beastTier = Math.min(5, Math.max(1, Number(beast.tier)));

    const adventurerLevel = calculateLevel(adventurer.xp);
    const critChance = Math.min(100, adventurerLevel);

    const tierKey = `T${beastTier}` as keyof typeof GOLD_MULTIPLIER;
    const goldMultiplier = GOLD_MULTIPLIER[tierKey] ?? 1;
    const goldReward = Math.max(
      0,
      Math.floor((beast.level * goldMultiplier) / GOLD_REWARD_DIVISOR)
    );

    const rawXp = Math.floor(((6 - beastTier) * beast.level) / 2);
    const adjustedXp = Math.floor(
      rawXp * (100 - Math.min(adventurerLevel * 2, 95)) / 100
    );
    const xpReward = Math.max(MINIMUM_XP_REWARD, adjustedXp);

    return {
      critChance,
      goldReward,
      xpReward,
    };
  }, [adventurer?.xp, beast]);

  const adventurerLevel = useMemo(() => {
    if (!adventurer) {
      return 0;
    }

    return calculateLevel(adventurer.xp);
  }, [adventurer?.xp]);

  useEffect(() => {
    let cancelled = false;

    if (!adventurer || !beast || !beastCombatSummary) {
      setSimulationResult(defaultSimulationResult);
      return () => {
        cancelled = true;
      };
    }

    const runSimulation = async () => {
      const result = await simulateCombatOutcomes(adventurer, beast);
      if (!cancelled) {
        setSimulationResult(result);
      }
    };

    void runSimulation();

    return () => {
      cancelled = true;
    };
  }, [
    adventurer?.health,
    adventurer?.xp,
    adventurer?.item_specials_seed,
    adventurer?.stats.strength,
    adventurer?.stats.luck,
    adventurer?.equipment.weapon.id,
    adventurer?.equipment.weapon.xp,
    adventurer?.equipment.chest.id,
    adventurer?.equipment.chest.xp,
    adventurer?.equipment.head.id,
    adventurer?.equipment.head.xp,
    adventurer?.equipment.waist.id,
    adventurer?.equipment.waist.xp,
    adventurer?.equipment.hand.id,
    adventurer?.equipment.hand.xp,
    adventurer?.equipment.foot.id,
    adventurer?.equipment.foot.xp,
    adventurer?.equipment.neck.id,
    adventurer?.equipment.neck.xp,
    adventurer?.equipment.ring.id,
    adventurer?.equipment.ring.xp,
    adventurer?.beast_health,
    beast?.health,
    beast?.level,
    beast?.tier,
    beast?.specialPrefix,
    beast?.specialSuffix,
    beastCombatSummary?.goldReward,
  ]);

  const potionCost = useMemo(() => {
    if (!adventurer) {
      return 0;
    }

    return potionPrice(adventurerLevel, adventurer.stats.charisma ?? 0);
  }, [adventurerLevel, adventurer?.stats.charisma]);

  const potionCoverage = useMemo(() => {
    if (!beastCombatSummary) {
      return { potions: 0, coverage: 0 };
    }

    if (potionCost <= 0) {
      return { potions: Number.POSITIVE_INFINITY, coverage: Number.POSITIVE_INFINITY };
    }

    const potions = Math.floor(beastCombatSummary.goldReward / potionCost);
    return {
      potions,
      coverage: potions * 10,
    };
  }, [beastCombatSummary?.goldReward, potionCost]);

  const potentialHealthChange = useMemo(() => {
    if (!simulationResult.hasOutcome) {
      return 0;
    }

    const damageTaken = Math.max(0, simulationResult.modeDamageTaken);
    if (potionCoverage.coverage === Number.POSITIVE_INFINITY) {
      return Number.POSITIVE_INFINITY;
    }

    return potionCoverage.coverage - damageTaken;
  }, [simulationResult.hasOutcome, simulationResult.modeDamageTaken, potionCoverage.coverage]);

  const isPotentialHealthNegative = simulationResult.hasOutcome
    && Number.isFinite(potentialHealthChange)
    && potentialHealthChange < 0;
  const isPotentialHealthPositive = simulationResult.hasOutcome
    && (potentialHealthChange === Number.POSITIVE_INFINITY || potentialHealthChange > 0);
  const shouldForceGamble = simulationResult.hasOutcome
    && simulationResult.winRate > 50
    && isPotentialHealthNegative;

  const { tipLabel, tipStyles, tipReason } = useMemo(() => {
    if (!simulationResult.hasOutcome) {
      return {
        tipLabel: '—',
        tipStyles: styles.simulationTipNeutral,
        tipReason: 'Idle',
      };
    }

    if (simulationResult.winRate <= 50) {
      return {
        tipLabel: 'FLEE',
        tipStyles: styles.simulationTipFlee,
        tipReason: 'Death risk',
      };
    }

    if (shouldForceGamble) {
      return {
        tipLabel: 'GAMBLE',
        tipStyles: styles.simulationTipGamble,
        tipReason: 'Health loss',
      };
    }

    if (simulationResult.winRate > 75) {
      return {
        tipLabel: 'FIGHT',
        tipStyles: styles.simulationTipFight,
        tipReason: 'Easy win',
      };
    }

    return {
      tipLabel: 'GAMBLE',
      tipStyles: styles.simulationTipGamble,
      tipReason: 'Even odds',
    };
  }, [simulationResult.hasOutcome, simulationResult.winRate, shouldForceGamble]);

  const potentialHealthChangeText = (() => {
    if (!simulationResult.hasOutcome) {
      return '-';
    }

    if (!Number.isFinite(potentialHealthChange)) {
      return '∞';
    }

    const rounded = Math.round(potentialHealthChange);
    if (rounded === 0) {
      return '0';
    }

    const formatted = formatNumber(Math.abs(rounded));
    return `${rounded > 0 ? '+' : '-'}${formatted}`;
  })();

  return (
    <Box sx={[styles.container, spectating && styles.spectating]}>
      <Box sx={[styles.imageContainer, { backgroundImage: `url('/images/battle_scenes/${isJackpot ? `jackpot_${beast!.baseName.toLowerCase()}` : beast!.baseName.toLowerCase()}.png')` }]} />

      {/* Adventurer */}
      <Adventurer combatStats={combatStats} />

      {/* Beast */}
      <Beast />

      {beast && beastCombatSummary && (
        <Box sx={styles.beastStatsPanel}>
          <Typography sx={styles.beastStatsTitle}>Beast Insights</Typography>
          <Box sx={styles.beastStatsList}>
            <Box sx={styles.beastStatRow}>
              <Typography sx={styles.beastStatLabel}>Crit Chance</Typography>
              <Typography sx={styles.beastStatValue}>{formatNumber(beastCombatSummary.critChance)}%</Typography>
            </Box>
          </Box>

          {simulationResult.hasOutcome && (
            <>
              <Box sx={styles.simulationSection}>
                <Typography sx={styles.simulationTitle}>Simulated Outcomes</Typography>

                <Box sx={styles.simulationSummaryRow}>
                  <Box sx={[styles.simulationTipChip, tipStyles]}>
                    <Typography sx={styles.simulationChipLabel}>Tip</Typography>
                    <Typography sx={[styles.simulationChipValue, styles.simulationTipValue]}>{tipLabel}</Typography>
                    <Typography sx={styles.simulationTipReason}>{tipReason}</Typography>
                  </Box>
                  <Box sx={[styles.simulationChip, styles.simulationChipWin]}>
                    <Typography sx={styles.simulationChipLabel}>Win</Typography>
                    <Typography sx={styles.simulationChipValue}>{simulationResult.winRate}%</Typography>
                    <Typography sx={styles.simulationChipSubValue}>chance</Typography>
                  </Box>
                  <Box sx={[styles.simulationChip, styles.simulationChipLoss]}>
                    <Typography sx={styles.simulationChipLabel}>Lethal</Typography>
                    <Typography sx={styles.simulationChipValue}>{simulationResult.lethalRate}%</Typography>
                    <Typography sx={styles.simulationChipSubValue}>chance</Typography>
                  </Box>
                </Box>

                <Box sx={styles.simulationStatsGrid}>
                  <Box sx={[styles.simulationStatCard, styles.simulationStatCardPositive]}>
                    <Typography sx={styles.simulationStatLabel}>Dmg Dealt</Typography>
                    <Typography sx={styles.simulationStatValue}>{formatNumber(simulationResult.modeDamageDealt)}</Typography>
                    <Typography sx={styles.simulationStatSubValue}>
                      {formatRange(simulationResult.minDamageDealt, simulationResult.maxDamageDealt)}
                    </Typography>
                  </Box>
                  <Box sx={[styles.simulationStatCard, styles.simulationStatCardNegative]}>
                    <Typography sx={styles.simulationStatLabel}>Dmg Taken</Typography>
                    <Typography sx={styles.simulationStatValue}>{formatNumber(Math.round(simulationResult.modeDamageTaken))}</Typography>
                    <Typography sx={styles.simulationStatSubValue}>
                      {formatRange(simulationResult.minDamageTaken, simulationResult.maxDamageTaken)}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </>
          )}

          <Box sx={styles.beastStatsSeparator} />

          <Box sx={styles.beastStatsList}>
            {simulationResult.hasOutcome && (
              <Box sx={styles.beastStatRow}>
                <Typography sx={styles.beastStatLabel}>Potential Health Change</Typography>
                <Typography sx={[
                  styles.beastStatValue,
                  isPotentialHealthPositive && styles.beastStatPositiveValue,
                  isPotentialHealthNegative && styles.beastStatWarningValue,
                ]}>{potentialHealthChangeText}</Typography>
              </Box>
            )}
            <Box sx={styles.beastStatRow}>
              <Typography sx={styles.beastStatLabel}>Gold Reward</Typography>
              <Typography sx={styles.beastStatValue}>+{formatNumber(beastCombatSummary.goldReward)}</Typography>
            </Box>
            <Box sx={styles.beastStatRow}>
              <Typography sx={styles.beastStatLabel}>XP Reward</Typography>
              <Typography sx={styles.beastStatValue}>+{formatNumber(beastCombatSummary.xpReward)}</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Combat Log */}
      <Box sx={styles.middleSection}>
        <Box sx={styles.combatLogContainer}>
          <AnimatedText text={combatLog} />
          {(combatLog === fleeMessage || combatLog === attackMessage || combatLog === equipMessage)
            && <div className='dotLoader yellow' style={{ marginTop: '6px' }} />}
        </Box>
      </Box>

      {/* Skip Animations Toggle */}
      {showSkipCombat && untilDeath && <Box sx={styles.skipContainer}>
        <Button
          variant="outlined"
          onClick={handleSkipCombat}
          sx={[
            styles.skipButton,
          ]}
          disabled={skipCombat}
        >
          <Typography fontWeight={600}>
            Skip
          </Typography>
          <Box sx={{ fontSize: '0.6rem' }}>
            ▶▶
          </Box>
        </Button>
      </Box>}

      <InventoryOverlay disabledEquip={attackInProgress || fleeInProgress || equipInProgress} />
      <SettingsOverlay />

      {/* Combat Buttons */}
      {!spectating && <Box sx={styles.buttonContainer}>
        {hasNewItemsEquipped ? (
          <>
            <Box sx={styles.actionButtonContainer}>
              <Button
                variant="contained"
                onClick={handleEquipItems}
                sx={styles.attackButton}
                disabled={equipInProgress}
              >
                <Box sx={{ opacity: equipInProgress ? 0.5 : 1 }}>
                  <Typography sx={styles.buttonText}>
                    EQUIP
                  </Typography>
                </Box>
              </Button>
            </Box>

            <Box sx={styles.actionButtonContainer}>
              <Button
                variant="contained"
                onClick={undoEquipment}
                sx={styles.fleeButton}
                disabled={equipInProgress}
              >
                <Box sx={{ opacity: equipInProgress ? 0.5 : 1 }}>
                  <Typography sx={styles.buttonText}>
                    UNDO
                  </Typography>
                </Box>
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Box sx={styles.actionButtonContainer}>
              <Button
                variant="contained"
                onClick={handleAttack}
                sx={styles.attackButton}
                disabled={!adventurer || !beast || attackInProgress || fleeInProgress || equipInProgress}
              >
                <Box sx={{ opacity: !adventurer || !beast || attackInProgress || fleeInProgress || equipInProgress ? 0.5 : 1 }}>
                  <Typography sx={styles.buttonText}>
                    ATTACK
                  </Typography>

                  <Typography sx={styles.buttonHelperText}>
                    {`${calculateAttackDamage(adventurer!.equipment.weapon!, adventurer!, beast!).baseDamage} damage`}
                  </Typography>
                </Box>
              </Button>
            </Box>

            <Box sx={styles.actionButtonContainer}>
              <Button
                variant="contained"
                onClick={handleFlee}
                sx={styles.fleeButton}
                disabled={adventurer!.stats.dexterity === 0 || fleeInProgress || attackInProgress}
              >
                <Box sx={{ opacity: adventurer!.stats.dexterity === 0 || fleeInProgress || attackInProgress ? 0.5 : 1 }}>
                  <Typography sx={styles.buttonText}>
                    FLEE
                  </Typography>
                  <Typography sx={styles.buttonHelperText}>
                    {adventurer!.stats.dexterity === 0 ? 'No Dexterity' : `${fleePercentage}% chance`}
                  </Typography>
                </Box>
              </Button>
            </Box>

            <Box sx={styles.deathCheckboxContainer} onClick={() => {
              if (!attackInProgress && !fleeInProgress && !equipInProgress) {
                setUntilDeath(!untilDeath);
              }
            }}>
              <Typography sx={styles.deathCheckboxLabel}>
                until<br />death
              </Typography>
              <Checkbox
                checked={untilDeath}
                disabled={attackInProgress || fleeInProgress || equipInProgress}
                onChange={(e) => setUntilDeath(e.target.checked)}
                size="medium"
                sx={styles.deathCheckbox}
              />
            </Box>
          </>
        )}
      </Box>}
    </Box>
  );
}

const styles = {
  container: {
    width: '100%',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  spectating: {
    border: '1px solid rgba(128, 255, 0, 0.6)',
    boxSizing: 'border-box',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#000',
  },
  middleSection: {
    position: 'absolute',
    top: 30,
    left: '50%',
    width: '340px',
    padding: '4px 8px',
    border: '2px solid #083e22',
    borderRadius: '12px',
    background: 'rgba(24, 40, 24, 0.55)',
    backdropFilter: 'blur(8px)',
    transform: 'translateX(-50%)',
  },
  combatLogContainer: {
    width: '100%',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 32,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-end',
  },
  actionButtonContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  attackButton: {
    border: '3px solid rgb(8, 62, 34)',
    background: 'rgba(24, 40, 24, 1)',
    width: '190px',
    height: '48px',
    justifyContent: 'center',
    borderRadius: '8px',
    '&:hover': {
      background: 'rgba(34, 60, 34, 1)',
    },
    '&:disabled': {
      background: 'rgba(24, 40, 24, 1)',
      borderColor: 'rgba(8, 62, 34, 0.5)',
    },
  },
  fleeButton: {
    width: '190px',
    height: '48px',
    justifyContent: 'center',
    background: 'rgba(60, 16, 16, 1)',
    borderRadius: '8px',
    border: '3px solid #6a1b1b',
    '&:hover': {
      background: 'rgba(90, 24, 24, 1)',
    },
    '&:disabled': {
      background: 'rgba(60, 16, 16, 1)',
      borderColor: 'rgba(106, 27, 27, 0.5)',
    },
  },
  buttonIcon: {
    fontSize: '2.2rem',
    color: '#FFD700',
    filter: 'drop-shadow(0 0 6px #FFD70088)',
    marginRight: '8px',
  },
  buttonText: {
    fontFamily: 'Cinzel, Georgia, serif',
    fontWeight: 600,
    fontSize: '1rem',
    color: '#d0c98d',
    letterSpacing: '1px',
    lineHeight: 1.1,
  },
  buttonHelperText: {
    color: '#d0c98d',
    fontSize: '12px',
    opacity: 0.8,
    lineHeight: '12px',
    textTransform: 'none',
  },
  deathCheckboxContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: '32px',
    cursor: 'pointer',
  },
  deathCheckboxLabel: {
    color: 'rgba(208, 201, 141, 0.7)',
    fontSize: '0.75rem',
    fontFamily: 'Cinzel, Georgia, serif',
    lineHeight: '0.9',
    textAlign: 'center',
  },
  deathCheckbox: {
    color: 'rgba(208, 201, 141, 0.7)',
    padding: '0',
    '&.Mui-checked': {
      color: '#d0c98d',
    },
  },
  beastStatsPanel: {
    position: 'absolute',
    top: 150,
    right: 40,
    width: 300,
    padding: '10px 12px',
    border: '2px solid #083e22',
    borderRadius: '12px',
    background: 'rgba(24, 40, 24, 0.6)',
    boxShadow: '0 0 10px rgba(0, 0, 0, 0.45)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 0.75,
    zIndex: 80,
  },
  beastStatsTitle: {
    color: '#d0c98d',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.9rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    textAlign: 'center',
  },
  beastStatsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.5,
  },
  beastStatRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  beastStatLabel: {
    color: 'rgba(208, 201, 141, 0.85)',
    fontSize: '0.82rem',
  },
  beastStatValue: {
    color: '#ffffff',
    fontSize: '0.8rem',
    fontFamily: 'Cinzel, Georgia, serif',
    fontWeight: 500,
  },
  beastStatPositiveValue: {
    color: '#6edd84',
    fontWeight: 600,
  },
  beastStatWarningValue: {
    color: '#f28d85',
    fontWeight: 600,
  },
  simulationSection: {
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  simulationTitle: {
    color: '#d0c98d',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.35px',
  },
  simulationSummaryRow: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'space-between',
  },
  simulationChip: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    border: '1px solid rgba(208, 201, 141, 0.2)',
    background: 'rgba(24, 40, 24, 0.55)',
  },
  simulationChipWin: {
    background: 'linear-gradient(135deg, rgba(44, 96, 52, 0.7), rgba(18, 54, 30, 0.85))',
    borderColor: 'rgba(94, 176, 116, 0.6)',
  },
  simulationChipLoss: {
    background: 'linear-gradient(135deg, rgba(126, 44, 42, 0.7), rgba(70, 22, 20, 0.85))',
    borderColor: 'rgba(194, 96, 90, 0.6)',
  },
  simulationChipLabel: {
    color: 'rgba(208, 201, 141, 0.85)',
    fontSize: '0.62rem',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  simulationChipValue: {
    color: '#ffffff',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    lineHeight: 1.1,
  },
  simulationTipValue: {
    textTransform: 'uppercase',
  },
  simulationTipReason: {
    color: 'rgba(208, 201, 141, 0.75)',
    fontSize: '0.6rem',
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
  },
  simulationChipSubValue: {
    color: 'rgba(208, 201, 141, 0.75)',
    fontSize: '0.62rem',
  },
  simulationTipChip: {
    flex: 1,
    padding: '6px 8px',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    border: '1px solid rgba(208, 201, 141, 0.25)',
    background: 'rgba(24, 40, 24, 0.55)',
  },
  simulationTipNeutral: {
    border: '1px solid rgba(208, 201, 141, 0.25)',
    background: 'rgba(24, 40, 24, 0.55)',
  },
  simulationTipFight: {
    background: 'linear-gradient(135deg, rgba(44, 96, 52, 0.7), rgba(18, 54, 30, 0.85))',
    border: '1px solid rgba(94, 176, 116, 0.6)',
  },
  simulationTipFlee: {
    background: 'linear-gradient(135deg, rgba(126, 44, 42, 0.7), rgba(70, 22, 20, 0.85))',
    border: '1px solid rgba(194, 96, 90, 0.6)',
  },
  simulationTipGamble: {
    background: 'linear-gradient(135deg, rgba(156, 118, 36, 0.65), rgba(86, 52, 12, 0.75))',
    border: '1px solid rgba(208, 172, 64, 0.6)',
  },
  simulationStatsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
  },
  simulationStatCard: {
    borderRadius: '10px',
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  simulationStatCardNeutral: {
    background: 'rgba(24, 40, 24, 0.5)',
    border: '1px solid rgba(208, 201, 141, 0.25)',
  },
  simulationStatCardPositive: {
    background: 'linear-gradient(135deg, rgba(38, 92, 48, 0.65), rgba(18, 54, 30, 0.75))',
    border: '1px solid rgba(90, 176, 112, 0.6)',
  },
  simulationStatCardNegative: {
    background: 'linear-gradient(135deg, rgba(118, 38, 32, 0.6), rgba(68, 20, 18, 0.7))',
    border: '1px solid rgba(176, 74, 68, 0.6)',
  },
  simulationStatLabel: {
    color: 'rgba(208, 201, 141, 0.75)',
    fontSize: '0.64rem',
  },
  simulationStatValue: {
    color: '#ffffff',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.95rem',
    fontWeight: 600,
    lineHeight: 1.1,
  },
  simulationStatSubValue: {
    color: 'rgba(208, 201, 141, 0.7)',
    fontSize: '0.7rem',
    fontWeight: 500,
  },
  beastStatsSeparator: {
    marginTop: '10px',
    marginBottom: '8px',
    borderTop: '1px solid rgba(208, 201, 141, 0.2)',
  },
  skipContainer: {
    display: 'flex',
    alignItems: 'center',
    position: 'absolute',
    top: 90,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  },
  skipButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '90px',
    height: '32px',
  },
};
