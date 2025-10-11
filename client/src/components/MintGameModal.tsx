import { paymentModalStyles } from "@/components/PaymentOptionsModal";
import { useController } from "@/contexts/controller";
import { NETWORKS } from "@/utils/networkConfig";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Button,
  IconButton,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

interface MintGameModalProps {
  open: boolean;
  onClose: () => void;
}

const styles = paymentModalStyles;
const MAX_TICKET_BATCH = 100;

export default function MintGameModal({ open, onClose }: MintGameModalProps) {
  const { enterDungeonMultiple, tokenBalances, playerName } = useController();
  const [mintCount, setMintCount] = useState(0);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adventurerName, setAdventurerName] = useState("");

  const dungeonTicketAddress =
    NETWORKS[import.meta.env.VITE_PUBLIC_CHAIN as keyof typeof NETWORKS]
      ?.dungeonTicket;

  const availableTickets = useMemo(() => {
    if (!dungeonTicketAddress) return 0;

    const paymentTokens =
      NETWORKS[import.meta.env.VITE_PUBLIC_CHAIN as keyof typeof NETWORKS]
        ?.paymentTokens ?? [];
    const ticketToken = paymentTokens.find(
      (token: any) =>
        token.address?.toLowerCase() === dungeonTicketAddress.toLowerCase()
    );

    if (!ticketToken) return 0;

    const balanceMap = tokenBalances ?? {};
    const balanceRaw = balanceMap[ticketToken.name];
    const balance = balanceRaw ? Number(balanceRaw) : 0;
    return Number.isFinite(balance) ? balance : 0;
  }, [dungeonTicketAddress, tokenBalances]);

  const maxMintable = useMemo(
    () => Math.min(availableTickets, MAX_TICKET_BATCH),
    [availableTickets]
  );

  useEffect(() => {
    if (open) {
      setError(null);
      const initialCount = maxMintable > 0 ? 1 : 0;
      setMintCount(initialCount);
      setAdventurerName(playerName);
    }
  }, [open, maxMintable, playerName]);

  useEffect(() => {
    if (!open) return;
    if (mintCount > maxMintable) {
      setMintCount(maxMintable);
    }
  }, [open, maxMintable, mintCount]);

  const handleMint = useCallback(async () => {
    if (mintCount <= 0 || isMinting) return;

    try {
      setIsMinting(true);
      setError(null);
      const trimmedName = adventurerName.trim();
      await enterDungeonMultiple(mintCount, trimmedName || undefined);
      onClose();
    } catch (err) {
      console.error("Failed to mint games with tickets:", err);
      setError("Unable to mint games. Please try again.");
    } finally {
      setIsMinting(false);
    }
  }, [
    adventurerName,
    enterDungeonMultiple,
    mintCount,
    isMinting,
    onClose,
  ]);

  return (
    <AnimatePresence>
      {open && (
        <Box sx={styles.overlay}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={styles.modal}>
              <Box sx={styles.modalGlow} />
              <IconButton
                onClick={isMinting ? undefined : onClose}
                sx={styles.closeBtn}
                size="small"
                disabled={isMinting}
              >
                <CloseIcon sx={{ fontSize: 20 }} />
              </IconButton>

              <Box sx={styles.header}>
                <Box sx={styles.titleContainer}>
                  <Typography sx={styles.title}>MINT TICKETS</Typography>
                  <Box sx={styles.titleUnderline} />
                </Box>
                <Typography sx={styles.subtitle}>
                  Use dungeon tickets to mint new games
                </Typography>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  width: "100%",
                  maxWidth: 330,
                  mx: "auto",
                  pb: 3,
                }}
              >
                <Stack spacing={2} px={3} pt={2}>
                  <TextField
                    label="Adventurer Name"
                    value={adventurerName}
                    onChange={(event) => setAdventurerName(event.target.value)}
                    fullWidth
                    disabled={isMinting}
                    InputLabelProps={{
                      sx: { color: "#d0c98d" },
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        background: "rgba(0, 0, 0, 0.3)",
                        borderRadius: 1.5,
                        color: "#fff",
                        "& fieldset": {
                          borderColor: "rgba(208, 201, 141, 0.3)",
                        },
                        "&:hover fieldset": {
                          borderColor: "rgba(208, 201, 141, 0.6)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#d0c98d",
                        },
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#fff4b5",
                      },
                    }}
                  />

                  <Box
                    sx={{
                      border: "1px solid rgba(208, 201, 141, 0.2)",
                      borderRadius: 2,
                      p: 2,
                      background: "rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1.5,
                      }}
                    >
                      <Typography variant="body2" color="#d0c98d">
                        Tickets available
                      </Typography>
                      <Typography variant="body2" fontWeight={600} color="#fff4b5">
                        {availableTickets}
                      </Typography>
                    </Box>

                    <Slider
                      value={mintCount}
                      min={0}
                      max={maxMintable}
                      step={1}
                      marks={
                        maxMintable <= 6
                          ? Array.from(
                              { length: maxMintable + 1 },
                              (_, i) => ({
                                value: i,
                                label: `${i}`,
                              })
                            )
                          : undefined
                      }
                      onChange={(_, value) => setMintCount(value as number)}
                      valueLabelDisplay="auto"
                      disabled={maxMintable === 0 || isMinting}
                      sx={{
                        "& .MuiSlider-thumb": {
                          color: "#ffd54f",
                        },
                        "& .MuiSlider-track": {
                          color: "#ffd54f",
                        },
                        "& .MuiSlider-rail": {
                          color: "rgba(208, 201, 141, 0.3)",
                        },
                      }}
                    />

                    <Box sx={{ display: "flex", justifyContent: "center", px: 1, mt: 2 }}>
                      <Button
                        variant="contained"
                        onClick={handleMint}
                        disabled={
                          mintCount === 0 || maxMintable === 0 || isMinting
                        }
                        fullWidth
                        sx={{
                          ...styles.activateButton,
                          pointerEvents:
                            mintCount === 0 || maxMintable === 0 || isMinting
                              ? "none"
                              : "auto",
                          opacity:
                            mintCount === 0 || maxMintable === 0 || isMinting
                              ? 0.6
                              : 1,
                        }}
                      >
                        <Typography sx={styles.buttonText}>
                          {isMinting
                            ? "Minting..."
                            : `Mint ${mintCount} ${mintCount === 1 ? "game" : "games"}`}
                        </Typography>
                      </Button>
                    </Box>
                  </Box>

                  {error && (
                    <Typography color="error" textAlign="center">
                      {error}
                    </Typography>
                  )}

                  {availableTickets === 0 && (
                    <Typography
                      variant="body2"
                      textAlign="center"
                      color="rgba(208, 201, 141, 0.7)"
                    >
                      No tickets available. Buy a game to collect more dungeon tickets.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  );
}
