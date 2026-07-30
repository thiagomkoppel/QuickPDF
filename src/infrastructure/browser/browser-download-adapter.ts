import type { DownloadAdapter, DownloadRequest } from "../../application/editor-application";

export class BrowserDownloadAdapter implements DownloadAdapter {
  public download(request: DownloadRequest): void {
    const bytes = new Uint8Array(request.bytes);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const blob = new Blob([arrayBuffer], { type: request.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = request.filename;
    link.rel = "noopener";
    document.body.append(link);
    try {
      link.click();
    } finally {
      link.remove();
      URL.revokeObjectURL(url);
    }
  }
}
