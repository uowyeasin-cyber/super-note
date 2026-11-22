// Photo → note: keeps the photo in the app's own storage, and (with AI) reads the text,
// board, slide or receipt in it and files it like any other note.
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { AREAS, type Area } from './classify';
import { askJson, fileRules, nowLine, type AiCtx } from './brain';

export type Picked = { uri: string; base64: string; mime: string };

export async function pickPhoto(from: 'camera' | 'gallery'): Promise<Picked | null> {
  // The gallery uses Android's photo picker, which needs no permission; only the camera asks.
  if (from === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) return null;
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.45, base64: true, exif: false };
  const r = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return { uri: keep(a.uri), base64: a.base64 ?? '', mime: a.mimeType || 'image/jpeg' };
}

/** Copies the picked photo into the app's documents so it never disappears with the cache. */
function keep(uri: string): string {
  try {
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const ext = (uri.match(/\.(jpe?g|png|webp|heic)$/i)?.[1] ?? 'jpg').toLowerCase();
    const dest = new File(dir, `p${Date.now()}.${ext}`);
    new File(uri).copySync(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export type PhotoNote = { text: string; title: string; area?: Area; topic?: string; important?: boolean };

export async function readPhoto(p: Picked, ctx: AiCtx, lang: 'en' | 'bn', fileNames: string[], context = ''): Promise<PhotoNote | null> {
  if (!p.base64) return null;
  return askJson<PhotoNote>(ctx,
    `This photo was taken for a personal notes app (class board/slide, book page, notice, receipt, handwritten note, document…).
Now is ${nowLine()}.${context ? ` The person is currently in: ${context}.` : ''}
Read everything useful in it. Return JSON only:
{"text": the content as a clean note (keep the original language; Bangla stays Bangla); for receipts include shop, items, total and date,
 "title": short title (max 8 words) in ${lang === 'bn' ? 'Bangla' : 'English'},
 ${fileRules(AREAS, fileNames)}}`,
    { base64: p.base64, mime: p.mime }, 40000);
}
