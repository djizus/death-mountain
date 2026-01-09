import { MAX_BAG_SIZE, STARTING_HEALTH } from '@/constants/game';
import { useGameDirector } from '@/desktop/contexts/GameDirector';
import { useSound } from '@/desktop/contexts/Sound';
import { useResponsiveScale } from '@/desktop/hooks/useResponsiveScale';
import { useDungeon } from '@/dojo/useDungeon';
import { useGameStore } from '@/stores/gameStore';
import { useMarketStore } from '@/stores/marketStore';
import { useUIStore } from '@/stores/uiStore';
import { calculateLevel } from '@/utils/game';
import { ItemUtils, ItemType, slotIcons, typeIcons, Tier } from '@/utils/loot';
import { MarketItem, generateMarketItems, getTierOneArmorSetStats, potionPrice, STAT_FILTER_OPTIONS, type ArmorSetStatSummary, type StatDisplayName } from '@/utils/market';
import { getEventIcon, getEventTitle } from '@/utils/events';
import { getExplorationInsights, type DamageBucket, type SlotDamageSummary } from '@/utils/exploration';
import FilterListAltIcon from '@mui/icons-material/FilterListAlt';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import XIcon from '@mui/icons-material/X';
import { Box, Button, Checkbox, Divider, FormControlLabel, IconButton, Modal, Slider, Tab, Tabs, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';
import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import JewelryTooltip from '@/components/JewelryTooltip';
import discordIcon from '@/desktop/assets/images/discord.png';
import WalletConnect from '@/desktop/components/WalletConnect';

const renderSlotToggleButton = (slot: keyof typeof slotIcons) => (
  <ToggleButton key={slot} value={slot} aria-label={slot}>
    <Box
      component="img"
      src={slotIcons[slot]}
      alt={slot}
      sx={{
        width: 24,
        height: 24,
        filter: 'invert(0.85) sepia(0.3) saturate(1.5) hue-rotate(5deg) brightness(0.8)',
        opacity: 0.9,
      }}
    />
  </ToggleButton>
);

const renderTypeToggleButton = (type: keyof typeof typeIcons) => (
  <ToggleButton key={type} value={type} aria-label={type}>
    <Box
      component="img"
      src={typeIcons[type]}
      alt={type}
      sx={{
        width: 24,
        height: 24,
        filter: 'invert(0.85) sepia(0.3) saturate(1.5) hue-rotate(5deg) brightness(0.8)',
        opacity: 0.9,
      }}
    />
  </ToggleButton>
);

const renderTierToggleButton = (tier: Tier) => (
  <ToggleButton key={tier} value={tier} aria-label={`Tier ${tier}`}>
    <Box
      sx={{
        color: ItemUtils.getTierColor(tier),
        fontWeight: 'bold',
        fontSize: '1rem',
        lineHeight: '1.5rem',
        width: '24px',
        height: '24px',
      }}>
      T{tier}
    </Box>
  </ToggleButton>
);

const STAT_ABBREVIATIONS: Record<StatDisplayName, string> = {
  Strength: 'STR',
  Vitality: 'VIT',
  Dexterity: 'DEX',
  Intelligence: 'INT',
  Wisdom: 'WIS',
  Charisma: 'CHA',
};

const highlightPulse = keyframes`
  0% {
    border-color: rgba(215, 198, 41, 0.4);
    box-shadow: 0 0 0 rgba(215, 198, 41, 0.25);
  }
  50% {
    border-color: rgba(215, 198, 41, 0.85);
    box-shadow: 0 0 14px rgba(215, 198, 41, 0.45);
  }
  100% {
    border-color: rgba(215, 198, 41, 0.4);
    box-shadow: 0 0 0 rgba(215, 198, 41, 0.25);
  }
`;

const redPulse = keyframes`
  0% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.7;
  }
`;

interface MarketOverlayProps {
  disabledPurchase?: boolean;
  disabledReason?: 'exploring' | 'stats';
}

export default function MarketOverlay({ disabledPurchase = false, disabledReason }: MarketOverlayProps) {
  console.log('[MarketOverlay] rendered', { disabledPurchase, disabledReason });
  const { scalePx, contentOffset } = useResponsiveScale();
  const dungeon = useDungeon();
  const navigate = useNavigate();
  const {
    adventurer,
    bag,
    marketItemIds,
    setShowInventory,
    setNewInventoryItems,
    newMarket,
    setNewMarket,
    exploreLog,
    gameSettings,
    spectating,
  } = useGameStore();
  const { executeGameAction, actionFailed } = useGameDirector();
  const { volume, setVolume, muted, setMuted, musicVolume, setMusicVolume, musicMuted, setMusicMuted } = useSound();
  const {
    setUseMobileClient,
    skipAllAnimations,
    setSkipAllAnimations,
    skipCombatDelays,
    setSkipCombatDelays,
    showUntilBeastToggle,
    setShowUntilBeastToggle,
  } = useUIStore();
  const {
    isOpen,
    cart,
    slotFilter,
    typeFilter,
    tierFilter,
    statFilter,
    setSlotFilter,
    setTypeFilter,
    setTierFilter,
    setStatFilter,
    addToCart,
    removeFromCart,
    setPotions,
    inProgress,
    setInProgress,
    showFilters,
    setShowFilters,
    clearCart,
  } = useMarketStore();


  const [showCart, setShowCart] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'exploring' | 'events' | 'settings'>('market');
  const [explorationTab, setExplorationTab] = useState<'overall' | 'slot' | 'discovery'>('overall');
  const [ambushSlot, setAmbushSlot] = useState<SlotDamageSummary['slot']>('hand');
  const [trapSlot, setTrapSlot] = useState<SlotDamageSummary['slot']>('hand');
  const [showSetStats, setShowSetStats] = useState(false);

  const specialsUnlocked = Boolean(adventurer?.item_specials_seed);

  const handleTabChange = (_: SyntheticEvent, newValue: 'market' | 'exploring' | 'events' | 'settings') => {
    setActiveTab(newValue);
  };

  const handleVolumeChange = (_: Event, newValue: number | number[]) => {
    setVolume((newValue as number) / 100);
  };

  const handleMusicVolumeChange = (_: Event, newValue: number | number[]) => {
    setMusicVolume((newValue as number) / 100);
  };

  const handleSwitchToMobile = () => {
    setUseMobileClient(true);
  };

  const handleExitGame = () => {
    navigate('/');
  };

  const handleExplorationTabChange = useCallback((_: SyntheticEvent, newValue: 'overall' | 'slot' | 'discovery') => {
    if (newValue) {
      setExplorationTab(newValue);
    }
  }, [setExplorationTab]);

  const handleAmbushSlotChange = useCallback((_: SyntheticEvent, newValue: SlotDamageSummary['slot'] | null) => {
    if (newValue) {
      setAmbushSlot(newValue);
    }
  }, [setAmbushSlot]);

  const handleTrapSlotChange = useCallback((_: SyntheticEvent, newValue: SlotDamageSummary['slot'] | null) => {
    if (newValue) {
      setTrapSlot(newValue);
    }
  }, [setTrapSlot]);

  useEffect(() => {
    if (activeTab !== 'market') {
      setShowCart(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!specialsUnlocked && statFilter) {
      setStatFilter(null);
    }
  }, [specialsUnlocked, statFilter, setStatFilter]);

  useEffect(() => {
    if (!specialsUnlocked && showSetStats) {
      setShowSetStats(false);
    }
  }, [specialsUnlocked, showSetStats]);

  useEffect(() => {
    console.log('[Market] cart effect triggered', { inProgress, cartItems: cart.items.length, cartPotions: cart.potions, marketItemIds: marketItemIds?.length, gold: adventurer?.gold, charisma: adventurer?.stats?.charisma });
    if (inProgress) {
      if (cart.items.length > 0) {
        setNewInventoryItems(cart.items.map(item => item.id));
        setShowInventory(true);
      }


      setShowCart(false);
      setInProgress(false);
    }

    console.log('[Market] clearing cart');
    clearCart();
  }, [marketItemIds, adventurer?.gold, adventurer?.stats?.charisma]);

  useEffect(() => {
    setInProgress(false);
  }, [actionFailed]);

  useEffect(() => {
    if (isOpen && newMarket) {
      setNewMarket(false);
    }
  }, [isOpen, newMarket, setNewMarket]);

  // Function to check if an item is already owned (in equipment or bag)
  const isItemOwned = useCallback((itemId: number) => {
    if (!adventurer) return false;

    // Check equipment
    const equipmentItems = Object.values(adventurer.equipment);
    const equipped = equipmentItems.find(item => item.id === itemId);

    // Check bag
    const inBag = bag.find(item => item.id === itemId);

    return Boolean(inBag || equipped);
  }, [adventurer?.equipment, bag]);

  // Memoize market items to prevent unnecessary recalculations
  const marketItems = useMemo(() => {
    if (!marketItemIds) return [];

    const items = generateMarketItems(
      marketItemIds,
      adventurer?.stats?.charisma || 0,
      adventurer?.item_specials_seed || 0
    );

    // Sort items by price and ownership status
    return items.sort((a, b) => {
      const isOwnedA = isItemOwned(a.id);
      const isOwnedB = isItemOwned(b.id);
      const canAffordA = (adventurer?.gold || 0) >= a.price;
      const canAffordB = (adventurer?.gold || 0) >= b.price;

      // First sort by ownership (owned items go to the end)
      if (isOwnedA && !isOwnedB) return 1;
      if (!isOwnedA && isOwnedB) return -1;

      // Then sort by affordability
      if (canAffordA && canAffordB) {
        if (a.price === b.price) {
          return a.tier - b.tier; // Both same price, sort by tier
        }
        return b.price - a.price;
      } else if (canAffordA) {
        return -1; // A is affordable, B is not, A comes first
      } else if (canAffordB) {
        return 1; // B is affordable, A is not, B comes first
      } else {
        return b.price - a.price; // Both unaffordable, sort by price
      }
    });

  }, [marketItemIds, adventurer?.gold, adventurer?.stats?.charisma, adventurer?.item_specials_seed, isItemOwned]);

  const handleBuyItem = (item: MarketItem) => {
    console.log('[Market] handleBuyItem called', { item, disabledPurchase, cart });
    addToCart(item);
  };

  const handleBuyPotion = (value: number) => {
    setPotions(value);
  };

  const handleCheckout = () => {
    console.log('[Market] handleCheckout called', { disabledPurchase, disabledReason, cart, inProgress });
    if (disabledPurchase) {
      console.log('[Market] handleCheckout early return due to disabledPurchase');
      return;
    }

    setInProgress(true);

    const slotsToEquip = new Set<string>();
    let itemPurchases = cart.items.map(item => {
      const slot = ItemUtils.getItemSlot(item.id).toLowerCase();
      const slotEmpty = adventurer?.equipment[slot as keyof typeof adventurer.equipment]?.id === 0;
      const shouldEquip = slotEmpty && !slotsToEquip.has(slot);
      if (shouldEquip) {
        slotsToEquip.add(slot);
      }
      return {
        item_id: item.id,
        equip: shouldEquip,
      };
    });

    console.log('[Market] executeGameAction buy_items', { potions: cart.potions, itemPurchases, remainingGold });
    executeGameAction({
      type: 'buy_items',
      potions: cart.potions,
      itemPurchases,
      remainingGold,
    });
  };

  const handleRemoveItem = (itemToRemove: MarketItem) => {
    removeFromCart(itemToRemove);
  };

  const handleRemovePotion = () => {
    setPotions(0);
  };

  const handleSlotFilter = (_: React.MouseEvent<HTMLElement>, newSlot: string | null) => {
    setSlotFilter(newSlot);
  };

  const handleTypeFilter = (_: React.MouseEvent<HTMLElement>, newType: string | null) => {
    setTypeFilter(newType);
  };

  const handleTierFilter = (_: React.MouseEvent<HTMLElement>, newTier: Tier | null) => {
    setTierFilter(newTier);
  };

  const handleStatFilter = (_: React.MouseEvent<HTMLElement>, newStat: string | null) => {
    setStatFilter(newStat);
  };

  const potionCost = potionPrice(calculateLevel(adventurer?.xp || 0), adventurer?.stats?.charisma || 0);
  const totalCost = cart.items.reduce((sum, item) => sum + item.price, 0) + (cart.potions * potionCost);
  const remainingGold = (adventurer?.gold || 0) - totalCost;
  const maxHealth = STARTING_HEALTH + (adventurer?.stats?.vitality || 0) * 15;
  const maxPotionsByHealth = Math.ceil((maxHealth - (adventurer?.health || 0)) / 10);
  const maxPotionsByGold = Math.floor((adventurer!.gold - cart.items.reduce((sum, item) => sum + item.price, 0)) / potionCost);
  const maxPotions = Math.min(maxPotionsByHealth, maxPotionsByGold);
  const inventoryFull = bag.length + cart.items.length === MAX_BAG_SIZE;
  const marketAvailable = adventurer?.stat_upgrades_available! === 0;

  const filteredItems = marketItems.filter(item => {
    if (slotFilter && item.slot !== slotFilter) return false;
    if (typeFilter && item.type !== typeFilter) return false;
    if (tierFilter && item.tier !== tierFilter) return false;
    if (statFilter && (!item.futureStatTags.length || !item.futureStatTags.includes(statFilter))) return false;
    return true;
  });


  const setStatsSummaries = useMemo<ArmorSetStatSummary[]>(() => {
    if (!specialsUnlocked) {
      return [];
    }

    return getTierOneArmorSetStats(adventurer?.item_specials_seed || 0);
  }, [specialsUnlocked, adventurer?.item_specials_seed]);

  const ringsSummary = useMemo(() => setStatsSummaries.find((summary) => summary.type === 'Rings'), [setStatsSummaries]);

  const renderSetStatsItem = (item: ArmorSetStatSummary['items'][number]) => {
    const hasItem = item.id > 0;
    const imageUrl = hasItem ? ItemUtils.getItemImage(item.id) : null;
    const tierColor = hasItem ? ItemUtils.getTierColor(ItemUtils.getItemTier(item.id)) : undefined;

    return (
      <Box key={`${item.slot}-${item.id}`} sx={styles.setStatsItemRow}>
        {hasItem && imageUrl ? (
          <Box sx={[styles.itemImageContainer, styles.setStatsItemImageContainer]}>
            <Box
              sx={[styles.itemGlow, styles.setStatsItemGlow, tierColor ? { backgroundColor: tierColor } : {}]}
            />
            <Box
              component="img"
              src={imageUrl}
              alt={item.slot}
              sx={[styles.itemImage, styles.setStatsItemImage]}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </Box>
        ) : (
          <Typography sx={styles.setStatsItemSlot}>{item.slot}</Typography>
        )}
        <Typography sx={styles.setStatsItemBonus}>{item.statBonus ?? '—'}</Typography>
      </Box>
    );
  };

  const explorationInsights = useMemo(() => getExplorationInsights(adventurer ?? null, gameSettings ?? null), [adventurer, gameSettings]);

  useEffect(() => {
    if (!explorationInsights.ready) return;
    if (!explorationInsights.beasts.slotDamages.some(slot => slot.slot === ambushSlot)) {
      const fallback = explorationInsights.beasts.slotDamages[0]?.slot;
      if (fallback) {
        setAmbushSlot(fallback);
      }
    }
  }, [ambushSlot, explorationInsights, setAmbushSlot]);

  useEffect(() => {
    if (!explorationInsights.ready) return;
    if (!explorationInsights.obstacles.slotDamages.some(slot => slot.slot === trapSlot)) {
      const fallback = explorationInsights.obstacles.slotDamages[0]?.slot;
      if (fallback) {
        setTrapSlot(fallback);
      }
    }
  }, [explorationInsights, setTrapSlot, trapSlot]);

  const renderDistributionList = useCallback((distribution: DamageBucket[], highlightValue: number | null = null) => {
    if (!distribution.length) {
      return (
        <Typography sx={styles.distributionEmpty}>Not enough data yet.</Typography>
      );
    }

    const maxPercentage = Math.max(...distribution.map(bucket => bucket.percentage), 1);

    return (
      <Box sx={styles.distributionList}>
        {distribution.map(bucket => {
          const isHighlighted = highlightValue !== null
            && highlightValue >= bucket.start
            && highlightValue <= bucket.end;

          return (
            <Box
              key={bucket.label}
              sx={{
                ...styles.distributionItem,
                ...(isHighlighted ? styles.distributionItemHighlighted : {}),
              }}>
              <Typography
                sx={{
                  ...styles.distributionItemLabel,
                  ...(isHighlighted ? styles.distributionItemLabelHighlighted : {}),
                }}>
                {bucket.label}
              </Typography>
              <Box
                sx={{
                  ...styles.distributionBarTrack,
                  ...(isHighlighted ? styles.distributionBarTrackHighlighted : {}),
                }}>
                <Box
                  sx={{
                    ...styles.distributionBarFill,
                    width: `${Math.max((bucket.percentage / maxPercentage) * 100, 4)}%`,
                    ...(isHighlighted ? styles.distributionBarFillHighlighted : {}),
                  }}
                />
              </Box>
              <Typography
                sx={{
                  ...styles.distributionItemValue,
                  ...(isHighlighted ? styles.distributionItemValueHighlighted : {}),
                }}>
                {bucket.percentage.toFixed(1)}%
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  }, []);

  const explorationSection = useMemo(() => {
    if (!explorationInsights.ready) {
      return (
        <Box sx={styles.exploringContent}>
          <Box sx={styles.exploringCard}>
            <Typography sx={styles.sectionTitle}>Exploring Overview</Typography>
            <Typography sx={styles.placeholderMessage}>Encounter data will appear once the game state is loaded.</Typography>
          </Box>
        </Box>
      );
    }

    const { beasts, obstacles, discoveries } = explorationInsights;
    const playerHealth = adventurer?.health ?? null;
    const selectedAmbushSlot = beasts.slotDamages.find(slot => slot.slot === ambushSlot) ?? beasts.slotDamages[0];
    const selectedTrapSlot = obstacles.slotDamages.find(slot => slot.slot === trapSlot) ?? obstacles.slotDamages[0];
    const hasPlayerHealth = playerHealth !== null && playerHealth > 0;
    const ambushOverallLethal = hasPlayerHealth && beasts.damageDistribution.length > 0
      ? beasts.overallLethalChance
      : null;
    const trapOverallLethal = hasPlayerHealth && obstacles.damageDistribution.length > 0
      ? obstacles.overallLethalChance
      : null;


    const overallContent = (
      <>
        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Ambush Damage</Typography>
          <Typography sx={styles.lethalChance}>
            {ambushOverallLethal !== null
              ? `Lethal: ${ambushOverallLethal.toFixed(1)}% chance`
              : 'Lethal: --'}
          </Typography>
          {renderDistributionList(beasts.damageDistribution, playerHealth)}
        </Box>
        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Trap Damage</Typography>
          <Typography sx={styles.lethalChance}>
            {trapOverallLethal !== null
              ? `Lethal: ${trapOverallLethal.toFixed(1)}% chance`
              : 'Lethal: --'}
          </Typography>
          {renderDistributionList(obstacles.damageDistribution, playerHealth)}
        </Box>
      </>
    );

    const slotContent = (
      <>
        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Ambush Damage by Slot</Typography>
          <Box sx={styles.slotSection}>
            <ToggleButtonGroup
              value={selectedAmbushSlot?.slot ?? null}
              exclusive
              onChange={handleAmbushSlotChange}
              sx={styles.slotToggleGroup}>
              {beasts.slotDamages.map(slot => (
                <ToggleButton key={slot.slot} value={slot.slot} sx={styles.slotToggle}>
                  <Typography sx={styles.slotToggleLabel}>{slot.slotLabel}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {selectedAmbushSlot ? renderDistributionList(selectedAmbushSlot.distribution, playerHealth) : (
              <Typography sx={styles.distributionEmpty}>Not enough data yet.</Typography>
            )}
          </Box>
        </Box>
        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Trap Damage by Slot</Typography>
          <Box sx={styles.slotSection}>
            <ToggleButtonGroup
              value={selectedTrapSlot?.slot ?? null}
              exclusive
              onChange={handleTrapSlotChange}
              sx={styles.slotToggleGroup}>
              {obstacles.slotDamages.map(slot => (
                <ToggleButton key={slot.slot} value={slot.slot} sx={styles.slotToggle}>
                  <Typography sx={styles.slotToggleLabel}>{slot.slotLabel}</Typography>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {selectedTrapSlot ? renderDistributionList(selectedTrapSlot.distribution, playerHealth) : (
              <Typography sx={styles.distributionEmpty}>Not enough data yet.</Typography>
            )}
          </Box>
        </Box>
      </>
    );

    const discoveryContent = (
      <Box sx={styles.exploringCard}>
        <Typography sx={styles.sectionTitle}>Discovery Outcomes</Typography>
        <Box sx={styles.discoveryRow}>
          <Box sx={styles.discoveryCard}>
            <Typography sx={styles.discoveryLabel}>Gold ({discoveries.goldChance}%)</Typography>
            <Typography sx={styles.discoveryValue}>+{discoveries.goldRange.min} to +{discoveries.goldRange.max}</Typography>
          </Box>
          <Box sx={styles.discoveryCard}>
            <Typography sx={styles.discoveryLabel}>Health ({discoveries.healthChance}%)</Typography>
            <Typography sx={styles.discoveryValue}>+{discoveries.healthRange.min} to +{discoveries.healthRange.max}</Typography>
          </Box>
          <Box sx={styles.discoveryCard}>
            <Typography sx={styles.discoveryLabel}>Loot ({discoveries.lootChance}%)</Typography>
            <Typography sx={styles.discoveryValue}>Random equipment drop</Typography>
          </Box>
        </Box>
      </Box>
    );

    return (
      <Box sx={styles.exploringContent}>
        <Box sx={styles.explorationTabsContainer}>
          <Tabs
            value={explorationTab}
            onChange={handleExplorationTabChange}
            aria-label="exploration sections"
            sx={styles.explorationTabs}>
            <Tab value="overall" label="Overall Damage" sx={styles.explorationTab} />
            <Tab value="slot" label="Slot Damage" sx={styles.explorationTab} />
            <Tab value="discovery" label="Discovery" sx={styles.explorationTab} />
          </Tabs>
        </Box>
        {explorationTab === 'overall' && overallContent}
        {explorationTab === 'slot' && slotContent}
        {explorationTab === 'discovery' && discoveryContent}
      </Box>
    );
  }, [
    ambushSlot,
    explorationInsights,
    explorationTab,
    handleAmbushSlotChange,
    handleExplorationTabChange,
    handleTrapSlotChange,
    renderDistributionList,
    trapSlot,
  ]);

  const eventLogSection = useMemo(() => (
    <Box sx={styles.eventLogContainer}>
      <Box sx={styles.eventLogHeader}>
        <Typography sx={styles.eventLogTitle}>Explorer Log</Typography>
      </Box>
      <Box sx={styles.eventLogList}>
        {exploreLog.length === 0 ? (
          <Typography sx={styles.eventLogEmpty}>No events recorded yet.</Typography>
        ) : (
          exploreLog.map((event, index) => (
            <Box key={`${exploreLog.length - index}`} sx={styles.eventItem}>
              <Box sx={styles.eventIcon}>
                <Box
                  component="img"
                  src={getEventIcon(event)}
                  alt={'event'}
                  sx={styles.eventIconImage}
                />
              </Box>
              <Box sx={styles.eventDetails}>
                <Typography sx={styles.eventTitle}>{getEventTitle(event)}</Typography>
                <Box sx={styles.eventMeta}>
                  {typeof event.xp_reward === 'number' && event.xp_reward > 0 && (
                    <Typography sx={styles.eventMetaValue}>+{event.xp_reward} XP</Typography>
                  )}

                  {event.type === 'obstacle' && (
                    <Typography sx={event.obstacle?.dodged ? styles.eventMetaValue : styles.eventMetaDamage}>
                      {event.obstacle?.dodged
                        ? `Dodged ${(event.obstacle?.damage ?? 0).toLocaleString()} dmg`
                        : `-${(event.obstacle?.damage ?? 0).toLocaleString()} Health${event.obstacle?.critical_hit ? ' critical hit!' : ''}`}
                    </Typography>
                  )}

                  {typeof event.gold_reward === 'number' && event.gold_reward > 0 && (
                    <Typography sx={styles.eventMetaValue}>+{event.gold_reward} Gold</Typography>
                  )}

                  {event.type === 'discovery' && event.discovery?.type === 'Gold' && (
                    <Typography sx={styles.eventMetaValue}>+{event.discovery.amount} Gold</Typography>
                  )}

                  {event.type === 'discovery' && event.discovery?.type === 'Health' && (
                    <Typography sx={styles.eventMetaHeal}>+{event.discovery.amount} Health</Typography>
                  )}

                  {event.type === 'stat_upgrade' && event.stats && (
                    <Typography sx={styles.eventMetaValue}>
                      {Object.entries(event.stats)
                        .filter(([_, value]) => typeof value === 'number' && value > 0)
                        .map(([stat, value]) => `+${value} ${stat.slice(0, 3).toUpperCase()}`)
                        .join(', ')}
                    </Typography>
                  )}

                  {(['defeated_beast', 'fled_beast'].includes(event.type)) && event.health_loss && event.health_loss > 0 && (
                    <Typography sx={styles.eventMetaDamage}>-{event.health_loss} Health</Typography>
                  )}

                  {event.type === 'level_up' && event.level && (
                    <Typography sx={styles.eventMetaValue}>Reached Level {event.level}</Typography>
                  )}

                  {event.type === 'buy_items' && typeof event.potions === 'number' && event.potions > 0 && (
                    <Typography sx={styles.eventMetaValue}>+{event.potions} Potions</Typography>
                  )}

                  {event.items_purchased && event.items_purchased.length > 0 && (
                    <Typography sx={styles.eventMetaValue}>+{event.items_purchased.length} Items</Typography>
                  )}

                  {event.items && event.items.length > 0 && (
                    <Typography sx={styles.eventMetaValue}>
                      {event.items.length} items
                    </Typography>
                  )}

                  {event.type === 'beast' && (
                    <Typography sx={styles.eventMetaValue}>
                      Level {event.beast?.level} Power {event.beast?.tier! * event.beast?.level!}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  ), [exploreLog]);

  if (!isOpen) {
    return null;
  }

  if (!isOpen) {
    return null;
  }

  return (
    <Box sx={{
      ...styles.popup,
      top: scalePx(30),
      right: scalePx(8),
      width: scalePx(480),
      minHeight: scalePx(600),
    }}>
      <Box sx={styles.tabBar}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="market sections"
          sx={styles.tabs}>
          <Tab value="market" label="Market" sx={styles.tab} />
          <Tab value="exploring" label="Explore" sx={styles.tab} />
          <Tab value="events" label="Events" sx={styles.tab} />
          <Tab value="settings" label="Settings" sx={styles.tab} />
        </Tabs>
      </Box>

      {activeTab === 'market' && (
        <Box sx={styles.marketContent}>
          <Box sx={styles.topBar}>
            {disabledPurchase ? (
              <Typography sx={styles.disabledMarketText}>
                {disabledReason === 'exploring' ? 'Market opens after exploration' : 'Market opens after stat selection'}
              </Typography>
            ) : (
              <>
                <Box sx={styles.goldDisplay}>
                  <Typography sx={styles.goldLabel} variant='h6'>Gold left:</Typography>
                  <Typography sx={styles.goldValue} variant='h6'>{remainingGold}</Typography>
                </Box>
                <Button
                  variant="outlined"
                  onClick={handleCheckout}
                  disabled={spectating || inProgress || cart.potions === 0 && cart.items.length === 0 || remainingGold < 0}
                  sx={{ height: '34px', width: '170px', justifyContent: 'center' }}>
                  {inProgress
                    ? <Box display={'flex'} alignItems={'baseline'}>
                      <Typography>
                        Processing
                      </Typography>
                      <div className='dotLoader yellow' />
                    </Box>
                    : <Typography>
                      Purchase ({cart.potions + cart.items.length})
                    </Typography>
                  }
                </Button>
              </>
            )}
          </Box>

          <Modal
            open={showCart}
            onClose={() => {
              setShowCart(false);
              setInProgress(false);
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Box sx={styles.cartModal}>
              <Button
                onClick={() => {
                  setShowCart(false);
                  setInProgress(false);
                }}
                sx={styles.closeButton}>
                x
              </Button>
              <Typography sx={styles.cartTitle}>Market Cart</Typography>
              <Box sx={styles.cartItems}>
                {cart.potions > 0 && (
                  <Box sx={styles.cartItem}>
                    <Typography sx={styles.cartItemName}>Health Potion x{cart.potions}</Typography>
                    <Typography sx={styles.cartItemPrice}>{potionCost * cart.potions} Gold</Typography>
                    <Button
                      onClick={handleRemovePotion}
                      sx={styles.removeButton}>
                      x
                    </Button>
                  </Box>
                )}
                {cart.items.map((item, index) => (
                  <Box key={index} sx={styles.cartItem}>
                    <Typography sx={styles.cartItemName}>{item.name}</Typography>
                    <Typography sx={styles.cartItemPrice}>{item.price} Gold</Typography>
                    <Button
                      onClick={() => handleRemoveItem(item)}
                      sx={styles.removeButton}>
                      x
                    </Button>
                  </Box>
                ))}
              </Box>

              {(adventurer?.stats?.charisma || 0) > 0 && <Box sx={styles.charismaDiscount}>
                <Typography sx={styles.charismaLabel}>
                  Gold Saved from Charisma
                </Typography>
                <Typography sx={styles.charismaValue}>
                  {Math.round(
                    (potionPrice(calculateLevel(adventurer?.xp || 0), 0) * cart.potions) - (potionCost * cart.potions) +
                    cart.items.reduce((total, item) => {
                      const maxDiscount = (6 - item.tier) * 4;
                      const charismaDiscount = Math.min(adventurer?.stats?.charisma || 0, maxDiscount);
                      return total + charismaDiscount;
                    }, 0)
                  )} Gold
                </Typography>
              </Box>}

              <Box sx={styles.cartTotal}>
                <Typography sx={styles.totalLabel}>Total</Typography>
                <Typography sx={styles.totalValue}>{totalCost} Gold</Typography>
              </Box>

              <Box sx={styles.cartActions}>
                <Button
                  variant="contained"
                  onClick={handleCheckout}
                  disabled={spectating || inProgress || cart.potions === 0 && cart.items.length === 0 || remainingGold < 0}
                  sx={styles.checkoutButton}>
                  {inProgress
                    ? <Box display={'flex'} alignItems={'baseline'}>
                      <Typography variant='h5'>
                        Processing
                      </Typography>
                      <div className='dotLoader yellow' />
                    </Box>
                    : <Typography variant='h5'>
                      Checkout
                    </Typography>
                  }
                </Button>
              </Box>
            </Box>
          </Modal>

          {specialsUnlocked && (
            <Modal
              open={showSetStats}
              onClose={() => setShowSetStats(false)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
          <Box sx={styles.setStatsModal}>
            <Box sx={styles.setStatsHeader}>
              <Typography sx={styles.setStatsTitle}>Level 15+ Bonus Stats</Typography>
                  <Button onClick={() => setShowSetStats(false)} sx={styles.closeButton}>x</Button>
                </Box>
                {setStatsSummaries.length === 0 ? (
                  <Typography sx={styles.setStatsEmpty}>No armor stats available.</Typography>
                ) : (
                  <Box sx={styles.setStatsContent}>
                    {setStatsSummaries.map((summary) => {
                      if (summary.type === 'Rings') {
                        return null;
                      }
                      const columnPlacement = (() => {
                        switch (summary.type) {
                          case 'Weapons':
                            return styles.setStatsColumnWeapons;
                          case ItemType.Cloth:
                            return styles.setStatsColumnCloth;
                          case ItemType.Hide:
                            return styles.setStatsColumnHide;
                          case ItemType.Metal:
                            return styles.setStatsColumnMetal;
                          default:
                            return {};
                        }
                      })();

                      return (
                        <Box
                          key={summary.type}
                          sx={[styles.setStatsColumn, columnPlacement]}
                        >
                          <Typography sx={styles.setStatsColumnTitle}>{summary.type.toUpperCase()}</Typography>
                          <Box sx={styles.setStatsItems}>
                            {summary.items.map(renderSetStatsItem)}
                          </Box>
                          {summary.type === 'Weapons' && ringsSummary && ringsSummary.items.length > 0 && (
                            <>
                              <Box sx={styles.setStatsDivider} />
                              <Typography sx={styles.setStatsColumnTitle}>RINGS</Typography>
                              <Box sx={styles.setStatsItems}>
                                {ringsSummary.items.map(renderSetStatsItem)}
                              </Box>
                            </>
                          )}
                          {summary.category === 'Armor' && (
                            <Box sx={styles.setStatsTotals}>
                              {STAT_FILTER_OPTIONS.map((stat) => (
                                <Typography key={stat} sx={styles.setStatsTotalValue}>
                                  {`+${summary.totals[stat]} ${STAT_ABBREVIATIONS[stat]}`}
                                </Typography>
                              ))}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Modal>
          )}

          <Box sx={styles.mainContent}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'stretch', mb: '6px' }}>
              <Box sx={styles.potionsSection}>
                <Box sx={styles.potionSliderContainer}>
                  <Box sx={styles.potionLeftSection}>
                    <Box component="img" src={'/images/health.png'} alt="Health Icon" sx={styles.potionImage} />
                    <Box sx={styles.potionInfo}>
                      <Typography>Potions</Typography>
                      <Typography sx={styles.potionHelperText}>+10 Health</Typography>
                    </Box>

                  </Box>
                  <Box sx={styles.potionRightSection}>
                    <Box sx={styles.potionControls}>
                      <Typography sx={styles.potionCost}>Cost: {potionCost} Gold</Typography>
                    </Box>
                    {potionCost > 1 && (
                      <Typography sx={styles.potionChaHint}>Increase Charisma</Typography>
                    )}
                    {!disabledPurchase && (
                      <Slider
                        value={cart.potions}
                        onChange={(_, value) => handleBuyPotion(value as number)}
                        min={0}
                        max={maxPotions}
                        disabled={spectating}
                        sx={styles.potionSlider}
                      />
                    )}
                  </Box>
                </Box>
              </Box>

              <IconButton
                onClick={() => setShowFilters(!showFilters)}
                sx={{
                  ...styles.filterToggleButton,
                  ...(showFilters ? styles.filterToggleButtonActive : {}),
                }}>
                <FilterListAltIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>

            {showFilters && (
              <Box sx={styles.filtersContainer}>
                <Box sx={styles.filterGroup}>
                  <ToggleButtonGroup
                    value={slotFilter}
                    exclusive
                    onChange={handleSlotFilter}
                    aria-label="item slot"
                    sx={styles.filterButtons}>
                    {Object.keys(slotIcons).map((slot) => renderSlotToggleButton(slot as keyof typeof slotIcons))}
                  </ToggleButtonGroup>
                </Box>

                <Box sx={styles.filterGroup}>
                  <ToggleButtonGroup
                    value={typeFilter}
                    exclusive
                    onChange={handleTypeFilter}
                    aria-label="item type"
                    sx={styles.filterButtons}>
                    {Object.keys(typeIcons)
                      .filter(type => ['Cloth', 'Hide', 'Metal'].includes(type))
                      .map((type) => renderTypeToggleButton(type as keyof typeof typeIcons))}
                  </ToggleButtonGroup>

                  <ToggleButtonGroup
                    value={tierFilter}
                    exclusive
                    onChange={handleTierFilter}
                    aria-label="item tier"
                    sx={[styles.filterButtons, { fontSize: '1rem' }]}>
                    {Object.values(Tier)
                      .filter(tier => typeof tier === 'number' && tier > 0)
                      .map((tier) => renderTierToggleButton(tier as Tier))}
                  </ToggleButtonGroup>
                </Box>

                {specialsUnlocked && (
                  <Box sx={styles.filterGroup}>
                    <ToggleButtonGroup
                      value={statFilter}
                      exclusive
                      onChange={handleStatFilter}
                      aria-label="item stat"
                      sx={styles.filterButtons}>
                      <ToggleButton
                        value=""
                        onClick={(e) => { e.preventDefault(); setShowSetStats(true); }}
                        aria-label="Show level 15 armor set stats">
                        <KeyboardDoubleArrowUpIcon sx={{ fontSize: 24, color: '#EDCF33' }} />
                      </ToggleButton>
                      {STAT_FILTER_OPTIONS.map((stat) => (
                        <ToggleButton key={stat} value={stat} aria-label={stat}>
                          <Box sx={styles.statFilterLabel}>{STAT_ABBREVIATIONS[stat]}</Box>
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                )}
              </Box>
            )}

            <Box sx={styles.itemsGrid}>
              {filteredItems.map((item) => {
                const canAfford = remainingGold >= item.price;
                const inCart = cart.items.some(cartItem => cartItem.id === item.id);
                const isOwned = isItemOwned(item.id);
                const shouldGrayOut = (!canAfford && !isOwned && !inCart) || isOwned;

                return (
                  <Box
                    key={item.id}
                    sx={[
                      styles.itemCard,
                      shouldGrayOut && styles.itemUnaffordable,
                    ]}>
                    <Box sx={styles.itemImageContainer}>
                      <Box
                        sx={[
                          styles.itemGlow,
                          { backgroundColor: ItemUtils.getTierColor(item.tier) },
                        ]}
                      />
                      <Box
                        component="img"
                        src={item.imageUrl}
                        alt={item.name}
                        sx={styles.itemImage}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <Box sx={styles.itemTierBadge} style={{ backgroundColor: ItemUtils.getTierColor(item.tier) }}>
                        <Typography sx={styles.itemTierText}>T{item.tier}</Typography>
                      </Box>
                    </Box>

                    <Box sx={styles.itemInfo}>
                      <Box sx={styles.itemHeader}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Typography sx={styles.itemName}>{item.name}</Typography>
                          <JewelryTooltip itemId={item.id} />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {item.type in typeIcons && (
                            <Box
                              component="img"
                              src={typeIcons[item.type as keyof typeof typeIcons]}
                              alt={item.type}
                              sx={styles.typeIcon}
                            />
                          )}
                          <Typography sx={styles.itemType}>
                            {item.type}
                          </Typography>

                        </Box>
                      </Box>

                      {item.futureStatBonus && (
                        <Box sx={styles.itemBonusRow}>
                          <Typography sx={styles.itemBonusValue}>
                            {item.futureStatBonus}
                          </Typography>
                        </Box>
                      )}

                      <Box sx={styles.itemFooter}>
                        <Typography sx={styles.itemPrice}>
                          {item.price} Gold
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          {inCart && (
                            <Typography sx={styles.inCartText}>
                              In Cart
                            </Typography>
                          )}
                          <Button
                            variant="outlined"
                            onClick={() => (inCart ? handleRemoveItem(item) : handleBuyItem(item))}
                            disabled={spectating || (!inCart && (disabledPurchase || remainingGold < item.price || isItemOwned(item.id) || inventoryFull))}
                            sx={{
                              height: '32px',
                              ...(inCart && {
                                background: 'rgba(215, 197, 41, 0.2)',
                                color: 'rgba(215, 197, 41, 0.8)',
                              }),
                              ...(!inCart && disabledPurchase && {
                                cursor: 'not-allowed',
                                opacity: 0.5,
                                pointerEvents: 'auto',
                              }),
                            }}
                            size="small">
                            <Typography textTransform={'none'}>
                              {inCart ? 'Undo' : isItemOwned(item.id) ? 'Owned' : inventoryFull ? 'Bag Full' : 'Buy'}
                            </Typography>
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>
      )}

      {activeTab === 'exploring' && explorationSection}

      {activeTab === 'events' && eventLogSection}

      {activeTab === 'settings' && (
        <Box sx={styles.settingsContent}>
          {/* Profile Section */}
          {!dungeon.hideController && (
            <>
              <Box sx={styles.settingsSection}>
                <Typography sx={styles.settingsSectionTitle}>Profile</Typography>
                <WalletConnect />
              </Box>
              <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
            </>
          )}

          {/* Sound Control */}
          <Box sx={styles.settingsSection}>
            <Typography sx={styles.settingsSectionTitle}>Sound</Typography>
            <Box sx={styles.soundControl}>
              <Typography width="45px">Sfx</Typography>
              <IconButton
                size="small"
                onClick={() => setMuted(!muted)}
                sx={{ color: !muted ? '#d0c98d' : '#666', padding: '4px' }}
              >
                {muted ? <VolumeOffIcon sx={{ fontSize: 22 }} /> : <VolumeUpIcon sx={{ fontSize: 22 }} />}
              </IconButton>
              <Slider
                value={Math.round(volume * 100)}
                onChange={handleVolumeChange}
                disabled={muted}
                valueLabelDisplay="auto"
                step={1}
                min={0}
                max={100}
                sx={styles.volumeSlider}
              />
              <Typography sx={{ color: '#d0c98d', fontSize: '12px', minWidth: '35px', textAlign: 'right' }}>
                {Math.round(volume * 100)}%
              </Typography>
            </Box>
            <Box sx={styles.soundControl}>
              <Typography width="45px">Music</Typography>
              <IconButton
                size="small"
                onClick={() => setMusicMuted(!musicMuted)}
                sx={{ color: !musicMuted ? '#d0c98d' : '#666', padding: '4px' }}
              >
                {musicMuted ? <VolumeOffIcon sx={{ fontSize: 22 }} /> : <VolumeUpIcon sx={{ fontSize: 22 }} />}
              </IconButton>
              <Slider
                value={Math.round(musicVolume * 100)}
                onChange={handleMusicVolumeChange}
                disabled={musicMuted}
                valueLabelDisplay="auto"
                step={1}
                min={0}
                max={100}
                sx={styles.volumeSlider}
              />
              <Typography sx={{ color: '#d0c98d', fontSize: '12px', minWidth: '35px', textAlign: 'right' }}>
                {Math.round(musicVolume * 100)}%
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          {/* Animations Section */}
          <Box sx={styles.settingsSection}>
            <Typography sx={styles.settingsSectionTitle}>Animations</Typography>
            <Box sx={styles.animationsControl}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={skipAllAnimations}
                    onChange={(e) => setSkipAllAnimations(e.target.checked)}
                    sx={styles.checkbox}
                  />
                }
                label="Skip all animations"
                sx={styles.checkboxLabel}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={skipCombatDelays}
                    onChange={(e) => setSkipCombatDelays(e.target.checked)}
                    sx={styles.checkbox}
                  />
                }
                label="Skip combat delays"
                sx={styles.checkboxLabel}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          {/* Exploration Section */}
          <Box sx={styles.settingsSection}>
            <Typography sx={styles.settingsSectionTitle}>Exploration</Typography>
            <Box sx={styles.animationsControl}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={showUntilBeastToggle}
                    onChange={(e) => setShowUntilBeastToggle(e.target.checked)}
                    sx={styles.checkbox}
                  />
                }
                label='Show "until beast" toggle'
                sx={styles.checkboxLabel}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />

          {/* Client Section */}
          <Box sx={styles.settingsSection}>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleSwitchToMobile}
              startIcon={<PhoneAndroidIcon sx={{ fontSize: 20 }} />}
              sx={styles.switchClientButton}
            >
              Switch to Mobile
            </Button>
          </Box>

          {/* Game Section */}
          <Box sx={styles.settingsSection}>
            <Button
              variant="contained"
              fullWidth
              onClick={handleExitGame}
              sx={styles.exitGameButton}
            >
              Exit Game
            </Button>
          </Box>

          {/* Social Links */}
          <Box sx={styles.settingsSection}>
            <Box sx={styles.socialButtons}>
              <IconButton
                size="small"
                sx={styles.socialButton}
                onClick={() => window.open('https://docs.provable.games/lootsurvivor', '_blank')}
              >
                <MenuBookIcon sx={{ fontSize: 22, color: '#d0c98d' }} />
              </IconButton>
              <IconButton
                size="small"
                sx={styles.socialButton}
                onClick={() => window.open('https://x.com/LootSurvivor', '_blank')}
              >
                <XIcon sx={{ fontSize: 22 }} />
              </IconButton>
              <IconButton
                size="small"
                sx={styles.socialButton}
                onClick={() => window.open('https://discord.gg/DQa4z9jXnY', '_blank')}
              >
                <img src={discordIcon} alt="Discord" style={{ width: 22, height: 22 }} />
              </IconButton>
              <IconButton
                size="small"
                sx={styles.socialButton}
                onClick={() => window.open('https://github.com/provable-games/death-mountain', '_blank')}
              >
                <GitHubIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

const styles = {
  tabBar: {
    borderBottom: '1px solid rgba(215, 198, 41, 0.2)',
    mb: 1,
  },
  tabs: {
    minHeight: 0,
    '& .MuiTabs-flexContainer': {
      gap: '8px',
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#d7c529',
      height: '2px',
    },
  },
  tab: {
    minHeight: 0,
    minWidth: 0,
    flex: 1,
    color: 'rgba(215, 198, 41, 0.6)',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.78rem',
    letterSpacing: '0.6px',
    padding: '6px 0',
    '&.Mui-selected': {
      color: '#d7c529',
    },
  },
  popup: {
    position: 'absolute',
    // top, right, width set dynamically via useResponsiveScale
    maxHeight: 'calc(100dvh - 100px)',
    maxWidth: '98dvw',
    background: 'rgba(24, 40, 24, 0.75)',
    border: '2px solid #083e22',
    borderRadius: '10px',
    backdropFilter: 'blur(8px)',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 1,
    overflow: 'hidden',
    minHeight: 0,
    boxShadow: '0 0 8px #000a',
  },
  marketContent: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  },
  eventLogContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingTop: '6px',
    minHeight: 0,
    overflow: 'hidden',
  },
  eventLogHeader: {
    padding: '0 4px',
  },
  eventLogTitle: {
    color: '#d0c98d',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: 'Cinzel, Georgia, serif',
  },
  eventLogList: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    overflowY: 'auto',
    paddingRight: '4px',
    minHeight: 0,
    '&::-webkit-scrollbar': {
      width: '6px',
    },
    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(215, 198, 41, 0.3)',
      borderRadius: '3px',
    },
    '&::-webkit-scrollbar-track': {
      background: 'rgba(24, 40, 24, 0.6)',
      borderRadius: '3px',
    },
  },
  exploringContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    paddingTop: '6px',
    minHeight: 0,
    overflowY: 'auto',
  },
  explorationTabsContainer: {
    padding: '0 4px',
  },
  explorationTabs: {
    minHeight: 0,
    '& .MuiTabs-flexContainer': {
      gap: '6px',
    },
    '& .MuiTabs-indicator': {
      backgroundColor: '#d7c529',
      height: '2px',
    },
  },
  explorationTab: {
    minHeight: 0,
    minWidth: 0,
    flex: 1,
    color: 'rgba(215, 198, 41, 0.6)',
    fontFamily: 'Cinzel, Georgia, serif',
    fontSize: '0.74rem',
    letterSpacing: '0.5px',
    padding: '4px 0',
    '&.Mui-selected': {
      color: '#d7c529',
    },
  },
  exploringCard: {
    background: 'rgba(24, 40, 24, 0.85)',
    border: '1px solid rgba(215, 198, 41, 0.25)',
    borderRadius: '10px',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitle: {
    color: '#d0c98d',
    fontSize: '0.84rem',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    fontFamily: 'Cinzel, Georgia, serif',
  },
  placeholderMessage: {
    color: '#7f8572',
    fontSize: '0.8rem',
  },
  subSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  subSectionTitle: {
    color: '#d0c98d',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  distributionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  distributionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  distributionItemLabel: {
    width: '72px',
    color: 'rgba(208, 201, 141, 0.85)',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  distributionItemHighlighted: {
    border: '2px solid rgba(215, 198, 41, 0.45)',
    borderRadius: '7px',
    padding: '2px 10px',
    margin: '0 -10px',
    animation: `${highlightPulse} 2.2s ease-in-out infinite`,
  },
  distributionItemLabelHighlighted: {
    color: '#fff7c2',
  },
  distributionBarTrack: {
    flex: 1,
    height: '8px',
    borderRadius: '4px',
    background: 'rgba(215, 198, 41, 0.12)',
    overflow: 'hidden',
  },
  distributionBarTrackHighlighted: {
    background: 'rgba(215, 198, 41, 0.22)',
  },
  distributionBarFill: {
    height: '100%',
    borderRadius: '4px',
    background: 'linear-gradient(90deg, rgba(215, 197, 41, 0.9), rgba(215, 197, 41, 0.4))',
  },
  distributionBarFillHighlighted: {
    background: 'linear-gradient(90deg, rgba(215, 198, 41, 1), rgba(215, 198, 41, 0.6))',
  },
  distributionItemValue: {
    width: '52px',
    textAlign: 'right',
    color: '#f2edd0',
    fontSize: '0.68rem',
  },
  distributionItemValueHighlighted: {
    color: '#fff7c2',
  },
  distributionEmpty: {
    color: '#7f8572',
    fontSize: '0.72rem',
  },
  sectionNote: {
    color: '#d0c98d',
    fontSize: '0.76rem',
  },
  slotSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  lethalChance: {
    color: '#f2edd0',
    fontSize: '0.7rem',
    letterSpacing: '0.3px',
  },
  slotToggleGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  slotToggle: {
    padding: '4px 8px',
    minWidth: 0,
    borderColor: 'rgba(215, 198, 41, 0.25) !important',
    '&.Mui-selected': {
      backgroundColor: 'rgba(215, 198, 41, 0.18)',
    },
  },
  slotToggleLabel: {
    color: '#d0c98d',
    fontSize: '0.7rem',
    letterSpacing: '0.4px',
  },
  discoveryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  discoveryCard: {
    flex: '1 1 150px',
    background: 'rgba(24, 40, 24, 0.55)',
    border: '1px solid rgba(215, 198, 41, 0.2)',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  discoveryLabel: {
    color: '#d0c98d',
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  discoveryValue: {
    color: '#f2edd0',
    fontSize: '0.86rem',
  },
  eventLogEmpty: {
    color: '#d0c98d',
    fontSize: '0.78rem',
    textAlign: 'center',
    padding: '16px 0',
  },
  eventItem: {
    display: 'flex',
    gap: '12px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid rgba(215, 198, 41, 0.2)',
    background: 'rgba(24, 40, 24, 0.65)',
  },
  eventIcon: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventIconImage: {
    width: '32px',
    height: '32px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.6))',
  },
  eventDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  eventTitle: {
    color: '#d0c98d',
    fontSize: '0.8rem',
    fontWeight: 600,
    letterSpacing: '0.4px',
  },
  eventMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 12px',
  },
  eventMetaValue: {
    color: '#d7c529',
    fontSize: '0.72rem',
  },
  eventMetaDamage: {
    color: '#ff6b6b',
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  eventMetaHeal: {
    color: '#80ff00',
    fontSize: '0.72rem',
    fontWeight: 600,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0 8px 4px',
    boxSizing: 'border-box',
    gap: '8px',
    borderBottom: '1px solid rgba(215, 198, 41, 0.2)',
  },
  goldDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  goldLabel: {
    color: '#d7c529',
  },
  goldValue: {
    color: '#d7c529',
  },
  disabledMarketText: {
    color: '#d7c529',
    fontSize: '0.95rem',
    fontStyle: 'italic',
    textAlign: 'center',
    width: '100%',
    py: 0.5,
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    mt: 1,
    overflowY: 'auto',
  },
  potionsSection: {
    flex: 1,
  },
  potionSliderContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px',
    background: 'rgba(24, 40, 24, 0.95)',
    borderRadius: '4px',
    border: '2px solid #083e22',
  },
  potionLeftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
  potionRightSection: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 1,
    ml: '16px',
  },
  potionImage: {
    width: 36,
    height: 36,
  },
  potionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  potionHelperText: {
    color: '#d0c98d',
    fontSize: '0.8rem',
  },
  potionControls: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    width: '95%',
    ml: 1,
  },
  potionCost: {
    color: '#d7c529',
    fontSize: '0.9rem',
  },
  potionChaHint: {
    color: '#ff6b6b',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    textAlign: 'right',
    animation: `${redPulse} 1.5s ease-in-out infinite`,
  },
  potionSlider: {
    color: '#d7c529',
    width: '95%',
    py: 1,
    ml: 1,
    '& .MuiSlider-thumb': {
      backgroundColor: '#d7c529',
      width: '14px',
      height: '14px',
      '&:hover, &.Mui-focusVisible, &.Mui-active': {
        boxShadow: '0 0 0 4px rgba(215, 197, 41, 0.16)',
      },
    },
    '& .MuiSlider-track': {
      backgroundColor: '#d7c529',
    },
    '& .MuiSlider-rail': {
      backgroundColor: 'rgba(215, 197, 41, 0.2)',
    },
  },
  itemsGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
    alignContent: 'start',
    minHeight: 0,
    overflowY: 'auto',
    boxShadow: '0 0 8px #000a',
    pr: '2px',
  },
  itemCard: {
    position: 'relative',
    background: 'rgba(24, 40, 24, 0.95)',
    borderRadius: '4px',
    border: '2px solid #083e22',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    minWidth: 0,
  },
  itemImageContainer: {
    position: 'relative',
    width: '100%',
    height: '80px',
    background: 'rgba(20, 20, 20, 0.7)',
    borderRadius: '4px',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    position: 'relative',
    zIndex: 2,
  },
  itemGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    filter: 'blur(8px)',
    opacity: 0.4,
    zIndex: 1,
  },
  itemTierBadge: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    padding: '2px 4px 0',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  itemTierText: {
    color: '#111111',
    fontSize: '0.8rem',
    fontWeight: 'bold',
  },
  itemInfo: {
    pt: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  itemHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  itemBonusRow: {
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(215, 197, 41, 0.08)',
    border: '1px solid rgba(215, 197, 41, 0.18)',
    borderRadius: '4px',
    padding: '6px',
    gap: '4px',
  },
  itemBonusValue: {
    color: '#f8eb8f',
    fontWeight: '600',
    fontSize: '0.72rem',
  },
  itemName: {
    color: '#d0c98d',
    fontWeight: '600',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemType: {
    color: '#d0c98d',
    fontSize: '0.8rem',
  },
  typeIcon: {
    width: 16,
    height: 16,
    filter: 'invert(0.85) sepia(0.3) saturate(1.5) hue-rotate(5deg) brightness(0.8)',
  },
  itemFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  itemPrice: {
    color: '#d7c529',
  },
  inCartText: {
    color: 'rgba(255, 165, 0, 0.9)',
    fontSize: '12px',
    mt: '-18px'
  },
  cartModal: {
    background: 'rgba(24, 40, 24, 0.95)',
    borderRadius: '8px',
    padding: '16px',
    width: '100%',
    maxWidth: '400px',
    maxHeight: '80dvh',
    display: 'flex',
    flexDirection: 'column',
    border: '2px solid #083e22',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    minWidth: '32px',
    height: '32px',
    padding: 0,
    fontSize: '24px',
    color: 'rgba(255, 255, 255, 0.9)',
    '&:hover': {
      color: '#d7c529',
    },
  },
  cartTitle: {
    color: '#d0c98d',
    fontSize: '1.2rem',
    marginBottom: '16px',
    textAlign: 'center',
  },
  cartItems: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '16px',
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 2px 8px 8px',
    background: 'rgba(20, 20, 20, 0.7)',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  cartItemName: {
    color: '#ffffff',
    fontSize: '1rem',
    flex: 1,
  },
  cartItemPrice: {
    color: '#d7c529',
    fontWeight: '500',
    minWidth: '80px',
    textAlign: 'right',
  },
  removeButton: {
    padding: 0,
    minWidth: '24px',
    width: '24px',
    height: '24px',
    fontSize: '16px',
    ml: 1,
    color: '#FF4444',
  },
  charismaDiscount: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    pr: '12px',
    background: 'rgba(24, 40, 24, 0.95)',
    borderRadius: '4px',
    border: '2px solid #083e22',
    marginBottom: '4px',
  },
  charismaLabel: {
    color: '#d0c98d',
    fontSize: '0.8rem',
  },
  charismaValue: {
    color: '#d7c529',
    fontSize: '0.8rem',
  },
  cartTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    pr: '12px',
    background: 'rgba(24, 40, 24, 0.95)',
    borderRadius: '4px',
    border: '2px solid #083e22',
    marginBottom: '16px',
  },
  totalLabel: {
    color: '#ffffff',
    fontSize: '1rem',
  },
  totalValue: {
    color: '#d7c529',
    fontSize: '15px',
    fontWeight: '600',
  },
  cartActions: {
    display: 'flex',
    gap: '8px',
  },
  checkoutButton: {
    flex: 1,
    fontSize: '1rem',
    py: '8px',
    fontWeight: 'bold',
    background: 'rgba(215, 197, 41, 0.3)',
    color: '#111111',
    justifyContent: 'center',
    '&:hover': {
      background: 'rgba(215, 197, 41, 0.4)',
    },
    '&:disabled': {
      background: 'rgba(215, 197, 41, 0.2)',
    },
  },
  filtersContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '6px',
    padding: '8px',
    background: 'rgba(24, 40, 24, 0.95)',
    borderRadius: '4px',
    border: '2px solid #083e22',
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'row',
    gap: '4px',
  },
  filterButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    '& .MuiToggleButton-root': {
      color: 'rgba(255, 255, 255, 0.7)',
      borderColor: 'rgba(215, 197, 41, 0.2)',
      padding: '8px',
      minWidth: '32px',
      '&.Mui-selected': {
        color: '#111111',
        backgroundColor: 'rgba(215, 197, 41, 0.3)',
      },
    },
  },
  statFilterRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    width: '100%',
  },
  statFilterButtons: {
    flex: 1,
  },
  statFilterLabel: {
    fontSize: '1rem',
    lineHeight: '1.5rem',
    color: '#EDCF33',
  },
  setStatsButton: {
    minWidth: '40px',
    height: '40px',
    borderColor: 'rgba(215, 197, 41, 0.4)',
    color: '#d7c529',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    '&:hover': {
      borderColor: 'rgba(215, 197, 41, 0.6)',
      background: 'rgba(215, 197, 41, 0.12)',
    },
  },
  filterToggleButton: {
    width: 36,
    minWidth: 36,
    padding: 0,
    background: 'rgba(24, 40, 24, 0.95)',
    border: '2px solid #083e22',
    color: '#d0c98d',
    transition: 'all 0.2s ease',
    borderRadius: '4px',
    '&:hover': {
      background: 'rgba(215, 197, 41, 0.1)',
      borderColor: 'rgba(215, 197, 41, 0.3)',
      color: '#d7c529',
    },
  },
  filterToggleButtonActive: {
    background: 'rgba(215, 197, 41, 0.15)',
    borderColor: 'rgba(215, 197, 41, 0.4)',
    color: '#d7c529',
    '&:hover': {
      background: 'rgba(215, 197, 41, 0.2)',
    },
  },
  newIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    background: 'radial-gradient(circle, #d7c529 60%, #2d3c00 100%)',
    borderRadius: '50%',
    border: '2px solid #222',
    boxShadow: '0 0 8px #d7c529',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: '#222',
    fontWeight: 'bold',
    zIndex: 2
  },
  setStatsModal: {
    background: 'rgba(24, 40, 24, 0.97)',
    borderRadius: '8px',
    padding: '20px',
    border: '2px solid rgba(215, 197, 41, 0.35)',
    width: 'min(1120px, 94vw)',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  setStatsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  setStatsTitle: {
    color: '#f8eb8f',
    fontSize: '1.1rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  setStatsEmpty: {
    color: 'rgba(215, 197, 41, 0.8)',
    textAlign: 'center',
  },
  setStatsContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gridAutoRows: 'auto',
    gap: '10px',
    width: '100%',
  },
  setStatsColumn: {
    border: '1px solid rgba(215, 197, 41, 0.25)',
    borderRadius: '6px',
    padding: '10px',
    background: 'rgba(12, 20, 12, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  setStatsColumnWeapons: {
    gridColumn: '1',
    gridRow: '1',
  },
  setStatsColumnRings: {
    gridColumn: '1',
    gridRow: '1',
  },
  setStatsColumnCloth: {
    gridColumn: '2',
    gridRow: '1',
  },
  setStatsColumnHide: {
    gridColumn: '3',
    gridRow: '1',
  },
  setStatsColumnMetal: {
    gridColumn: '4',
    gridRow: '1',
  },
  setStatsColumnTitle: {
    color: '#d7c529',
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: '0.04em',
  },
  setStatsItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  setStatsItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  setStatsItemImageContainer: {
    width: '38px',
    height: '38px',
    minWidth: '38px',
  },
  setStatsItemGlow: {
    opacity: 0.25,
  },
  setStatsItemImage: {
    padding: '3px',
  },
  setStatsDivider: {
    borderTop: '1px solid rgba(215, 197, 41, 0.18)',
    marginTop: '6px',
    paddingTop: '6px',
  },
  setStatsItemSlot: {
    color: '#d0c98d',
    fontWeight: 500,
    fontSize: '0.8rem',
  },
  setStatsItemBonus: {
    color: '#f8eb8f',
    fontWeight: 600,
    fontSize: '0.8rem',
    textAlign: 'right',
  },
  setStatsTotals: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(215, 197, 41, 0.2)',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  setStatsTotalValue: {
    color: '#d7c529',
    fontWeight: 700,
    fontSize: '0.82rem',
  },
  itemUnaffordable: {
    opacity: 0.5,
  },
  // Settings styles
  settingsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
    padding: '4px 0',
    overflowY: 'auto',
    flex: 1,
  },
  settingsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.75,
  },
  settingsSectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#d0c98d',
    fontFamily: 'Cinzel, Georgia, serif',
  },
  soundControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    padding: '6px 10px',
    background: 'rgba(24, 40, 24, 0.3)',
    border: '1px solid rgba(8, 62, 34, 0.5)',
    borderRadius: '6px',
  },
  volumeSlider: {
    flex: 1,
    color: '#d0c98d',
    height: 4,
    '& .MuiSlider-thumb': {
      backgroundColor: '#d0c98d',
      width: 14,
      height: 14,
      '&:hover': {
        boxShadow: '0 0 0 6px rgba(208, 201, 141, 0.16)',
      },
    },
    '& .MuiSlider-track': {
      backgroundColor: '#d0c98d',
      border: 'none',
    },
    '& .MuiSlider-rail': {
      backgroundColor: 'rgba(208, 201, 141, 0.2)',
    },
    '& .MuiSlider-valueLabel': {
      backgroundColor: '#d0c98d',
      color: '#1a1a1a',
      fontSize: '10px',
      fontWeight: 600,
    },
    '&.Mui-disabled': {
      '& .MuiSlider-track': {
        backgroundColor: '#666',
      },
      '& .MuiSlider-thumb': {
        backgroundColor: '#666',
      },
    },
  },
  animationsControl: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0.5,
  },
  checkbox: {
    color: '#d0c98d',
    padding: '4px',
    '&.Mui-checked': {
      color: '#d0c98d',
    },
    '&:hover': {
      backgroundColor: 'rgba(208, 201, 141, 0.08)',
    },
  },
  checkboxLabel: {
    color: '#d0c98d',
    fontSize: '0.75rem',
    margin: 0,
    '& .MuiFormControlLabel-label': {
      fontWeight: 500,
      fontSize: '0.8rem',
    },
  },
  switchClientButton: {
    borderColor: '#d0c98d',
    color: '#d0c98d',
    fontFamily: 'Cinzel, Georgia, serif',
    fontWeight: 500,
    fontSize: '0.8rem',
    textTransform: 'none',
    '&:hover': {
      borderColor: '#d0c98d',
      background: 'rgba(208, 201, 141, 0.1)',
    },
  },
  exitGameButton: {
    background: 'rgba(255, 0, 0, 0.15)',
    border: '2px solid rgba(255, 0, 0, 0.3)',
    color: '#FF6B6B',
    fontFamily: 'Cinzel, Georgia, serif',
    fontWeight: 500,
    fontSize: '0.8rem',
    letterSpacing: '0.5px',
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(255, 0, 0, 0.25)',
      border: '2px solid rgba(255, 0, 0, 0.4)',
    },
  },
  socialButtons: {
    display: 'flex',
    justifyContent: 'center',
    gap: 2,
  },
  socialButton: {
    color: '#d0c98d',
    opacity: 0.8,
    background: 'rgba(24, 40, 24, 0.3)',
    border: '1px solid rgba(8, 62, 34, 0.5)',
    '&:hover': {
      opacity: 1,
      background: 'rgba(24, 40, 24, 0.5)',
    },
    padding: '8px',
  },
};
