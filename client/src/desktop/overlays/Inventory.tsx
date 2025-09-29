import { BEAST_MIN_DAMAGE } from '@/constants/beast';
import AdventurerStats from '@/desktop/components/AdventurerStats';
import ItemTooltip from '@/desktop/components/ItemTooltip';
import { useGameDirector } from '@/desktop/contexts/GameDirector';
import { useGameStore } from '@/stores/gameStore';
import { Item } from '@/types/game';
import { calculateAttackDamage, calculateBeastDamage, calculateBeastDamageDetails, calculateCombatStats, calculateLevel } from '@/utils/game';
import { ItemType, ItemUtils, Tier } from '@/utils/loot';
import { keyframes } from '@emotion/react';
import { DeleteOutline, Star } from '@mui/icons-material';
import { Box, Button, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

type EquipmentSlot = 'weapon' | 'chest' | 'head' | 'waist' | 'foot' | 'hand' | 'neck' | 'ring';

const equipmentSlots: Array<{ key: EquipmentSlot; label: string; icon: string; position: { row: number; col: number } }> = [
  { key: 'head', label: 'Head', position: { row: 1, col: 2 }, icon: '/images/types/head.svg' },
  { key: 'hand', label: 'Hands', position: { row: 2, col: 1 }, icon: '/images/types/hand.svg' },
  { key: 'chest', label: 'Chest', position: { row: 2, col: 2 }, icon: '/images/types/chest.svg' },
  { key: 'neck', label: 'Neck', position: { row: 2, col: 3 }, icon: '/images/types/neck.svg' },
  { key: 'weapon', label: 'Weapon', position: { row: 3, col: 1 }, icon: '/images/types/weapon.svg' },
  { key: 'waist', label: 'Waist', position: { row: 3, col: 2 }, icon: '/images/types/waist.svg' },
  { key: 'ring', label: 'Ring', position: { row: 3, col: 3 }, icon: '/images/types/ring.svg' },
  { key: 'foot', label: 'Feet', position: { row: 4, col: 2 }, icon: '/images/types/foot.svg' },
];

interface InventoryOverlayProps {
  disabledEquip?: boolean;
}

function CharacterEquipment({ isDropMode, itemsToDrop, onItemClick, newItems, onItemHover }: {
  isDropMode: boolean,
  itemsToDrop: number[],
  onItemClick: (item: any) => void,
  newItems: number[],
  onItemHover: (itemId: number) => void
}) {
  const { adventurer, beast } = useGameStore();

  return (
    <Box sx={styles.equipmentPanel}>
      <Box sx={styles.characterPortraitWrapper}>
        <img
          src={'/images/adventurer.png'}
          alt="adventurer"
          style={{
            ...styles.characterPortrait,
            objectFit: 'contain',
            position: 'absolute',
            left: '50%',
            top: '45%',
            transform: 'translate(-50%, -45%)',
            zIndex: 0,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 10px #000a)'
          }}
        />
        {equipmentSlots.map(slot => {
          const item = adventurer?.equipment[slot.key];
          const metadata = item ? ItemUtils.getMetadata(item.id) : null;
          const isSelected = item?.id ? itemsToDrop.includes(item.id) : false;
          const highlight = item?.id ? (isDropMode && itemsToDrop.length === 0) : false;
          const isNew = item?.id ? newItems.includes(item.id) : false;
          const tier = item?.id ? ItemUtils.getItemTier(item.id) : null;
          const tierColor = tier ? ItemUtils.getTierColor(tier) : undefined;
          const level = item?.id ? calculateLevel(item.xp) : 0;
          const isNameMatch = item?.id && beast ? ItemUtils.isNameMatch(item.id, level, adventurer!.item_specials_seed, beast) : false;
          const isArmorSlot = ['head', 'chest', 'foot', 'hand', 'waist'].includes(slot.key);
          const isWeaponSlot = slot.key === 'weapon';
          const isNameMatchDanger = isNameMatch && isArmorSlot;
          const isNameMatchPower = isNameMatch && isWeaponSlot;
          const hasSpecials = level >= 15;
          const hasGoldSpecials = level >= 20;
          const { row, col } = slot.position;

          // Calculate damage values
          let damage = 0;
          let critDamage = 0;
          let damageTaken = 0;
          let critDamageTaken = 0;
          if (beast) {
            const beastPower = beast.level * (6 - beast.tier);
            if (isArmorSlot && beast.health > 4) {
              // For armor slots, show damage taken (always negative)
              if (item && item.id !== 0) {
                const damageSummary = calculateBeastDamageDetails(beast, adventurer!, item);
                damageTaken = damageSummary.baseDamage;
                critDamageTaken = damageSummary.criticalDamage;
              } else {
                // For empty armor slots, show beast power * 1.5
                damageTaken = Math.max(BEAST_MIN_DAMAGE, Math.floor(beastPower * 1.5));
                critDamageTaken = Math.max(BEAST_MIN_DAMAGE, damageTaken * 2);
              }
            } else if (isWeaponSlot) {
              // For weapon slots, show damage dealt (always positive)
              if (item && item.id !== 0) {
                const attackSummary = calculateAttackDamage(item, adventurer!, beast);
                damage = attackSummary.baseDamage;
                critDamage = attackSummary.criticalDamage;
              }
            }
          }

          const hasDamageOverlay = (damage > 0 || damageTaken > 0) && !!beast;
          const baseOverlayValue = isArmorSlot ? damageTaken : damage;
          const critOverlayValue = isArmorSlot ? critDamageTaken : critDamage;

          return (
            <Tooltip
              key={slot.key}
              title={item?.id ? (
                <ItemTooltip item={item} itemSpecialsSeed={adventurer?.item_specials_seed || 0} style={styles.tooltipContainer} />
              ) : (
                !item?.id && (
                  beast && isArmorSlot ? (
                    <Box sx={styles.tooltipContainer}>
                      <Box sx={styles.emptySlotTooltipHeader}>
                        <Typography sx={styles.emptySlotTooltipTitle}>
                          Empty {slot.label} Slot
                        </Typography>
                      </Box>
                      <Box sx={styles.emptySlotTooltipDivider} />
                      <Box sx={styles.emptySlotTooltipDamageContainer}>
                        <Typography sx={styles.emptySlotTooltipDamageText}>
                          -{Math.floor((6 - beast.tier) * beast.level * 1.5)} health (Base)
                        </Typography>
                        <Typography sx={styles.emptySlotTooltipDamageText}>
                          -{Math.floor((6 - beast.tier) * beast.level * 1.5 * 2)} health (Critical)
                        </Typography>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={styles.tooltipContainer}>
                      <Typography sx={styles.emptySlotTooltipTitle}>
                        Empty {slot.label} Slot
                      </Typography>
                    </Box>
                  )
                )
              )}
              placement="auto-end"
              slotProps={{
                popper: {
                  modifiers: [
                    {
                      name: 'offset',
                      options: { offset: [0, 0] },
                    },
                    {
                      name: 'preventOverflow',
                      enabled: true,
                      options: { rootBoundary: 'viewport' },
                    },
                  ],
                },
                tooltip: {
                  sx: {
                    bgcolor: 'transparent',
                    border: 'none',
                  },
                },
              }}
            >
              <Box
                sx={[
                  styles.gridSlot,
                  styles.equipmentSlot,
                  ...(isSelected ? [styles.selectedItem] : []),
                  ...(highlight ? [styles.highlight] : []),
                  ...(isNew ? [styles.newItem] : []),
                  ...(!isDropMode ? [styles.nonInteractive] : []),
                  ...(isNameMatchDanger ? [styles.nameMatchDangerSlot] : []),
                  ...(isNameMatchPower ? [styles.nameMatchPowerSlot] : [])
                ]}
                style={{ gridColumn: col, gridRow: row }}
                onClick={() => isDropMode && item?.id && onItemClick(item)}
                onMouseEnter={() => item?.id && onItemHover(item.id)}
              >
                {item?.id && metadata ? (
                  <Box sx={styles.itemImageContainer}>
                    <Box
                      sx={[
                        styles.itemGlow,
                        { backgroundColor: tierColor }
                      ]}
                    />
                    <Box sx={styles.itemLevelBadge}>
                      <Typography sx={styles.itemLevelText}>Lv {level}</Typography>
                    </Box>
                    {(isNameMatchDanger || isNameMatchPower) && (
                      <Box
                        sx={[
                          styles.nameMatchGlow,
                          isNameMatchDanger ? styles.nameMatchDangerGlow : styles.nameMatchPowerGlow
                        ]}
                      />
                    )}
                    <img
                      src={metadata.imageUrl}
                      alt={metadata.name}
                      style={{ ...styles.equipmentIcon, position: 'relative' }}
                    />
                    {hasSpecials && (
                      <Box sx={[styles.starOverlay, hasGoldSpecials ? styles.goldStarOverlay : styles.silverStarOverlay]}>
                        <Star sx={[styles.starIcon, hasGoldSpecials ? styles.goldStarIcon : styles.silverStarIcon]} />
                      </Box>
                    )}
                    {/* Damage Indicator Overlay */}
                    {hasDamageOverlay && (
                      <>
                        <Box sx={[
                          styles.damageIndicator,
                          styles.damageIndicatorTop,
                          isArmorSlot ? styles.damageIndicatorRed : styles.damageIndicatorGreen
                        ]}>
                          <Typography sx={[
                            styles.damageIndicatorText,
                            isArmorSlot ? styles.damageIndicatorTextRed : styles.damageIndicatorTextGreen
                          ]}>
                            {isArmorSlot ? `-${baseOverlayValue}` : `+${baseOverlayValue}`}
                          </Typography>
                        </Box>
                        {critOverlayValue > 0 && (
                          <Box sx={[
                            styles.damageIndicator,
                            styles.damageIndicatorBottom,
                            isArmorSlot ? styles.damageIndicatorCritRed : styles.damageIndicatorCritGreen
                          ]}>
                            <Typography sx={[
                              styles.damageIndicatorText,
                              isArmorSlot ? styles.damageIndicatorTextRed : styles.damageIndicatorTextGreen
                            ]}>
                              {isArmorSlot ? `-${critOverlayValue}` : `+${critOverlayValue}`}
                            </Typography>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                ) : (
                  <Box sx={styles.emptySlot} title={slot.label}>
                    <img src={slot.icon} alt={slot.label} style={{ width: '70%', height: '70%', opacity: 0.5 }} />
                    {/* Damage Indicator Overlay for Empty Slots */}
                    {hasDamageOverlay && (
                      <>
                        <Box sx={[
                          styles.damageIndicator,
                          styles.damageIndicatorTop,
                          isArmorSlot ? styles.damageIndicatorRed : styles.damageIndicatorGreen
                        ]}>
                          <Typography sx={[
                            styles.damageIndicatorText,
                            isArmorSlot ? styles.damageIndicatorTextRed : styles.damageIndicatorTextGreen
                          ]}>
                            {isArmorSlot ? `-${baseOverlayValue}` : `+${baseOverlayValue}`}
                          </Typography>
                        </Box>
                        {critOverlayValue > 0 && (
                          <Box sx={[
                            styles.damageIndicator,
                            styles.damageIndicatorBottom,
                            isArmorSlot ? styles.damageIndicatorCritRed : styles.damageIndicatorCritGreen
                          ]}>
                            <Typography sx={[
                              styles.damageIndicatorText,
                              isArmorSlot ? styles.damageIndicatorTextRed : styles.damageIndicatorTextGreen
                            ]}>
                              {isArmorSlot ? `-${critOverlayValue}` : `+${critOverlayValue}`}
                            </Typography>
                          </Box>
                        )}
                      </>
                    )}
                  </Box>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

function InventoryBag({ isDropMode, itemsToDrop, onItemClick, onDropModeToggle, newItems, onItemHover }: {
  isDropMode: boolean,
  itemsToDrop: number[],
  onItemClick: (item: any) => void,
  onDropModeToggle: () => void,
  newItems: number[],
  onItemHover: (itemId: number) => void
}) {
  const { bag, adventurer, beast } = useGameStore();

  // Calculate combat stats to get bestItems for defense highlighting
  const combatStats = beast ? calculateCombatStats(adventurer!, bag, beast) : null;
  const bestItemIds = combatStats?.bestItems.map((item: Item) => item.id) || [];

  const slotPriority: Record<string, number> = {
    weapon: 0,
    neck: 1,
    ring: 2,
    head: 3,
    chest: 4,
    hand: 5,
    waist: 6,
    foot: 7,
  };

  const weaponTypePriority = [ItemType.Magic, ItemType.Blade, ItemType.Bludgeon];
  const armorTypePriority = [ItemType.Cloth, ItemType.Hide, ItemType.Metal];

  const getWeaponPriority = (item: Item) => {
    const itemType = ItemUtils.getItemType(item.id);
    const index = weaponTypePriority.indexOf(itemType);
    return index === -1 ? weaponTypePriority.length : index;
  };

  const getArmorPriority = (item: Item) => {
    const itemType = ItemUtils.getItemType(item.id);
    const index = armorTypePriority.indexOf(itemType);
    if (index === -1) {
      // Treat jewellery and other types as lowest priority within their slot
      return armorTypePriority.length;
    }
    return index;
  };

  const getSlotPriority = (slot: string) => {
    return slotPriority[slot] ?? Number.MAX_SAFE_INTEGER;
  };

  const sortedItems = [...(bag ?? [])].sort((a, b) => {
    const slotA = ItemUtils.getItemSlot(a.id).toLowerCase();
    const slotB = ItemUtils.getItemSlot(b.id).toLowerCase();
    const isWeaponA = slotA === 'weapon';
    const isWeaponB = slotB === 'weapon';

    if (isWeaponA !== isWeaponB) {
      return isWeaponA ? -1 : 1;
    }

    if (isWeaponA && isWeaponB) {
      const weaponPriorityDiff = getWeaponPriority(a) - getWeaponPriority(b);
      if (weaponPriorityDiff !== 0) {
        return weaponPriorityDiff;
      }
      // Fallback to tier then id for deterministic ordering
      const tierDiff = ItemUtils.getItemTier(a.id) - ItemUtils.getItemTier(b.id);
      if (tierDiff !== 0) {
        return tierDiff;
      }
      return a.id - b.id;
    }

    const slotDiff = getSlotPriority(slotA) - getSlotPriority(slotB);
    if (slotDiff !== 0) {
      return slotDiff;
    }

    const isArmorSlotA = ['head', 'chest', 'hand', 'waist', 'foot'].includes(slotA);
    const isArmorSlotB = ['head', 'chest', 'hand', 'waist', 'foot'].includes(slotB);

    if (isArmorSlotA && isArmorSlotB) {
      const armorDiff = getArmorPriority(a) - getArmorPriority(b);
      if (armorDiff !== 0) {
        return armorDiff;
      }
    }

    const tierDiff = ItemUtils.getItemTier(a.id) - ItemUtils.getItemTier(b.id);
    if (tierDiff !== 0) {
      return tierDiff;
    }

    return a.id - b.id;
  });

  const remainingSlots = Math.max(0, 15 - (bag?.length || 0));
  const emptySlots = Array.from({ length: remainingSlots }).map((_, index) => (
    <Box key={`empty-${index}`} sx={[styles.bagSlot, styles.emptyBagSlot]}>
      <Box sx={styles.emptySlot}></Box>
    </Box>
  ));

  const renderBagItem = (item: Item) => {
    const metadata = ItemUtils.getMetadata(item.id);
    const isSelected = itemsToDrop.includes(item.id);
    const highlight = isDropMode && itemsToDrop.length === 0;
    const isNew = newItems.includes(item.id);
    const tier = ItemUtils.getItemTier(item.id);
    const tierColor = ItemUtils.getTierColor(tier);
    const level = calculateLevel(item.xp);
    const slot = ItemUtils.getItemSlot(item.id).toLowerCase();
    const isArmorSlot = ['head', 'chest', 'foot', 'hand', 'waist'].includes(slot);
    const isWeaponSlot = slot === 'weapon';
    const isNameMatch = beast ? ItemUtils.isNameMatch(item.id, level, adventurer!.item_specials_seed, beast) : false;
    const isNameMatchDanger = isNameMatch && isArmorSlot;
    const isNameMatchPower = isNameMatch && isWeaponSlot;
    const isDefenseItem = bestItemIds.includes(item.id);
    const hasSpecials = level >= 15;
    const hasGoldSpecials = level >= 20;

    let damage = 0;
    let critDamage = 0;
    let damageTaken = 0;
    let critDamageTaken = 0;
    if (beast) {
      if (isArmorSlot) {
        const damageSummary = calculateBeastDamageDetails(beast, adventurer!, item);
        damageTaken = damageSummary.baseDamage;
        critDamageTaken = damageSummary.criticalDamage;
      } else if (isWeaponSlot) {
        const attackSummary = calculateAttackDamage(item, adventurer!, beast);
        damage = attackSummary.baseDamage;
        critDamage = attackSummary.criticalDamage;
      }
    }

    if (isNew && isWeaponSlot && [Tier.T1, Tier.T2, Tier.T3].includes(tier)
      && ItemUtils.getItemTier(adventurer?.equipment.weapon.id!) === Tier.T5) {
      onItemClick(item);
    }

    const hasDamageOverlay = (damage > 0 || damageTaken > 0) && !!beast;
    const baseOverlayValue = isArmorSlot ? damageTaken : damage;
    const critOverlayValue = isArmorSlot ? critDamageTaken : critDamage;

    return (
      <Tooltip
        key={item.id}
        title={<ItemTooltip item={item} itemSpecialsSeed={adventurer?.item_specials_seed || 0} style={styles.bagTooltipContainer} />}
        placement="auto-end"
        slotProps={{
          popper: {
            modifiers: [
              {
                name: 'offset',
                options: { offset: [0, -20] },
              },
              {
                name: 'preventOverflow',
                enabled: true,
                options: { rootBoundary: 'viewport' },
              },
            ],
          },
          tooltip: {
            sx: {
              bgcolor: 'transparent',
              border: 'none',
            },
          },
        }}
      >
        <Box
          sx={[
            styles.bagSlot,
            ...(isSelected ? [styles.selectedItem] : []),
            ...(highlight ? [styles.highlight] : []),
            ...(isNew ? [styles.newItem] : []),
            ...(isNameMatchDanger ? [styles.nameMatchDangerSlot] : []),
            ...(isNameMatchPower ? [styles.nameMatchPowerSlot] : []),
            ...(isDefenseItem ? [styles.defenseItemSlot] : [])
          ]}
          onClick={() => onItemClick(item)}
          onMouseEnter={() => onItemHover(item.id)}
        >
          <Box sx={styles.itemImageContainer}>
            <Box
              sx={[
                styles.itemGlow,
                { backgroundColor: tierColor }
              ]}
            />
            {(isNameMatchDanger || isNameMatchPower) && (
              <Box
                sx={[
                  styles.nameMatchGlow,
                  isNameMatchDanger ? styles.nameMatchDangerGlow : styles.nameMatchPowerGlow
                ]}
              />
            )}
            <img
              src={metadata.imageUrl}
              alt={metadata.name}
              style={{ ...styles.bagIcon, position: 'relative' }}
            />
            {hasSpecials && (
              <Box sx={[styles.starOverlay, hasGoldSpecials ? styles.goldStarOverlay : styles.silverStarOverlay]}>
                <Star sx={[styles.starIcon, hasGoldSpecials ? styles.goldStarIcon : styles.silverStarIcon]} />
              </Box>
            )}
            {hasDamageOverlay && (
              <>
                <Box sx={[
                  styles.damageIndicator,
                  styles.damageIndicatorTop,
                  isArmorSlot ? styles.damageIndicatorRed : styles.damageIndicatorGreen
                ]}>
                  <Typography sx={[
                    styles.damageIndicatorText,
                    isArmorSlot ? styles.damageIndicatorTextRed : styles.damageIndicatorTextGreen
                  ]}>
                    {isArmorSlot ? `-${baseOverlayValue}` : `+${baseOverlayValue}`}
                  </Typography>
                </Box>
                {critOverlayValue > 0 && (
                  <Box sx={[
                    styles.damageIndicator,
                    styles.damageIndicatorBottom,
                    isArmorSlot ? styles.damageIndicatorCritRed : styles.damageIndicatorCritGreen
                  ]}>
                    <Typography sx={[
                      styles.damageIndicatorText,
                      isArmorSlot ? styles.damageIndicatorTextRed : styles.damageIndicatorTextGreen
                    ]}>
                      {isArmorSlot ? `-${critOverlayValue}` : `+${critOverlayValue}`}
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
          <Box sx={styles.itemLevelBadge}>
            <Typography sx={styles.itemLevelText}>Lv {level}</Typography>
          </Box>
        </Box>
      </Tooltip>
    );
  };

  const showDropButton = !isDropMode && !beast;

  return (
    <Box sx={styles.bagPanel}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="h6">Bag ({bag?.length || 0}/{15})</Typography>
        <Typography variant="h6" color="secondary">{adventurer?.gold || 0} gold</Typography>
      </Box>

      <Box sx={styles.bagGrid}>
        {sortedItems.map(renderBagItem)}
        {emptySlots}

        {showDropButton && (
          <Box
            key="drop-button"
            sx={[styles.bagSlot, styles.dropButtonSlot]}
            onClick={onDropModeToggle}
          >
            <DeleteOutline sx={styles.dropIcon} />
            <Typography sx={styles.dropText}>drop</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default function InventoryOverlay({ disabledEquip }: InventoryOverlayProps) {
  const { executeGameAction, actionFailed } = useGameDirector();
  const { adventurer, bag, showInventory } = useGameStore();
  const { equipItem, newInventoryItems, setNewInventoryItems } = useGameStore();
  const [isDropMode, setIsDropMode] = useState(false);
  const [itemsToDrop, setItemsToDrop] = useState<number[]>([]);
  const [dropInProgress, setDropInProgress] = useState(false);
  const [newItems, setNewItems] = useState<number[]>([]);

  // Update newItems when newInventoryItems changes and clear newInventoryItems
  useEffect(() => {
    if (newInventoryItems.length > 0) {
      setNewItems([...newInventoryItems]);
      setNewInventoryItems([]);
    }
  }, [newInventoryItems, setNewInventoryItems]);

  useEffect(() => {
    if (dropInProgress) {
      setDropInProgress(false);
      setIsDropMode(false);
      setItemsToDrop([]);
    }
  }, [adventurer?.equipment, bag, actionFailed]);

  const handleItemClick = useCallback((item: any) => {
    if (disabledEquip) {
      return;
    }

    if (isDropMode) {
      setItemsToDrop(prev => {
        if (prev.includes(item.id)) {
          return prev.filter(id => id !== item.id);
        } else {
          return [...prev, item.id];
        }
      });
    } else {
      equipItem(item);
    }
  }, [isDropMode, equipItem, disabledEquip]);

  const handleConfirmDrop = () => {
    setDropInProgress(true);
    executeGameAction({
      type: 'drop',
      items: itemsToDrop,
    });
  };

  const handleCancelDrop = () => {
    setIsDropMode(false);
    setItemsToDrop([]);
  };

  const handleItemHover = useCallback((itemId: number) => {
    if (newItems.includes(itemId)) {
      setNewItems((prev: number[]) => prev.filter((id: number) => id !== itemId));
    }
  }, [newItems]);

  if (!showInventory) {
    return null;
  }

  return (
    <>
      {/* Inventory popup */}
      <Box sx={styles.popup}>
            <Box sx={styles.inventoryRoot}>
              {/* Left: Equipment */}
              <CharacterEquipment
                isDropMode={isDropMode}
                itemsToDrop={itemsToDrop}
                onItemClick={handleItemClick}
                newItems={newItems}
                onItemHover={handleItemHover}
              />
              {/* Right: Stats */}
              <AdventurerStats variant="stats" />
            </Box>

            {/* Bottom: Bag */}
            <InventoryBag
              isDropMode={isDropMode}
              itemsToDrop={itemsToDrop}
              onItemClick={handleItemClick}
              onDropModeToggle={() => setIsDropMode(true)}
              newItems={newItems}
              onItemHover={handleItemHover}
            />

            {/* Drop Mode Controls */}
            {isDropMode && (
              <Box sx={styles.dropControls}>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleCancelDrop}
                  sx={styles.cancelDropButton}
                  disabled={dropInProgress}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleConfirmDrop}
                  sx={styles.dropControlButton}
                  disabled={dropInProgress || itemsToDrop.length === 0}
                >
                  {dropInProgress
                    ? <Box display={'flex'} alignItems={'baseline'}>
                      <Typography>
                        Dropping items
                      </Typography>
                      <div className='dotLoader yellow' />
                    </Box>
                    : <Typography>
                      Confirm
                    </Typography>
                  }
                </Button>
              </Box>
            )}
          </Box>
    </>
  );
}

const pulseRed = keyframes`
  0% {
    box-shadow: 0 0 16px rgba(248, 27, 27, 0.8), 0 0 24px rgba(248, 27, 27, 0.4);
    background-color: rgba(248, 27, 27, 0.15);
  }
  50% {
    box-shadow: 0 0 24px rgba(248, 27, 27, 1), 0 0 36px rgba(248, 27, 27, 0.6);
    background-color: rgba(248, 27, 27, 0.25);
  }
  100% {
    box-shadow: 0 0 16px rgba(248, 27, 27, 0.8), 0 0 24px rgba(248, 27, 27, 0.4);
    background-color: rgba(248, 27, 27, 0.15);
  }
`;

const pulseGreen = keyframes`
  0% {
    box-shadow: 0 0 16px rgba(128, 255, 0, 0.8), 0 0 24px rgba(128, 255, 0, 0.4);
    background-color: rgba(128, 255, 0, 0.15);
  }
  50% {
    box-shadow: 0 0 24px rgba(128, 255, 0, 1), 0 0 36px rgba(128, 255, 0, 0.6);
    background-color: rgba(128, 255, 0, 0.25);
  }
  100% {
    box-shadow: 0 0 16px rgba(128, 255, 0, 0.8), 0 0 24px rgba(128, 255, 0, 0.4);
    background-color: rgba(128, 255, 0, 0.15);
  }
`;


const styles = {
  popup: {
    position: 'absolute',
    top: '120px',
    left: '24px',
    width: '500px',
    maxHeight: '90vh',
    background: 'rgba(24, 40, 24, 0.55)',
    border: '2px solid #083e22',
    borderRadius: '10px',
    boxShadow: '0 8px 32px 8px #000b',
    backdropFilter: 'blur(8px)',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 1.5,
    overflow: 'hidden',
  },
  inventoryRoot: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: 1,
    mb: 1
  },
  equipmentPanel: {
    height: '412px',
    width: '230px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    background: 'rgba(24, 40, 24, 0.95)',
    border: '2px solid #083e22',
    borderRadius: '8px',
    boxShadow: '0 0 8px #000a',
    padding: 1.5,
  },
  characterPortraitWrapper: {
    position: 'relative',
    width: 220,
    height: 280,
    margin: '0 auto',
    background: 'rgba(20, 20, 20, 0.7)',
    borderRadius: '8px',
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gridTemplateRows: 'repeat(4, 1fr)',
    gap: 1,
    padding: 1,
    justifyItems: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  gridSlot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
    height: '100%',
    padding: '1%',
  },
  characterPortrait: {
    width: 100,
    height: 150,
  },
  equipmentSlot: {
    background: 'rgba(24, 40, 24, 0.95)',
    border: '2px solid #083e22',
    borderRadius: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 4px #000a',
    zIndex: 2,
    cursor: 'pointer',
    overflow: 'hidden',
    width: '85%',
    height: '85%',
    minWidth: 54,
    minHeight: 54,
  },
  itemImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
  equipmentIcon: {
    width: '80%',
    height: '80%',
    zIndex: 2,
  },
  bagIcon: {
    width: '70%',
    height: '70%',
    zIndex: 2,
  },
  emptySlot: {
    width: '88%',
    height: '88%',
    border: '1.5px dashed #666',
    borderRadius: 0,
    background: 'rgba(80,80,80,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bagPanel: {
    width: '100%',
    background: 'rgba(24, 40, 24, 0.98)',
    border: '2px solid #083e22',
    padding: '12px 12px 10px',
    boxShadow: '0 0 8px #000a',
    boxSizing: 'border-box',
    borderRadius: '8px',
  },
  bagGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 0.5,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  bagSlot: {
    width: 60,
    height: 60,
    minWidth: 54,
    minHeight: 54,
    background: 'rgba(24, 40, 24, 0.95)',
    border: '2px solid #083e22',
    borderRadius: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 4px #000a',
    cursor: 'pointer',
    overflow: 'hidden',
    flexShrink: 0,
    position: 'relative',
  },
  emptyBagSlot: {
    cursor: 'default',
    pointerEvents: 'none',
    opacity: 0.45,
  },
  dropButtonSlot: {
    width: 60,
    height: 60,
    background: 'rgba(255, 0, 0, 0.1)',
    border: '2px solid rgba(255, 0, 0, 0.2)',
    boxShadow: '0 0 4px #000a',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255, 0, 0, 0.2)',
    },
  },
  dropIcon: {
    width: 16,
    height: 16,
    color: 'rgba(255, 0, 0, 0.7)',
  },
  dropText: {
    fontSize: '0.7rem',
    color: 'rgba(255, 0, 0, 0.7)',
    lineHeight: 1,
    mt: 0.5,
  },
  dropControls: {
    display: 'flex',
    gap: 1,
    mt: 1,
  },
  cancelDropButton: {
    flex: 1,
    justifyContent: 'center',
    fontSize: '0.9rem',
    background: 'rgba(255, 0, 0, 0.1)',
    color: '#FF0000',
    '&:disabled': {
      background: 'rgba(255, 0, 0, 0.05)',
      color: 'rgba(255, 0, 0, 0.3)',
    },
  },
  dropControlButton: {
    flex: 1,
    justifyContent: 'center',
    fontSize: '0.9rem',
    background: 'rgba(128, 255, 0, 0.15)',
    color: '#80FF00',
    '&:disabled': {
      background: 'rgba(128, 255, 0, 0.1)',
      color: 'rgba(128, 255, 0, 0.5)',
    },
  },
  selectedItem: {
    border: '2px solid #FF0000',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    '&:hover': {
      backgroundColor: 'rgba(255, 0, 0, 0.1)',
    },
  },
  highlight: {
    border: '2px solid #80FF00',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    '&:hover': {
      backgroundColor: 'rgba(128, 255, 0, 0.15)',
    },
  },
  nonInteractive: {
    cursor: 'default',
    '&:hover': {
      cursor: 'pointer',
    },
  },
  tooltipContainer: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(17, 17, 17, 1)',
    border: '2px solid #083e22',
    borderRadius: '8px',
    padding: '10px',
    zIndex: 1000,
    minWidth: '220px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  bagTooltipContainer: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(17, 17, 17, 1)',
    border: '2px solid #083e22',
    borderRadius: '8px',
    padding: '10px',
    zIndex: 1000,
    minWidth: '220px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transform: 'translate(-20%, -105%)',
  },
  newItem: {
    border: '2px solid #80FF00',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    '&:hover': {
      backgroundColor: 'rgba(128, 255, 0, 0.15)',
    },
  },
  strongItemSlot: {
    border: '2px solid #80FF00',
    boxShadow: '0 0 8px rgba(128, 255, 0, 0.3)',
  },
  weakItemSlot: {
    border: '2px solid rgb(248, 27, 27)',
    boxShadow: '0 0 8px rgba(255, 68, 68, 0.3)',
  },
  nameMatchDangerSlot: {
    animation: `${pulseRed} 1.2s infinite`,
    border: '2px solid rgb(248, 27, 27)',
    boxShadow: '0 0 16px rgba(248, 27, 27, 0.8), 0 0 24px rgba(248, 27, 27, 0.4)',
    zIndex: 10,
  },
  nameMatchPowerSlot: {
    animation: `${pulseGreen} 1.2s infinite`,
    border: '2px solid #80FF00',
    boxShadow: '0 0 16px rgba(128, 255, 0, 0.8), 0 0 24px rgba(128, 255, 0, 0.4)',
    zIndex: 10,
  },
  defenseItemSlot: {
    border: '2px solid rgba(128, 255, 0, 0.4)',
    boxShadow: '0 0 6px rgba(128, 255, 0, 0.2)',
  },
  starOverlay: {
    position: 'absolute',
    top: -2,
    left: -2,
    zIndex: 10,
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: '50%',
    padding: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  silverStarOverlay: {
    background: 'rgba(0, 0, 0, 0.9)',
  },
  goldStarOverlay: {
    background: 'rgba(0, 0, 0, 0.9)',
  },
  starIcon: {
    width: 10,
    height: 10,
  },
  silverStarIcon: {
    color: '#E5E5E5',
    filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.8))',
  },
  goldStarIcon: {
    color: '#FFD700',
    filter: 'drop-shadow(0 0 2px rgba(255, 215, 0, 0.8))',
  },
  nameMatchGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '120%',
    height: '120%',
    filter: 'blur(12px)',
    opacity: 0.6,
    zIndex: 1,
    animation: 'pulse 1.2s infinite',
  },
  nameMatchDangerGlow: {
    backgroundColor: 'rgba(248, 27, 27, 0.8)',
  },
  nameMatchPowerGlow: {
    backgroundColor: 'rgba(128, 255, 0, 0.8)',
  },
  emptySlotTooltipHeader: {
    marginBottom: '8px',
  },
  emptySlotTooltipTitle: {
    color: '#d0c98d',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  emptySlotTooltipDivider: {
    height: '1px',
    backgroundColor: '#d7c529',
    opacity: 0.2,
    margin: '8px 0',
  },
  emptySlotTooltipDamageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderColor: 'rgba(255, 0, 0, 0.2)',
  },
  emptySlotTooltipDamageText: {
    color: '#ff4444',
    fontSize: '0.85rem',
  },
  damageIndicator: {
    position: 'absolute',
    right: '2px',
    minWidth: '15px',
    minHeight: '15px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(2px)',
    padding: '0 1px',
  },
  damageIndicatorTop: {
    top: '2px',
  },
  damageIndicatorBottom: {
    bottom: '2px',
  },
  damageIndicatorRed: {
    background: 'rgba(200, 60, 60, 0.55)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 0 4px rgba(200, 60, 60, 0.25)',
  },
  damageIndicatorGreen: {
    background: 'rgba(70, 200, 110, 0.55)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 0 4px rgba(70, 200, 110, 0.25)',
  },
  damageIndicatorCritRed: {
    background: 'rgba(220, 40, 40, 0.7)',
    border: '1px solid rgba(255, 210, 210, 0.16)',
    boxShadow: '0 0 6px rgba(220, 40, 40, 0.35)',
  },
  damageIndicatorCritGreen: {
    background: 'rgba(60, 190, 130, 0.7)',
    border: '1px solid rgba(210, 255, 225, 0.16)',
    boxShadow: '0 0 6px rgba(60, 190, 130, 0.35)',
  },
  damageIndicatorText: {
    fontSize: '0.68rem',
    fontWeight: 600,
    fontFamily: 'Cinzel, Georgia, serif',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
    lineHeight: 1,
    letterSpacing: '0.4px',
  },
  damageIndicatorTextRed: {
    color: '#FFFFFF',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.9), 0 0 4px rgba(255, 255, 255, 0.3)',
  },
  itemLevelBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    padding: '1px 4px',
    borderRadius: '4px',
    background: 'rgba(0, 0, 0, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    zIndex: 12,
    minWidth: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLevelText: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#f3f3f3',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    textShadow: '0 1px 2px rgba(0,0,0,0.8)',
  },
  damageIndicatorTextGreen: {
    color: '#FFFFFF',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.9), 0 0 4px rgba(255, 255, 255, 0.3)',
  },
};
