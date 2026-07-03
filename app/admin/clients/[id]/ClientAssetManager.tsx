"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import type { ClientAsset } from "@/lib/coaching/db/coachingRepository";
import type { ClientAssetKind } from "@/lib/coaching/storage/clientAssets";

type ClientAssetManagerProps = {
  clientId: string;
  initialPlanImages: ClientAsset[];
  initialProgressPhotos: ClientAsset[];
};

const MAX_FILE_SIZE_MB = 8;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function normalizeAssets(assets: ClientAsset[]): ClientAsset[] {
  return assets.map((asset) => ({ ...asset, uploadedAt: new Date(asset.uploadedAt) }));
}

export function ClientAssetManager({
  clientId,
  initialPlanImages,
  initialProgressPhotos,
}: ClientAssetManagerProps) {
  const [planImages, setPlanImages] = useState(() => normalizeAssets(initialPlanImages));
  const [progressPhotos, setProgressPhotos] = useState(() =>
    normalizeAssets(initialProgressPhotos),
  );
  const [kind, setKind] = useState<ClientAssetKind>("planImages");
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assets = kind === "planImages" ? planImages : progressPhotos;
  const setAssets = kind === "planImages" ? setPlanImages : setProgressPhotos;

  async function upload(file: File, replaceAssetId?: string) {
    setMessage("");
    if (!file.type.startsWith("image/")) {
      setMessage("Only image files can be uploaded.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setMessage(`Images must be ${MAX_FILE_SIZE_MB} MB or smaller.`);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("kind", kind);
    formData.set("label", label || file.name);
    if (replaceAssetId) formData.set("replaceAssetId", replaceAssetId);

    setIsBusy(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/assets`, {
        method: "POST",
        body: formData,
      });
      const body = (await response.json()) as { assets?: ClientAsset[]; error?: string };
      if (!response.ok || !body.assets) throw new Error(body.error ?? "Upload failed.");
      setAssets(normalizeAssets(body.assets));
      setLabel("");
      setMessage(replaceAssetId ? "Image replaced." : "Image uploaded.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteAsset(assetId: string) {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/clients/${clientId}/assets`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, kind }),
      });
      const body = (await response.json()) as { assets?: ClientAsset[]; error?: string };
      if (!response.ok || !body.assets) throw new Error(body.error ?? "Delete failed.");
      setAssets(normalizeAssets(body.assets));
      setMessage("Image deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setIsBusy(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const [file] = Array.from(event.target.files ?? []);
    if (file) void upload(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const [file] = Array.from(event.dataTransfer.files);
    if (file) void upload(file);
  }

  return (
    <section className="card stack">
      <div className="section-heading">
        <div>
          <h2>Client image assets</h2>
          <p className="muted-copy">
            Upload plan images or progress photos. Images must be {MAX_FILE_SIZE_MB} MB or smaller.
          </p>
        </div>
        <select value={kind} onChange={(event) => setKind(event.target.value as ClientAssetKind)}>
          <option value="planImages">Plan images</option>
          <option value="progressPhotos">Progress photos</option>
        </select>
      </div>

      <label
        className="upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          disabled={isBusy}
        />
        <span>Drag an image here or choose a file</span>
      </label>
      <label>
        Image label
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Meal plan page, week 1 workout, front progress photo..."
        />
      </label>
      {message ? (
        <p
          className={
            message.includes("failed") || message.includes("Only") || message.includes("smaller")
              ? "error-text"
              : "success-text"
          }
        >
          {message}
        </p>
      ) : null}

      <div className="asset-gallery">
        {assets.length ? (
          assets.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <Image src={asset.url} alt={asset.label} width={480} height={360} unoptimized />
              <div className="stack compact-stack">
                <strong>{asset.label}</strong>
                <span className="muted-copy">Uploaded {formatDate(asset.uploadedAt)}</span>
                <div className="button-row">
                  <label className="secondary-link replace-upload">
                    Replace
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isBusy}
                      onChange={(event) => {
                        const [file] = Array.from(event.target.files ?? []);
                        if (file) void upload(file, asset.id);
                      }}
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => void deleteAsset(asset.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))
        ) : (
          <p className="muted-copy">
            No {kind === "planImages" ? "plan images" : "progress photos"} uploaded yet.
          </p>
        )}
      </div>
    </section>
  );
}
