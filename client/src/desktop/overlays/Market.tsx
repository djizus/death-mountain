import { useGameDirector } from '@/desktop/contexts/GameDirector';
import { MAX_BAG_SIZE, STARTING_HEALTH } from '@/constants/game';
import { useGameStore } from '@/stores/gameStore';
import { useMarketStore } from '@/stores/marketStore';
import { calculateLevel } from '@/utils/game';
import { ItemUtils, slotIcons, typeIcons, Tier } from '@/utils/loot';
import { MarketItem, generateMarketItems, potionPrice } from '@/utils/market';
import { getEventIcon, getEventTitle } from '@/utils/events';
import { getExplorationInsights, type SlotDamageSummary } from '@/utils/exploration';
import FilterListAltIcon from '@mui/icons-material/FilterListAlt';
import { Box, Button, IconButton, Modal, Slider, Tab, Tabs, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { SyntheticEvent, useCallback, useEffect, useMemo, useState } from 'react';
import JewelryTooltip from '@/components/JewelryTooltip';

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

const STAT_FILTER_OPTIONS = ['Strength', 'Vitality', 'Charisma', 'Dexterity', 'Intelligence', 'Wisdom'];

export default function MarketOverlay() {
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
  } = useGameStore();
  const { executeGameAction, actionFailed } = useGameDirector();
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
  const [activeTab, setActiveTab] = useState<'market' | 'exploring' | 'events'>('market');

  const handleTabChange = (_: SyntheticEvent, newValue: 'market' | 'exploring' | 'events') => {
    setActiveTab(newValue);
  };

  useEffect(() => {
    if (activeTab !== 'market') {
      setShowCart(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (inProgress) {
      if (cart.items.length > 0) {
        setNewInventoryItems(cart.items.map(item => item.id));
        setShowInventory(true);
      }

      setShowCart(false);
      setInProgress(false);
    }

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
    addToCart(item);
  };

  const handleBuyPotion = (value: number) => {
    setPotions(value);
  };

  const handleCheckout = () => {
    setInProgress(true);

    let itemPurchases = cart.items.map(item => ({
      item_id: item.id,
      equip: adventurer?.equipment[ItemUtils.getItemSlot(item.id).toLowerCase() as keyof typeof adventurer.equipment]?.id === 0 ? true : false,
    }));

    executeGameAction({
      type: 'buy_items',
      potions: cart.potions,
      itemPurchases,
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

  const filteredItems = marketItems.filter(item => {
    if (slotFilter && item.slot !== slotFilter) return false;
    if (typeFilter && item.type !== typeFilter) return false;
    if (tierFilter && item.tier !== tierFilter) return false;
    if (statFilter && (!item.futureStatTags.length || !item.futureStatTags.includes(statFilter))) return false;
    return true;
  });

  const explorationInsights = useMemo(() => getExplorationInsights(adventurer ?? null, gameSettings ?? null), [adventurer, gameSettings]);

  const formatRange = useCallback((min: number, max: number) => {
    if (min === max) {
      return `${min}`;
    }
    return `${min} – ${max}`;
  }, []);

  const renderDistributionChips = useCallback((data: Record<string, number>) => (
    <Box sx={styles.distributionRow}>
      {Object.entries(data).map(([label, value]) => (
        <Box key={label} sx={styles.distributionChip}>
          <Typography sx={styles.distributionLabel}>{label}</Typography>
          <Typography sx={styles.distributionValue}>{value.toFixed(2)}%</Typography>
        </Box>
      ))}
    </Box>
  ), []);

  const renderDamageTable = useCallback((title: string, rows: SlotDamageSummary[]) => (
    <Box sx={styles.tableContainer}>
      <Typography sx={styles.tableTitle}>{title}</Typography>
      <Box sx={styles.tableHeader}>
        <Typography sx={styles.tableHeaderCellSlot}>Slot</Typography>
        <Typography sx={styles.tableHeaderCell}>Base Damage</Typography>
        <Typography sx={styles.tableHeaderCell}>Critical Damage</Typography>
        <Typography sx={styles.tableHeaderCell}>Armor</Typography>
      </Box>
      {rows.map((row) => (
        <Box key={row.slot} sx={styles.tableRow}>
          <Typography sx={styles.tableCellSlot}>{row.slotLabel}</Typography>
          <Typography sx={styles.tableCell}>{formatRange(row.minBase, row.maxBase)}</Typography>
          <Typography sx={styles.tableCell}>{formatRange(row.minCrit, row.maxCrit)}</Typography>
          <Typography sx={styles.tableCell}>{row.armorName || 'None'}</Typography>
        </Box>
      ))}
    </Box>
  ), [formatRange]);

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

    return (
      <Box sx={styles.exploringContent}>
        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Encounter Mix</Typography>
          <Box sx={styles.probabilityRow}>
            {[{ label: 'Beast', value: explorationInsights.encounterDistribution.baseMix.beast }, { label: 'Obstacle', value: explorationInsights.encounterDistribution.baseMix.obstacle }, { label: 'Discovery', value: explorationInsights.encounterDistribution.baseMix.discovery }].map(probability => (
              <Box key={probability.label} sx={styles.probabilityCard}>
                <Typography sx={styles.probabilityLabel}>{probability.label}</Typography>
                <Typography sx={styles.probabilityValue}>{probability.value.toFixed(2)}%</Typography>
              </Box>
            ))}
          </Box>

          <Box sx={styles.subSection}>
            <Typography sx={styles.subSectionTitle}>Beast tiers</Typography>
            {renderDistributionChips(explorationInsights.encounterDistribution.beastByTier)}
            <Typography sx={styles.subSectionTitle}>Beast damage types</Typography>
            {renderDistributionChips(explorationInsights.encounterDistribution.beastByType)}
          </Box>

          <Box sx={styles.subSection}>
            <Typography sx={styles.subSectionTitle}>Trap tiers</Typography>
            {renderDistributionChips(explorationInsights.encounterDistribution.obstacleByTier)}
            <Typography sx={styles.subSectionTitle}>Trap damage types</Typography>
            {renderDistributionChips(explorationInsights.encounterDistribution.obstacleByType)}
          </Box>
        </Box>

        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Beast Ambush Risk</Typography>
          <Box sx={styles.metricRow}>
            <Typography sx={styles.metricLabel}>Ambush chance</Typography>
            <Typography sx={styles.metricValue}>{explorationInsights.beasts.ambushChance.toFixed(2)}%</Typography>
          </Box>
          <Box sx={styles.metricRow}>
            <Typography sx={styles.metricLabel}>Critical chance</Typography>
            <Typography sx={styles.metricValue}>{explorationInsights.beasts.critChance.toFixed(2)}%</Typography>
          </Box>
          {renderDamageTable('Potential damage by slot', explorationInsights.beasts.slotDamages)}
          {explorationInsights.beasts.highestThreat && (
            <Typography sx={styles.sectionNote}>
              Highest spike: {explorationInsights.beasts.highestThreat.name} hitting your {explorationInsights.beasts.highestThreat.slot} for up to {explorationInsights.beasts.highestThreat.damage} damage.
            </Typography>
          )}
        </Box>

        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Trap Impact</Typography>
          <Box sx={styles.metricRow}>
            <Typography sx={styles.metricLabel}>Dodge chance</Typography>
            <Typography sx={styles.metricValue}>{explorationInsights.obstacles.dodgeChance.toFixed(2)}%</Typography>
          </Box>
          <Box sx={styles.metricRow}>
            <Typography sx={styles.metricLabel}>Critical chance</Typography>
            <Typography sx={styles.metricValue}>{explorationInsights.obstacles.critChance.toFixed(2)}%</Typography>
          </Box>
          {renderDamageTable('Trap damage by slot', explorationInsights.obstacles.slotDamages)}
          {explorationInsights.obstacles.highestThreat && (
            <Typography sx={styles.sectionNote}>
              Highest spike: {explorationInsights.obstacles.highestThreat.name} targeting your {explorationInsights.obstacles.highestThreat.slot} for up to {explorationInsights.obstacles.highestThreat.damage} damage.
            </Typography>
          )}
        </Box>

        <Box sx={styles.exploringCard}>
          <Typography sx={styles.sectionTitle}>Discovery Outcomes</Typography>
          <Box sx={styles.discoveryRow}>
            <Box sx={styles.discoveryCard}>
              <Typography sx={styles.discoveryLabel}>Gold ({explorationInsights.discoveries.goldChance}%)</Typography>
              <Typography sx={styles.discoveryValue}>+{explorationInsights.discoveries.goldRange.min} to +{explorationInsights.discoveries.goldRange.max}</Typography>
            </Box>
            <Box sx={styles.discoveryCard}>
              <Typography sx={styles.discoveryLabel}>Health ({explorationInsights.discoveries.healthChance}%)</Typography>
              <Typography sx={styles.discoveryValue}>+{explorationInsights.discoveries.healthRange.min} to +{explorationInsights.discoveries.healthRange.max}</Typography>
            </Box>
            <Box sx={styles.discoveryCard}>
              <Typography sx={styles.discoveryLabel}>Loot ({explorationInsights.discoveries.lootChance}%)</Typography>
              <Typography sx={styles.discoveryValue}>Random equipment drop</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }, [explorationInsights, renderDamageTable, renderDistributionChips]);

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
                        ? 'Dodged'
                        : `-${event.obstacle?.damage} Health${event.obstacle?.critical_hit ? ' critical hit!' : ''}`}
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
    <Box sx={styles.popup}>
      <Box sx={styles.tabBar}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="market sections"
          sx={styles.tabs}>
          <Tab value="market" label="Market" sx={styles.tab} />
          <Tab value="exploring" label="Exploring" sx={styles.tab} />
          <Tab value="events" label="Event Log" sx={styles.tab} />
        </Tabs>
      </Box>

      {activeTab === 'market' && (
        <Box sx={styles.marketContent}>
          <Box sx={styles.topBar}>
            <Box sx={styles.goldDisplay}>
              <Typography sx={styles.goldLabel} variant='h6'>Gold left:</Typography>
              <Typography sx={styles.goldValue} variant='h6'>{remainingGold}</Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={handleCheckout}
              disabled={inProgress || cart.potions === 0 && cart.items.length === 0 || remainingGold < 0}
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
                  disabled={inProgress || cart.potions === 0 && cart.items.length === 0 || remainingGold < 0}
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

          <Box sx={styles.mainContent}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', mb: '6px' }}>
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
                    <Slider
                      value={cart.potions}
                      onChange={(_, value) => handleBuyPotion(value as number)}
                      min={0}
                      max={maxPotions}
                      sx={styles.potionSlider}
                    />
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

                <Box sx={styles.filterGroup}>
                  <ToggleButtonGroup
                    value={statFilter}
                    exclusive
                    onChange={handleStatFilter}
                    aria-label="item stat"
                    sx={styles.filterButtons}>
                    {STAT_FILTER_OPTIONS.map((stat) => (
                      <ToggleButton key={stat} value={stat} aria-label={stat}>
                        <Typography sx={styles.statFilterLabel}>{stat.slice(0, 3).toUpperCase()}</Typography>
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
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
                          <Typography sx={styles.itemBonusLabel}>
                            Unlocks at 15
                          </Typography>
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
                            disabled={!inCart && (remainingGold < item.price || isItemOwned(item.id) || inventoryFull)}
                            sx={{
                              height: '32px',
                              ...(inCart && {
                                background: 'rgba(215, 197, 41, 0.2)',
                                color: 'rgba(215, 197, 41, 0.8)',
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
    top: '24px',
    right: '24px',
    width: '390px',
    maxHeight: 'calc(100dvh - 170px)',
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
  probabilityRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  probabilityCard: {
    flex: '1 1 120px',
    background: 'rgba(24, 40, 24, 0.75)',
    border: '1px solid rgba(215, 198, 41, 0.25)',
    borderRadius: '8px',
    padding: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  probabilityLabel: {
    color: '#d0c98d',
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: 'Cinzel, Georgia, serif',
  },
  probabilityValue: {
    color: '#d7c529',
    fontSize: '1.08rem',
    fontWeight: 600,
  },
  exploringCard: {
    background: 'rgba(24, 40, 24, 0.85)',
    border: '1px solid rgba(215, 198, 41, 0.25)',
    borderRadius: '10px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
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
  distributionRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  distributionChip: {
    padding: '6px 8px',
    borderRadius: '6px',
    border: '1px solid rgba(215, 198, 41, 0.2)',
    background: 'rgba(24, 40, 24, 0.5)',
    minWidth: '80px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  distributionLabel: {
    color: 'rgba(208, 201, 141, 0.75)',
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  distributionValue: {
    color: '#f2edd0',
    fontSize: '0.86rem',
    fontWeight: 600,
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#d0c98d',
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  metricValue: {
    color: '#d7c529',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  sectionNote: {
    color: '#d0c98d',
    fontSize: '0.76rem',
  },
  tableContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  tableTitle: {
    color: '#d0c98d',
    fontSize: '0.74rem',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  tableHeader: {
    display: 'flex',
    padding: '6px 8px',
    borderRadius: '6px',
    background: 'rgba(13, 40, 20, 0.6)',
    border: '1px solid rgba(13, 80, 40, 0.35)',
  },
  tableHeaderCellSlot: {
    flex: '0 0 70px',
    color: 'rgba(208, 201, 141, 0.75)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
  },
  tableHeaderCell: {
    flex: 1,
    color: 'rgba(208, 201, 141, 0.75)',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
  },
  tableRow: {
    display: 'flex',
    padding: '6px 8px',
    borderRadius: '6px',
    background: 'rgba(24, 40, 24, 0.5)',
    border: '1px solid rgba(13, 80, 40, 0.2)',
  },
  tableCellSlot: {
    flex: '0 0 70px',
    color: '#f2edd0',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
  tableCell: {
    flex: 1,
    color: '#f2edd0',
    fontSize: '0.8rem',
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
  itemBonusLabel: {
    color: 'rgba(215, 197, 41, 0.8)',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
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
    gap: '8px',
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
  statFilterLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'rgba(215, 197, 41, 0.85)',
  },
  filterToggleButton: {
    width: 36,
    height: 36,
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
  itemUnaffordable: {
    opacity: 0.5,
  },
};
