// Replace the old pickerOnce() helper with this multi-select picker.
async function pickerMultiple(){
  const out = await DocumentPicker.open(["public.image"]);
  return Array.isArray(out) ? out : (out ? [out] : []);
}
