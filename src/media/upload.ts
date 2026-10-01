import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '@/api/config';
import { getAuthToken } from '@/api/client';
import type { MediaType } from '@/api/social';

/**
 * Pick an image/video from the library and upload it to the backend, which
 * returns a servable URL. Uses multipart/form-data so videos stream up without
 * base64 bloat.
 */

export interface UploadResult {
  url: string;
  mediaType: MediaType;
}

export type PickKind = 'image' | 'media'; // 'media' = images + videos

function contentTypeFor(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const isVideo = asset.type === 'video';
  const ext = asset.uri.split('.').pop()?.toLowerCase();
  if (isVideo) return ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function nameFor(asset: ImagePicker.ImagePickerAsset, contentType: string): string {
  if (asset.fileName) return asset.fileName;
  const ext = contentType.split('/')[1] ?? 'bin';
  return `upload.${ext === 'quicktime' ? 'mov' : ext}`;
}

/** Open the library and let the user pick. Returns null if they cancel or deny. */
export async function pickMedia(
  kind: PickKind = 'media',
  opts: { square?: boolean } = {}
): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes:
      kind === 'image'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.All,
    allowsEditing: !!opts.square,
    aspect: opts.square ? [1, 1] : undefined,
    quality: 0.7,
    videoMaxDuration: 60,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

/** Upload a picked asset via multipart. Throws on network/HTTP error. */
export async function uploadAsset(
  asset: ImagePicker.ImagePickerAsset
): Promise<UploadResult> {
  const contentType = contentTypeFor(asset);
  const name = nameFor(asset, contentType);

  const form = new FormData();
  // React Native's fetch accepts this {uri,name,type} shape for file parts.
  form.append('file', {
    uri: asset.uri,
    name,
    type: contentType,
  } as unknown as Blob);

  const token = getAuthToken();
  const res = await fetch(`${API_URL}/uploads`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.error ?? `Upload failed (HTTP ${res.status})`);
  return { url: data.url as string, mediaType: (data.mediaType ?? 'image') as MediaType };
}

/** Convenience: pick + upload in one call. Returns null if the user cancels. */
export async function pickAndUpload(
  kind: PickKind = 'media',
  opts: { square?: boolean } = {}
): Promise<UploadResult | null> {
  const asset = await pickMedia(kind, opts);
  if (!asset) return null;
  return uploadAsset(asset);
}
