import { createOrder, getTreasuryStatus, submitOrderPayment, type OrderResponse, type PayToken, type TreasuryStatus } from "@/api/orders";
import { useController } from "@/contexts/controller";
import { useDungeon } from "@/dojo/useDungeon";
import { NETWORKS } from "@/utils/networkConfig";
import { stringToFelt } from "@/utils/utils";
import CloseIcon from "@mui/icons-material/Close";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import TokenIcon from "@mui/icons-material/Token";
import { Box, Button, IconButton, Menu, MenuItem, Tab, Tabs, Typography } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CallData, cairo } from "starknet";

interface PaymentOptionsModalProps {
  open: boolean;
  onClose: () => void;
}

interface TokenSelectionProps {
  userTokens: any[];
  selectedToken: string;
  tokenQuote: { amount: string; loading: boolean; error?: string };
  onTokenChange: (tokenSymbol: string) => void;
  styles: any;
  onPay: () => void;
  isPaying: boolean;
  hasTreasuryAddress: boolean;
  treasuryStatus: TreasuryStatus | null;
}

// Format amount to significant decimals based on token type
function formatDisplayAmount(amount: string, symbol: string): string {
  if (!amount) return "";
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;

  // Stablecoins: 2 decimals
  if (symbol === "USDC" || symbol === "USDC_E" || symbol === "USDC.e Bridged") {
    return num.toFixed(2);
  }

  // For other tokens, use significant figures
  if (num >= 1000) {
    return num.toFixed(2);
  } else if (num >= 100) {
    return num.toFixed(3);
  } else if (num >= 10) {
    return num.toFixed(4);
  } else if (num >= 1) {
    return num.toFixed(5);
  } else if (num >= 0.01) {
    return num.toFixed(6);
  } else {
    // Very small amounts - show up to 8 decimals, trim trailing zeros
    return num.toFixed(8).replace(/\.?0+$/, "");
  }
}

// Memoized token selection component
const TokenSelectionContent = memo(
  ({
    userTokens,
    selectedToken,
    tokenQuote,
    onTokenChange,
    onPay,
    isPaying,
    hasTreasuryAddress,
    treasuryStatus,
    styles,
  }: TokenSelectionProps) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const selectedTokenData = userTokens.find(
      (t: any) => t.symbol === selectedToken
    );

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
      setAnchorEl(null);
    };

    const handleTokenSelect = (tokenSymbol: string) => {
      onTokenChange(tokenSymbol);
      handleClose();
    };

    const hasEnoughBalance = useMemo(() => {
      if (!selectedTokenData) return false;
      if (!tokenQuote.amount) return false;
      return Number(selectedTokenData.balance) >= Number(tokenQuote.amount);
    }, [selectedTokenData, tokenQuote.amount]);

    const displayAmount = useMemo(() => {
      if (!tokenQuote.amount) return "";
      return formatDisplayAmount(tokenQuote.amount, selectedToken);
    }, [tokenQuote.amount, selectedToken]);

    // Show empty state if no tokens available
    if (userTokens.length === 0) {
      return (
        <Box sx={styles.tabContent}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <TokenIcon sx={{ fontSize: 64, color: "rgba(208, 201, 141, 0.3)" }} />
          </Box>
          <Box sx={{ textAlign: "center", px: 2 }}>
            <Typography sx={{ fontSize: 14, color: "rgba(208, 201, 141, 0.8)", mb: 1 }}>
              No supported tokens found
            </Typography>
            <Typography sx={{ fontSize: 12, color: "rgba(255, 215, 0, 0.6)" }}>
              Add ETH, STRK, LORDS, USDC, or SURVIVOR to your wallet
            </Typography>
          </Box>
        </Box>
      );
    }

    return (
      <Box sx={styles.tabContent}>
        <Box sx={styles.sectionContainer} pb={2} mt={1}>
          <Button
            variant="outlined"
            onClick={handleClick}
            fullWidth
            sx={styles.mobileSelectButton}
          >
            <Box
              sx={{
                fontSize: "0.6rem",
                color: "text.primary",
                marginLeft: "-5px",
                display: "flex",
                alignItems: "center",
              }}
            >
              ▼
            </Box>
            <Box sx={styles.tokenRow}>
              <Box sx={styles.tokenLeft}>
                <Typography sx={styles.tokenName}>
                  {selectedTokenData
                    ? selectedTokenData.symbol
                    : "Select token"}
                </Typography>
              </Box>
              {selectedTokenData && (
                <Typography sx={styles.tokenBalance}>
                  {selectedTokenData.balance}
                </Typography>
              )}
            </Box>
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            slotProps={{
              paper: {
                sx: {
                  mt: 0.5,
                  width: "260px",
                  maxHeight: 300,
                  background: "rgba(24, 40, 24, 1)",
                  border: "1px solid rgba(208, 201, 141, 0.3)",
                  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
                  zIndex: 9999,
                },
              },
            }}
            sx={{
              zIndex: 9999,
            }}
          >
            {userTokens.map((token: any) => (
              <MenuItem
                key={token.symbol}
                onClick={() => handleTokenSelect(token.symbol)}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 1,
                  backgroundColor:
                    token.symbol === selectedToken
                      ? "rgba(208, 201, 141, 0.2)"
                      : "transparent",
                  "&:hover": {
                    backgroundColor:
                      token.symbol === selectedToken
                        ? "rgba(208, 201, 141, 0.3)"
                        : "rgba(208, 201, 141, 0.1)",
                  },
                }}
              >
                <Box sx={styles.tokenRow}>
                  <Box sx={styles.tokenLeft}>
                    <Typography sx={styles.tokenName}>
                      {token.symbol}
                    </Typography>
                  </Box>
                  <Typography sx={styles.tokenBalance}>
                    {token.balance}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>
        </Box>

        <Box sx={styles.costDisplay}>
          <Typography sx={styles.costText}>
            {tokenQuote.loading
              ? "Loading quote..."
              : tokenQuote.error
                ? `Error: ${tokenQuote.error}`
                : displayAmount
                  ? `Cost: ${displayAmount} ${selectedToken}`
                  : "Loading..."}
          </Typography>
        </Box>

        {treasuryStatus && !treasuryStatus.canFulfillOrders && (
          <Box sx={{ px: 2, mt: 1, textAlign: "center" }}>
            <Typography sx={{ fontSize: 12, color: "#ff6b6b" }}>
              Service temporarily unavailable. Please try again later.
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", justifyContent: "center", px: 2, mt: 2 }}>
          <Button
            variant="contained"
            sx={styles.activateButton}
            onClick={onPay}
            fullWidth
            disabled={
              isPaying ||
              tokenQuote.loading ||
              !!tokenQuote.error ||
              !hasEnoughBalance ||
              !hasTreasuryAddress ||
              (treasuryStatus !== null && !treasuryStatus.canFulfillOrders)
            }
          >
            <Typography sx={styles.buttonText}>
              {treasuryStatus && !treasuryStatus.canFulfillOrders
                ? "Unavailable"
                : isPaying
                  ? "Sending..."
                  : hasEnoughBalance
                    ? "Pay & Enter"
                    : "Insufficient Balance"}
            </Typography>
          </Button>
        </Box>
      </Box>
    );
  }
);

// Fiat tab content
const FiatContent = memo(({ styles }: { styles: any }) => (
  <Box sx={styles.tabContent}>
    <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
      <CreditCardIcon sx={{ fontSize: 64, color: "rgba(208, 201, 141, 0.3)" }} />
    </Box>
    <Box sx={{ textAlign: "center", px: 2 }}>
      <Typography sx={{ fontSize: 14, color: "rgba(208, 201, 141, 0.8)", mb: 2 }}>
        Pay with credit card, Apple Pay, or Google Pay
      </Typography>
      <Typography sx={{ fontSize: 12, color: "rgba(255, 215, 0, 0.6)" }}>
        Coming soon
      </Typography>
    </Box>
    <Box sx={{ display: "flex", justifyContent: "center", px: 2, mt: 3 }}>
      <Button
        variant="contained"
        sx={styles.activateButton}
        fullWidth
        disabled
      >
        <Typography sx={styles.buttonText}>Coming Soon</Typography>
      </Button>
    </Box>
  </Box>
));

export default function PaymentOptionsModal({
  open,
  onClose,
}: PaymentOptionsModalProps) {
  const { account, tokenBalances, enterDungeon, address, playerName } =
    useController();

  const navigate = useNavigate();
  const dungeon = useDungeon();

  // Tab state: 0 = Crypto, 1 = Fiat
  const [activeTab, setActiveTab] = useState(0);

  // Get payment tokens from network config
  const paymentTokens = useMemo(() => {
    return NETWORKS.SN_MAIN.paymentTokens || [];
  }, []);

  const userTokens = useMemo(() => {
    return paymentTokens
      .map((token: any) => ({
        symbol: token.name,
        balance: tokenBalances[token.name] || 0,
        address: token.address,
        decimals: token.decimals || 18,
        displayDecimals: token.displayDecimals || 4,
      }))
      .filter(
        (token: any) =>
          Number(token.balance) > 0 &&
          token.address !== dungeon.ticketAddress
      );
  }, [paymentTokens, tokenBalances]);

  const dungeonTicketCount = useMemo(() => {
    const dungeonTicketToken = paymentTokens.find(
      (token: any) => token.address === dungeon.ticketAddress
    );
    return dungeonTicketToken
      ? Number(tokenBalances[dungeonTicketToken.name])
      : 0;
  }, [paymentTokens, tokenBalances]);

  const [selectedToken, setSelectedToken] = useState("");
  const [tokenQuote, setTokenQuote] = useState<{
    amount: string;
    loading: boolean;
    error?: string;
  }>({
    amount: "",
    loading: false,
  });

  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [treasuryStatus, setTreasuryStatus] = useState<TreasuryStatus | null>(null);

  // Fetch treasury status when modal opens
  useEffect(() => {
    if (!open) {
      setTreasuryStatus(null);
      return;
    }

    getTreasuryStatus().then(setTreasuryStatus);
  }, [open]);

  useEffect(() => {
    if (userTokens.length > 0 && !selectedToken) {
      setSelectedToken(userTokens[0].symbol);
    }
  }, [userTokens]);

  const fetchTokenQuote = useCallback(
    async (tokenSymbol: string) => {
      if (!address) {
        setOrder(null);
        setTokenQuote({
          amount: "",
          loading: false,
          error: "Wallet not connected",
        });
        return;
      }

      const payToken: PayToken | null =
        tokenSymbol === "USDC.e Bridged"
          ? "USDC_E"
          : tokenSymbol === "USDC"
            ? "USDC"
            : tokenSymbol === "ETH"
              ? "ETH"
              : tokenSymbol === "STRK"
                ? "STRK"
                : tokenSymbol === "LORDS"
                  ? "LORDS"
                  : tokenSymbol === "SURVIVOR"
                    ? "SURVIVOR"
                    : null;

      if (!payToken) {
        setOrder(null);
        setTokenQuote({
          amount: "",
          loading: false,
          error: "Token not supported",
        });
        return;
      }

      setTokenQuote({ amount: "", loading: true });
      setOrder(null);

      try {
        const candidateName = (playerName || "Adventurer").trim();
        const truncatedName = candidateName.slice(0, 31);
        let resolvedName = "Adventurer";
        try {
          stringToFelt(truncatedName);
          resolvedName = truncatedName;
        } catch {
          resolvedName = "Adventurer";
        }

        const created = await createOrder({
          dungeonId: "survivor",
          payToken,
          recipientAddress: address,
          playerName: resolvedName,
        });

        setOrder(created);
        setTokenQuote({ amount: created.requiredAmount, loading: false });
      } catch (error) {
        setTokenQuote({
          amount: "",
          loading: false,
          error: "Failed to get quote",
        });
      }
    },
    [address, playerName]
  );

  const hasTicket = dungeonTicketCount >= 1;

  const enterWithTicket = () => {
    enterDungeon({ paymentType: "Ticket" }, []);
    onClose();
  };

  const payWithCrypto = async () => {
    if (isPaying) return;
    if (!account || !address) return;

    if (!order) {
      fetchTokenQuote(selectedToken);
      return;
    }

    if (Date.now() > order.expiresAt) {
      setOrder(null);
      setTokenQuote({
        amount: "",
        loading: false,
        error: "Quote expired, refresh",
      });
      return;
    }

    const selectedTokenData = userTokens.find((t: any) => t.symbol === selectedToken);

    if (!order.payToken.address) {
      setTokenQuote({
        amount: "",
        loading: false,
        error: "Token not supported",
      });
      return;
    }

    // Validate that the selected token's address matches the order's token address
    const normalizeAddress = (addr: string | undefined): string => {
      if (!addr) return "";
      return addr.toLowerCase().replace(/^0x0*/, "");
    };
    
    const selectedAddressNorm = normalizeAddress(selectedTokenData?.address);
    const orderAddressNorm = normalizeAddress(order.payToken.address);

    if (!selectedAddressNorm || selectedAddressNorm !== orderAddressNorm) {
      setOrder(null);
      fetchTokenQuote(selectedToken);
      return;
    }

    setIsPaying(true);
    try {
      const amount = BigInt(order.requiredAmountRaw);
      const u256 = cairo.uint256(amount);

      const tx = await account.execute([
        {
          contractAddress: order.payToken.address,
          entrypoint: "transfer",
          calldata: CallData.compile([order.treasuryAddress, u256.low, u256.high]),
        },
      ]);

      const txHash: string | undefined = tx?.transaction_hash;
      if (!txHash) {
        throw new Error("missing_tx_hash");
      }

      await submitOrderPayment({ orderId: order.id, txHash });

      onClose();
      navigate(`/${dungeon.id}/play?mode=entering&orderId=${order.id}`, {
        replace: true,
      });
    } catch {
      setTokenQuote((prev) => ({
        ...prev,
        loading: false,
        error: "Payment failed",
      }));
    } finally {
      setIsPaying(false);
    }
  };

  // Handle token selection change
  const handleTokenChange = useCallback((tokenSymbol: string) => {
    setSelectedToken(tokenSymbol);
  }, []);

  // Reusable action button component
  const ActionButton = ({
    onClick,
    children,
    disabled,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <Box sx={{ display: "flex", justifyContent: "center", px: 2, mb: 2 }}>
      <Button
        variant="contained"
        sx={styles.activateButton}
        onClick={onClick}
        fullWidth
        disabled={disabled}
      >
        <Typography sx={styles.buttonText}>{children}</Typography>
      </Button>
    </Box>
  );

  // Determine if user has any supported crypto tokens
  const hasCryptoTokens = userTokens.length > 0;

  useEffect(() => {
    if (!open) {
      setOrder(null);
      setTokenQuote({ amount: "", loading: false });
      setActiveTab(0);
      return;
    }

    // If user has ticket, show ticket view (no tabs)
    if (hasTicket) {
      setOrder(null);
      setTokenQuote({ amount: "", loading: false });
      return;
    }

    // If user has no crypto tokens, default to fiat tab
    if (!hasCryptoTokens) {
      setActiveTab(1);
      return;
    }

    // Fetch quote when on crypto tab with a selected token
    if (selectedToken && activeTab === 0) {
      fetchTokenQuote(selectedToken);
    }
  }, [open, hasTicket, hasCryptoTokens, selectedToken, fetchTokenQuote, activeTab]);

  return (
    <AnimatePresence>
      {open && (
        <Box sx={styles.overlay}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={styles.modal}>
              <Box sx={styles.modalGlow} />
              <IconButton onClick={onClose} sx={styles.closeBtn} size="small">
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>

              <Box sx={styles.header}>
                <Box sx={styles.titleContainer}>
                  <Typography sx={styles.title}>DUNGEON ACCESS</Typography>
                  <Box sx={styles.titleUnderline} />
                </Box>
                <Typography sx={styles.subtitle}>
                  {hasTicket ? "Use your ticket" : "Select payment method"}
                </Typography>
              </Box>

              <Box sx={{ width: "100%", maxWidth: "330px", mx: "auto", pb: 2 }}>
                {hasTicket ? (
                  <motion.div
                    key="ticket"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <Box sx={styles.ticketCard}>
                      <Box sx={styles.goldenTokenContainer}>
                        <img
                          src="/images/dungeon_ticket.png"
                          alt="Dungeon Ticket"
                          style={{
                            width: "120px",
                            height: "120px",
                            objectFit: "contain",
                            display: "block",
                          }}
                          onError={(e) => {
                            console.error("Failed to load dungeon ticket image");
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </Box>

                      <Box sx={{ textAlign: "center", mb: 1 }}>
                        <Typography sx={styles.ticketCount}>
                          You have {dungeonTicketCount} ticket
                          {dungeonTicketCount > 1 ? "s" : ""}
                        </Typography>
                      </Box>

                      <ActionButton onClick={enterWithTicket}>
                        Enter Dungeon
                      </ActionButton>
                    </Box>
                  </motion.div>
                ) : (
                  <>
                    <Tabs
                      value={activeTab}
                      onChange={(_, newValue) => setActiveTab(newValue)}
                      variant="fullWidth"
                      sx={styles.tabs}
                    >
                      <Tab
                        icon={<TokenIcon sx={{ fontSize: 20 }} />}
                        iconPosition="start"
                        label="Crypto"
                        sx={styles.tab}
                      />
                      <Tab
                        icon={<CreditCardIcon sx={{ fontSize: 20 }} />}
                        iconPosition="start"
                        label="Fiat"
                        sx={styles.tab}
                      />
                    </Tabs>

                    <AnimatePresence mode="wait">
                      {activeTab === 0 ? (
                        <motion.div
                          key="crypto-tab"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.15 }}
                        >
                          <TokenSelectionContent
                            userTokens={userTokens}
                            selectedToken={selectedToken}
                            tokenQuote={tokenQuote}
                            onTokenChange={handleTokenChange}
                            styles={styles}
                            onPay={payWithCrypto}
                            isPaying={isPaying}
                            hasTreasuryAddress={!!order?.treasuryAddress}
                            treasuryStatus={treasuryStatus}
                          />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="fiat-tab"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.15 }}
                        >
                          <FiatContent styles={styles} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </Box>
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  );
}

export const paymentModalStyles = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    bgcolor: "rgba(0, 0, 0, 0.5)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
  },
  modal: {
    width: "380px",
    maxWidth: "90dvw",
    maxHeight: "90dvh",
    overflowY: "auto",
    p: 0,
    borderRadius: 3,
    background: "linear-gradient(145deg, #1a2f1a 0%, #0f1f0f 100%)",
    border: "2px solid rgba(208, 201, 141, 0.4)",
    boxShadow:
      "0 24px 64px rgba(0, 0, 0, 0.8), 0 0 40px rgba(208, 201, 141, 0.1)",
    position: "relative",
    overflow: "hidden",
  },
  modalGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background:
      "linear-gradient(45deg, transparent 30%, rgba(208, 201, 141, 0.02) 50%, transparent 70%)",
    pointerEvents: "none",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    color: "#d0c98d",
    background: "rgba(208, 201, 141, 0.1)",
    border: "1px solid rgba(208, 201, 141, 0.2)",
    "&:hover": {
      background: "rgba(208, 201, 141, 0.2)",
      transform: "scale(1.1)",
    },
    transition: "all 0.2s ease",
    zIndex: 10,
  },
  header: {
    textAlign: "center",
    p: 3,
    pb: 2,
    borderBottom: "1px solid rgba(208, 201, 141, 0.2)",
  },
  titleContainer: {
    position: "relative",
    mb: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 1.5,
    textShadow: "0 2px 8px rgba(208, 201, 141, 0.3)",
  },
  titleUnderline: {
    width: 80,
    height: 2,
    background: "linear-gradient(90deg, transparent, #d0c98d, transparent)",
    mx: "auto",
    borderRadius: 1,
    mt: 1,
  },
  subtitle: {
    fontSize: 14,
    color: "#FFD700",
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  tabs: {
    mx: 2,
    mt: 2,
    mb: 1,
    minHeight: 42,
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: 1,
    "& .MuiTabs-indicator": {
      backgroundColor: "#d0c98d",
      height: 3,
      borderRadius: 1,
    },
  },
  tab: {
    minHeight: 42,
    textTransform: "none",
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(208, 201, 141, 0.6)",
    "&.Mui-selected": {
      color: "#d0c98d",
    },
    "& .MuiTab-iconWrapper": {
      marginRight: 1,
    },
  },
  tabContent: {
    px: 2,
    py: 1,
    minHeight: 180,
  },
  ticketCard: {
    m: 2,
    p: 2,
    background: "rgba(24, 40, 24, 0.6)",
    border: "2px solid rgba(208, 201, 141, 0.3)",
    borderRadius: 2,
  },
  sectionContainer: {
    px: 0,
  },
  mobileSelectButton: {
    height: "48px",
    textTransform: "none",
    fontWeight: 500,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    background: "rgba(0, 0, 0, 0.4)",
    border: "1px solid rgba(208, 201, 141, 0.3)",
    borderRadius: 1,
    color: "inherit",
    "&:hover": {
      borderColor: "rgba(208, 201, 141, 0.5)",
      background: "rgba(0, 0, 0, 0.5)",
    },
  },
  tokenRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginLeft: "10px",
  },
  tokenLeft: {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
  },
  tokenName: {
    fontSize: 14,
    fontWeight: 600,
  },
  tokenBalance: {
    fontSize: 11,
    color: "#FFD700",
    opacity: 0.7,
  },
  costDisplay: {
    px: 1,
    mt: 2,
    textAlign: "center",
  },
  costText: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  goldenTokenContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    py: 1,
  },
  ticketCount: {
    fontSize: 14,
    color: "#FFD700",
    opacity: 0.9,
    letterSpacing: 0.5,
  },
  activateButton: {
    background: "#d0c98d",
    color: "#1a2f1a",
    py: 1.2,
    borderRadius: 1,
    fontWeight: 700,
    letterSpacing: 0.5,
    textAlign: "center",
    justifyContent: "center",
    alignItems: "center",
    "&:hover": {
      background: "#e6df9a",
      boxShadow: "0 4px 12px rgba(208, 201, 141, 0.3)",
    },
    "&:active": {
      transform: "translateY(1px)",
    },
    "&.Mui-disabled": {
      background: "rgba(208, 201, 141, 0.3)",
      color: "rgba(26, 47, 26, 0.6)",
    },
    transition: "all 0.2s ease",
  },
  buttonText: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 0.5,
    color: "inherit",
    textAlign: "center",
  },
};

const styles = paymentModalStyles;
