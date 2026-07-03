import { NextResponse } from "next/server";

import { requireAdminPage } from "@/lib/coaching/auth/adminAuth";
import { createCoachingRepository } from "@/lib/coaching/db/coachingRepositoryFactory";
import { clientAssetContentType, readClientAsset } from "@/lib/coaching/storage/clientAssets";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; assetId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id, assetId } = await context.params;
  await requireAdminPage(`/admin/clients/${id}`);

  const profile = await createCoachingRepository().getClientProfile(id);
  const asset = [...(profile?.planImages ?? []), ...(profile?.progressPhotos ?? [])].find(
    (candidate) => candidate.id === assetId,
  );

  if (!asset) {
    return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  }

  const body = await readClientAsset(asset.storagePath);
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": clientAssetContentType(asset.storagePath),
    },
  });
}
