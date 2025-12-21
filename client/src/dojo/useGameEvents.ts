import { useDynamicConnector } from "@/contexts/starknet";
import { useDungeon } from "@/dojo/useDungeon";
import type { GameEvent } from "@/utils/events";
import { processGameEvent } from "@/utils/events";
import { addAddressPadding, num } from "starknet";

export const useGameEvents = () => {
  const dungeon = useDungeon();
  const { currentNetworkConfig } = useDynamicConnector();

  const fetchGameEventsSql = async (query: string) => {
    const url = `${currentNetworkConfig.toriiUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch game events (${response.status})`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  };

  const parseEvents = (rows: any[]): GameEvent[] =>
    rows
      .map((row: any): GameEvent | null => {
        try {
          return processGameEvent(JSON.parse(row.data), dungeon);
        } catch {
          return null;
        }
      })
      .filter((event): event is GameEvent => event !== null);

  const getGameEvents = async (gameId: number, limit: number = 10000) => {
    try {
      const keys = `${addAddressPadding(num.toHex(gameId))}/`;
      const query = `SELECT data FROM "event_messages_historical" WHERE keys = "${keys}" LIMIT ${limit}`;
      const rows = await fetchGameEventsSql(query);
      return parseEvents(rows);
    } catch {
      return [];
    }
  };

  const getGameEventsAfterActionCount = async (
    gameId: number,
    afterActionCount: number,
    limit: number = 2000
  ) => {
    try {
      const keys = `${addAddressPadding(num.toHex(gameId))}/`;
      const safeCursor = Number.isFinite(afterActionCount) ? Math.max(0, Math.floor(afterActionCount)) : 0;

      const query = `SELECT data FROM "event_messages_historical" WHERE keys = "${keys}" AND CAST(json_extract(data, '$.action_count') AS INTEGER) > ${safeCursor} LIMIT ${limit}`;

      const rows = await fetchGameEventsSql(query);
      return parseEvents(rows);
    } catch {
      // Fallback: fetch all and filter client-side (keeps app working even if JSON SQL is unsupported).
      const events = await getGameEvents(gameId);
      return events.filter((event: any) => (event?.action_count ?? 0) > afterActionCount);
    }
  };

  return {
    getGameEvents,
    getGameEventsAfterActionCount,
  };
};
