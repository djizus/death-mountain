import {
  getArmorType,
  getArmorTypeStrength,
  getArmorTypeWeakness,
  getAttackType,
  getWeaponTypeStrength,
  getWeaponTypeWeakness,
  getBeastTier,
} from "@/utils/beast";
import { typeIcons, ItemUtils, Tier } from "@/utils/loot";
import { Box, Typography, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

interface BeastInfoPopupProps {
  beastType: string;
  beastId: number;
  beastLevel: number;
  onClose: () => void;
}

export default function BeastInfoPopup({ beastType, beastId, beastLevel, onClose }: BeastInfoPopupProps) {
  const attackType = getAttackType(beastId);
  const armorType = getArmorType(beastId);
  const beastTier = getBeastTier(beastId);
  const beastPower = Number(beastLevel) * (6 - Number(beastTier));

  return (
    <Box sx={styles.popupContainer}>
      <Box sx={styles.header}>
        <Typography sx={styles.title}>
          {beastType}
        </Typography>
        <Box sx={styles.infoBoxes}>
          <Box sx={styles.statBox}>
            <Typography sx={styles.statLabel}>Power</Typography>
            <Typography sx={styles.statValue}>{beastPower}</Typography>
          </Box>
          <Box sx={styles.levelBox}>
            <Typography sx={styles.levelLabel}>Level</Typography>
            <Typography sx={styles.levelValue}>{beastLevel}</Typography>
          </Box>
          <Box
            sx={{
              ...styles.tierBox,
              backgroundColor: `${ItemUtils.getTierColor(beastTier as Tier)}0D`,
              border: `1px solid ${ItemUtils.getTierColor(beastTier as Tier)}0D`,
            }}
          >
            <Typography sx={{ ...styles.infoLabel, color: ItemUtils.getTierColor(beastTier as Tier) }}>
              Tier
            </Typography>
            <Typography sx={{ ...styles.infoValue, color: ItemUtils.getTierColor(beastTier as Tier) }}>
              T{beastTier}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={styles.closeButton} size="small">
          <CloseIcon sx={styles.closeIcon} />
        </IconButton>
      </Box>

      <Box sx={styles.divider} />

      <Box sx={styles.contentContainer}>
        <Box sx={styles.column}>
          <Box sx={styles.sectionHeader}>
            <Box sx={styles.typeRow}>
              <Box
                component="img"
                src={typeIcons[attackType as keyof typeof typeIcons]}
                alt={attackType}
                sx={styles.typeIcon}
              />
              <Typography sx={styles.typeText}>{attackType} Attacks</Typography>
            </Box>
          </Box>

          <Box sx={styles.strengthWeaknessContainer}>
            <Box sx={styles.strengthWeaknessRow}>
              <Typography sx={styles.label}>Strong Against:</Typography>
              <Box sx={styles.typeRow}>
                <Box
                  component="img"
                  src={typeIcons[getWeaponTypeStrength(attackType) as keyof typeof typeIcons]}
                  alt="icon"
                  sx={styles.typeIcon}
                />
                <Typography sx={styles.typeText}>
                  {getWeaponTypeStrength(attackType)}
                </Typography>
                <Typography sx={styles.percentage}>150% DMG</Typography>
              </Box>
            </Box>

            <Box sx={styles.strengthWeaknessRow}>
              <Typography sx={styles.label}>Weak Against:</Typography>
              <Box sx={styles.typeRow}>
                <Box
                  component="img"
                  src={typeIcons[getWeaponTypeWeakness(attackType) as keyof typeof typeIcons]}
                  alt="icon"
                  sx={styles.typeIcon}
                />
                <Typography sx={styles.typeText}>
                  {getWeaponTypeWeakness(attackType)}
                </Typography>
                <Typography sx={styles.percentage}>50% DMG</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={styles.column}>
          <Box sx={styles.sectionHeader}>
            <Box sx={styles.typeRow}>
              <Box
                component="img"
                src={typeIcons[armorType as keyof typeof typeIcons]}
                alt={armorType}
                sx={styles.typeIcon}
              />
              <Typography sx={styles.typeText}>{armorType} Armor</Typography>
            </Box>
          </Box>

          <Box sx={styles.strengthWeaknessContainer}>
            <Box sx={styles.strengthWeaknessRow}>
              <Typography sx={styles.label}>Strong Against:</Typography>
              <Box sx={styles.typeRow}>
                <Box
                  component="img"
                  src={typeIcons[getArmorTypeStrength(armorType) as keyof typeof typeIcons]}
                  alt={getArmorTypeStrength(armorType)}
                  sx={styles.typeIcon}
                />
                <Typography sx={styles.typeText}>
                  {getArmorTypeStrength(armorType)}
                </Typography>
                <Typography sx={styles.percentage}>50% DMG</Typography>
              </Box>
            </Box>

            <Box sx={styles.strengthWeaknessRow}>
              <Typography sx={styles.label}>Weak Against:</Typography>
              <Box sx={styles.typeRow}>
                <Box
                  component="img"
                  src={typeIcons[getArmorTypeWeakness(armorType) as keyof typeof typeIcons]}
                  alt={getArmorTypeWeakness(armorType)}
                  sx={styles.typeIcon}
                />
                <Typography sx={styles.typeText}>
                  {getArmorTypeWeakness(armorType)}
                </Typography>
                <Typography sx={styles.percentage}>150% DMG</Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

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
    justifyContent: "flex-start",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  title: {
    fontSize: "1.2rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
    color: "#80FF00",
    textShadow: "0 0 10px rgba(128, 255, 0, 0.3)",
  },
  closeButton: {
    backgroundColor: "rgba(128, 255, 0, 0.1)",
    border: "1px solid rgba(128, 255, 0, 0.2)",
    borderRadius: "4px",
    width: "28px",
    height: "28px",
    padding: "4px",
    marginLeft: "auto",
    "&:hover": {
      backgroundColor: "rgba(128, 255, 0, 0.15)",
      border: "1px solid rgba(128, 255, 0, 0.3)",
    },
  },
  closeIcon: {
    color: "#80FF00",
    fontSize: "16px",
  },
  infoBoxes: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    backgroundColor: "rgba(128, 255, 0, 0.1)",
    borderRadius: "6px",
    border: "1px solid rgba(128, 255, 0, 0.2)",
  },
  statLabel: {
    color: "rgba(128, 255, 0, 0.7)",
    fontSize: "0.75rem",
    fontFamily: "VT323, monospace",
  },
  statValue: {
    color: "#80FF00",
    fontSize: "1rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
  },
  levelBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4px 8px",
    backgroundColor: "rgba(237, 207, 51, 0.1)",
    borderRadius: "6px",
    border: "1px solid rgba(237, 207, 51, 0.2)",
  },
  levelLabel: {
    color: "rgba(237, 207, 51, 0.7)",
    fontSize: "0.75rem",
    fontFamily: "VT323, monospace",
  },
  levelValue: {
    color: "#EDCF33",
    fontSize: "1rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
  },
  tierBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "4px 8px",
    borderRadius: "6px",
  },
  infoLabel: {
    color: "rgba(128, 255, 0, 0.7)",
    fontSize: "0.75rem",
    fontFamily: "VT323, monospace",
  },
  infoValue: {
    fontSize: "1rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
  },
  divider: {
    height: "1px",
    backgroundColor: "rgba(128, 255, 0, 0.2)",
    margin: "8px 0",
  },
  contentContainer: {
    display: "flex",
    gap: "12px",
  },
  column: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  typeRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  typeIcon: {
    width: "20px",
    height: "20px",
    filter: "invert(1) sepia(1) saturate(3000%) hue-rotate(50deg) brightness(1.1)",
  },
  typeText: {
    color: "#80FF00",
    fontSize: "0.95rem",
    fontFamily: "VT323, monospace",
  },
  strengthWeaknessContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    backgroundColor: "rgba(128, 255, 0, 0.05)",
    borderRadius: "6px",
    border: "1px solid rgba(128, 255, 0, 0.1)",
    padding: "8px",
  },
  strengthWeaknessRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  label: {
    color: "rgba(128, 255, 0, 0.7)",
    fontSize: "0.75rem",
    fontFamily: "VT323, monospace",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  percentage: {
    color: "#EDCF33",
    fontSize: "0.8rem",
    fontFamily: "VT323, monospace",
    fontWeight: "bold",
  },
};
