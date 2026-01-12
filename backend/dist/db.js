class InMemoryDatabase {
    orders = new Map();
    prepare(sql) {
        const self = this;
        const normalizedSql = sql.replace(/\s+/g, " ").trim().toLowerCase();
        return {
            run(...params) {
                // Handle named params (object) or positional params
                const p = params[0];
                if (normalizedSql.includes("insert into orders")) {
                    const order = {
                        id: p.id,
                        created_at: p.created_at,
                        updated_at: p.updated_at,
                        expires_at: p.expires_at,
                        status: p.status,
                        dungeon_id: p.dungeon_id,
                        pay_token_symbol: p.pay_token_symbol,
                        pay_token_address: p.pay_token_address,
                        pay_token_decimals: p.pay_token_decimals,
                        required_amount_raw: p.required_amount_raw,
                        quote_sell_amount_raw: p.quote_sell_amount_raw,
                        recipient_address: p.recipient_address,
                        player_name: p.player_name,
                        payment_tx_hash: null,
                        paid_amount_raw: null,
                        fulfill_tx_hash: null,
                        game_id: null,
                        last_error: null,
                    };
                    self.orders.set(order.id, order);
                    return { changes: 1 };
                }
                if (normalizedSql.includes("update orders")) {
                    // Positional params for updates
                    const id = params[params.length - 1];
                    const order = self.orders.get(id);
                    if (!order)
                        return { changes: 0 };
                    // Parse the SET clause to know which fields to update
                    if (normalizedSql.includes("status = ?") && normalizedSql.includes("updated_at = ?") && normalizedSql.includes("last_error = ?") && !normalizedSql.includes("paid_amount_raw")) {
                        order.status = params[0];
                        order.updated_at = params[1];
                        order.last_error = params[2];
                    }
                    else if (normalizedSql.includes("status = ?") && normalizedSql.includes("updated_at = ?") && normalizedSql.includes("paid_amount_raw = ?")) {
                        order.status = params[0];
                        order.updated_at = params[1];
                        order.paid_amount_raw = params[2];
                        order.last_error = null;
                    }
                    else if (normalizedSql.includes("status = ?") && normalizedSql.includes("updated_at = ?") && normalizedSql.includes("game_id = ?")) {
                        order.status = params[0];
                        order.updated_at = params[1];
                        order.game_id = params[2];
                        order.last_error = null;
                    }
                    else if (normalizedSql.includes("updated_at = ?") && normalizedSql.includes("fulfill_tx_hash = ?") && normalizedSql.includes("last_error = null")) {
                        order.updated_at = params[0];
                        order.fulfill_tx_hash = params[1];
                        order.last_error = null;
                    }
                    else if (normalizedSql.includes("payment_tx_hash = ?") && normalizedSql.includes("updated_at = ?")) {
                        order.payment_tx_hash = params[0];
                        order.updated_at = params[1];
                    }
                    else if (normalizedSql.includes("status = ?") && normalizedSql.includes("updated_at = ?")) {
                        order.status = params[0];
                        order.updated_at = params[1];
                    }
                    else if (normalizedSql.includes("updated_at = ?") && normalizedSql.includes("last_error = ?")) {
                        order.updated_at = params[0];
                        order.last_error = params[1];
                    }
                    return { changes: 1 };
                }
                return { changes: 0 };
            },
            get(...params) {
                if (normalizedSql.includes("select") && normalizedSql.includes("from orders where id = ?")) {
                    return self.orders.get(params[0]);
                }
                if (normalizedSql.includes("select") && normalizedSql.includes("from orders") && normalizedSql.includes("where")) {
                    // Worker query for pending orders
                    const orders = Array.from(self.orders.values());
                    return orders.find(o => (o.status === "awaiting_payment" && o.payment_tx_hash !== null) ||
                        o.status === "paid" ||
                        o.status === "fulfilling");
                }
                return undefined;
            },
            all(..._params) {
                return Array.from(self.orders.values());
            }
        };
    }
}
export function openDb(_sqlitePath) {
    console.log("Using in-memory database (orders will not persist across restarts)");
    return new InMemoryDatabase();
}
export function initDb(_db) {
    // No-op for in-memory db
}
