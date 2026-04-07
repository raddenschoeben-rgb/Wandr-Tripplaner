export const DEFAULT_TAG_ICON = "📍";

const NAME_TO_ICON: Record<string, string> = {
  "ẩm thực": "🍜",
  "ăn uống": "🍜",
  "nhà hàng": "🍽️",
  "cafe": "☕",
  "cà phê": "☕",
  "di tích": "🏛️",
  "lịch sử": "🏛️",
  "văn hóa": "🎭",
  "mua sắm": "🛍️",
  "shopping": "🛍️",
  "di chuyển": "🚌",
  "giao thông": "🚇",
  "khách sạn": "🏨",
  "lưu trú": "🏨",
  "resort": "🏖️",
  "thiên nhiên": "🌿",
  "công viên": "🌳",
  "biển": "🌊",
  "núi": "⛰️",
  "giải trí": "🎡",
  "vui chơi": "🎠",
  "spa": "💆",
  "y tế": "🏥",
  "chùa": "🛕",
  "đền": "🛕",
  "bar": "🍸",
  "nightlife": "🌙",
  "thể thao": "⚽",
  "bảo tàng": "🖼️",
};

export function getTagIcon(tag: { name: string; icon?: string | null }): string {
  if (tag.icon) return tag.icon;
  const lower = tag.name.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(NAME_TO_ICON)) {
    if (lower.includes(key)) return emoji;
  }
  return DEFAULT_TAG_ICON;
}

export const SUGGESTED_ICONS = [
  "🍜", "🍽️", "☕", "🏛️", "🛍️", "🚌", "🚇", "🏨", "🌿", "🌊",
  "🎡", "🎭", "🛕", "🌳", "⛰️", "🍸", "🎠", "🏖️", "🖼️", "⚽",
  "💆", "🌙", "📍", "❤️", "⭐", "🎯", "🔥", "💡", "🎵", "📸",
];
