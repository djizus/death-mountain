import { useGameStore } from '@/stores/gameStore';
import { useMarketStore } from '@/stores/marketStore';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Tooltip } from '@mui/material';
import { useEffect } from 'react';

interface BottomNavProps {
  activeNavItem: 'GAME' | 'CHARACTER' | 'MARKET' | 'SETTINGS';
  setActiveNavItem: (item: 'GAME' | 'CHARACTER' | 'MARKET' | 'SETTINGS') => void;
  isExploring?: boolean;
  isBattling?: boolean;
}

export default function BottomNav({ activeNavItem, setActiveNavItem, isExploring = false, isBattling = false }: BottomNavProps) {
  const { adventurer, marketItemIds, newMarket, setNewMarket, setNewInventoryItems, spectating } = useGameStore();
  const { cart, clearCart } = useMarketStore();

  useEffect(() => {
    if (cart.items.length > 0) {
      setNewInventoryItems(cart.items.map(item => item.id));
    }
    clearCart();
  }, [marketItemIds, adventurer?.gold, adventurer?.stats?.charisma]);

  const isActionInProgress = isExploring || isBattling;
  const isMarketAvailable = adventurer?.beast_health === 0 && !isActionInProgress;
  const actionInProgressTooltipText = isBattling ? 'Not available during battle action' : 'Not available while exploring';
  const marketTooltipText = isActionInProgress ? actionInProgressTooltipText : (adventurer?.beast_health! > 0 ? 'Not available during battle' : '');

  const navItems = [
    {
      key: 'GAME',
      icon: <img src={'/images/mobile/adventurer.png?v=2'} alt="Game" style={{ height: 32 }} />,
      onClick: () => setActiveNavItem('GAME'),
      active: activeNavItem === 'GAME',
      disabled: isActionInProgress,
      tooltip: isActionInProgress ? actionInProgressTooltipText : ''
    },
    {
      key: 'CHARACTER',
      icon: <img src={'/images/inventory.png'} alt="Inventory" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', filter: 'hue-rotate(40deg) saturate(1.5) brightness(1.15) contrast(1.2)' }} />,
      onClick: () => setActiveNavItem('CHARACTER'),
      active: activeNavItem === 'CHARACTER',
      disabled: isActionInProgress,
      tooltip: isActionInProgress ? actionInProgressTooltipText : ''
    },
    {
      key: 'MARKET',
      icon: <img src={'/images/mobile/market.png'} alt="Market" style={{ height: 32 }} />,
      onClick: () => { setActiveNavItem('MARKET'); setNewMarket(false); },
      active: activeNavItem === 'MARKET',
      hasNew: newMarket,
      disabled: !isMarketAvailable,
      tooltip: marketTooltipText
    },
    {
      key: 'SETTINGS',
      icon: <SettingsIcon sx={{
        height: 32,
        width: 32,
        color: 'rgba(128, 255, 0, 1)'
      }} />,
      onClick: () => setActiveNavItem('SETTINGS'),
      active: activeNavItem === 'SETTINGS',
      disabled: isActionInProgress,
      tooltip: isActionInProgress ? actionInProgressTooltipText : ''
    }
  ];

  return (
    <>
      <Box sx={styles.navContainer}>
        <Box sx={styles.mainNavItems}>
          {navItems.map((item) => {
            return item.tooltip ? (
              <Box key={item.key} sx={{ position: 'relative' }}>
                <Tooltip
                  title={item.tooltip}
                >
                  <Box
                    sx={{
                      ...styles.navItem,
                      opacity: item.disabled ? 0.3 : item.active ? 1 : 0.7,
                      cursor: item.disabled ? 'default' : 'pointer',
                      pointerEvents: 'auto',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent',
                      '&:hover': item.disabled ? {} : {
                        opacity: 1,
                        transform: 'translateY(-2px)'
                      }
                    }}
                    onClick={item.disabled ? undefined : item.onClick}
                  >
                    <Box
                      sx={{
                        ...styles.navIcon,
                        backgroundColor: item.active ? 'rgba(128, 255, 0, 0.1)' : 'transparent',
                        border: `1px solid ${item.active ? 'rgba(128, 255, 0, 0.2)' : 'rgba(128, 255, 0, 0.1)'}`,
                        boxShadow: item.active ? '0 0 10px rgba(128, 255, 0, 0.2)' : 'none',
                        ...(item.key === 'MARKET' && item.hasNew ? styles.marketPulse : {}),
                        '&:hover': item.disabled ? {} : {
                          backgroundColor: 'rgba(128, 255, 0, 0.15)',
                          border: '1px solid rgba(128, 255, 0, 0.3)',
                          boxShadow: '0 0 15px rgba(128, 255, 0, 0.3)'
                        }
                      }}
                    >
                      {item.icon}
                      {item.key === 'MARKET' && item.hasNew && adventurer?.stat_upgrades_available! === 0 && (
                        <Box sx={styles.newIndicator}>!</Box>
                      )}
                    </Box>
                  </Box>
                </Tooltip>
              </Box>
            ) : (
              <Box
                key={item.key}
                sx={{
                  ...styles.navItem,
                  opacity: item.disabled ? 0.3 : item.active ? 1 : 0.7,
                  cursor: item.disabled ? 'default' : 'pointer',
                  pointerEvents: 'auto',
                  '&:hover': item.disabled ? {} : {
                    opacity: 1,
                    transform: 'translateY(-2px)'
                  }
                }}
                onClick={item.disabled ? undefined : item.onClick}
              >
                <Box
                  sx={{
                    ...styles.navIcon,
                    backgroundColor: item.active ? 'rgba(128, 255, 0, 0.1)' : 'transparent',
                    border: `1px solid ${item.active ? 'rgba(128, 255, 0, 0.2)' : 'rgba(128, 255, 0, 0.1)'}`,
                    boxShadow: item.active ? '0 0 10px rgba(128, 255, 0, 0.2)' : 'none',
                    ...(item.key === 'MARKET' && item.hasNew ? styles.marketPulse : {}),
                    '&:hover': item.disabled ? {} : {
                      backgroundColor: 'rgba(128, 255, 0, 0.15)',
                      border: '1px solid rgba(128, 255, 0, 0.3)',
                      boxShadow: '0 0 15px rgba(128, 255, 0, 0.3)'
                    }
                  }}
                >
                  {item.icon}
                  {item.key === 'MARKET' && item.hasNew && (
                    <Box sx={styles.newIndicator}>!</Box>
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    </>
  );
}

const styles = {
  navContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: '64px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxSizing: 'border-box',
    zIndex: 1000,
  },
  mainNavItems: {
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
    maxWidth: '400px',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    pb: 0.5,
    cursor: 'pointer',
    opacity: 0.7,
    transition: 'all 0.2s ease',
    position: 'relative',
    '&:hover': {
      opacity: 1,
      transform: 'translateY(-2px)'
    }
  },
  navIcon: {
    width: '42px',
    height: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: 'rgba(128, 255, 0, 0.15)',
      border: '1px solid rgba(128, 255, 0, 0.3)',
      boxShadow: '0 0 15px rgba(128, 255, 0, 0.3)'
    }
  },
  newIndicator: {
    position: 'absolute',
    top: 6,
    right: 10,
    width: 14,
    height: 14,
    background: 'radial-gradient(circle, #80FF00 60%, #2d3c00 100%)',
    borderRadius: '50%',
    border: '2px solid #222',
    boxShadow: '0 0 8px #80FF00',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: '#222',
    fontWeight: 'bold',
    zIndex: 2
  },
  marketPulse: {
    animation: 'marketPulse 1.5s ease-in-out infinite',
    boxShadow: '0 0 16px rgba(128, 255, 0, 0.45)',
    '@keyframes marketPulse': {
      '0%': {
        transform: 'scale(1)',
        boxShadow: '0 0 12px rgba(128, 255, 0, 0.3)'
      },
      '50%': {
        transform: 'scale(1.08)',
        boxShadow: '0 0 22px rgba(128, 255, 0, 0.6)'
      },
      '100%': {
        transform: 'scale(1)',
        boxShadow: '0 0 12px rgba(128, 255, 0, 0.3)'
      }
    }
  }
};
