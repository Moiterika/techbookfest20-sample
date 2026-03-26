import { z } from "zod";
import { Money } from "../shared/types";

/** 品目 作成・更新 DTO */
export const ItemDto = z.object({
  code: z.string().min(1, "品目コードは必須です"),
  name: z.string().min(1, "品目名は必須です"),
  category: z.string().optional(),
  price: Money.optional(),
  barcode: z.string().optional(),
});

export type ItemDto = z.infer<typeof ItemDto>;

/** フォーム入力からの変換（フォームは number で来るので Money に包む） */
export function toItemDto(form: {
  code: string;
  name: string;
  category?: string;
  price?: number;
  barcode?: string;
}): ItemDto {
  return {
    code: form.code,
    name: form.name,
    category: form.category || undefined,
    price: form.price != null ? { value: form.price, cur: "JPY" } : undefined,
    barcode: form.barcode || undefined,
  };
}

/** DB 保存用に DTO をフラットに戻す */
export function fromItemDto(dto: ItemDto) {
  return {
    code: dto.code,
    name: dto.name,
    category: dto.category ?? null,
    price: dto.price?.value ?? 0,
    barcode: dto.barcode ?? null,
  };
}
