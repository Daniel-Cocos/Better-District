import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

// Photos are cropped to the frame they're shown in, so what residents frame is what everyone sees.
// Android crops to this ratio; iOS's cropper is always square, and those photos are letterboxed.
export const PHOTO_ASPECT = 4 / 3;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

/** Take or choose one photo, then let the resident move and crop it before it's used. */
export function usePhotoPicker(onPicked: (photo: ImagePicker.ImagePickerAsset) => void, onError: (message: string) => void) {
  const [picking, setPicking] = useState(false);
  async function pickPhoto(camera: boolean) {
    setPicking(true); onError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        onError('Camera access was declined. You can upload a photo instead.'); return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.75, exif: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) {
        const asset = result.assets[0];
        if ((asset.fileSize ?? 0) > MAX_PHOTO_BYTES) { onError('Choose a photo smaller than 10 MB.'); return; }
        onPicked(asset);
      }
    } catch { onError('Couldn’t open photos. Please try again.'); }
    finally { setPicking(false); }
  }
  return { picking, pickPhoto };
}
