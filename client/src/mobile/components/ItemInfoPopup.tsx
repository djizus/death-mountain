import { useGameStore } from "@/stores/gameStore";
import { Item } from "@/types/game";
import {
  calculateAttackDamage,
  calculateBeastDamage,
  calculateLevel,
  calculateNextLevelXP,
  calculateProgress,
  calculateCombatStats,
} from "@/utils/game";
import { ItemType, ItemUtils, Tier, typeIcons } from "@/utils/loot";
import { Box, LinearProgress, Typography, Tooltip, keyframes } from "@mui/material";
import ItemTooltip from "./ItemTooltip";

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

  const futureSpecials = itemSpecialsSeed !== 0 && level < 15 ? ItemUtils.getSpecials(item.id, 15, itemSpecialsSeed) : null;

  let damage = null as ReturnType<typeof calculateAttackDamage> | null;
  let damageTaken = null as number | null;
  let isNameMatch = false;

  if (beast) {
    isNameMatch = ItemUtils.isNameMatch(item.id, level, itemSpecialsSeed, beast);

    if (["Head", "Chest", "Foot", "Hand", "Waist"].includes(ItemUtils.getItemSlot(item.id))) {
      damageTaken = calculateBeastDamage(beast, adventurer!, item).baseDamage;
    } else if (ItemUtils.isWeapon(item.id)) {
      damage = calculateAttackDamage(item, adventurer!, beast);
    }
  }

  const combatStats = beast ? calculateCombatStats(adventurer!, bag, beast) : null;
  const bestItemIds = combatStats?.bestItems.map((availableItem: Item) => availableItem.id) || [];

  const currentItemSlot = ItemUtils.getItemSlot(item.id);

  const sortInventoryItems = (items: Item[]): Item[] => {
    return [...items].sort((a, b) => {
      const getMaterialPriority = (itemId: number): number => {
        const itemType = ItemUtils.getItemType(itemId);
        switch (itemType) {
          case "Cloth":
          case "Magic":
            return 1;
          case "Hide":
          case "Blade":
            return 2;
          case "Metal":
          case "Bludgeon":
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

      const tierA = ItemUtils.getItemTier(a.id);
      const tierB = ItemUtils.getItemTier(b.id);

      if (tierA !== tierB) {
        return tierA - tierB;
      }

      return a.id - b.id;
    });
  };

  const availableItems = sortInventoryItems(
    bag.filter((bagItem) => ItemUtils.getItemSlot(bagItem.id).toLowerCase() === currentItemSlot.toLowerCase()),
  );

  const getOffsetY = (
    isWeapon: boolean,
    isNecklaceOrRing: boolean,
    isNameMatchItem: boolean,
    levelValue: number,
    specialSeed: number,
  ) => {
    let offset = 240;

    if (isWeapon) {
      offset += 40;
    }

    if (isNameMatchItem) {
      offset += 48;
    }

    if (levelValue >= 15 || specialSeed !== 0) {
      offset += 30;
    }

    if (isNecklaceOrRing) {
      offset += 6;
    }

    return offset;
  };

  const handleEquipItem = (itemToEquip: Item) => {
    equipItem(itemToEquip);
    if (onItemEquipped) {
      onItemEquipped(itemToEquip);
    }
  };

  return (
    <Box sx={styles.popupContainer}>
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
              {futureSpecials && futureSpecials.special1 ? (
                <Box sx={styles.futureSpecialContainer}>
                  <Typography sx={styles.futureSpecialLabel}>
                    Unlocks At 15
                  </Typography>
                </Box>
              ) : specials.special1 ? (
                <Typography variant="caption" sx={styles.special}>
                  {specials.special1}
                </Typography>
              ) : null}
            </Box>
            <Box sx={styles.headerBottomRow}>
              {futureSpecials && futureSpecials.special1 ? (
                <Box sx={styles.futureSpecialContent}>
                  <Typography sx={styles.futureSpecial}>
                    {futureSpecials.special1}
                  </Typography>

                  <Typography sx={styles.futureSpecial}>
                    {ItemUtils.getStatBonus(futureSpecials.special1)}
                  </Typography>
                </Box>
              ) : specials.special1 ? (
                <Typography variant="caption" sx={styles.special}>
                  {ItemUtils.getStatBonus(specials.special1)}
                </Typography>
              ) : null}
            </Box>
          </Box>
        )}
      </Box>

      <Box sx={styles.divider} />

      <Box sx={styles.contentContainer}>
        <Box sx={styles.leftColumn}>
          <Box sx={{ ...styles.statsContainer, flexDirection: ItemUtils.isWeapon(item.id) ? "row" : "column" }}>
            <Box sx={{ ...styles.infoBoxes, flexDirection: ItemUtils.isWeapon(item.id) ? "column" : "row" }}>
              <Box sx={styles.infoRow}>
                <Box sx={styles.typeContainer}>
                  {ItemUtils.isWeapon(item.id) && (
                    <Box
                      component="img"
                      src={typeIcons[ItemUtils.getItemType(item.id) as keyof typeof typeIcons]}
                      sx={styles.typeIcon}
                    />
                  )}
                  {ItemUtils.getItemSlot(item.id) !== "Weapon" && (
                    <Box
                      component="img"
                      src={typeIcons[ItemUtils.getItemType(item.id) as keyof typeof typeIcons]}
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
                <Box
                  sx={{
                    ...styles.tierBox,
                    backgroundColor: `${tierColor}0D`,
                    border: `1px solid ${tierColor}0D`,
                  }}
                >
                  <Typography sx={{ ...styles.infoLabel, color: tierColor }}>
                    Tier
                  </Typography>
                  <Typography sx={{ ...styles.infoValue, color: tierColor }}>
                    T{tier}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {(damage || damageTaken) && (
              <Box
                sx={{
                  ...styles.damageContainer,
                  ...(damageTaken && {
                    height: "31px",
                    boxSizing: "border-box",
                  }),
                }}
              >
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
                  {typeof damageTaken === "number" && `-${damageTaken} health when hit`}
                </Box>
              </Box>
            )}
          </Box>

          <Box sx={styles.xpContainer}>
            <Box sx={styles.xpHeader}>
              <Typography variant="caption" sx={styles.xpLabel}>
                XP Progress
              </Typography>
              <Typography variant="caption" sx={styles.xpValue}>
                {item.xp}/{xpToNextLevel}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={calculateProgress(item.xp, true)} sx={styles.xpBar} />
          </Box>

          {isNameMatch && (
            <Box
              sx={{
                ...styles.nameMatchContainer,
                border: ItemUtils.isWeapon(item.id)
                  ? "1px solid rgba(0, 255, 0, 0.6)"
                  : "1px solid rgba(255, 0, 0, 0.6)",
                backgroundColor: ItemUtils.isWeapon(item.id)
                  ? "rgba(0, 255, 0, 0.1)"
                  : "rgba(255, 0, 0, 0.1)",
              }}
            >
              <Typography
                sx={{
                  ...styles.nameMatchWarning,
                  color: ItemUtils.isWeapon(item.id) ? "#00FF00" : "#FF4444",
                }}
              >
                Name matches beast!
              </Typography>
            </Box>
          )}

          {(type === ItemType.Necklace || type === ItemType.Ring) && (
            <>
              <Box sx={styles.divider} />
              <Box sx={styles.jewelryContainer}>
                <Typography sx={styles.jewelryEffect}>
                  {ItemUtils.getJewelryEffect(item.id)}
                </Typography>
              </Box>
            </>
          )}
        </Box>

        <Box sx={styles.rightColumn}>
          <Box sx={styles.itemsGrid}>
            {availableItems.map((availableItem, index) => {
              const itemLevel = calculateLevel(availableItem.xp);
              const nameMatch = ItemUtils.isNameMatch(
                availableItem.id,
                itemLevel,
                adventurer!.item_specials_seed,
                beast!,
              );
              const isArmorSlot = ["Head", "Chest", "Legs", "Hands", "Waist"].includes(
                ItemUtils.getItemSlot(availableItem.id),
              );
              const isWeaponSlot = ItemUtils.getItemSlot(availableItem.id) === "Weapon";
              const isDefenseItem = bestItemIds.includes(availableItem.id);
              const isNecklaceOrRing =
                ItemUtils.getItemSlot(availableItem.id) === "Neck" ||
                ItemUtils.getItemSlot(availableItem.id) === "Ring";
              const isNameMatchDanger = nameMatch && isArmorSlot;
              const isNameMatchPower = nameMatch && isWeaponSlot;
              const offsetX = -160 - ((index % 3) * 10);
              const offsetY = getOffsetY(
                isWeaponSlot,
                isNecklaceOrRing,
                isNameMatchDanger || isNameMatchPower,
                itemLevel,
                adventurer!.item_specials_seed,
              );

              return (
                <Tooltip
                  key={availableItem.id}
                  title={<ItemTooltip itemSpecialsSeed={adventurer!.item_specials_seed} item={availableItem} />}
                  placement="top"
                  slotProps={{
                    popper: {
                      disablePortal: true,
                      modifiers: [
                        { name: "preventOverflow", enabled: true, options: { rootBoundary: "viewport" } },
                        { name: "offset", options: { offset: [offsetX, offsetY] } },
                      ],
                    },
                    tooltip: { sx: { bgcolor: "transparent", border: "none" } },
                  }}
                >
                  <Box
                    onClick={() => handleEquipItem(availableItem)}
                    sx={{
                      ...styles.itemSlot,
                      ...(isDefenseItem && styles.strongItemSlot),
                      ...(isNameMatchDanger && styles.nameMatchDangerSlot),
                      ...(isNameMatchPower && styles.nameMatchPowerSlot),
                    }}
                  >
                    <Box sx={styles.itemImageContainer}>
                      <Box
                        sx={[
                          styles.itemGlow,
                          { backgroundColor: ItemUtils.getTierColor(ItemUtils.getItemTier(availableItem.id)) },
                        ]}
                      />
                      <Box
                        component="img"
                        src={ItemUtils.getItemImage(availableItem.id)}
                        alt={ItemUtils.getItemName(availableItem.id)}
                        sx={styles.itemImage}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </Box>
                  </Box>
                </Tooltip>
              );
            })}
            {Array.from({ length: Math.max(0, 9 - availableItems.length) }).map((_, index) => (
              <Box key={`empty-${index}`} sx={styles.emptySlot}>
                <Box component="img" src="/images/inventory.png" alt="Empty slot" sx={styles.emptySlotIcon} />
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
    backgroundColor: "rgba(128, 255, 0, 0.05)",
    border: "1px solid rgba(128, 255, 0, 0.1)",
    borderRadius: "10px",
    padding: "12px 16px",
    width: "calc(100% - 32px)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  },
  header: {
    display: "flex",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "50%",
  },
  headerRight: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "50%",
    alignItems: "flex-end",
  },
  headerTopRow: {
    display: "flex",
    flexDirection: "row",
    gap: "4px",
    height: "14px",
    alignItems: "flex-end",
  },
  headerBottomRow: {
    display: "flex",
    flexDirection: "row",
    gap: "4px",
    height: "14px",
    alignItems: "flex-end",
  },
  specialName: {
    color: "#EDCF33",
    lineHeight: "1.0",
    fontFamily: "VT323, monospace",
    fontSize: "0.9rem",
    fontWeight: "bold",
    display: "flex",
    alignItems: "flex-end",
  },
  itemName: {
    color: "#80FF00",
    lineHeight: "1.0",
    fontFamily: "VT323, monospace",
    fontSize: "1.0rem",
    fontWeight: "bold",
    textShadow: "0 0 8px rgba(128, 255, 0, 0.3)",
    display: "flex",
    alignItems: "flex-end",
  },
  infoBoxes: {
    display: "flex",
    gap: "6px",
  },
  infoRow: {
    display: "flex",
    flexDirection: "row",
    gap: "6px",
  },
  levelBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2px 6px",
    background: "rgba(237, 207, 51, 0.1)",
    borderRadius: "4px",
    border: "1px solid rgba(237, 207, 51, 0.2)",
    minWidth: "31px",
    gap: "1px",
  },
  tierBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "2px 6px",
    background: "rgba(128, 255, 0, 0.1)",
    borderRadius: "4px",
    border: "1px solid rgba(128, 255, 0, 0.2)",
    minWidth: "31px",
    gap: "1px",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "2px 6px",
    background: "rgba(128, 255, 0, 0.1)",
    borderRadius: "4px",
    border: "1px solid rgba(128, 255, 0, 0.2)",
    minWidth: "42px",
    gap: "1px",
  },
  statLabel: {
    color: "rgba(128, 255, 0, 0.7)",
    fontSize: "0.7rem",
    fontFamily: "VT323, monospace",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    lineHeight: "1",
  },
  statValue: {
    color: "#80FF00",
    fontSize: "0.8rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
    lineHeight: "1",
  },
  levelLabel: {
    color: "rgba(237, 207, 51, 0.7)",
    fontSize: "0.7rem",
    fontFamily: "VT323, monospace",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    lineHeight: "1",
  },
  levelValue: {
    color: "#EDCF33",
    fontSize: "0.8rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
    lineHeight: "1",
  },
  infoLabel: {
    color: "rgba(128, 255, 0, 0.7)",
    fontSize: "0.7rem",
    fontFamily: "VT323, monospace",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    lineHeight: "1",
  },
  infoValue: {
    color: "#80FF00",
    fontSize: "0.8rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
    lineHeight: "1",
  },
  divider: {
    width: "100%",
    height: "1px",
    backgroundColor: "rgba(128, 255, 0, 0.2)",
    margin: "8px 0",
  },
  contentContainer: {
    display: "flex",
    flexDirection: "row",
    gap: "16px",
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flex: 1,
  },
  rightColumn: {
    width: "45%",
  },
  statsContainer: {
    display: "flex",
    gap: "8px",
    backgroundColor: "rgba(128, 255, 0, 0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(128, 255, 0, 0.1)",
    padding: "12px",
  },
  infoContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  typeContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    backgroundColor: "rgba(128, 255, 0, 0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(128, 255, 0, 0.2)",
  },
  typeIcon: {
    width: "18px",
    height: "18px",
    filter: "invert(1) sepia(1) saturate(3000%) hue-rotate(50deg) brightness(1.1)",
  },
  damageContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "8px",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: "8px",
    border: "1px solid rgba(128, 255, 0, 0.1)",
  },
  damageRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  damageLabel: {
    color: "rgba(128, 255, 0, 0.7)",
    fontFamily: "VT323, monospace",
    fontSize: "0.9rem",
  },
  damageValue: {
    color: "#80FF00",
    fontFamily: "VT323, monospace",
    fontSize: "0.9rem",
  },
  xpContainer: {
    backgroundColor: "rgba(128, 255, 0, 0.05)",
    borderRadius: "8px",
    border: "1px solid rgba(128, 255, 0, 0.1)",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  xpHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpLabel: {
    color: "rgba(128, 255, 0, 0.7)",
    fontFamily: "VT323, monospace",
  },
  xpValue: {
    color: "#80FF00",
    fontFamily: "VT323, monospace",
  },
  xpBar: {
    height: "6px",
    borderRadius: "3px",
    backgroundColor: "rgba(128, 255, 0, 0.1)",
    "& .MuiLinearProgress-bar": {
      backgroundColor: "#80FF00",
    },
  },
  nameMatchContainer: {
    padding: "8px",
    borderRadius: "6px",
    display: "flex",
    justifyContent: "center",
  },
  nameMatchWarning: {
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
    fontSize: "0.9rem",
  },
  jewelryContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px",
    backgroundColor: "rgba(128, 255, 0, 0.1)",
    borderRadius: "8px",
    border: "1px solid rgba(128, 255, 0, 0.2)",
  },
  jewelryEffect: {
    color: "rgba(128, 255, 0, 0.9)",
    fontFamily: "VT323, monospace",
    textAlign: "center",
  },
  itemsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  itemSlot: {
    aspectRatio: "1",
    backgroundColor: "rgba(128, 255, 0, 0.05)",
    borderRadius: "6px",
    border: "1px solid rgba(128, 255, 0, 0.1)",
    padding: "2px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    position: "relative",
    "&:hover": {
      backgroundColor: "rgba(128, 255, 0, 0.1)",
      transform: "translateY(-2px)",
    },
  },
  strongItemSlot: {
    border: "2px solid rgba(128, 255, 0, 0.6)",
    animation: `${pulseGreen} 1.5s infinite`,
  },
  nameMatchDangerSlot: {
    border: "2px solid rgba(255, 68, 68, 0.6)",
    animation: `${pulseRed} 1.5s infinite`,
  },
  nameMatchPowerSlot: {
    border: "2px solid rgba(128, 255, 0, 0.6)",
    animation: `${pulseGreen} 1.5s infinite`,
  },
  itemImageContainer: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  itemGlow: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "100%",
    height: "100%",
    filter: "blur(4px)",
    opacity: 0.4,
  },
  itemImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    position: "relative",
    zIndex: 2,
  },
  emptySlot: {
    aspectRatio: "1",
    backgroundColor: "rgba(128, 255, 0, 0.02)",
    borderRadius: "6px",
    border: "1px dashed rgba(128, 255, 0, 0.1)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  emptySlotIcon: {
    width: "24px",
    height: "24px",
    opacity: 0.3,
    filter: "invert(1) sepia(1) saturate(3000%) hue-rotate(50deg) brightness(1.1)",
  },
  futureSpecialContainer: {
    padding: "2px 4px",
    backgroundColor: "rgba(237, 207, 51, 0.2)",
    borderRadius: "4px",
  },
  futureSpecialLabel: {
    color: "rgba(237, 207, 51, 0.9)",
    fontSize: "0.7rem",
    fontFamily: "VT323, monospace",
  },
  futureSpecialContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  futureSpecial: {
    color: "rgba(237, 207, 51, 0.9)",
    fontSize: "0.75rem",
    fontFamily: "VT323, monospace",
    lineHeight: 1,
  },
  special: {
    color: "rgba(237, 207, 51, 0.9)",
    fontSize: "0.75rem",
    fontFamily: "VT323, monospace",
  },
};
