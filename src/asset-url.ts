const configuredAssetCdnBaseUrl = (import.meta.env.VITE_ASSET_CDN_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

export function resolveAssetUrl(assetPath: string, cdnBaseUrl = configuredAssetCdnBaseUrl): string {
  const normalizedCdnBaseUrl = cdnBaseUrl.trim().replace(/\/+$/, "");

  if (normalizedCdnBaseUrl === "") {
    return assetPath;
  }

  return `${normalizedCdnBaseUrl}/${assetPath.replace(/^\/+/, "")}`;
}
