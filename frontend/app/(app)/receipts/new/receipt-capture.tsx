"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, ImageUp, Loader2, Receipt, RotateCcw, ScanLine } from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { subscriptionKey, useOcrQuota } from "@/lib/receipts";
import { FormError } from "@/app/_components/fields";
import { ghostBtn, primaryBtn } from "../../ui";

const MAX_BYTES = 10 * 1024 * 1024; // before compression; the server takes max 5 MB after
const MAX_EDGE = 1600;

/** Downscale + re-encode on the device: faster upload on mobile data, EXIF stripped. */
async function compress(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}

export function ReceiptCapture() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const quota = useOcrQuota();
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [preparing, setPreparing] = useState(false);

  const scan = useMutation({
    mutationFn: async (dataUrl: string) => {
      const body = new FormData();
      body.append("image", await (await fetch(dataUrl)).blob(), "struk.jpg");
      return api<{ id: string }>("/receipts", { method: "POST", body });
    },
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: subscriptionKey });
      router.push(`/receipts/${id}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal mengunggah struk."),
  });

  async function onFile(file: File | undefined) {
    setError(undefined);
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("File harus berupa foto (JPG/PNG).");
    if (file.size > MAX_BYTES) return setError("Foto terlalu besar (maks 10 MB).");
    setPreparing(true);
    try {
      setImage(await compress(file));
    } catch {
      setError("Foto tidak bisa dibaca. Coba foto ulang.");
    } finally {
      setPreparing(false);
    }
  }

  const limit = quota.data?.limit ?? null;
  const quotaLeft = quota.data && limit !== null ? Math.max(0, limit - quota.data.used) : null;

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <header>
        <p className="flex items-center gap-2 font-mono text-xs font-bold text-warning">
          <Receipt className="size-4" /> Baca Struk Otomatis
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Scan Struk Belanja</h1>
        <p className="text-muted-foreground">Foto bon belanja pasar atau grosir. Sistem membaca item & total, kamu tinggal cek lalu simpan.</p>
      </header>

      {quota.data && limit !== null && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Kuota scan bulan ini</span>
            <span className="font-mono font-bold text-primary">
              {quota.data.used} / {limit} scan
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-track" role="meter" aria-label="Kuota scan terpakai" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={Math.min(quota.data.used, limit)}>
            <div className={`h-full rounded-full ${quota.data.used / limit >= 0.8 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(100, (quota.data.used / limit) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Sisa {quotaLeft} scan{quota.data.tier === "FREE" && ". Paket PRO: kuota scan lebih besar"}.
          </p>
        </div>
      )}

      <section aria-label="Foto struk" className="rounded-2xl border-2 border-dashed bg-card p-5 text-center shadow-sm">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- local data: URL preview, next/image can't optimize it
          <img src={image} alt="Pratinjau foto struk" className="mx-auto max-h-96 rounded-xl border object-contain" />
        ) : (
          <div className="py-8">
            <span aria-hidden className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ScanLine className="size-8" />
            </span>
            <p className="mt-4 font-semibold">Pastikan seluruh struk terlihat & tidak buram</p>
            <p className="text-sm text-muted-foreground">Letakkan di permukaan datar dengan cahaya cukup.</p>
          </div>
        )}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className={`${image ? ghostBtn : primaryBtn} h-12 cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-ring`}>
            <Camera className="size-5" /> {image ? "Foto Ulang" : "Buka Kamera"}
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <label className={`${ghostBtn} h-12 cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-ring`}>
            <ImageUp className="size-5" /> Pilih dari Galeri
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </div>
        {preparing && (
          <p role="status" className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Menyiapkan foto…
          </p>
        )}
      </section>

      <FormError message={error} />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {image && (
          <button type="button" onClick={() => setImage(null)} className={ghostBtn}>
            <RotateCcw className="size-4" /> Batal
          </button>
        )}
        <button type="button" disabled={!image || scan.isPending || quotaLeft === 0} onClick={() => image && scan.mutate(image)} className={`${primaryBtn} h-12`}>
          {scan.isPending ? <Loader2 className="size-5 animate-spin motion-reduce:animate-none" /> : <ScanLine className="size-5" />}
          {scan.isPending ? "Mengunggah…" : "Pindai Struk"}
        </button>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Tidak ada struk?{" "}
        <Link href="/transactions" className="rounded font-semibold text-primary hover:underline">
          Catat pengeluaran manual
        </Link>
      </p>
    </main>
  );
}
