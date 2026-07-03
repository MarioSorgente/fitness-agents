import { NextResponse } from "next/server";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import type { ClientAssetKind } from "@/lib/coaching/storage/clientAssets";
import { deleteClientAsset, uploadClientAsset } from "@/lib/coaching/storage/clientAssets";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function assetKind(value: FormDataEntryValue | null): ClientAssetKind {
  return value === "progressPhotos" ? "progressPhotos" : "planImages";
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requireAdminPage(`/admin/clients/${id}`);

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose an image file to upload." }, { status: 400 });
    }

    const kind = assetKind(formData.get("kind"));
    const repository = createCoachingRepository();
    const profile = await repository.getClientProfile(id);
    if (!profile) {
      return NextResponse.json({ error: "Client profile not found." }, { status: 404 });
    }

    const replaceAssetId =
      typeof formData.get("replaceAssetId") === "string"
        ? String(formData.get("replaceAssetId"))
        : undefined;
    const currentAssets = profile[kind];
    const replacedAsset = replaceAssetId
      ? currentAssets.find((asset) => asset.id === replaceAssetId)
      : undefined;
    const asset = await uploadClientAsset({
      clientId: id,
      kind,
      file,
      label: typeof formData.get("label") === "string" ? String(formData.get("label")) : undefined,
    });

    if (replacedAsset) {
      await deleteClientAsset(replacedAsset.storagePath);
    }

    const nextAssets = replacedAsset
      ? currentAssets.map((candidate) => (candidate.id === replacedAsset.id ? asset : candidate))
      : [...currentAssets, asset];

    const updated = await repository.updateClientProfile(id, { [kind]: nextAssets });
    return NextResponse.json({ asset, assets: updated[kind] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Asset upload failed." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  await requireAdminPage(`/admin/clients/${id}`);

  try {
    const { assetId, kind = "planImages" } = (await request.json()) as {
      assetId?: string;
      kind?: ClientAssetKind;
    };
    if (!assetId || (kind !== "planImages" && kind !== "progressPhotos")) {
      return NextResponse.json(
        { error: "A valid asset id and type are required." },
        { status: 400 },
      );
    }

    const repository = createCoachingRepository();
    const profile = await repository.getClientProfile(id);
    const asset = profile?.[kind].find((candidate) => candidate.id === assetId);
    if (!profile || !asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    await deleteClientAsset(asset.storagePath);
    const updated = await repository.updateClientProfile(id, {
      [kind]: profile[kind].filter((candidate) => candidate.id !== assetId),
    });

    return NextResponse.json({ assets: updated[kind] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Asset delete failed." },
      { status: 400 },
    );
  }
}
