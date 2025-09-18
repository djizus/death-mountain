import {
  getArmorType, getArmorTypeStrength, getArmorTypeWeakness,
  getAttackType, getWeaponTypeStrength, getWeaponTypeWeakness, getBeastTier
} from '@/utils/beast';
import { typeIcons, ItemUtils, Tier } from '@/utils/loot';
import { Box, Typography, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

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
      {/* Header with close button */}
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
          <Box sx={{
            ...styles.tierBox,
            backgroundColor: `${ItemUtils.getTierColor(beastTier as Tier)}0D`, // 0D = ~5% alpha
            border: `1px solid ${ItemUtils.getTierColor(beastTier as Tier)}`,
          }}>
            <Typography sx={{...styles.infoLabel, color: ItemUtils.getTierColor(beastTier as Tier) }}>Tier</Typography>
            <Typography sx={{ ...styles.infoValue, color: ItemUtils.getTierColor(beastTier as Tier) }}>T{beastTier}</Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={styles.closeButton}
          size="small"
        >
          <CloseIcon sx={styles.closeIcon} />
        </IconButton>
      </Box>

      <Box sx={styles.divider} />

      {/* Content with two columns */}
      <Box sx={styles.contentContainer}>
        {/* Left Column - Weapon */}
        <Box sx={styles.column}>
          <Box sx={styles.sectionHeader}>
            <Box sx={styles.typeRow}>
              <Box
                component="img"
                src={typeIcons[attackType as keyof typeof typeIcons]}
                alt={attackType}
                sx={styles.typeIcon}
              />
              <Typography sx={styles.typeText}>{attackType} Attack</Typography>
            </Box>
          </Box>

          <Box sx={styles.strengthWeaknessContainer}>
            <Box sx={styles.strengthWeaknessRow}>
              <Typography sx={styles.label}>Strong Against:</Typography>
              <Box sx={styles.typeRow}>
                <Box
                  component="img"
                  src={typeIcons[getWeaponTypeStrength(attackType) as keyof typeof typeIcons]}
                  alt={'icon'}
                  sx={styles.typeIcon}
                />
                <Typography sx={styles.typeText}>
                  {getWeaponTypeStrength(attackType)} Armor
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
                  alt={'icon'}
                  sx={styles.typeIcon}
                />
                <Typography sx={styles.typeText}>
                  {getWeaponTypeWeakness(attackType)} Armor
                </Typography>
                <Typography sx={styles.percentage}>50% DMG</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Right Column - Armor */}
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
                  {getArmorTypeStrength(armorType)} Weapons
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
                  {getArmorTypeWeakness(armorType)} Weapons
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
    backgroundColor: 'rgba(128, 255, 0, 0.05)',
    border: '1px solid rgba(128, 255, 0, 0.1)',
    borderRadius: '10px',
    padding: '12px 16px',
    width: 'calc(100% - 32px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.2rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    color: '#80FF00',
    textShadow: '0 0 10px rgba(128, 255, 0, 0.3)',
  },
  closeButton: {
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    border: '1px solid rgba(128, 255, 0, 0.2)',
    borderRadius: '4px',
    width: '28px',
    height: '28px',
    padding: '4px',
    marginLeft: 'auto',
    '&:hover': {
      backgroundColor: 'rgba(128, 255, 0, 0.15)',
      border: '1px solid rgba(128, 255, 0, 0.3)',
    },
  },
  closeIcon: {
    color: '#80FF00',
    fontSize: '16px',
  },
  divider: {
    height: '1px',
    backgroundColor: 'rgba(128, 255, 0, 0.1)',
    margin: '0 0 8px 0',
  },
  contentContainer: {
    display: 'flex',
    gap: '16px',
    flexDirection: 'row',
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionHeader: {
    marginBottom: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  infoBoxes: {
    display: 'flex',
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
    minWidth: '40px',
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
    minWidth: '40px',
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
    minWidth: '50px',
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
  typeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 6px',
    background: 'rgba(128, 255, 0, 0.1)',
    borderRadius: '4px',
    border: '1px solid rgba(128, 255, 0, 0.2)',
  },
  typeIcon: {
    width: '16px',
    height: '16px',
    filter: 'invert(1) sepia(1) saturate(3000%) hue-rotate(50deg) brightness(1.1)',
  },
  typeText: {
    color: '#80FF00',
    fontSize: '0.8rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
  },
  strengthWeaknessContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  strengthWeaknessRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    color: 'rgba(128, 255, 0, 0.7)',
    fontSize: '0.7rem',
    fontFamily: 'VT323, monospace',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    lineHeight: '1',
  },
  percentage: {
    color: '#80FF00',
    fontSize: '0.8rem',
    fontFamily: 'VT323, monospace',
    fontWeight: 'bold',
    marginLeft: 'auto',
    borderLeft: '1px solid rgba(128, 255, 0, 0.2)',
    minWidth: '50px',
    textAlign: 'right',
  },
};
