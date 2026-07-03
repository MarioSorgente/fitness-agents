import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getFirebaseAdminApp } from "../db/firebaseAdmin";

export type ClientAssetKind = "planImages" | "progressPhotos";

export type ClientAsset = {
  id: string;
  url: string;
  storagePath: string;
  label: string;
  uploadedAt: Date;
};

type UploadClientAssetInput = {
  clientId: string;
  kind: ClientAssetKind;
  file: File;
  label?: string;
};

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const LOCAL_UPLOAD_ROOT =
  process.env.COACHING_LOCAL_UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads");

function shouldUseFirebaseStorage(): boolean {
  return Boolean(
    process.env.COACHING_STORAGE_BACKEND === "firebase" ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      (process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY),
  );
}

export function assertValidClientAssetFile(file: File): void {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Images must be 8 MB or smaller.");
  }
}

function safeExtension(file: File): string {
  const extension = path
    .extname(file.name)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "");
  if (extension) return extension;

  const mimeExtension = file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "");
  return mimeExtension ? `.${mimeExtension}` : ".img";
}

function buildStoragePath(clientId: string, kind: ClientAssetKind, file: File, id: string): string {
  return `clients/${clientId}/${kind}/${id}${safeExtension(file)}`;
}

function assetUrl(clientId: string, assetId: string): string {
  return `/api/admin/clients/${encodeURIComponent(clientId)}/assets/${encodeURIComponent(assetId)}`;
}

async function fileBuffer(file: File): Promise<Buffer> {
  return Buffer.from(await file.arrayBuffer());
}

async function firebaseBucket() {
  const { getStorage } = await import("firebase-admin/storage");
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  return bucketName
    ? getStorage(getFirebaseAdminApp()).bucket(bucketName)
    : getStorage(getFirebaseAdminApp()).bucket();
}

export async function uploadClientAsset(input: UploadClientAssetInput): Promise<ClientAsset> {
  assertValidClientAssetFile(input.file);

  const id = randomUUID();
  const storagePath = buildStoragePath(input.clientId, input.kind, input.file, id);
  const uploadedAt = new Date();

  if (shouldUseFirebaseStorage()) {
    const bucket = await firebaseBucket();
    await bucket.file(storagePath).save(await fileBuffer(input.file), {
      contentType: input.file.type,
      metadata: { metadata: { clientId: input.clientId, kind: input.kind, assetId: id } },
    });
  } else {
    const fullPath = path.join(LOCAL_UPLOAD_ROOT, storagePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, await fileBuffer(input.file));
  }

  return {
    id,
    url: assetUrl(input.clientId, id),
    storagePath,
    label: input.label?.trim() || input.file.name || "Client image",
    uploadedAt,
  };
}

export async function deleteClientAsset(storagePath: string): Promise<void> {
  if (shouldUseFirebaseStorage()) {
    const bucket = await firebaseBucket();
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
    return;
  }

  await rm(path.join(LOCAL_UPLOAD_ROOT, storagePath), { force: true });
}

export async function getClientAssetUrl(clientId: string, assetId: string): Promise<string> {
  return assetUrl(clientId, assetId);
}

export async function readClientAsset(storagePath: string): Promise<Buffer> {
  if (shouldUseFirebaseStorage()) {
    const bucket = await firebaseBucket();
    const [contents] = await bucket.file(storagePath).download();
    return contents;
  }

  return readFile(path.join(LOCAL_UPLOAD_ROOT, storagePath));
}

export function clientAssetContentType(storagePath: string): string {
  const extension = path.extname(storagePath).toLowerCase();
  if ([".jpg", ".jpeg"].includes(extension)) return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}
