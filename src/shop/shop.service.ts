import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { pool } from "../database/pool.js";
import { callDbFunction } from "../database/rpc.js";
import {
  getMerchant,
  getItemValue,
  getItemSellPrice,
  getItemType,
} from "../game-data/game-data.js";

/**
 * 서버 권위 상점.
 * - 가격은 game-data(프론트 items 동기화본)의 value/sellPrice만 신뢰한다.
 * - 매 거래를 단일 트랜잭션 + 유저별 advisory lock으로 직렬화해 골드/인벤 원자성과
 *   동시요청 이중지급을 원천 차단한다.
 * - 인벤 DB 함수의 반환 success를 반드시 검사한다(스택 초과/인벤 풀 시 미지급분 정산).
 */

interface InventoryItem {
  slot: number;
  itemId: string;
  quantity: number;
}

interface InvOpResult {
  success?: boolean;
  error?: string;
  items?: InventoryItem[];
}

export interface BuyResult {
  gold: number;
  itemId: string;
  quantity: number;
}

export interface SellResult {
  gold: number;
}

@Injectable()
export class ShopService {
  /** npcId 상인이 itemId를 quantity만큼 판매 → 골드 차감 후 인벤 지급 (단일 트랜잭션) */
  async buy(userId: string, npcId: string, itemId: string, quantity: number): Promise<BuyResult> {
    const qty = this.validateQuantity(quantity);

    const merchant = getMerchant(npcId);
    if (!merchant) throw new NotFoundException({ error: `상인을 찾을 수 없습니다: ${npcId}` });
    if (!merchant.stock?.includes(itemId)) {
      throw new BadRequestException({ error: "이 상인이 취급하지 않는 품목입니다", code: "ITEM_NOT_STOCKED" });
    }

    const unit = getItemValue(itemId);
    if (unit === undefined) {
      throw new BadRequestException({ error: `가격 정보가 없는 아이템입니다: ${itemId}`, code: "NO_PRICE" });
    }
    const itemType = getItemType(itemId);

    return this.withUserTx(userId, async (client) => {
      const cost = unit * qty;

      // 원자적 골드 차감 (음수 불가)
      const { rows, rowCount } = await client.query<{ gold: number }>(
        `update characters set gold = gold - $2 where user_id = $1 and gold >= $2 returning gold`,
        [userId, cost]
      );
      if (rowCount === 0) {
        const { rows: cr } = await client.query(`select 1 from characters where user_id = $1`, [userId]);
        if (cr.length === 0) throw new NotFoundException({ error: "캐릭터가 없습니다" });
        throw new BadRequestException({ error: "골드가 부족합니다", code: "NOT_ENOUGH_GOLD" });
      }
      let gold = Number(rows[0].gold);

      // 스택/슬롯 정합을 위해 1개씩 지급하고 반환 success를 검사한다.
      // (inventory_add_item은 한 번에 한 슬롯만 다루고 max_stack 초과분을 조용히 버림)
      let delivered = 0;
      for (let k = 0; k < qty; k++) {
        const res = (await callDbFunction(
          "inventory_add_item",
          {
            p_user_id: userId,
            p_inventory_type: "personal",
            p_item_id: itemId,
            p_item_type: itemType,
            p_quantity: 1,
          },
          "scalar",
          client
        )) as InvOpResult | null;
        if (res?.success === true) delivered++;
        else break; // inventory_full 등 — 더 못 담음
      }

      if (delivered === 0) {
        // 한 개도 못 담음 → 트랜잭션 롤백으로 골드 차감도 무효화
        throw new BadRequestException({ error: "인벤토리에 담을 공간이 없습니다", code: "INVENTORY_FULL" });
      }

      // 미지급분 환불 (같은 트랜잭션 내)
      if (delivered < qty) {
        const refund = unit * (qty - delivered);
        const rr = await client.query<{ gold: number }>(
          `update characters set gold = gold + $2 where user_id = $1 returning gold`,
          [userId, refund]
        );
        gold = Number(rr.rows[0]?.gold ?? gold + refund);
      }

      return { gold, itemId, quantity: delivered };
    });
  }

  /** itemId를 quantity만큼 판매 → 인벤 차감 후 골드 지급 (단일 트랜잭션) */
  async sell(userId: string, itemId: string, quantity: number): Promise<SellResult> {
    const qty = this.validateQuantity(quantity);

    const unit = getItemSellPrice(itemId);
    if (unit === undefined) {
      throw new BadRequestException({ error: `판매할 수 없는 아이템입니다: ${itemId}`, code: "NO_PRICE" });
    }

    return this.withUserTx(userId, async (client) => {
      const inv = (await callDbFunction(
        "inventory_get",
        { p_user_id: userId, p_inventory_type: "personal" },
        "scalar",
        client
      )) as { items?: InventoryItem[]; error?: string } | null;
      const items = inv?.items ?? [];
      // 빈 슬롯은 null 로 들어오므로 반드시 걸러낸다
      const owned = items.filter((it): it is InventoryItem => !!it && it.itemId === itemId);
      const have = owned.reduce((s, it) => s + it.quantity, 0);
      if (have < qty) {
        throw new BadRequestException({ error: `보유 수량이 부족합니다 (${have}/${qty})`, code: "NOT_ENOUGH_ITEMS" });
      }

      // 슬롯 순회 차감 — 각 반환 success를 검사해 실제 제거량만 정산
      let removed = 0;
      let remaining = qty;
      for (const it of owned) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, it.quantity);
        const res = (await callDbFunction(
          "inventory_remove_item",
          { p_user_id: userId, p_inventory_type: "personal", p_slot: it.slot, p_quantity: take },
          "scalar",
          client
        )) as InvOpResult | null;
        if (res?.success === true) {
          removed += take;
          remaining -= take;
        } else {
          break; // slot_empty 등 — 정합 깨짐, 중단(트랜잭션 롤백)
        }
      }

      if (removed < qty) {
        // 전량 차감 실패 → 롤백. 부분 지급/이중지급 방지.
        throw new BadRequestException({ error: "판매 처리에 실패했습니다", code: "NOT_ENOUGH_ITEMS" });
      }

      const payout = unit * removed;
      const { rows } = await client.query<{ gold: number }>(
        `update characters set gold = gold + $2 where user_id = $1 returning gold`,
        [userId, payout]
      );
      if (rows.length === 0) throw new NotFoundException({ error: "캐릭터가 없습니다" });

      return { gold: Number(rows[0].gold) };
    });
  }

  private validateQuantity(quantity: number): number {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new BadRequestException({ error: "수량은 1~99 사이 정수여야 합니다", code: "INVALID_QUANTITY" });
    }
    return quantity;
  }

  /**
   * 단일 커넥션 트랜잭션 + 유저별 advisory lock으로 거래를 직렬화한다.
   * 콜백에서 예외가 나면 롤백(골드/인벤 변경 전부 취소), 정상 종료면 커밋.
   */
  private async withUserTx<T>(userId: string, fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("begin");
      // 같은 유저의 buy/sell/train 동시 실행 직렬화 (트랜잭션 종료 시 자동 해제)
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [userId]);
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
}
