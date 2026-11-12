import apiClient from "./api";

/**
 * CAF PDFs are protected on the server, so they are downloaded with the
 * logged-in user's token and then opened from a temporary blob URL.
 */
export async function openCafPdf(cafId: string): Promise<void> {
  // Open the tab first (inside the click) so popup blockers allow it
  const win = window.open("", "_blank");
  try {
    const response = await apiClient.get(`/CAF/forms/${cafId}/file`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(
      new Blob([response.data], { type: "application/pdf" })
    );
    if (win) {
      win.location.href = url;
    } else {
      window.open(url, "_blank");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    win?.close();
    throw err;
  }
}
