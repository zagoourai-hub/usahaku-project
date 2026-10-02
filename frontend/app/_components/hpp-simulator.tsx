"use client";

import { useState } from "react";
import Link from "next/link";
import { formatIDR } from "@/lib/format";
import { AlertTriangle, CheckCircle2, CircleAlert, Plus, UtensilsCrossed, BadgeCheck } from "lucide-react";

type Ingredient = { id: number; name: string; cost: string };

const toNumber = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const inputBase =
  "w-full rounded-md border bg-background text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 dark:bg-card-inner";

function MoneyInput({ id, value, onChange, label, className = "" }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
        Rp
      </span>
      <input
        id={id}
        aria-label={label}
        type="number"
        inputMode="numeric"
        min={0}
        step={50}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} tabular h-10 pl-9 pr-3 text-sm font-semibold`}
      />
    </div>
  );
}

export function HppSimulator() {
  const [menu, setMenu] = useState("Es Kopi Susu Aren");
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: 1, name: "Kopi Espresso (18g)", cost: "3200" },
    { id: 2, name: "Susu UHT (120ml)", cost: "1800" },
    { id: 3, name: "Gula Aren (15ml)", cost: "950" },
  ]);
  const [overhead, setOverhead] = useState("500");
  const [price, setPrice] = useState("18000");

  const totalBahan = ingredients.reduce((sum, i) => sum + toNumber(i.cost), 0);
  const hpp = totalBahan + toNumber(overhead);
  const sellingPrice = toNumber(price);
  const profit = sellingPrice - hpp;
  const margin = sellingPrice > 0 ? Math.round((profit / sellingPrice) * 100) : 0;

  const level = margin >= 50 ? "good" : margin >= 30 ? "mid" : "bad";
  const tone = {
    good: { badge: "bg-income-soft text-income", bar: "bg-income", Icon: CheckCircle2, text: "Margin Sehat (Target F&B > 50%)" },
    mid: { badge: "bg-warning-soft text-warning", bar: "bg-warning", Icon: AlertTriangle, text: "Margin Sedang (Perlu Perhatian)" },
    bad: { badge: "bg-expense-soft text-expense", bar: "bg-expense", Icon: CircleAlert, text: "Margin Rendah/Kritis!" },
  }[level];

  const updateIngredient = (id: number, patch: Partial<Ingredient>) =>
    setIngredients((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  return (
    <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-5 text-primary" />
            <h3 className="text-[15px] font-bold">Rincian Resep &amp; Bahan</h3>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary dark:bg-primary/15">
            Live Input
          </span>
        </div>

        <div>
          <label htmlFor="sim-menu" className="mb-1.5 block text-sm font-semibold">Nama Menu</label>
          <input id="sim-menu" value={menu} onChange={(e) => setMenu(e.target.value)} className={`${inputBase} h-11 px-3 text-sm`} />
        </div>

        <fieldset>
          <legend className="sr-only">Bahan baku dan biaya per porsi</legend>
          <div aria-hidden className="mb-1.5 flex justify-between px-0.5 text-xs font-medium text-muted-foreground">
            <span>Bahan Baku</span>
            <span>Biaya Satuan</span>
          </div>
          <ul className="space-y-2.5">
            {ingredients.map((item, index) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  aria-label={`Nama bahan ${index + 1}`}
                  placeholder="Nama bahan"
                  value={item.name}
                  onChange={(e) => updateIngredient(item.id, { name: e.target.value })}
                  className={`${inputBase} h-10 flex-1 px-3 text-xs`}
                />
                <MoneyInput
                  id={`sim-cost-${item.id}`}
                  label={`Biaya ${item.name || `bahan ${index + 1}`}`}
                  value={item.cost}
                  onChange={(cost) => updateIngredient(item.id, { cost })}
                  className="w-32 shrink-0"
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setIngredients((list) => [...list, { id: Date.now(), name: "Bahan Tambahan", cost: "500" }])}
            className="mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="size-4" /> Tambah Bahan
          </button>
        </fieldset>

        <div className="border-t pt-3">
          <label htmlFor="sim-overhead" className="mb-1.5 block text-sm font-semibold">
            Biaya Overhead (listrik, cup, sedotan, dll)
          </label>
          <MoneyInput id="sim-overhead" value={overhead} onChange={setOverhead} />
        </div>
      </div>

      <div className="flex flex-col justify-between rounded-lg border-2 border-primary/40 bg-card p-6 shadow-sm">
        <div>
          <div className="flex items-center justify-between border-b pb-3">
            <span className="font-mono text-xs font-bold text-primary">Hasil Perhitungan Langsung</span>
            <BadgeCheck className="size-[18px] text-primary" />
          </div>

          <output aria-live="polite" className="mt-4 block">
            <span className="mb-1 block font-mono text-xs text-muted-foreground">Total HPP per Porsi</span>
            <span className="tabular block text-3xl font-bold tracking-tight text-primary md:text-4xl">{formatIDR(hpp)}</span>
            <span className="mt-1.5 block text-xs text-muted-foreground">
              {ingredients.length} bahan baku ({formatIDR(totalBahan)}) + overhead ({formatIDR(toNumber(overhead))})
            </span>
          </output>

          <div className="my-5 border-t pt-4">
            <label htmlFor="sim-price" className="mb-1.5 block text-sm font-semibold">Rencana Harga Jual</label>
            <MoneyInput id="sim-price" value={price} onChange={setPrice} />

            <div className="mt-4 space-y-3 rounded-lg border bg-card-inner p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Estimasi Laba Bersih / Porsi</span>
                <span className={`tabular text-sm font-bold ${profit < 0 ? "text-expense" : "text-income"}`}>
                  {profit < 0 ? "− " : ""}
                  {formatIDR(profit)}
                </span>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Persentase Margin</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold ${tone.badge}`}>Margin {margin}%</span>
                </div>
                <div
                  role="meter"
                  aria-label="Persentase margin"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.max(0, Math.min(100, margin))}
                  className="h-2 w-full overflow-hidden rounded-full bg-track"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${tone.bar}`}
                    style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
                  />
                </div>
              </div>
              <p className={`flex items-center gap-1.5 text-xs font-semibold ${tone.badge.split(" ")[1]}`}>
                <tone.Icon className="size-3.5" /> {tone.text}
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3">
          <Link
            href="/register"
           
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Simpan &amp; Lihat Menu Lainnya →
          </Link>
          <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
            Ini baru simulasi 1 menu. Daftar gratis untuk simpan ratusan resep, scan struk belanja pasar, dan pantau laba harian otomatis.
          </p>
        </div>
      </div>
    </div>
  );
}
