export type 品目更新Args = {
  id: number;
  code: string;
  name: string;
  category: string | null;
  price: number;
  barcode: string | null;
};
