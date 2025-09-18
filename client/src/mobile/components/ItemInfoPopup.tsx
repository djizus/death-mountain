import { useGameStore } from '@/stores/gameStore';
import { Item } from '@/types/game';
import { calculateAttackDamage, calculateBeastDamage, calculateLevel, calculateNextLevelXP, calculateProgress, calculateCombatStats } from '@/utils/game';
import { ItemType, ItemUtils, Tier, typeIcons } from '@/utils/loot';
import { Box, LinearProgress, Typography, Tooltip, keyframes } from '@mui/material';
import ItemTooltip from './ItemTooltip';

interface ItemInfoPopupProps {
  item: Item;
  itemSpecialsSeed: number;
  onClose: () => void;
  onItemEquipped?: (newItem: Item) => void;
}

export default function ItemInfoPopup({ item, itemSpecialsSeed, onClose, onItemEquipped }: ItemInfoPopupProps) {
  const { adventurer, beast, bag, equipItem } = useGameStore();
  const level = calculateLevel(item.xp);
  const tier = ItemUtils.getItemTier(item.id);
  const type = ItemUtils.getItemType(item.id);
  const metadata = ItemUtils.getMetadata(item.id);
  const xpToNextLevel = calculateNextLevelXP(level, true);
  const specials = ItemUtils.getSpecials(item.id, level, itemSpecialsSeed);
  const specialName = specials.suffix ? `"${specials.prefix} ${specials.suffix}"` : null;
  const tierColor = ItemUtils.getTierColor(tier as Tier);

  // Calculate what specials would be unlocked at level 15 if itemSpecialsSeed is not 0
  const futureSpecials = itemSpecialsSeed !== 0 && level < 15 ? ItemUtils.getSpecials(item.id, 15, itemSpecialsSeed) : null;

  // Calculate damage if there's a beast and this is an armor or weapon item
  let damage = null;
  let damageTaken = null;
  let isNameMatch = false;

  if (beast) {
    isNameMatch = ItemUtils.isNameMatch(item.id, level, itemSpecialsSeed, beast);

    if (['Head', 'Chest', 'Foot', 'Hand', 'Waist'].includes(ItemUtils.getItemSlot(item.id))) {
      damageTaken = calculateBeastDamage(beast, adventurer!, item);
    } else if (ItemUtils.isWeapon(item.id)) {
      damage = calculateAttackDamage(item, adventurer!, beast);
    }
  }

  // Calculate combat stats and best items (same as BeastScreen)
  const combatStats = beast ? calculateCombatStats(adventurer!, bag, beast) : null;
  const bestItemIds = combatStats?.bestItems.map((item: Item) => item.id) || [];

  // Get the slot of the current item
  const currentItemSlot = ItemUtils.getItemSlot(item.id);
  
  // Determine if this is a weapon or armor item
  const isWeapon = ItemUtils.isWeapon(item.id);
  const isArmor = ['Head', 'Chest', 'Foot', 'Hand', 'Waist'].includes(currentItemSlot);
  const isNecklace = ItemUtils.isNecklace(item.id);
  const isRing = ItemUtils.isRing(item.id);
  
  const itemType = ItemUtils.getItemType(item.id);
  const attackType = isWeapon ? itemType : 'None';
  const armorType = isArmor ? itemType : 'None';

  // Sorting function for inventory items (same as CharacterScreen)
  const sortInventoryItems = (items: Item[]): Item[] => {
    return [...items].sort((a, b) => {      
      const getMaterialPriority = (itemId: number): number => {
        const itemType = ItemUtils.getItemType(itemId);
        switch (itemType) {
          case 'Cloth':
          case 'Magic':
            return 1;
          case 'Hide':
          case 'Blade':
            return 2;
          case 'Metal':
          case 'Bludgeon':
            return 3;
          default:
            return 4;
        }
      };
      
      const materialA = getMaterialPriority(a.id);
      const materialB = getMaterialPriority(b.id);
      
      if (materialA !== materialB) {
        return materialA - materialB;
      }
      
      // Then sort by tier (1-5)
      const tierA = ItemUtils.getItemTier(a.id);
      const tierB = ItemUtils.getItemTier(b.id);
      
      if (tierA !== tierB) {
        return tierA - tierB;
      }
      
      // Finally sort by item ID for consistent ordering
      return a.id - b.id;
    });
  };

  // Get available items from bag and sort them
  const availableItems = sortInventoryItems(
    bag.filter(bagItem => 
      ItemUtils.getItemSlot(bagItem.id).toLowerCase() === currentItemSlot.toLowerCase()
    )
  );

  const getOffsetY = (isWeapon: boolean, isNecklaseOrRing: boolean, isNameMatch: boolean, level: number, specialSeed: number) => {
    let offset = 240;

    if (isWeapon) {
      offset += 40;
    }

    if (isNameMatch) {
      offset += 48;
    }

    if (level >= 15 || (specialSeed !== 0)) {
      offset += 30;
    }

    if (isNecklaseOrRing) {
      offset += 6;
    }

    return offset;
  }

  const handleEquipItem = (itemToEquip: Item) => {
    equipItem(itemToEquip);
    if (onItemEquipped) {
      onItemEquipped(itemToEquip);
    }
  };

  return (
    <Box sx={styles.popupContainer}>
      {/* Header */}
      <Box sx={styles.header}>
        <Box sx={styles.headerLeft}>
          {(specials.special1 || futureSpecials) && (
            <Box sx={styles.headerTopRow}>
              {specialName && (
                <Typography sx={styles.specialName}>
                  {specialName}
                </Typography>
              )}
            </Box>
          )}
          <Box sx={styles.headerBottomRow}>
            <Typography sx={styles.itemName}>
              {metadata.name}
            </Typography>
          </Box>
        </Box>
        {(specials.special1 || futureSpecials) && (
          <Box sx={styles.headerRight}>
            <Box sx={styles.headerTopRow}>
              {(futureSpecials && futureSpecials.special1) ? (
                <>
                  <Box sx={styles.futureSpecialContainer}>
                    <Typography sx={styles.futureSpecialLabel}>
                      Unlocks At 15
                    </Typography>
                  </Box>
                </>
              ) : specials.special1 && (
                <Typography variant="caption" sx={styles.special}>
                  {specials.special1}
                </Typography>
              )}
            </Box>
            <Box sx={styles.headerBottomRow}>
              {(futureSpecials && futureSpecials.special1) ? (
                <>
                  <Box sx={styles.futureSpecialContent}>
                    <Typography sx={styles.futureSpecial}>
                      {futureSpecials.special1}
                    </Typography>

                    <Typography sx={styles.futureSpecial}>
                      {ItemUtils.getStatBonus(futureSpecials.special1)}
                    </Typography>
                  </Box>
                </>
              ) : specials.special1 && (
                <Typography variant="caption" sx={styles.special}>
                  {ItemUtils.getStatBonus(specials.special1)}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={styles.divider} />

      {/* Content with two columns */}
      <Box sx={styles.contentContainer}>
        {/* Left Column - Item Info */}
        <Box sx={styles.leftColumn}>
          <Box sx={{...styles.statsContainer, flexDirection: isWeapon ? 'row' : 'column'}}>
            <Box sx={{...styles.infoBoxes, flexDirection: isWeapon ? 'column' : 'row'}}>
              
              <Box sx={styles.infoRow}>
                <Box sx={styles.typeContainer}>
                  {isWeapon && (
                    <Box
                      component="img"
                      src={typeIcons[attackType as keyof typeof typeIcons]}
                      sx={styles.typeIcon}
                    />
                  )}
                  {isArmor && (
                    <Box
                      component="img"
                      src={typeIcons[armorType as keyof typeof typeIcons]}
                      sx={styles.typeIcon}
                    />
                  )}
                  {isNecklace && (
                    <Box
                      component="img"
                      src={typeIcons['Necklace' as keyof typeof typeIcons]}
                      sx={styles.typeIcon}
                    />
                  )}
                  {isRing && (
                    <Box
                      component="img"
                      src={typeIcons['Ring' as keyof typeof typeIcons]}
                      sx={styles.typeIcon}
                    />
                  )}
                </Box>
                <Box sx={styles.statBox}>
                  <Typography sx={styles.statLabel}>Power</Typography>
                  <Typography sx={styles.statValue}>{level * (6 - tier)}</Typography>
                </Box>
              </Box>

              <Box sx={styles.infoRow}>
                <Box sx={styles.levelBox}>
                  <Typography sx={styles.levelLabel}>Level</Typography>
                  <Typography sx={styles.levelValue}>{level}</Typography>
                </Box>
                <Box sx={{
                  ...styles.tierBox,
                  backgroundColor: `${tierColor}0D`, // 0D = ~5% alpha
                  border: `1px solid ${tierColor}0D`,
                }}>
                  <Typography sx={{...styles.infoLabel, color: tierColor }}>Tier</Typography>
                  <Typography sx={{ ...styles.infoValue, color: tierColor }}>T{tier}</Typography>
                </Box>
              </Box>
            </Box>

            {(damage || damageTaken) && (
              <Box sx={{
                ...styles.damageContainer,
                ...(damageTaken && {
                  height: '31px',
                  boxSizing: 'border-box',
                }),
              }}>
                <Box sx={styles.damageValue}>
                  {damage && (
                    <Box>
                      <Box sx={styles.damageRow}>
                        <Typography sx={styles.damageLabel}>BASE DMG:</Typography>
                        <Typography sx={styles.damageValue}>{damage.baseDamage}</Typography>
                      </Box>
                      <Box sx={styles.damageRow}>
                        <Typography sx={styles.damageLabel}>CRIT DMG:</Typography>
                        <Typography sx={styles.damageValue}>{damage.criticalDamage}</Typography>
                      </Box>
                      <Box sx={styles.damageRow}>
                        <Typography sx={styles.damageLabel}>CRIT%:</Typography>
                        <Typography sx={styles.damageValue}>{adventurer!.stats.luck}%</Typography>
                      </Box>
                    </Box>
                  )}
                  {damageTaken && `-${damageTaken} health when hit`}
                </Box>
              </Box>
            )}
          </Box>

          <Box sx={styles.xpContainer}>
            <Box sx={styles.xpHeader}>
              <Typography variant="caption" sx={styles.xpLabel}>XP Progress</Typography>
              <Typography variant="caption" sx={styles.xpValue}>{item.xp}/{xpToNextLevel}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={calculateProgress(item.xp, true)}
              sx={styles.xpBar}
            />
          </Box>

          {isNameMatch && (
            <>
              <Box sx={{
                ...styles.nameMatchContainer,
                border: ItemUtils.isWeapon(item.id)
                  ? '1px solid rgba(0, 255, 0, 0.6)'
                  : '1px solid rgba(255, 0, 0, 0.6)',
                backgroundColor: ItemUtils.isWeapon(item.id)
                  ? 'rgba(0, 255, 0, 0.1)'
                  : 'rgba(255, 0, 0, 0.1)',
              }}>
                <Typography sx={{
                  ...styles.nameMatchWarning,
                  color: ItemUtils.isWeapon(item.id) ? '#00FF00' : '#FF4444',
                }}>
                  Name matches beast!
                </Typography>
              </Box>
            </>
          )}

          {(type === ItemType.Necklace || type === ItemType.Ring) &&
            <>
              <Box sx={styles.divider} />
              <Box sx={styles.jewelryContainer}>
                <Typography sx={styles.jewelryEffect}>
                  {ItemUtils.getJewelryEffect(item.id)}
                </Typography>
              </Box>
            </>
          }
        </Box>

        {/* Right Column - Available Items */}
        <Box sx={styles.rightColumn}>
          <Box sx={styles.itemsGrid}>
            {availableItems.map((availableItem, index) => {
              const itemLevel = calculateLevel(availableItem.xp);
              const isNameMatch = ItemUtils.isNameMatch(availableItem.id, itemLevel, adventurer!.item_specials_seed, beast!);
              const isArmorSlot = ['Head', 'Chest', 'Legs', 'Hands', 'Waist'].includes(ItemUtils.getItemSlot(availableItem.id));
              const isWeaponSlot = ItemUtils.getItemSlot(availableItem.id) === 'Weapon';
              const isDefenseItem = bestItemIds.includes(availableItem.id);
              const isNecklaseOrRing = ItemUtils.getItemSlot(availableItem.id) === 'Neck' || ItemUtils.getItemSlot(availableItem.id) === 'Ring';
              const isNameMatchDanger = isNameMatch && isArmorSlot;
              const isNameMatchPower = isNameMatch && isWeaponSlot;
              const offsetX = -160 - (index % 3) * 10; 
              const offsetY = getOffsetY(isWeaponSlot, isNecklaseOrRing, (isNameMatchDanger || isNameMatchPower), itemLevel, adventurer!.item_specials_seed);

              return (
                <Tooltip
                  key={availableItem.id}
                  title={<ItemTooltip itemSpecialsSeed={adventurer!.item_specials_seed} item={availableItem} />}
                  placement="top"
                  slotProps={{
                    popper: {
                      disablePortal: true,
                      modifiers: [
                        { name: 'preventOverflow', enabled: true, options: { rootBoundary: 'viewport' } },
                        { name: 'offset', options: { offset: [offsetX, offsetY] } }
                      ],
                    },
                    tooltip: { sx: { bgcolor: 'transparent', border: 'none' } },
                  }}
                >
                  <Box
                    onClick={() => handleEquipItem(availableItem)}
                    sx={{
                      ...styles.itemSlot,
                      ...(isDefenseItem && styles.strongItemSlot),
                      ...(isNameMatchDanger && styles.nameMatchDangerSlot),
                      ...(isNameMatchPower && styles.nameMatchPowerSlot)
                    }}
                  >
                    <Box sx={styles.itemImageContainer}>
                      <Box
                        sx={[
                          styles.itemGlow,
                          { backgroundColor: ItemUtils.getTierColor(ItemUtils.getItemTier(availableItem.id)) }
                        ]}
                      />
                      <Box
                        component="img"
                        src={ItemUtils.getItemImage(availableItem.id)}
                        alt={ItemUtils.getItemName(availableItem.id)}
                        sx={styles.itemImage}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </Box>
                  </Box>
                </Tooltip>
              );
            })}
            {/* Fill remaining slots with empty slots */}
            {Array.from({ length: Math.max(0, 9 - availableItems.length) }).map((_, index) => (
              <Box key={`empty-${index}`} sx={styles.emptySlot}>
                <Box
                  component="img"
                  src="/images/inventory.png"
                  alt="Empty slot"
                  sx={styles.emptySlotIcon}
                />
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

const pulseRed = keyframes`
  0% {
    box-shadow: 0 0 12px rgba(248, 27, 27, 0.6);
  }
  50% {
    box-shadow: 0 0 20px rgba(248, 27, 27, 0.8);
  }
  100% {
    box-shadow: 0 0 12px rgba(248, 27, 27, 0.6);
  }
`;

const pulseGreen = keyframes`
  0% {
    box-shadow: 0 0 12px rgba(128, 255, 0, 0.6);
  }
  50% {
    box-shadow: 0 0 20px rgba(128, 255, 0, 0.8);
  }
  100% {
    box-shadow: 0 0 12px rgba(128, 255, 0, 0.6);
  }
`;

const styles = {
  popupContainer: {
    backgroundColor: 'rgba(128, 255, 0, 0.05)',
    border: '1px solid rgba(128, 255, 0, 0.1)',
    borderRadius: '10px',
    padding: '12px 16px',
    width: 'calc(100% - 32px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    // justifyContent: 'flex-start',
    // alignItems: 'center',
    // gap: '12px',
    // marginBottom: '8px',
  },
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '50%',
  },
  headerRight: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    width: '50%',
    alignItems: 'flex-end',
  },
  headerTopRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '4px',
    height: '14px',
    alignItems: 'bottom',
  },
  headerBottomRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '4px',
    height: '14px',
    alignItems: 'bottom',
  },
  titleSection: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  specialName: {
    color: '#EDCF33',
    lineHeight: '1.0',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'flex-end',
  },
  itemName: {
    color: '#80FF00',
    lineHeight: '1.0',
    fontFamily: 'VT323, monospace',
    fontSize: '1.0rem',
    fontWeight: 'bold',
    textShadow: '0 0 8px rgba(128, 255, 0, 0.3)',
    display: 'flex',
    alignItems: 'flex-end',
  },
  tier: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
    padding: '2px 6px',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    borderRadius: '4px',
    marginRight: '20px',
  },
  infoBoxes: {
    display: 'flex',
    gap: '6px',
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '6px',
  },
  levelBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    p: '2px 6px',
    background: 'rgba(237, 207, 51, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(237, 207, 51, 0.2)',
    minWidth: '31px',
    gap: '1px',
  },
  tierBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    p: '2px 6px',
    background: 'rgba(128, 255, 0, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(128, 255, 0, 0.2)',
    minWidth: '31px',
    gap: '1px',
  },
  statBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    p: '2px 6px',
    background: 'rgba(128, 255, 0, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(128, 255, 0, 0.2)',
    minWidth: '42px',
    gap: '1px'
  },
  statLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontSize: '0.7rem',
    fontFamily: 'VT323, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    lineHeight: '1',
  },
  statValue: {
    color: '#80FF00',
    fontSize: '0.8rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    lineHeight: '1',
  },
  levelLabel: {
    color: 'rgba(237, 207, 51, 0.7)',
    fontSize: '0.7rem',
    fontFamily: 'VT323, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    lineHeight: '1',
  },
  levelValue: {
    color: '#EDCF33',
    fontSize: '0.8rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    lineHeight: '1',
  },
  infoLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontSize: '0.7rem',
    fontFamily: 'VT323, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    lineHeight: '1',
  },
  infoValue: {
    color: '#80FF00',
    fontSize: '0.8rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    lineHeight: '1',
  },
  divider: {
    height: '1px',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    margin: '8px 0',
  },
  contentContainer: {
    display: 'flex',
    gap: '16px',
    flexDirection: 'row',
  },
  leftColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  verticalDivider: {
    width: '1px',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    margin: '0 8px',
  },
  rightColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  itemsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 36px)',
    gap: '4px',
    maxHeight: '300px',
    overflowY: 'visible',
    overflowX: 'visible',
  },
  itemSlot: {
    aspectRatio: '1',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '3px',
    overflow: 'visible',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    cursor: 'pointer',
    border: '1px solid rgba(128, 255, 0, 0.2)',
    minHeight: '36px',
    '&:hover': {
      transform: 'scale(1.05)',
    },
  },
  strongItemSlot: {
    border: '1px solid #80FF00',
    boxShadow: '0 0 8px rgba(128, 255, 0, 0.3)',
  },
  nameMatchDangerSlot: {
    animation: `${pulseRed} 1.5s infinite`,
    border: '2px solid rgb(248, 27, 27)',
    boxShadow: '0 0 12px rgba(248, 27, 27, 0.6)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(248, 27, 27, 0.1)',
      borderRadius: '3px',
      zIndex: 1,
    }
  },
  nameMatchPowerSlot: {
    animation: `${pulseGreen} 1.5s infinite`,
    border: '2px solid #80FF00',
    boxShadow: '0 0 12px rgba(128, 255, 0, 0.6)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(128, 255, 0, 0.1)',
      borderRadius: '3px',
      zIndex: 1,
    }
  },
  itemImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemGlow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100%',
    height: '100%',
    filter: 'blur(3px)',
    opacity: 0.4,
    zIndex: 1,
  },
  itemImage: {
    width: '80%',
    height: '80%',
    objectFit: 'contain',
    position: 'relative',
    zIndex: 2,
  },
  emptySlot: {
    aspectRatio: '1',
    background: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '3px',
    border: '1px solid rgba(128, 255, 0, 0.1)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '36px',
  },
  emptySlotIcon: {
    width: '20px',
    height: '20px',
    opacity: 0.3,
    filter: 'invert(1) sepia(1) saturate(3000%) hue-rotate(50deg) brightness(1.1)',
  },
  statsContainer: {
    display: 'flex',
    gap: '6px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpContainer: {
    marginBottom: '4px',
  },
  xpHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  xpLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
  },
  xpValue: {
    color: '#80FF00',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
  },
  xpBar: {
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    '& .MuiLinearProgress-bar': {
      backgroundColor: '#80FF00',
      boxShadow: '0 0 8px rgba(128, 255, 0, 0.5)',
    },
  },
  specialContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '4px',
  },
  special: {
    color: '#EDCF33',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '4px',
    lineHeight: '1.0',
  },
  damageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    borderColor: 'rgba(128, 255, 0, 0.2)',
    minWidth: '82px',
  },
  damageRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  damageLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
  },
  damageValue: {
    color: '#80FF00',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
  },
  nameMatchContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '4px',
    border: '1px solid rgba(128, 255, 0, 0.3)',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
  },
  nameMatchWarning: {
    color: '#80FF00',
    fontWeight: '500',
    opacity: 0.8
  },
  futureSpecialContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  futureSpecialLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontSize: '0.8rem',
    fontWeight: '500',
    lineHeight: '1.0',
    opacity: 0.9,
    display: 'flex',
    alignItems: 'flex-end',
  },
  futureSpecialContent: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '8px',
  },
  futureSpecial: {
    color: '#80FF00',
    lineHeight: '1.0',
    fontSize: '0.8rem',
    opacity: 0.8,
    display: 'flex',
    alignItems: 'flex-end',
  },
  typeContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '2px 6px',
    background: 'rgba(128, 255, 0, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(128, 255, 0, 0.2)',
    minWidth: '20px',
  },
  typeIcon: {
    width: '16px',
    height: '16px',
    filter: 'invert(1) sepia(1) saturate(3000%) hue-rotate(50deg) brightness(1.1)',
  },
  jewelryContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  jewelryLabel: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontFamily: 'VT323, monospace',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  jewelryEffect: {
    color: '#80FF00',
    fontFamily: 'VT323, monospace',
    fontSize: '0.8rem',
    lineHeight: '1.4',
  },
};
