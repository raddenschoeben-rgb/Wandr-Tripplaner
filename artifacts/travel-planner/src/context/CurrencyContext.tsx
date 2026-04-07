import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Currency = "USD" | "VND" | "EUR" | "GBP" | "JPY" | "THB" | "SGD";

export const CURRENCIES: { code: Currency; symbol: string; label: string }[] = [
  { code: "VND", symbol: "₫", label: "VND — Việt Nam Đồng" },
  { code: "USD", symbol: "$", label: "USD — Đô la Mỹ" },
  { code: "EUR", symbol: "€", label: "EUR — Euro" },
  { code: "GBP", symbol: "£", label: "GBP — Bảng Anh" },
  { code: "JPY", symbol: "¥", label: "JPY — Yên Nhật" },
  { code: "THB", symbol: "฿", label: "THB — Baht Thái" },
  { code: "SGD", symbol: "S$", label: "SGD — Đô la Singapore" },
];

interface CurrencyContextValue {
  currency: Currency;
  symbol: string;
  setCurrency: (c: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "VND",
  symbol: "₫",
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    return (localStorage.getItem("wandr_currency") as Currency) ?? "VND";
  });

  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$";

  function setCurrency(c: Currency) {
    setCurrencyState(c);
    localStorage.setItem("wandr_currency", c);
  }

  return (
    <CurrencyContext.Provider value={{ currency, symbol, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
