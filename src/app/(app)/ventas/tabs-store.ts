"use client";

import { useSyncExternalStore } from "react";

/**
 * Billing tabs ("tickets") of the counter: several sales or workshop bills can be
 * in progress at the same time, each with its own cart, customer and terms.
 *
 * The tabs live in this browser (localStorage, per user): they are drafts, not
 * business records — nothing reaches the database until "Cobrar". If storage is
 * unavailable (private window), they still work in memory.
 */
export type TermsDraft = {
  paymentTerms: "CONTADO" | "CREDITO";
  dueDate?: string;
  monthlyInterest?: string;
  payment?: { paymentMethodId: number; currency: "NIO" | "USD"; exchangeRate?: string };
  authorizer?: { username: string; password: string };
};

export type CustomerRef = { id: number; name: string; phone: string };

export type ProductLine = {
  productId: number;
  name: string;
  listPrice: string;
  stock: number;
  quantity: number;
  discountId?: number;
  discountAmount?: string;
};

/** Labor is always a job of the catalog (DEC-048); serviceTypeId may be missing only in tabs saved before. */
export type LaborLine = { key: string; serviceTypeId?: number; description: string; price: string };
export type ChargeLine = { key: string; description: string; price: string };

type Base = { id: string; createdAt: number; terms: TermsDraft; customer: CustomerRef | null };
export type SaleTab = Base & { kind: "sale"; number: number; lines: ProductLine[] };
export type ServiceTab = Base & {
  kind: "service";
  orderId: number;
  title: string;
  labor: LaborLine[];
  /** The order's jobs were already copied into `labor` (done once, when the order loads). */
  laborLoaded?: boolean;
  parts: ProductLine[];
  external: ChargeLine[];
};
export type Tab = SaleTab | ServiceTab;

type State = { tabs: Tab[]; activeId: string | null; nextNumber: number };

const EMPTY: State = { tabs: [], activeId: null, nextNumber: 1 };
let state: State = EMPTY;
let storageKey = "";
const listeners = new Set<() => void>();

export const newKey = () => Math.random().toString(36).slice(2, 10);
export const defaultTerms = (): TermsDraft => ({ paymentTerms: "CONTADO", payment: { paymentMethodId: 0, currency: "NIO" } });

function load(key: string) {
  if (storageKey === key) return;
  storageKey = key;
  try {
    const raw = localStorage.getItem(key);
    state = raw ? ({ ...EMPTY, ...(JSON.parse(raw) as State) }) : EMPTY;
  } catch {
    state = EMPTY;
  }
}

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // storage blocked: keep in memory
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTabs(username: string) {
  load(`motor-irm.caja.${username}.v1`);
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  const active = s.tabs.find((t) => t.id === s.activeId) ?? s.tabs[0] ?? null;

  return {
    tabs: s.tabs,
    active,
    select: (id: string) => set({ ...state, activeId: id }),
    newSale: () => {
      const tab: SaleTab = {
        kind: "sale",
        id: newKey(),
        number: state.nextNumber,
        createdAt: Date.now(),
        terms: defaultTerms(),
        customer: null,
        lines: [],
      };
      set({ tabs: [...state.tabs, tab], activeId: tab.id, nextNumber: state.nextNumber + 1 });
      return tab.id;
    },
    /** Opens (or focuses) the bill of a workshop order. */
    openService: (orderId: number, title: string, customer: CustomerRef) => {
      const existing = state.tabs.find((t) => t.kind === "service" && t.orderId === orderId);
      if (existing) {
        set({ ...state, activeId: existing.id });
        return existing.id;
      }
      const tab: ServiceTab = {
        kind: "service",
        id: newKey(),
        orderId,
        title,
        createdAt: Date.now(),
        terms: defaultTerms(),
        customer,
        labor: [],
        parts: [],
        external: [],
      };
      set({ ...state, tabs: [...state.tabs, tab], activeId: tab.id });
      return tab.id;
    },
    update: (id: string, patch: (t: Tab) => Tab) =>
      set({ ...state, tabs: state.tabs.map((t) => (t.id === id ? patch(t) : t)) }),
    close: (id: string) => {
      const i = state.tabs.findIndex((t) => t.id === id);
      const tabs = state.tabs.filter((t) => t.id !== id);
      const next = tabs[Math.min(i, tabs.length - 1)];
      set({ ...state, tabs, activeId: next?.id ?? null });
    },
  };
}

/** For pages outside Caja (e.g. the workshop) that send an order to be billed. */
export function queueServiceBill(username: string, orderId: number, title: string, customer: CustomerRef) {
  load(`motor-irm.caja.${username}.v1`);
  const existing = state.tabs.find((t) => t.kind === "service" && t.orderId === orderId);
  if (existing) return set({ ...state, activeId: existing.id });
  const tab: ServiceTab = {
    kind: "service",
    id: newKey(),
    orderId,
    title,
    createdAt: Date.now(),
    terms: defaultTerms(),
    customer,
    labor: [],
    parts: [],
    external: [],
  };
  set({ ...state, tabs: [...state.tabs, tab], activeId: tab.id });
}
