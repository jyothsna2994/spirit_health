import { Alert, Platform, Share } from "react-native";

/* react-native-web's Alert is a no-op, so web gets the browser's own dialogs. */

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string,
  onConfirm: () => void
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}

/** Share (native sheet) or download (web) a JSON document, e.g. a FHIR bundle. */
export async function shareJson(filename: string, data: unknown) {
  const text = JSON.stringify(data, null, 2);
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type: "application/fhir+json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }
  await Share.share({ title: filename, message: text });
}
